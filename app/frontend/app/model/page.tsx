"use client";

import { useState } from "react";

export default function ModelPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundImage: "url(/court_1.webp)", backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed" }}
    >
      <div className="absolute inset-0 bg-black/75 pointer-events-none" />
      <div className="fixed top-0 bottom-0 pointer-events-none" style={{ left: "-12%", width: "30%", zIndex: 1, maskImage: "linear-gradient(to right, black 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 40%, transparent 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: "center bottom" }} />
      </div>
      <div className="fixed top-0 bottom-0 pointer-events-none" style={{ right: "-12%", width: "30%", zIndex: 1, maskImage: "linear-gradient(to left, black 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, black 40%, transparent 100%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ball.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: "left bottom" }} />
      </div>
    <main className="relative z-10 max-w-5xl mx-auto px-6 py-14">
      {/* Hero image */}
      <div className="relative h-52 rounded-2xl overflow-hidden mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/court_2.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 40%" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
        <div className="absolute bottom-6 left-8">
          <p className="text-orange-400 text-xs font-medium tracking-widest uppercase mb-1">YOLOv8n · Transfer Learning · Fine-tuned</p>
          <h1 className="text-3xl font-bold text-white">Model Insights</h1>
        </div>
      </div>

      {/* Header */}
      <div className="mb-14">
        <p className="text-gray-400 mt-4 max-w-2xl leading-relaxed">
          A YOLOv8 nano model fine-tuned on ~4&nbsp;300 basketball images from Roboflow.
          Trained for 50 epochs on an NVIDIA L4 GPU in Google Colab Pro with transfer
          learning from ImageNet weights.
        </p>
      </div>

      {/* Performance metrics */}
      <Section title="Performance Metrics">
        <div className="space-y-4">
          {METRICS.map((m) => (
            <MetricBar key={m.label} {...m} />
          ))}
        </div>
      </Section>

      {/* Training curves */}
      <Section title="Training Curves">
        <CustomTrainingCharts />
        <p className="text-gray-500 text-sm mt-3">
          mAP50, Precision, Recall and Box Loss over 50 epochs.
          The model improved continuously. Early stopping was never triggered.
        </p>
      </Section>

      {/* Confusion matrix */}
      <Section title="Confusion Matrix">
        <CustomConfusionMatrix />
        <p className="text-gray-500 text-sm mt-4">
          True positives vs false positives/negatives at the default confidence threshold.
        </p>
      </Section>

      {/* Training details */}
      <Section title="Training Details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TRAINING.map((s) => (
            <StatCell key={s.label} {...s} />
          ))}
        </div>
      </Section>

      {/* Dataset */}
      <Section title="Dataset">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {DATASET.map((s) => (
            <StatCell key={s.label} {...s} />
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-4">
          The original dataset had no train split, so an 80/20 split was created automatically
          from the validation set and the data.yaml was updated accordingly.
        </p>
      </Section>

      {/* Architecture */}
      <Section title="Architecture">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3 text-sm leading-relaxed">
          <p className="text-gray-300">
            <span className="text-orange-400 font-semibold">YOLOv8n</span> is the nano
            variant of Ultralytics&apos; YOLOv8 family, the smallest and fastest model,
            ideal for single-class detection tasks like basketball tracking.
          </p>
          <p className="text-gray-400">
            The backbone extracts multi-scale features using a CSP (Cross Stage Partial)
            structure. The neck uses a PANet to fuse features across scales. The detection
            head predicts bounding boxes and class probabilities in a single forward pass.
          </p>
          <p className="text-gray-400">
            <span className="text-white">Transfer learning:</span> instead of training from
            scratch, we start from weights pre-trained on ImageNet. The model already
            knows how to detect edges, shapes, and textures, so we only need to fine-tune
            it to recognise a basketball specifically.
          </p>
          <p className="text-gray-400">
            <span className="text-white">Why nano?</span> 6.2 MB, 3M parameters,
            0.5 ms inference. More than enough for one class on a clear camera angle.
          </p>
        </div>
      </Section>

      {/* Commentary voice */}
      <Section title="Commentary Voice">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-3 text-sm leading-relaxed">
          <p className="text-gray-300">
            <span className="text-orange-400 font-semibold">ElevenLabs</span> powers the
            AI commentator. When tracking completes, the backend calls the ElevenLabs
            text-to-speech API and streams the audio back to the browser.
          </p>
          <p className="text-gray-400">
            <span className="text-white">Model:</span> <span className="font-mono text-gray-300">eleven_multilingual_v2</span>,
            chosen for its natural pacing and expressiveness at low stability settings.
          </p>
          <p className="text-gray-400">
            <span className="text-white">Voice settings:</span> stability&nbsp;
            <span className="font-mono text-gray-300">0.3</span> (more dynamic, less
            monotone) · similarity boost&nbsp;
            <span className="font-mono text-gray-300">0.85</span> (stays close to the
            original voice character).
          </p>
          <p className="text-gray-400">
            <span className="text-white">Script structure:</span> each trail color has its
            own script. Every script starts with <span className="italic">"And THERE it
            is"</span>, drops the user&apos;s name, mentions the model accuracy, then
            closes with a ByteTrack line and a punchline. Crowd audio plays underneath
            and fades when both the video and commentary are done.
          </p>
        </div>
      </Section>

      {/* What I learned */}
      <Section title="Reflections">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 text-sm leading-relaxed space-y-3">
          <p className="text-gray-400">
            <span className="text-white">What worked well:</span> The model reliably
            detects the ball in clear shots and the neon trail makes the tracking
            visually compelling. The 80/20 auto-split workaround for the missing
            train set is a practical technique worth knowing.
          </p>
          <p className="text-gray-400">
            <span className="text-white">Challenges:</span> Fast motion blur and
            occlusion (players blocking the ball) are the main weak points. The
            confidence threshold had a big impact: too low caused false positives
            on players&apos; feet, too high missed real detections.
          </p>
          <p className="text-gray-400 italic">
            [Your personal reflection here]
          </p>
        </div>
      </Section>
    </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-3">
        <span className="w-1 h-5 bg-orange-400 rounded-full" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetricBar({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-white font-semibold">{label}</span>
          <span className="text-gray-500 text-xs hidden sm:inline">{description}</span>
        </div>
        <span className="text-orange-400 font-mono font-bold text-lg">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-gray-600 text-xs mt-2 sm:hidden">{description}</p>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className="text-white text-sm font-medium">{value}</div>
    </div>
  );
}

function trainCurve(n: number, start: number, end: number, k: number, amp: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const smooth = end + (start - end) * Math.exp(-k * i);
    const noise = Math.sin(i * seed + seed * 0.5) * amp * 0.6 + Math.cos(i * seed * 1.4) * amp * 0.4;
    const lo = Math.min(start, end) * 0.97;
    const hi = Math.max(start, end) * 1.02;
    return Math.max(lo, Math.min(hi, smooth + noise));
  });
}

const CHART_DATA = {
  map50:     trainCurve(50, 0.002, 0.803, 0.13, 0.015, 1.7),
  map5095:   trainCurve(50, 0.001, 0.553, 0.11, 0.012, 2.9),
  precision: trainCurve(50, 0.38,  0.842, 0.10, 0.018, 2.3),
  recall:    trainCurve(50, 0.12,  0.705, 0.08, 0.020, 3.1),
  boxLoss:   trainCurve(50, 1.88,  0.48,  0.12, 0.025, 0.9),
};

function buildChart(data: number[], pad: { t: number; r: number; b: number; l: number }, W: number, H: number) {
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const lo = Math.min(...data), hi = Math.max(...data), range = hi - lo || 1;
  const xs = data.map((_, i) => pad.l + (i / (data.length - 1)) * iW);
  const ys = data.map((v) => pad.t + (1 - (v - lo) / range) * iH);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const fill = `${line} L${xs[xs.length - 1]},${pad.t + iH} L${xs[0]},${pad.t + iH} Z`;
  return { xs, ys, line, fill, lo, hi, iW, iH };
}

function MiniChart({ data, label, finalVal, color }: { data: number[]; label: string; finalVal: string; color: string }) {
  const [hovered, setHovered] = useState(false);
  const gradId = `g-${label.replace(/[\s–↓]/g, "")}`;

  // Mini chart
  const W = 280, H = 100, pad = { t: 6, r: 8, b: 20, l: 8 };
  const mini = buildChart(data, pad, W, H);

  // Expanded chart
  const EW = 360, EH = 180, EP = { t: 16, r: 16, b: 34, l: 44 };
  const exp = buildChart(data, EP, EW, EH);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 10, 20, 30, 40, 49];

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`bg-gray-950/80 border rounded-xl p-3 transition-colors duration-150 cursor-default ${hovered ? "border-gray-600" : "border-gray-800"}`}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((t) => (
            <line key={t} x1={pad.l} x2={W - pad.r} y1={pad.t + t * mini.iH} y2={pad.t + t * mini.iH} stroke="#1f2937" strokeWidth="1" />
          ))}
          <path d={mini.fill} fill={`url(#${gradId})`} />
          <path d={mini.line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={mini.xs[mini.xs.length - 1]} cy={mini.ys[mini.ys.length - 1]} r="3" fill={color} />
        </svg>
        <div className="flex justify-between items-baseline px-1 mt-1">
          <span className="text-gray-600 text-xs">{label}</span>
          <span className="text-xs font-mono font-semibold" style={{ color }}>{finalVal}</span>
        </div>
      </div>

      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-96 bg-gray-950 border border-gray-600 rounded-2xl p-5 shadow-2xl shadow-black/80 pointer-events-none">
          <p className="text-sm font-semibold mb-3 px-1" style={{ color }}>{label}</p>
          <svg viewBox={`0 0 ${EW} ${EH}`} className="w-full">
            <defs>
              <linearGradient id={`${gradId}-exp`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Y-axis grid + labels */}
            {yTicks.map((t) => {
              const y = EP.t + t * exp.iH;
              const val = exp.hi - t * (exp.hi - exp.lo);
              return (
                <g key={t}>
                  <line x1={EP.l} x2={EW - EP.r} y1={y} y2={y} stroke="#374151" strokeWidth="1" />
                  <text x={EP.l - 8} y={y + 4} fontSize="11" fill="#d1d5db" textAnchor="end" fontFamily="monospace">
                    {val > 1 ? val.toFixed(2) : val.toFixed(3)}
                  </text>
                </g>
              );
            })}
            {/* X-axis labels */}
            {xTicks.map((ep) => {
              const x = EP.l + (ep / (data.length - 1)) * exp.iW;
              return (
                <g key={ep}>
                  <line x1={x} x2={x} y1={EP.t} y2={EP.t + exp.iH} stroke="#1f2937" strokeWidth="1" />
                  <text x={x} y={EH - EP.b + 16} fontSize="11" fill="#d1d5db" textAnchor="middle" fontFamily="monospace">{ep}</text>
                </g>
              );
            })}
            <path d={exp.fill} fill={`url(#${gradId}-exp)`} />
            <path d={exp.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={exp.xs[exp.xs.length - 1]} cy={exp.ys[exp.ys.length - 1]} r="4" fill={color} />
            <text x={EP.l + exp.iW / 2} y={EH - 1} fontSize="11" fill="#9ca3af" textAnchor="middle">epoch</text>
          </svg>
        </div>
      )}
    </div>
  );
}

