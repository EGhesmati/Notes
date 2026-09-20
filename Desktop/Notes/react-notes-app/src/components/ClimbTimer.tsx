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
  completedPoints,
  totalPoints,
}: {
  secondsLeft: number;
  duration: number;
  phase: TimerPhase;
  running: boolean;
  completedPoints: number;
  totalPoints: number;
}) {
  const isFocus = phase === "focus";
  const paused = !running && secondsLeft !== duration;
  const complete = isFocus && secondsLeft <= 0 && !running;
  const waterLevel = Math.min(1, Math.max(0, completedPoints / Math.max(1, totalPoints)));
  const status = isFocus && secondsLeft <= 0 && !running
    ? "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]">
        <div className="water-fill absolute inset-x-0 bottom-0" style={{ height: `${waterLevel * 100}%` }}>
          <div className={`sea-surface absolute inset-x-[-12%] top-0 h-8 ${
          running ? "sea-surface-active" : complete ? "sea-surface-complete" : paused ? "sea-surface-paused" : ""
          }`} aria-hidden>
          <svg className="sea-wave sea-wave-primary absolute inset-0 h-full w-full" viewBox="0 0 240 32" preserveAspectRatio="none">
            <path d="M-10 17 C 12 5, 30 5, 52 17 S 92 29, 114 17 S 154 5, 176 17 S 216 29, 250 14" />
          </svg>
          <svg className="sea-wave sea-wave-secondary absolute inset-0 h-full w-full" viewBox="0 0 240 32" preserveAspectRatio="none">
            <path d="M-10 21 C 15 11, 34 11, 58 21 S 101 31, 124 20 S 166 10, 190 20 S 220 30, 250 18" />
          </svg>
          <svg className="sea-wave sea-wave-tertiary absolute inset-0 h-full w-full" viewBox="0 0 240 32" preserveAspectRatio="none">
            <path d="M-10 25 C 18 18, 35 18, 62 25 S 106 31, 132 24 S 174 17, 202 24 S 226 29, 250 22" />
          </svg>
            <span key={completedPoints} className="water-ripple absolute left-1/2 top-1/2 h-3 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-indigo-400/20" />
          </div>
        </div>
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
