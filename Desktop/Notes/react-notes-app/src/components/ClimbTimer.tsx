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
}: {
  completedPoints: number;
  totalPoints: number;
}) {
  const sections = useMemo(
    () => Array.from({ length: Math.max(1, totalPoints) }, (_, index) => index),
    [totalPoints],
  );
  const completed = Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)));

  return (
    <div className="absolute inset-x-[25%] bottom-[12%] top-[20%] flex flex-col items-center justify-end" aria-hidden>
      <div className="mb-1 h-5 w-16 rounded-t-md border border-foreground/20 bg-card/90">
        <div className="mx-auto mt-1 h-2.5 w-7 rounded-sm border border-indigo-500/35 bg-indigo-500/15" />
      </div>
      <div className="flex w-12 flex-1 flex-col justify-end border-x border-foreground/15 bg-card/80">
        {sections.map((index) => (
          <div
            key={index}
            className={`min-h-1 flex-1 border-t border-foreground/10 ${
              index < completed ? "bg-foreground/15" : "bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="h-2 w-16 rounded-sm border border-foreground/15 bg-foreground/[0.08]" />
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
          <div className="absolute inset-x-0 bottom-0 h-[34%] bg-foreground/[0.035]" />
          <div className="absolute inset-x-0 bottom-[28%] h-px bg-foreground/10" />
          <StaticLighthouse completedPoints={completedPoints} totalPoints={totalPoints} />
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
  const circumference = 2 * Math.PI * 46;

  return (
    <div className="relative aspect-square w-64 sm:w-72">
      <div className="absolute inset-0 rounded-full border border-border/50 bg-card" />
      <RiveScene
        running={running}
        paused={paused}
        progress={isFocus ? pomodoroProgress : 0}
        completedPoints={completedPoints}
        totalPoints={totalPoints}
        complete={complete}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center rounded-full bg-card/95 px-5 py-4 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-foreground/45">
            {PHASE_LABEL[phase]}
          </span>
          <span className="mt-2 font-sans text-5xl font-extralight tracking-tight tabular-nums text-foreground sm:text-6xl">
            {formatTime(secondsLeft)}
          </span>
          <span className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-foreground/50">
            {running && isFocus ? <span className="h-1 w-1 rounded-full bg-indigo-500" /> : null}
            {status}
          </span>
        </div>
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.45" className="text-border/50" />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
          strokeLinecap="round"
          className={isFocus ? "text-indigo-600" : "text-foreground/25"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (isFocus ? pomodoroProgress : 0))}
        />
      </svg>
    </div>
  );
}
