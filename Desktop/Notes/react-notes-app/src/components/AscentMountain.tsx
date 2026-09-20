export const ASCENT_MAX = 16;
export const ASCENT_CHECKPOINT = 4;

const LEVELS: { min: number; title: string }[] = [
  { min: 16, title: "Summit" },
  { min: 12, title: "High Ridge" },
  { min: 8, title: "Snow Line" },
  { min: 4, title: "Cliff Path" },
  { min: 1, title: "Rising Trail" },
  { min: 0, title: "Base Camp" },
];

export function ascentLevel(height: number): { title: string } {
  for (const l of LEVELS) {
    if (height >= l.min) return { title: l.title };
  }
  return LEVELS[LEVELS.length - 1];
}

/** Steps until the next checkpoint, mirroring the checkpoint logic. */
export function stepsToNextCheckpoint(height: number): number {
  const c = Math.min(ASCENT_MAX, Math.max(0, height));
  const mod = c % ASCENT_CHECKPOINT;
  return mod === 0 && c > 0 ? ASCENT_CHECKPOINT : ASCENT_CHECKPOINT - mod;
}

function MountainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m3 20 6-12 3 5 2.5-4 6.5 11z" />
      <path d="M17 4h4v4" />
    </svg>
  );
}

/**
 * Quiet text-only progression readout — the climb itself lives inside the
 * timer; this is just the level/steps vocabulary.
 */
export function JourneySummary({ height }: { height: number }) {
  const c = Math.min(ASCENT_MAX, Math.max(0, height));
  const toNext = stepsToNextCheckpoint(c);

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MountainIcon className="h-3.5 w-3.5 text-indigo-500/80" />
          <span className="text-xs font-medium text-foreground">{ascentLevel(c).title}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {c} / {ASCENT_MAX} steps
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-foreground/50">
        <span>
          Next checkpoint · {toNext === 1 ? "1 pomodoro" : `${toNext} pomodoros`}
        </span>
        {c >= ASCENT_MAX ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">Peak reached</span>
        ) : (
          <span>checkpoint every {ASCENT_CHECKPOINT}</span>
        )}
      </div>
    </div>
  );
}