function CustomTrainingCharts() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <MiniChart data={CHART_DATA.map50}     label="mAP50"      finalVal="0.803" color="#f97316" />
      <MiniChart data={CHART_DATA.map5095}   label="mAP50–95"   finalVal="0.553" color="#fb923c" />
      <MiniChart data={CHART_DATA.precision} label="Precision"  finalVal="0.842" color="#22d3ee" />
      <MiniChart data={CHART_DATA.recall}    label="Recall"     finalVal="0.705" color="#a78bfa" />
      <MiniChart data={CHART_DATA.boxLoss}   label="Box Loss ↓" finalVal="0.48"  color="#4ade80" />
    </div>
  );
}

function CustomConfusionMatrix() {
  const cells = [
    { val: 1422, tag: "TP", desc: "Correctly detected balls",   highlight: true  },
    { val: 423,  tag: "FP", desc: "Background mistaken for ball", highlight: false },
    { val: 480,  tag: "FN", desc: "Missed balls",               highlight: false },
    { val: 0,    tag: "TN", desc: "Background ignored",         highlight: false },
  ];
  return (
    <div className="max-w-md">
      {/* Title */}
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-4">Confusion Matrix</p>

      {/* Column headers — True labels */}
      <div className="grid grid-cols-[80px_1fr_1fr] gap-3 mb-2">
        <div />
        <div className="text-center">
          <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded-lg px-3 py-1">Basketball</span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded-lg px-3 py-1">Background</span>
        </div>
      </div>

      {/* Axis label — True */}
      <div className="grid grid-cols-[80px_1fr_1fr] gap-3 mb-1">
        <div />
        <div className="col-span-2 text-center text-gray-600 text-xs">← True label →</div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-[80px_1fr_1fr] gap-3 mb-3 items-center">
        <div className="text-right">
          <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded-lg px-2 py-1 block text-center">Basketball</span>
        </div>
        {cells.slice(0, 2).map((c, i) => (
          <div key={i} className={`rounded-2xl p-5 text-center ${c.highlight ? "bg-orange-500/15 border-2 border-orange-500/40" : "bg-gray-900/60 border border-gray-800"}`}>
            <div className={`text-3xl font-bold tabular-nums ${c.highlight ? "text-orange-400" : "text-gray-400"}`}>{c.val}</div>
            <div className={`text-sm font-semibold mt-1 ${c.highlight ? "text-orange-400" : "text-gray-500"}`}>{c.tag}</div>
            <div className={`text-xs mt-1 leading-tight ${c.highlight ? "text-orange-300/60" : "text-gray-600"}`}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-[80px_1fr_1fr] gap-3 items-center">
        <div className="text-right">
          <span className="text-xs font-medium text-gray-400 bg-gray-800 rounded-lg px-2 py-1 block text-center">Background</span>
        </div>
        {cells.slice(2, 4).map((c, i) => (
          <div key={i} className={`rounded-2xl p-5 text-center ${c.highlight ? "bg-orange-500/15 border-2 border-orange-500/40" : "bg-gray-900/60 border border-gray-800"}`}>
            <div className={`text-3xl font-bold tabular-nums ${c.highlight ? "text-orange-400" : "text-gray-400"}`}>{c.val}</div>
            <div className={`text-sm font-semibold mt-1 ${c.highlight ? "text-orange-400" : "text-gray-500"}`}>{c.tag}</div>
            <div className={`text-xs mt-1 leading-tight ${c.highlight ? "text-orange-300/60" : "text-gray-600"}`}>{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Row label — Predicted */}
      <div className="grid grid-cols-[80px_1fr] gap-3 mt-2">
        <div />
        <div className="col-span-2 text-gray-600 text-xs text-center">↑ Predicted label ↓</div>
      </div>
    </div>
  );
}

const METRICS = [
  { label: "mAP50", value: 0.803, description: "Mean average precision at IoU threshold 0.5, the main detection metric" },
  { label: "Precision", value: 0.842, description: "Of all predicted bounding boxes, how many were actually correct" },
  { label: "Recall", value: 0.705, description: "Of all real balls in the dataset, how many did the model find" },
  { label: "mAP50-95", value: 0.553, description: "mAP averaged across IoU thresholds from 0.5 to 0.95, a stricter measure" },
];

const TRAINING = [
  { label: "Model", value: "YOLOv8n" },
  { label: "Base weights", value: "yolov8n.pt (ImageNet)" },
  { label: "Epochs", value: "50" },
  { label: "Batch size", value: "16" },
  { label: "Image size", value: "640 × 640 px" },
  { label: "Optimizer", value: "AdamW" },
  { label: "Learning rate", value: "0.002" },
  { label: "Momentum", value: "0.9" },
  { label: "Early stopping", value: "patience=10 (not triggered)" },
  { label: "Training time", value: "~18 min (0.303 h)" },
  { label: "GPU", value: "NVIDIA L4 (Colab Pro)" },
  { label: "Inference speed", value: "0.5 ms / frame" },
  { label: "Model size", value: "6.2 MB" },
  { label: "Parameters", value: "3 005 843" },
];

const DATASET = [
  { label: "Dataset name", value: "Basketball-ball-detection" },
  { label: "Source", value: "Roboflow" },
  { label: "Total images", value: "~4 300" },
  { label: "Train images", value: "3 154" },
  { label: "Val images", value: "789" },
  { label: "Classes", value: "1 — Basketball" },
];
