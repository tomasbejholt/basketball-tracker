from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import tempfile, os, cv2, numpy as np, subprocess, uuid, httpx
from collections import deque
from ultralytics import YOLO
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Basketball Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")


@app.on_event("startup")
def cleanup_temp():
    import glob
    for f in glob.glob(os.path.join(tempfile.gettempdir(), "bt_*")):
        try:
            os.unlink(f)
        except OSError:
            pass


_model: YOLO | None = None
_progress: dict[str, dict] = {}

ELEVENLABS_VOICE_ID = "DelQBHELqW1MekW91R0S"

COMMENTARY_SCRIPTS: dict[str, str] = {
    "neon green": (
        "And THERE it is — neon green, cutting through the frame like a laser. {name}'s pick. "
        "Built by Tomas... and his good friend Claude Code. "
        "This model is trained on YOLO version eight nano... "
        "eighty point three percent accuracy. "
        "Byte Track — locked on, every single frame. "
        "DAMN — that's a good one."
    ),
    "hot pink": (
        "And THERE it is — hot pink, loud, bold, impossible to miss. {name} made a statement. "
        "Built by Tomas... and his good friend Claude Code. "
        "This model is trained on YOLO version eight nano... "
        "eighty point three percent accuracy. "
        "Byte Track — relentless. Never stops. "
        "What a damn good one."
    ),
    "laser orange": (
        "And THERE it is — laser orange, burning a path across every frame. {name} knew. "
        "Built by Tomas... and his good friend Claude Code. "
        "This model is trained on YOLO version eight nano... "
        "eighty point three percent accuracy. "
        "Byte Track — on fire from frame one. "
        "DAMN good, folks."
    ),
    "purple lightning": (
        "And THERE it is — purple lightning, royal authority, every frame. Good eye, {name}. "
        "Built by Tomas... and his good friend Claude Code. "
        "This model is trained on YOLO version eight nano... "
        "eighty point three percent accuracy. "
        "Byte Track — majestic, unstoppable. "
        "Ladies and gentlemen... DAMN."
    ),
    "default": (
        "And THERE it is — blazing across the screen, frame by frame. Nice pick, {name}. "
        "Built by Tomas... and his good friend Claude Code. "
        "This model is trained on YOLO version eight nano... "
        "eighty point three percent accuracy. "
        "Byte Track — never loses it, never blinks. "
        "And DAMN — that's a good one."
    ),
}


def get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(MODEL_PATH)
    return _model


