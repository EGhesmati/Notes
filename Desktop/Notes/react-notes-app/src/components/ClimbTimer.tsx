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

function StaticLighthouse({
  completedPoints,
  totalPoints,
  complete,
}: {
  completedPoints: number;
  totalPoints: number;
  complete: boolean;
}) {
  const sections = useMemo(
    () => Array.from({ length: Math.max(1, totalPoints) }, (_, index) => index),
    [totalPoints],
  );
  const completed = Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)));

  return (
    <div className="absolute bottom-[8%] left-1/2 top-[64%] w-[46%] -translate-x-1/2" aria-hidden>
      <div className="lighthouse-horizon absolute inset-x-[-38%] bottom-[8%] h-px bg-foreground/10" />
      <div className="lighthouse-tower absolute bottom-0 left-1/2 h-[72%] w-[38%] min-w-9 -translate-x-1/2 [clip-path:polygon(22%_0,78%_0,100%_100%,0_100%)] border-x border-foreground/20 bg-card/90 shadow-[inset_-5px_0_8px_hsl(var(--foreground)/0.04)]">
        {sections.map((index) => (
          <div
            key={index}
            className={`border-t border-foreground/[0.08] ${index < completed ? "bg-foreground/[0.08]" : ""}`}
            style={{ height: `${100 / Math.max(1, totalPoints)}%` }}
          />
        ))}
      </div>
      <div className="lighthouse-base absolute bottom-0 left-1/2 h-2 w-[58%] -translate-x-1/2 rounded-sm border border-foreground/15 bg-foreground/[0.07]" />
      <div className="absolute bottom-[68%] left-1/2 h-4 w-[48%] -translate-x-1/2 rounded-sm border border-foreground/20 bg-card shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.04)]" />
      <div className="absolute bottom-[76%] left-1/2 h-px w-[64%] -translate-x-1/2 bg-foreground/20">
        <div className="absolute inset-x-[12%] top-1 h-px bg-foreground/10" />
      </div>
      <div className="absolute bottom-[84%] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[0.75rem] border-b-[0.45rem] border-x-transparent border-b-foreground/20" />
      <div className={`lighthouse-lantern absolute bottom-[80%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${complete ? "bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.65)]" : "bg-indigo-500/60"}`} />
      <div className="lighthouse-beam absolute bottom-[79%] left-1/2 h-2 w-24 origin-left -skew-y-[12deg] bg-indigo-400/[0.06]" />
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
  const complete = completedPoints >= totalPoints;
  const status = isFocus && secondsLeft <= 0 && !running
    ? complete ? "Lighthouse complete" : "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]">
        <div className="absolute inset-x-0 bottom-0 h-[31%] bg-foreground/[0.025]" />
        <StaticLighthouse completedPoints={completedPoints} totalPoints={totalPoints} complete={complete} />
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
