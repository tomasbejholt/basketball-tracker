"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const VIDEOS = [
  { label: "Game Clip 1", src: "/video_1.webm" },
  { label: "Game Clip 2", src: "/video_2.mp4" },
  { label: "Game Clip 3", src: "/video_3.mp4" },
];

export default function LibraryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const useVideo = async (src: string) => {
    setLoading(src);
    router.push(`/?video=${encodeURIComponent(src)}`);
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url(/court_1.webp)",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-black/75 pointer-events-none" />

      {/* Ball accents */}
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

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <p className="text-orange-400 text-sm font-medium tracking-widest uppercase mb-3">
            Example clips
          </p>
          <h1 className="text-5xl font-bold text-white">Video Library</h1>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            Pick a clip and the AI will track the ball automatically. No upload needed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {VIDEOS.map((v) => (
            <div
              key={v.src}
              className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden group hover:border-orange-500/40 transition-all duration-200"
            >
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                <video
                  src={v.src}
                  className="w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </div>
              <div className="p-4">
                <p className="text-white font-medium mb-3">{v.label}</p>
                <button
                  onClick={() => useVideo(v.src)}
                  disabled={loading === v.src}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  {loading === v.src ? "Loading…" : "Use this video →"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
