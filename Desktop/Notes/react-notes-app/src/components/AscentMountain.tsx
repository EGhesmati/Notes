import { ascentLevel, stepsToNextCheckpoint } from "@/lib/ascent";

function LighthouseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 20h8M9 20l1-11h4l1 11M8 9h8M10 7h4l-1-2h-2zM12 2v3" />
      <path d="M12 1 7 3M12 1l5 2" />
    </svg>
  );
}

export function JourneySummary({ height, totalPoints }: { height: number; totalPoints: number }) {
  const completed = Math.min(totalPoints, Math.max(0, Math.floor(height)));
  const remaining = stepsToNextCheckpoint(completed, totalPoints);
  const complete = completed >= totalPoints;

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LighthouseIcon className="h-3.5 w-3.5 text-indigo-500/80" />
          <span className="text-xs font-medium text-foreground">{ascentLevel(completed, totalPoints).title}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{completed} / {totalPoints} points</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground/50">
        <span>{complete ? "Lighthouse complete" : `Next point · ${remaining} ${remaining === 1 ? "pomodoro" : "pomodoros"}`}</span>
        <span className={complete ? "font-medium text-indigo-600 dark:text-indigo-400" : ""}>{complete ? "Complete" : "one point per Pomodoro"}</span>
      </div>
    </div>
  );
}
