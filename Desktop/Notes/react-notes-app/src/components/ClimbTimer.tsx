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

const FISH_PATH =
  "M26.2 8 C26.2 5.2 21.6 3.3 17.2 3.3 C13 3.3 9.4 4.1 7.2 5.2 L7.2 4.2 C6 3.6 4.6 2.6 3 1.8 L0.8 3.4 C2 5 3.2 6.6 3.7 8 C3.2 9.4 2 11 0.8 12.6 L3 14.2 C4.6 13.4 6 12.4 7.2 11.8 L7.2 10.8 C9.4 11.9 13 12.7 17.2 12.7 C21.6 12.7 26.2 10.8 26.2 8 Z";
const FISH_FIN_PATH =
  "M13.2 3.4 C13.5 1.6 12.1 1 11.3 2.3 C10.9 2.9 10.7 3.5 10.8 4 Z";

interface WavePart {
  cycles: number;
  amp: number;
  phase: number;
}

function buildWave(mean: number, parts: WavePart[], floor = 72) {
  const pts: string[] = [];
  for (let x = 0; x <= 240; x += 3) {
    let y = mean;
    for (const p of parts) y += p.amp * Math.sin((2 * Math.PI * p.cycles * x) / 240 + p.phase);
    pts.push(`${x} ${y.toFixed(2)}`);
  }
  const line = `M ${pts.join(" L ")}`;
  return { line, fill: `${line} L 240 ${floor} L 0 ${floor} Z` };
}

const WAVE_PRIMARY = buildWave(25, [
  { cycles: 3, amp: 4.5, phase: 0.5 },
  { cycles: 4, amp: 2.2, phase: 1.7 },
  { cycles: 6, amp: 1.1, phase: 2.9 },
]);
const WAVE_SUBSURFACE = buildWave(34, [
  { cycles: 2, amp: 3, phase: 2.1 },
  { cycles: 5, amp: 1.6, phase: 0.4 },
  { cycles: 8, amp: 1, phase: 4.1 },
]);

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
  const isFocus = phase === "focus";
  const paused = !running && secondsLeft !== duration;
  const complete = isFocus && secondsLeft <= 0 && !running;
  const visualPoints = completedPoints + (isFocus ? Math.min(1, Math.max(0, pomodoroProgress)) : 0);
  const waterLevel = Math.min(1, Math.max(0, visualPoints / Math.max(1, totalPoints)));
  const fishCount = waterLevel >= 0.9 ? 4 : waterLevel >= 0.65 ? 3 : waterLevel >= 0.4 ? 2 : waterLevel >= 0.2 ? 1 : 0;
  const fish = [
    { left: "30%", bottom: "58%", size: 0.78, flip: -1, opacity: 0.42, blur: 0.3, duration: "23s", delay: "-3s" },
    { left: "68%", bottom: "24%", size: 0.62, flip: 1, opacity: 0.27, blur: 0.55, duration: "30s", delay: "-9s" },
    { left: "14%", bottom: "42%", size: 0.7, flip: -1, opacity: 0.35, blur: 0.4, duration: "26s", delay: "-6s" },
    { left: "72%", bottom: "60%", size: 0.84, flip: 1, opacity: 0.46, blur: 0.2, duration: "20s", delay: "-1s" },
  ];
  const status = isFocus && secondsLeft <= 0 && !running
    ? "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]">
        <div className="water-vessel" style={{ height: `${waterLevel * 100}%` }}>
          <div className="water-body" aria-hidden />
          <div className="water-layers" aria-hidden />
          <div className="water-sheen" aria-hidden />
          <div className="water-sheen water-sheen-b" aria-hidden />
          {fish.slice(0, fishCount).map((item, index) => (
            <span
              key={index}
              className="water-fish"
              style={
                {
                  left: item.left,
                  bottom: item.bottom,
                  "--fish-scale": item.size,
                  "--fish-flip": item.flip,
                  "--fish-opacity": item.opacity,
                  "--fish-blur": `${item.blur}px`,
                  "--swim-duration": item.duration,
                  "--swim-delay": item.delay,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <span className={`water-fish-swim ${running ? "water-fish-swim-active" : paused ? "water-fish-swim-paused" : ""}`}>
                <svg viewBox="0 0 28 16">
                  <path d={FISH_PATH} />
                  <path d={FISH_FIN_PATH} />
                </svg>
              </span>
            </span>
          ))}
          <div className={`sea-surface ${
          running ? "is-active" : complete ? "is-complete" : paused ? "is-paused" : ""
          }`} aria-hidden>
            <div className="sea-surface-heave">
              <svg className="sea-wave sea-wave-primary" viewBox="0 0 240 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sea-surf-a" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#bcd6ea" stopOpacity="0.3" />
                    <stop offset="0.6" stopColor="#bcd6ea" stopOpacity="0.06" />
                    <stop offset="1" stopColor="#bcd6ea" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path fill="url(#sea-surf-a)" d={WAVE_PRIMARY.fill} />
                <path className="sea-rim" d={WAVE_PRIMARY.line} />
              </svg>
              <svg className="sea-wave sea-wave-secondary" viewBox="0 0 240 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sea-surf-b" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9db9d6" stopOpacity="0.14" />
                    <stop offset="0.55" stopColor="#9db9d6" stopOpacity="0.04" />
                    <stop offset="1" stopColor="#9db9d6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path fill="url(#sea-surf-b)" d={WAVE_SUBSURFACE.fill} />
              </svg>
            </div>
            {complete ? <span key={completedPoints} className="surface-roll" aria-hidden /> : null}
          </div>
        </div>
        <div className="glass-halo" aria-hidden />
        <div className="pointer-events-none absolute inset-1 rounded-full border border-white/30" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 flex justify-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-foreground/70">{PHASE_LABEL[phase]}</span>
          <span className="mt-1 font-sans text-[2.65rem] font-light tracking-tight tabular-nums text-foreground sm:text-[2.9rem]">{formatTime(secondsLeft)}</span>
          <span className="mt-3 rounded-full border border-indigo-500/15 bg-background/90 px-2.5 py-0.5 text-[10px] font-medium text-foreground/65 shadow-sm">
            {running && isFocus ? <span className="mr-1 inline-block h-1 w-1 rounded-full bg-indigo-500" /> : null}
            {status}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[6%] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[9px] font-medium tabular-nums text-foreground/45">
        {Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)))} / {totalPoints}
        <div className="h-px w-10 overflow-hidden bg-foreground/10">
          <div className="h-full bg-indigo-500/35" style={{ width: `${Math.min(100, Math.max(0, (completedPoints / Math.max(1, totalPoints)) * 100))}%` }} />
        </div>
      </div>
    </div>
  );
}
