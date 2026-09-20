import { useEffect, useMemo } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import type { TimerPhase } from "./PomodoroTimer";

const RIVE_SOURCE = "/Notes/lighthouse.riv";
const STATE_MACHINE = "Lighthouse";

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
    <div className="absolute bottom-[10%] left-1/2 top-[48%] w-[42%] -translate-x-1/2" aria-hidden>
      <div className="absolute bottom-0 left-1/2 flex h-full w-[42%] min-w-16 -translate-x-1/2 flex-col items-center justify-end">
        <div className="relative mb-1 h-7 w-[145%] rounded-t-md border border-foreground/25 bg-card shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.04)]">
          <div className={`mx-auto mt-1.5 h-3.5 w-10 rounded-sm border ${
            complete ? "border-amber-400/80 bg-amber-300/80" : "border-indigo-500/40 bg-indigo-500/15"
          }`} />
          <div className="absolute inset-x-1.5 bottom-0 h-px bg-foreground/15" />
        </div>
        <div className="relative flex w-full flex-1 flex-col justify-end [clip-path:polygon(14%_0,86%_0,100%_100%,0_100%)] border-x border-foreground/20 bg-card/90 shadow-[inset_-5px_0_8px_hsl(var(--foreground)/0.035)]">
          {sections.map((index) => (
            <div
              key={index}
              className={`min-h-1 flex-1 border-t border-foreground/10 ${
                index < completed ? "bg-foreground/15" : "bg-transparent"
              }`}
            />
          ))}
          <div className="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-foreground/[0.08]" />
          <div className="pointer-events-none absolute inset-y-2 left-[34%] w-px bg-indigo-500/[0.12]" />
          <div className="pointer-events-none absolute inset-y-2 right-[34%] w-px bg-foreground/[0.07]" />
        </div>
        <div className="relative h-3 w-[150%] rounded-sm border border-foreground/20 bg-foreground/[0.09]">
          <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-foreground/15" />
        </div>
      </div>
      <div className="absolute bottom-[calc(100%-2rem)] left-1/2 h-5 w-[175%] -translate-x-1/2 border-y border-foreground/25 bg-card/95">
        <div className="absolute inset-x-[12%] top-1/2 h-px -translate-y-1/2 bg-indigo-500/30" />
        <div className="absolute inset-x-[18%] top-1 h-px bg-foreground/10" />
      </div>
      <div className="absolute bottom-[calc(100%-0.5rem)] left-1/2 h-8 w-12 -translate-x-1/2 rounded-t-md border border-foreground/25 bg-card shadow-[inset_0_-3px_0_hsl(var(--foreground)/0.04)]">
        <div className="absolute inset-x-2 bottom-1 h-4 rounded-sm border border-foreground/20 bg-foreground/[0.06]" />
      </div>
      <div className="absolute bottom-[calc(100%+1.45rem)] left-1/2 h-4 w-16 -translate-x-1/2 border-x border-t border-foreground/25 bg-foreground/[0.08]">
        <div className="absolute inset-x-1 top-1 h-px bg-foreground/20" />
      </div>
      <div className="absolute bottom-[calc(100%+2.4rem)] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[1.35rem] border-b-[0.8rem] border-x-transparent border-b-foreground/20" />
      <div className="absolute bottom-[calc(100%+3.15rem)] left-1/2 h-5 w-24 -translate-x-1/2 -skew-y-6 bg-indigo-500/[0.045]" />
      <div className={`absolute bottom-[calc(100%+3rem)] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${
        complete ? "bg-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.75)]" : "bg-indigo-500/65"
      }`} />
    </div>
  );
}

function RiveScene({
  running,
  paused,
  progress,
  completedPoints,
  totalPoints,
  complete,
}: {
  running: boolean;
  paused: boolean;
  progress: number;
  completedPoints: number;
  totalPoints: number;
  complete: boolean;
}) {
  const { rive, RiveComponent } = useRive({
    src: RIVE_SOURCE,
    stateMachines: STATE_MACHINE,
    autoplay: true,
  }, { shouldResizeCanvasToContainer: true });
  const isRunningInput = useStateMachineInput(rive, STATE_MACHINE, "isRunning");
  const isPausedInput = useStateMachineInput(rive, STATE_MACHINE, "isPaused");
  const progressInput = useStateMachineInput(rive, STATE_MACHINE, "progress");
  const completedInput = useStateMachineInput(rive, STATE_MACHINE, "completedPoints");
  const totalInput = useStateMachineInput(rive, STATE_MACHINE, "totalPoints");
  const completeInput = useStateMachineInput(rive, STATE_MACHINE, "isComplete");

  useEffect(() => {
    // Rive state-machine inputs are mutable runtime handles by design.
    /* eslint-disable react-hooks/immutability */
    if (isRunningInput) isRunningInput.value = running;
    if (isPausedInput) isPausedInput.value = paused;
    if (progressInput) progressInput.value = progress;
    if (completedInput) completedInput.value = completedPoints;
    if (totalInput) totalInput.value = totalPoints;
    if (completeInput) completeInput.value = complete;
    /* eslint-enable react-hooks/immutability */
  }, [
    complete,
    completeInput,
    completedInput,
    completedPoints,
    isPausedInput,
    isRunningInput,
    paused,
    progress,
    progressInput,
    running,
    totalInput,
    totalPoints,
  ]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-full bg-background">
      {rive ? <RiveComponent className="h-full w-full" /> : null}
      {!rive ? (
        <div className="absolute inset-0">
          <div className="absolute inset-x-0 top-[45%] h-px bg-foreground/10" />
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-foreground/[0.035]" />
          <div className="absolute bottom-[21%] left-0 right-0 h-px bg-foreground/10" />
          <div className="absolute left-[28%] top-[34%] h-10 w-[44%] -skew-x-12 bg-indigo-500/[0.045]" />
          <StaticLighthouse completedPoints={completedPoints} totalPoints={totalPoints} complete={complete} />
        </div>
      ) : null}
    </div>
  );
}

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
  const complete = completedPoints >= totalPoints;
  const status = isFocus && secondsLeft <= 0 && !running
    ? complete ? "Lighthouse complete" : "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[11.5rem] max-w-full sm:w-[12.5rem]">
      <div className="absolute inset-0 rounded-full border border-border/60 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.02)]" />
      <RiveScene
        running={running}
        paused={paused}
        progress={isFocus ? pomodoroProgress : 0}
        completedPoints={completedPoints}
        totalPoints={totalPoints}
        complete={complete}
      />
      <div className="pointer-events-none absolute inset-x-0 top-[10%] flex justify-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground/70">
            {PHASE_LABEL[phase]}
          </span>
          <span className="mt-0.5 font-sans text-4xl font-light tracking-tight tabular-nums text-foreground sm:text-5xl">
            {formatTime(secondsLeft)}
          </span>
          <span className="mt-1 rounded-full bg-indigo-500/[0.08] px-2 py-0.5 text-[10px] font-medium text-foreground/65">
            {running && isFocus ? <span className="h-1 w-1 rounded-full bg-indigo-500" /> : null}
            {status}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[7%] left-1/2 -translate-x-1/2 text-[9px] font-medium tabular-nums text-foreground/50">
        {Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)))} / {totalPoints}
      </div>
    </div>
  );
}
