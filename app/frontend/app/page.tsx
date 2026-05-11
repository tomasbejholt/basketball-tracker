"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const TRAIL_COLORS = [
  { name: "neon green",       hex: "#00FF88", label: "Neon Green" },
{ name: "hot pink",         hex: "#FF00FF", label: "Hot Pink" },
  { name: "laser orange",     hex: "#FF8800", label: "Laser Orange" },
  { name: "purple lightning", hex: "#8800FF", label: "Purple Lightning" },
];

export default function TrackerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [conf, setConf] = useState(0.3);
  const [trailLen, setTrailLen] = useState(30);
  const [selectedColor, setSelectedColor] = useState(TRAIL_COLORS[0]);
  const [hasPickedColor, setHasPickedColor] = useState(false);
  const [showColorModal, setShowColorModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [inferenceProgress, setInferenceProgress] = useState<{ frame: number; total: number; phase: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [commentaryUrl, setCommentaryUrl] = useState<string | null>(null);
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const crowdRef = useRef<HTMLAudioElement>(null);
  const isVideoPlaying = useRef(false);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Please upload a video file (MP4, MOV, AVI).");
      return;
    }
    setFile(f);
    setResultUrl(null);
    setCommentaryUrl(null);
    setIsPlaying(false);
    setVideoEnded(false);
    setError(null);
  };

  // Load preset video from library (?video=/video_1.mp4)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const videoSrc = params.get("video");
    if (!videoSrc) return;
    window.history.replaceState({}, "", "/");
    fetch(videoSrc)
      .then((r) => r.blob())
      .then((blob) => {
        const name = videoSrc.split("/").pop() || "video.mp4";
        pickFile(new File([blob], name, { type: blob.type || "video/mp4" }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }, []);

  const fetchCommentary = async (colorName: string) => {
    setIsCommentaryLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/commentary?color_name=${encodeURIComponent(colorName)}&name=${encodeURIComponent(userName.trim() || "friend")}`
      );
      if (res.ok) {
        const blob = await res.blob();
        setCommentaryUrl(URL.createObjectURL(blob));
      }
    } catch {
      // commentary is optional — fail silently
    } finally {
      setIsCommentaryLoading(false);
    }
  };

  useEffect(() => {
    if (commentaryUrl && isVideoPlaying.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [commentaryUrl]);

  const track = async () => {
    if (!file) return;
    setShowColorModal(true);
  };

  const startTracking = async () => {
    if (!file) return;
    setShowColorModal(false);
    setHasPickedColor(true);
    setProcessing(true);
    setError(null);
    setResultUrl(null);
    setCommentaryUrl(null);
    setInferenceProgress(null);

    const jobId = crypto.randomUUID();
    jobIdRef.current = jobId;

    const fd = new FormData();
    fd.append("video", file);
    fd.append("conf", conf.toFixed(2));
    fd.append("trail_length", String(trailLen));
    fd.append("trail_color", selectedColor.hex);
    fd.append("job_id", jobId);

    try {
      const submitRes = await fetch(`${API_URL}/track`, { method: "POST", body: fd });
      if (!submitRes.ok) {
        const text = await submitRes.text();
        throw new Error(`Server error ${submitRes.status}: ${text}`);
      }

      await new Promise<void>((resolve, reject) => {
        let misses = 0;
        pollRef.current = setInterval(async () => {
          try {
            const res = await fetch(`${API_URL}/progress/${jobId}`);
            if (!res.ok) {
              if (++misses >= 6) {
                clearInterval(pollRef.current!);
                pollRef.current = null;
                reject(new Error("Server restarted during processing. Please try again."));
              }
              return;
            }
            misses = 0;
            const data = await res.json();
            setInferenceProgress(data);
            if (data.status === "done") {
              clearInterval(pollRef.current!);
              pollRef.current = null;
              resolve();
            } else if (data.status === "error") {
              clearInterval(pollRef.current!);
              pollRef.current = null;
              reject(new Error(data.error || "Processing failed"));
            }
          } catch {
            // polling is best-effort
          }
        }, 500);
      });

      const res = await fetch(`${API_URL}/result/${jobId}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      fetchCommentary(selectedColor.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setProcessing(false);
      setInferenceProgress(null);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current || isCommentaryLoading) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleVideoPlay = () => {
    isVideoPlaying.current = true;
    setIsPlaying(true);
    setVideoEnded(false);
    if (crowdRef.current) {
      crowdRef.current.volume = 0.12;
      crowdRef.current.currentTime = 0;
      crowdRef.current.play().catch(() => {});
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleVideoPause = () => {
    if (videoRef.current?.ended) return;
    isVideoPlaying.current = false;
    setIsPlaying(false);
    crowdRef.current?.pause();
    audioRef.current?.pause();
  };

  const handleVideoEnded = () => {
    isVideoPlaying.current = false;
    setIsPlaying(false);
    setVideoEnded(true);
    // wait for commentary to finish before stopping crowd
    const commentaryDone = !audioRef.current || audioRef.current.paused || audioRef.current.ended;
    if (commentaryDone) crowdRef.current?.pause();
  };

  const handleCommentaryEnded = () => {
    // stop crowd only if video is already done
    if (videoRef.current?.ended) crowdRef.current?.pause();
  };

  return (
    <>
    <div
      className="min-h-screen relative"
      style={{ backgroundImage: "url(/court_1.webp)", backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed" }}
    >
      <div className="absolute inset-0 bg-black/75 pointer-events-none" />
      {/* Ball image — fixed left accent */}
      <div
        className="fixed top-0 bottom-0 pointer-events-none"
        style={{
          left: "-12%",
          width: "30%",
          zIndex: 1,
          maskImage: "linear-gradient(to right, black 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 40%, transparent 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: "center bottom" }} />
      </div>
      {/* Ball image — fixed right accent (mirrored) */}
      <div
        className="fixed top-0 bottom-0 pointer-events-none"
        style={{
          right: "-12%",
          width: "30%",
          zIndex: 1,
          maskImage: "linear-gradient(to left, black 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to left, black 40%, transparent 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: "left bottom" }} />
      </div>
    {showColorModal && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-6">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm">
          <h2 className="text-white font-bold text-xl mb-2">Pick a trail color</h2>
          <p className="text-gray-400 text-sm mb-4">The commentator wants to know who's watching.</p>
          <input
            type="text"
            placeholder="Your name…"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && userName.trim()) startTracking(); }}
            maxLength={32}
            className="w-full bg-gray-800 border border-gray-700 focus:border-orange-500/60 focus:outline-none rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm mb-6 transition-colors"
          />
          <div className="flex gap-4 justify-center mb-8">
            {TRAIL_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setSelectedColor(c)}
                title={c.label}
                className={`w-10 h-10 rounded-full transition-all duration-150 ${
                  selectedColor.hex === c.hex
                    ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110"
                    : "hover:scale-105 opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
          <p className="text-center text-orange-400 font-mono text-sm mb-6">{selectedColor.label}</p>
          <button
            onClick={startTracking}
            disabled={!userName.trim()}
            className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
          >
            {userName.trim() ? "Confirm & Track" : "Enter your name first"}
          </button>
        </div>
      </div>
    )}
    <main className="relative z-10 max-w-4xl mx-auto px-6 py-14">
      {/* Hero */}
      <div className="text-center mb-14">
        <p className="text-orange-400 text-sm font-medium tracking-widest uppercase mb-3">
          YOLOv8 · Fine-tuned
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight">
          Track the{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
            Ball
          </span>
        </h1>
        <p className="text-gray-400 text-lg mt-4 max-w-xl mx-auto">
          Upload a basketball video and watch AI track the ball frame by frame
          with a glowing neon motion trail.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-orange-400 bg-orange-500/10 scale-[1.01]"
            : file
            ? "border-orange-500/50 bg-orange-500/5"
            : "border-gray-700 hover:border-orange-500/40 bg-gray-900/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <div className="text-5xl mb-4">{file ? "✅" : "🎬"}</div>
        <div className="text-white font-semibold text-lg">
          {file ? file.name : "Drop your video here"}
        </div>
        <div className="text-gray-500 text-sm mt-2">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Click to change`
            : "or click to browse — MP4 and MOV supported · AV1/WebM not supported"}
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/70 text-sm font-medium transition-all"
        >
          🎬 Choose from video library
        </Link>
      </div>

      {/* Sliders */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SliderCard
          label="Confidence threshold"
          value={conf}
          min={0.1}
          max={0.9}
          step={0.05}
          display={conf.toFixed(2)}
          onChange={setConf}
          hint="Low = catch more balls · High = fewer false positives"
        />
        <SliderCard
          label="Trail length"
          value={trailLen}
          min={5}
          max={60}
          step={1}
          display={`${trailLen} frames`}
          onChange={setTrailLen}
          hint="How many frames the neon trail covers"
        />
      </div>

      {/* Track button */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={track}
          disabled={!file || processing}
          className="px-12 py-4 bg-orange-500 hover:bg-orange-400 active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-orange-500/20 disabled:shadow-none"
        >
          {processing ? "Processing…" : "Track Ball 🏀"}
        </button>
      </div>

      {/* Loading state */}
      {processing && (
        <div className="mt-8">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-white text-sm font-medium">
                {inferenceProgress?.phase === "rendering" ? "Rendering…" : "Running YOLOv8 inference…"}
              </span>
              {inferenceProgress && inferenceProgress.total > 0 && inferenceProgress.phase === "inference" && (
                <span className="text-gray-500 text-xs font-mono">
                  {inferenceProgress.frame} / {inferenceProgress.total} frames
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              {inferenceProgress && inferenceProgress.total > 0 && inferenceProgress.phase === "inference" ? (
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((inferenceProgress.frame / inferenceProgress.total) * 100)}%` }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div className="mt-12">
          <h2 className="text-white font-semibold text-xl mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-orange-400 rounded-full inline-block" />
            Result
          </h2>
          {isCommentaryLoading && (
            <p className="text-gray-500 text-xs mb-3">Loading commentary...</p>
          )}
          {commentaryUrl && !isCommentaryLoading && (
            <p className="text-gray-500 text-xs mb-3">
              Press play — the commentator will kick in automatically.
            </p>
          )}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-orange-500/20 shadow-2xl shadow-orange-500/10">
            <video
              ref={videoRef}
              controls
              src={resultUrl}
              className="w-full max-h-[480px] object-contain"
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onEnded={handleVideoEnded}
            />
            {videoEnded && (
              <div className="absolute inset-0 bg-black/90 pointer-events-none" />
            )}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: "40px" }}>
                <button
                  onClick={handleTogglePlay}
                  disabled={isCommentaryLoading}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all pointer-events-auto ${
                    isCommentaryLoading
                      ? "bg-gray-700/80 cursor-not-allowed"
                      : "bg-white/25 hover:bg-white/40 cursor-pointer"
                  }`}
                >
                  {isCommentaryLoading ? (
                    <div className="w-7 h-7 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
          {commentaryUrl && (
            <audio ref={audioRef} src={commentaryUrl} preload="auto" onEnded={handleCommentaryEnded} />
          )}
          <audio ref={crowdRef} src="/crowd.wav" loop preload="auto" />
          <div className="mt-4 flex justify-end">
            <a
              href={resultUrl}
              download="basketball_tracked.mp4"
              className="px-6 py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 font-medium rounded-xl transition-colors text-sm"
            >
              Download MP4 ↓
            </a>
          </div>
        </div>
      )}
    </main>
    </div>
    </>
  );
}

function SliderCard({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-white font-medium text-sm">{label}</span>
        <span className="text-orange-400 font-mono text-sm">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
      <p className="text-gray-600 text-xs mt-2">{hint}</p>
    </div>
  );
}
