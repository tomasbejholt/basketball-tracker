from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import asyncio, tempfile, os, cv2, numpy as np, subprocess, uuid, httpx
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
    """Fill short gaps in detections via linear interpolation."""
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
    """Moving average smoothing to reduce jitter."""
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
    raw_positions: list = []
    raw_boxes: list = []
    for frame_idx, result in enumerate(
        model.track(source=input_path, persist=True, conf=conf, verbose=False, stream=True)
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


@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    if job_id not in _progress:
        raise HTTPException(status_code=404, detail="job not found")
    return _progress[job_id]


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
    avi_path   = os.path.join(tmp, f"bt_out_{uid}.avi")
    mp4_path   = os.path.join(tmp, f"bt_out_{uid}.mp4")

    with open(input_path, "wb") as f:
        f.write(await video.read())

    # Transcode to H.264 so OpenCV can decode any codec (AV1, HEVC, MOV…)
    await asyncio.to_thread(lambda: subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-vcodec", "libx264", "-pix_fmt", "yuv420p", "-an", conv_path],
        check=True, capture_output=True,
    ))
    _remove(input_path)

    cap = cv2.VideoCapture(conv_path)
    fps          = cap.get(cv2.CAP_PROP_FPS) or 30
    w            = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h            = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    cap.release()

    if job_id:
        _progress[job_id] = {"frame": 0, "total": total_frames, "phase": "inference"}

    base_bgr = hex_to_bgr(trail_color)

    raw_positions, raw_boxes = await asyncio.to_thread(
        _run_inference, model, conv_path, conf, job_id
    )

    if hasattr(model, "predictor") and model.predictor is not None:
        model.predictor = None

    if job_id and job_id in _progress:
        _progress[job_id]["frame"] = total_frames
        _progress[job_id]["phase"] = "rendering"

    positions = _interpolate(raw_positions, max_gap=max(1, int(fps / 2)))
    positions = _smooth(positions, window=5)

    def _render_and_encode():
        cap = cv2.VideoCapture(conv_path)
        out = cv2.VideoWriter(avi_path, cv2.VideoWriter_fourcc(*"XVID"), fps, (w, h))
        trail: deque = deque(maxlen=trail_length)

        for frame_idx, pos in enumerate(positions):
            ret, frame = cap.read()
            if not ret:
                break

            trail.append(pos)
            box = raw_boxes[frame_idx] if frame_idx < len(raw_boxes) else None

            if box is not None:
                x1, y1, x2, y2, c = box
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                radius = max((x2 - x1), (y2 - y1)) // 2
                cv2.circle(frame, (cx, cy), radius, base_bgr, 2)
                cv2.putText(frame, f"{c:.2f}", (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, base_bgr, 2)

            neon = np.zeros_like(frame)
            core = np.zeros_like(frame)
            bright_bgr = tuple(min(255, int(c * 0.5 + 200)) for c in base_bgr)

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

            out.write(frame)

        cap.release()
        out.release()
        subprocess.run(
            ["ffmpeg", "-y", "-i", avi_path, "-vcodec", "libx264", "-pix_fmt", "yuv420p", mp4_path],
            check=True, capture_output=True,
        )

    await asyncio.to_thread(_render_and_encode)

    if job_id and job_id in _progress:
        del _progress[job_id]

    background_tasks.add_task(_remove, conv_path)
    background_tasks.add_task(_remove, avi_path)
    background_tasks.add_task(_remove, mp4_path)

    return FileResponse(mp4_path, media_type="video/mp4", filename="basketball_tracked.mp4")


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
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.85},
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