def hex_to_bgr(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


def _remove(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


def _interpolate(positions: list, max_gap: int = 15) -> list:
    result = list(positions)
    n = len(result)
    i = 0
    while i < n:
        if result[i] is not None:
            i += 1
            continue
        prev = i - 1
        j = i
        while j < n and result[j] is None:
            j += 1
        gap = j - i
        if gap <= max_gap and prev >= 0 and j < n:
            x0, y0 = result[prev]
            x1, y1 = result[j]
            span = j - prev
            for k in range(i, j):
                t = (k - prev) / span
                result[k] = (int(x0 + t * (x1 - x0)), int(y0 + t * (y1 - y0)))
        i = j if j > i else i + 1
    return result


def _smooth(positions: list, window: int = 5) -> list:
    result = list(positions)
    half = window // 2
    n = len(result)
    for i in range(n):
        if result[i] is None:
            continue
        pts = [result[j] for j in range(max(0, i - half), min(n, i + half + 1)) if result[j] is not None]
        if pts:
            result[i] = (int(sum(p[0] for p in pts) / len(pts)), int(sum(p[1] for p in pts) / len(pts)))
    return result


def _run_inference(model: YOLO, input_path: str, conf: float, job_id: str) -> tuple[list, list]:
    import torch
    raw_positions: list = []
    raw_boxes: list = []
    with torch.no_grad():
        for frame_idx, result in enumerate(
            model.track(source=input_path, persist=True, conf=conf, verbose=False, stream=True, imgsz=640)
        ):
            if job_id and job_id in _progress:
                _progress[job_id]["frame"] = frame_idx
            boxes = result.boxes
            if boxes is not None and len(boxes) > 0:
                best = boxes[boxes.conf.argmax()]
                x1, y1, x2, y2 = best.xyxy[0].cpu().numpy().astype(int)
                raw_positions.append(((x1 + x2) // 2, (y1 + y2) // 2))
                raw_boxes.append((x1, y1, x2, y2, float(best.conf)))
            else:
                raw_positions.append(None)
                raw_boxes.append(None)
    return raw_positions, raw_boxes


def _process_video(
    model: YOLO,
    job_id: str,
    input_path: str,
    conv_path: str,
    mp4_path: str,
    conf: float,
    trail_length: int,
    trail_color: str,
) -> None:
    working_path = input_path
    try:
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", input_path, "-vcodec", "libx264", "-pix_fmt", "yuv420p", conv_path],
                check=True, capture_output=True,
            )
            _remove(input_path)
            working_path = conv_path
        except Exception:
            _remove(conv_path)

        cap = cv2.VideoCapture(working_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        cap.release()

        if total_frames == 0:
            r = subprocess.run(
                ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
                 "-show_entries", "stream=nb_frames",
                 "-of", "default=noprint_wrappers=1:nokey=1", working_path],
                capture_output=True, text=True,
            )
            try:
                total_frames = int(r.stdout.strip())
            except (ValueError, TypeError):
                pass

        if w == 0 or h == 0:
            raise RuntimeError("Could not decode video. Please use MP4 (H.264) format.")

        if job_id and job_id in _progress:
            _progress[job_id].update({"total": total_frames, "phase": "inference"})

        base_bgr = hex_to_bgr(trail_color)

        # Scale down for inference to reduce memory usage; render at original resolution
        scale = 1.0
        inference_path = working_path
        scaled_path = os.path.join(tempfile.gettempdir(), f"bt_scaled_{os.path.basename(mp4_path)}")
        if w > 640:
            scale = 640.0 / w
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", working_path, "-vf", "scale=640:-2", "-vcodec", "libx264", "-pix_fmt", "yuv420p", scaled_path],
                    check=True, capture_output=True,
                )
                inference_path = scaled_path
            except Exception:
                _remove(scaled_path)
                scale = 1.0

        raw_positions, raw_boxes = _run_inference(model, inference_path, conf, job_id)

        if inference_path != working_path:
            _remove(inference_path)

        if scale != 1.0:
            raw_positions = [(int(x / scale), int(y / scale)) if p is not None else None for p, x, y in
                             [(p, p[0], p[1]) if p is not None else (None, 0, 0) for p in raw_positions]]
            raw_boxes = [(int(b[0]/scale), int(b[1]/scale), int(b[2]/scale), int(b[3]/scale), b[4])
                         if b is not None else None for b in raw_boxes]

        if hasattr(model, "predictor") and model.predictor is not None:
            model.predictor = None
        import gc; gc.collect()

        if job_id and job_id in _progress:
            _progress[job_id]["frame"] = total_frames
            _progress[job_id]["phase"] = "rendering"

        positions = _interpolate(raw_positions, max_gap=max(1, int(fps / 2)))
        positions = _smooth(positions, window=5)

        proc = subprocess.Popen(
            [
                "ffmpeg", "-y",
                "-f", "rawvideo", "-vcodec", "rawvideo",
                "-s", f"{w}x{h}", "-pix_fmt", "bgr24", "-r", str(int(fps)),
                "-i", "pipe:0",
                "-vcodec", "libx264", "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p", mp4_path,
            ],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        cap = cv2.VideoCapture(working_path)
        trail: deque = deque(maxlen=trail_length)
        try:
            for frame_idx, pos in enumerate(positions):
                ret, frame = cap.read()
                if not ret:
                    break
                trail.append(pos)
                box = raw_boxes[frame_idx] if frame_idx < len(raw_boxes) else None
                if box is not None:
                    x1, y1, x2, y2, conf_val = box
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                    radius = max((x2 - x1), (y2 - y1)) // 2
                    cv2.circle(frame, (cx, cy), radius, base_bgr, 2)
                    cv2.putText(frame, f"{conf_val:.2f}", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, base_bgr, 2)
                neon = np.zeros_like(frame)
                core = np.zeros_like(frame)
                bright_bgr = tuple(min(255, int(ch * 0.5 + 200)) for ch in base_bgr)
                valid = [(p, i) for i, p in enumerate(trail) if p is not None]
                for idx in range(len(valid) - 1):
                    pos_a, i = valid[idx]
                    pos_b, _ = valid[idx + 1]
                    alpha = (i + 1) / trail_length
                    cv2.line(neon, pos_a, pos_b, base_bgr, max(2, int(alpha * 8)))
                    cv2.line(core, pos_a, pos_b, bright_bgr, max(1, int(alpha * 3)))
                if valid:
                    glow = cv2.GaussianBlur(neon, (21, 21), 0)
                    frame = cv2.addWeighted(frame, 1.0, glow, 1.2, 0)
                    frame = cv2.addWeighted(frame, 1.0, neon, 1.0, 0)
                    frame = cv2.addWeighted(frame, 1.0, core, 1.0, 0)
                    frame = np.clip(frame, 0, 255).astype(np.uint8)
                    del neon, core, glow
                proc.stdin.write(frame.tobytes())
                del frame
        finally:
            cap.release()
            proc.stdin.close()
            proc.wait()

        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg pipe encoding failed with exit code {proc.returncode}")

        _remove(working_path)

        if job_id and job_id in _progress:
            _progress[job_id]["status"] = "done"
            _progress[job_id]["result_path"] = mp4_path

    except Exception as e:
        _remove(working_path)
        _remove(mp4_path)
        if job_id and job_id in _progress:
            _progress[job_id]["status"] = "error"
            _progress[job_id]["error"] = str(e)


@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    if job_id not in _progress:
        raise HTTPException(status_code=404, detail="job not found")
    return _progress[job_id]


@app.get("/result/{job_id}")
def get_result(job_id: str, background_tasks: BackgroundTasks):
    if job_id not in _progress:
        raise HTTPException(status_code=404, detail="job not found")
    job = _progress[job_id]
    if job.get("status") != "done":
        raise HTTPException(status_code=202, detail="not ready")
    mp4_path = job.get("result_path")
    if not mp4_path or not os.path.exists(mp4_path):
        raise HTTPException(status_code=404, detail="result file missing")
    del _progress[job_id]
    background_tasks.add_task(_remove, mp4_path)
    return FileResponse(mp4_path, media_type="video/mp4", filename="basketball_tracked.mp4")


@app.post("/track")
async def track(
    background_tasks: BackgroundTasks,
    video: UploadFile,
    conf: float = Form(0.3),
    trail_length: int = Form(30),
    trail_color: str = Form("#00FF88"),
    job_id: str = Form(""),
):
    model = get_model()
    uid = uuid.uuid4().hex
    suffix = os.path.splitext(video.filename or "video.mp4")[1] or ".mp4"
    tmp = tempfile.gettempdir()

    input_path = os.path.join(tmp, f"bt_in_{uid}{suffix}")
    conv_path  = os.path.join(tmp, f"bt_conv_{uid}.mp4")
    mp4_path   = os.path.join(tmp, f"bt_out_{uid}.mp4")

    with open(input_path, "wb") as f:
        f.write(await video.read())

    if job_id:
        _progress[job_id] = {"frame": 0, "total": 0, "phase": "queued", "status": "processing"}

    background_tasks.add_task(
        _process_video,
        model, job_id, input_path, conv_path, mp4_path, conf, trail_length, trail_color,
    )

    return {"status": "accepted", "job_id": job_id}


@app.get("/commentary")
async def commentary(color_name: str = Query("neon green"), name: str = Query("friend")):
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="ELEVENLABS_API_KEY not configured")

    script = COMMENTARY_SCRIPTS.get(color_name.lower(), COMMENTARY_SCRIPTS["default"])
    script = script.format(name=name.strip() or "friend")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={
                "text": script,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.4, "similarity_boost": 0.85},
            },
            timeout=30.0,
        )

    if resp.status_code != 200:
        print(f"ElevenLabs error {resp.status_code}: {resp.text}")
        raise HTTPException(status_code=502, detail=f"ElevenLabs error {resp.status_code}: {resp.text}")

    return Response(content=resp.content, media_type="audio/mpeg")


@app.get("/health")
def health():
    return {"status": "ok"}
