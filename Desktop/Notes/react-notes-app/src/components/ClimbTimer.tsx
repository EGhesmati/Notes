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

function FocusCampfire({
  completedPoints,
  totalPoints,
}: {
  completedPoints: number;
  totalPoints: number;
}) {
  const completed = Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)));

  return (
    <div className="absolute bottom-[6%] left-1/2 top-[61%] w-[72%] -translate-x-1/2" aria-hidden>
      <div className="lighthouse-horizon absolute inset-x-[-38%] bottom-[8%] h-px bg-foreground/10" />
      <div className="absolute bottom-[9%] left-1/2 h-3 w-[48%] -translate-x-1/2 rounded-full border border-foreground/15 bg-foreground/[0.07]" />
      <div className="absolute bottom-[14%] left-1/2 h-2 w-[35%] -translate-x-1/2 rotate-[18deg] rounded-full bg-foreground/[0.12]" />
      <div className="absolute bottom-[14%] left-1/2 h-2 w-[35%] -translate-x-1/2 -rotate-[18deg] rounded-full bg-foreground/[0.09]" />
      <div className="campfire-glow absolute bottom-[32%] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-amber-400/[0.08]" />
      <div className="absolute bottom-[18%] left-1/2 h-12 w-10 -translate-x-1/2" style={{ transform: `translateX(-50%) scale(${0.85 + completed / Math.max(1, totalPoints) * 0.2})` }}>
        <div className="campfire-flame absolute bottom-0 left-1/2 h-11 w-7 -translate-x-1/2 rotate-45 rounded-[75%_15%_75%_15%] bg-amber-400/85 shadow-[0_0_12px_rgba(251,191,36,.35)]" />
        <div className="absolute bottom-0 left-1/2 h-7 w-5 -translate-x-1/2 rounded-[70%_30%_65%_35%] bg-orange-300/80" />
        <div className="absolute bottom-0 left-1/2 h-4 w-2.5 -translate-x-1/2 rounded-full bg-foreground/80" />
      </div>
      <div className="campfire-ember absolute bottom-[38%] left-[39%] h-1 w-1 rounded-full bg-amber-300/70" />
      <div className="campfire-ember absolute bottom-[44%] right-[38%] h-1 w-1 rounded-full bg-orange-300/60 [animation-delay:900ms]" />
      <div className="campfire-ember absolute bottom-[51%] left-[48%] h-1 w-1 rounded-full bg-amber-300/60 [animation-delay:1.4s]" />
    </div>
  );
}

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
  const status = isFocus && secondsLeft <= 0 && !running
    ? "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]">
        <div className="absolute inset-x-0 bottom-0 h-[31%] bg-foreground/[0.025]" />
        <FocusCampfire completedPoints={completedPoints} totalPoints={totalPoints} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 flex justify-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-foreground/70">
            {PHASE_LABEL[phase]}
          </span>
          <span className="mt-1 font-sans text-[2.65rem] font-light tracking-tight tabular-nums text-foreground sm:text-[2.9rem]">
            {formatTime(secondsLeft)}
          </span>
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
