import { useMemo } from "react";

export const ASCENT_MAX = 16;
export const ASCENT_CHECKPOINT = 4;

const LEVELS: { min: number; title: string; subtitle: string }[] = [
  { min: 16, title: "Summit", subtitle: "You reached the peak today." },
  { min: 12, title: "High Ridge", subtitle: "The summit is in sight." },
  { min: 8, title: "Snow Line", subtitle: "The air is getting thin." },
  { min: 4, title: "Cliff Path", subtitle: "First checkpoint reached." },
  { min: 1, title: "Rising Trail", subtitle: "Keep the boulder moving." },
  { min: 0, title: "Base Camp", subtitle: "Finish a pomodoro to start climbing." },
];

export function ascentLevel(height: number): { title: string; subtitle: string } {
  for (const l of LEVELS) {
    if (height >= l.min) return { title: l.title, subtitle: l.subtitle };
  }
  return LEVELS[LEVELS.length - 1];
}

export function AscentMountain({ height }: { height: number }) {
  const progress = Math.min(1, Math.max(0, height / ASCENT_MAX));

  // Animate the boulder along the climb path with a gentle lateral sway
  // so it looks like it's being pushed angling up the mountain.
  const boulderX = 26 + progress * 128 + Math.sin(progress * Math.PI * 3) * 8;
  const boulderY = 212 - progress * 178;

  const { title, subtitle } = useMemo(() => ascentLevel(height), [height]);

  const flags = useMemo(() => {
    const list: { x: number; y: number; step: number; reached: boolean }[] = [];
    for (let step = ASCENT_CHECKPOINT; step <= ASCENT_MAX; step += ASCENT_CHECKPOINT) {
      const p = Math.min(1, step / ASCENT_MAX);
      const reached = height >= step;
      list.push({
        x: 26 + p * 128 + Math.sin(p * Math.PI * 3) * 8,
        y: 212 - p * 178,
        step,
        reached,
      });
    }
    return list;
  }, [height]);

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-foreground">🗻 {title}</span>
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      </div>

      <svg viewBox="0 0 240 240" className="h-44 w-44">
        {/* Sky */}
        <defs>
          <linearGradient id="ascent-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="ascent-sun" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="240" height="240" rx="16" fill="url(#ascent-sky)" />

        {/* Mountain silhouette (two peaks) */}
        <path
          d="M0,210 L58,104 L96,152 L132,70 L188,150 L240,118 L240,240 L0,240 Z"
          fill="#a8a29e"
          fillOpacity="0.35"
        />
        <path
          d="M0,210 L58,104 L96,152 L132,70 L188,150 L240,118 L240,240 L0,240 Z"
          fill="none"
          stroke="#78716c"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />

        {/* Snow cap on the summit */}
        <path
          d="M120,86 L132,70 L144,86 L138,90 L132,86 L126,90 Z"
          fill="#f1f5f9"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Climb path */}
        <path
          d="M20,222 Q70,180 110,150 T180,100"
          fill="none"
          stroke="#a1a1aa"
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeOpacity="0.5"
        />

        {/* Checkpoint flags */}
        {flags.map((f) => (
          <g key={f.step}>
            <line x1={f.x} y1={f.y - 14} x2={f.x} y2={f.y} stroke="#71717a" strokeWidth="1.5" />
            <path
              d={`M${f.x},${f.y - 14} l8,4 l-8,4 Z`}
              fill={f.reached ? "#f59e0b" : "#e4e4e7"}
              opacity={f.reached ? 1 : 0.6}
            />
          </g>
        ))}

        {/* The boulder */}
        <g>
          <circle cx={boulderX} cy={boulderY} r="13" fill="url(#ascent-sun)" stroke="#d97706" strokeWidth="1.5" />
          {/* shatter crack for the "rolling" feel */}
          <path d="M-5,-3 L-1,3 L3,4 L6,-2" transform={`translate(${boulderX}, ${boulderY})`} stroke="#92400e" strokeWidth="1" fill="none" opacity="0.5" />
        </g>

        {/* Base ground */}
        <line x1="14" y1="222" x2="226" y2="222" stroke="#78716c" strokeOpacity="0.3" strokeWidth="2" />
      </svg>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{height}</span>
        <span>of {ASCENT_MAX} steps climbed · checkpoint every {ASCENT_CHECKPOINT}</span>
      </div>
      {height >= ASCENT_MAX && (
        <span className="rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          ✨ Peak reached — the boulder rests today.
        </span>
      )}
    </div>
  );
}