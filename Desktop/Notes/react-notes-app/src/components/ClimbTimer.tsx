import { useMemo } from "react";
import type { TimerPhase } from "./PomodoroTimer";

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const PHASE_STATUS: Record<TimerPhase, string> = {
  focus: "Deep work",
  "short-break": "Short break",
  "long-break": "Long break",
};

export function ClimbTimer({
  secondsLeft,
  duration,
  phase,
  running,
  pomodoroProgress,
  completedPoints,
  totalPoints,
}: {
  secondsLeft: number;
  duration: number;
  phase: TimerPhase;
  running: boolean;
  pomodoroProgress: number;
  completedPoints: number;
  totalPoints: number;
}) {
  const safeTotal = Math.max(1, Math.round(totalPoints));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const progress = phase === "focus" ? Math.min(1, Math.max(0, pomodoroProgress)) : 0;
  const sections = useMemo(() => Array.from({ length: safeTotal }, (_, index) => index), [safeTotal]);
  const towerHeight = 154;
  const sectionHeight = Math.max(2.5, towerHeight / safeTotal);

  return (
    <div
      className="lighthouse-timer relative w-full max-w-[34rem] overflow-hidden rounded-[1.5rem] border border-violet-300/25 shadow-2xl shadow-violet-950/30"
      aria-label={`${safeCompleted} of ${safeTotal} lighthouse construction points completed`}
    >
      <svg viewBox="0 0 640 440" className="h-auto w-full" role="img">
        <defs>
          <linearGradient id="lighthouse-purple-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#120b2b" />
            <stop offset="0.55" stopColor="#30205e" />
            <stop offset="1" stopColor="#6d3fa3" />
          </linearGradient>
          <linearGradient id="lighthouse-purple-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#432b76" />
            <stop offset="1" stopColor="#160d35" />
          </linearGradient>
          <linearGradient id="lighthouse-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f5e8ff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#e8c9ff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f5e8ff" stopOpacity="0" />
          </linearGradient>
          <filter id="lighthouse-glow"><feGaussianBlur stdDeviation="8" /></filter>
          <clipPath id="lighthouse-world"><rect width="640" height="440" rx="24" /></clipPath>
        </defs>
        <g clipPath="url(#lighthouse-world)">
          <rect width="640" height="440" fill="url(#lighthouse-purple-sky)" />
          <circle cx="500" cy="82" r="34" fill="#ead9ff" opacity="0.7" />
          <circle cx="500" cy="82" r="58" fill="#d5b2ff" opacity="0.16" filter="url(#lighthouse-glow)" />
          <path d="M0 252 C130 220 205 270 315 238 C430 205 520 258 640 222 V440 H0Z" fill="#26164c" opacity="0.9" />
          <path d="M0 302 C145 270 225 318 350 282 C470 248 548 302 640 270 V440 H0Z" fill="url(#lighthouse-purple-sea)" />
          <path d="M320 144 L20 82 L20 126 Z M320 144 L620 82 L620 126 Z" fill="url(#lighthouse-beam)" opacity="0.48" />
          <path d="M0 334 Q100 320 200 334 T400 334 T640 334 M0 361 Q100 347 200 361 T400 361 T640 361" fill="none" stroke="#d7b7ff" strokeOpacity="0.2" />
          <ellipse cx="320" cy="374" rx="124" ry="14" fill="#09051a" opacity="0.55" />
          {sections.map((index) => {
            const y = 350 - (index + 1) * sectionHeight;
            const reached = index < safeCompleted;
            const width = 68 + (index / Math.max(1, safeTotal - 1)) * 22;
            return (
              <g key={index} opacity={reached ? 1 : 0.16}>
                <path d={`M ${320 - width / 2} ${y} L ${320 + width / 2} ${y} L ${320 + width / 2 - 3} ${y - sectionHeight + 1} L ${320 - width / 2 + 3} ${y - sectionHeight + 1} Z`} fill={reached ? "#c9a4ef" : "#b9a5d3"} />
                {index % 4 === 3 && <path d={`M ${320 - width / 2 - 4} ${y - sectionHeight} L ${320 + width / 2 + 4} ${y - sectionHeight}`} stroke="#f0dcff" strokeOpacity="0.7" strokeWidth="2" />}
              </g>
            );
          })}
          <rect x="278" y="125" width="84" height="12" rx="3" fill="#eadbfa" />
          <path d="M270 125 H370 L358 110 H282Z" fill="#b994de" />
          <rect x="292" y="105" width="56" height="8" rx="2" fill="#a878d4" />
          <circle cx="320" cy="144" r="8" fill="#fff0ff" opacity="0.95" />
        </g>
        <circle cx="320" cy="220" r="128" fill="#160c32" fillOpacity="0.58" stroke="#ead9ff" strokeOpacity="0.2" />
        <circle cx="320" cy="220" r="128" fill="none" stroke="#ead9ff" strokeOpacity="0.18" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 128}`} strokeDashoffset={`${2 * Math.PI * 128 * (1 - progress)}`} strokeLinecap="round" transform="rotate(-90 320 220)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-1 text-center text-white">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-100/65">{PHASE_LABEL[phase]}</span>
        <span className="mt-3 text-6xl font-extralight tracking-tight tabular-nums sm:text-7xl">{formatTime(secondsLeft)}</span>
        <span className="mt-2 text-[11px] font-medium text-violet-100/60">{running ? PHASE_STATUS[phase] : secondsLeft === duration ? "Ready" : "Paused"}</span>
        <span className="mt-5 text-[11px] font-medium tabular-nums text-violet-100/80">{safeCompleted} / {safeTotal} points</span>
      </div>
    </div>
  );
}
