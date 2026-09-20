const LEVELS = [
  { fraction: 1, title: "Lighthouse complete" },
  { fraction: 0.75, title: "Lantern level" },
  { fraction: 0.5, title: "Upper tower" },
  { fraction: 0.25, title: "Tower base" },
  { fraction: 0, title: "Foundation" },
];

export function ascentLevel(height: number, totalPoints: number): { title: string } {
  const fraction = totalPoints > 0 ? Math.min(1, Math.max(0, height / totalPoints)) : 0;
  return LEVELS.find((level) => fraction >= level.fraction) ?? LEVELS[LEVELS.length - 1];
}

export function stepsToNextCheckpoint(height: number, totalPoints: number): number {
  return Math.max(0, Math.ceil(Math.max(0, totalPoints - height)));
}

function LighthouseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 20h8M9 20l1-12h4l1 12M8 8h8M10 8l2-3 2 3M12 5V3M7 10l-4 2M17 10l4 2" />
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
          <LighthouseIcon className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-foreground">{ascentLevel(completed, totalPoints).title}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{completed} / {totalPoints} points</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{complete ? "Lighthouse complete" : `Next point · ${remaining} ${remaining === 1 ? "pomodoro" : "pomodoros"}`}</span>
        <span className={complete ? "font-medium text-violet-600 dark:text-violet-400" : ""}>{complete ? "Complete" : "one point per Pomodoro"}</span>
      </div>
    </div>
  );
}
