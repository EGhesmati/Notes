const LEVELS = [
  { fraction: 1, title: "Summit" },
  { fraction: 0.75, title: "High Ridge" },
  { fraction: 0.5, title: "Snow Line" },
  { fraction: 0.25, title: "Cliff Path" },
  { fraction: 0, title: "Base Camp" },
];

export function ascentLevel(height: number, totalPoints: number): { title: string } {
  const fraction = totalPoints > 0 ? height / totalPoints : 0;
  return LEVELS.find((level) => fraction >= level.fraction) ?? LEVELS[LEVELS.length - 1];
}

export function stepsToNextCheckpoint(height: number, totalPoints: number): number {
  return Math.max(0, Math.ceil(Math.max(0, totalPoints - height)));
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 20 6-12 3 5 2.5-4 6.5 11z" />
      <path d="M17 4h4v4" />
    </svg>
  );
}

export function JourneySummary({ height, totalPoints }: { height: number; totalPoints: number }) {
  const c = Math.min(totalPoints, Math.max(0, Math.floor(height)));
  const toNext = stepsToNextCheckpoint(c, totalPoints);

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MountainIcon className="h-3.5 w-3.5 text-indigo-500/80" />
          <span className="text-xs font-medium text-foreground">{ascentLevel(c, totalPoints).title}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">{c} / {totalPoints} points</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground/50">
        <span>{toNext === 0 ? "Summit reached" : `Next point · ${toNext} ${toNext === 1 ? "pomodoro" : "pomodoros"}`}</span>
        {c >= totalPoints ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">Climb complete</span>
        ) : (
          <span>one point per Pomodoro</span>
        )}
      </div>
    </div>
  );
}
