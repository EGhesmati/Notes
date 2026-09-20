import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";

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

/* Climb from the bottom-left base up to the peak (fractions of the container). */
const BASE = { x: 0.0, y: 0.98 };
const PEAK = { x: 0.62, y: 0.2 };

function pointAt(fraction: number): { xFrac: number; yFrac: number } {
  return {
    xFrac: BASE.x + (PEAK.x - BASE.x) * fraction,
    yFrac: BASE.y + (PEAK.y - BASE.y) * fraction,
  };
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
 * Signature climbing progression.
 *
 * A boulder climbs the front ridge of a small layered mountain (subtle parallax
 * between the two ridges) and unlocks a flag at each checkpoint. The climb is the
 * reward — restrained, smooth, and driven only by completed pomodoros.
 */
export function MountainProgress({ height }: { height: number }) {
  const { title } = ascentLevel(height);
  const clampH = Math.min(ASCENT_MAX, Math.max(0, height));

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const controls = useAnimationControls();
  const prevHeightRef = useRef(clampH);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* Signature moment: reaching a checkpoint gives the boulder a small settle. */
  useEffect(() => {
    const prev = prevHeightRef.current;
    if (clampH > prev && clampH % ASCENT_CHECKPOINT === 0) {
      controls.start({
        scale: [1, 1.3, 1],
        transition: { duration: 0.55, ease: "easeOut" },
      });
    }
    prevHeightRef.current = clampH;
  }, [clampH, controls]);

  const fraction = size.w > 0 ? clampH / ASCENT_MAX : 0;
  const boulder = pointAt(fraction);

  const mod = clampH % ASCENT_CHECKPOINT;
  const toNext = mod === 0 && clampH > 0 ? ASCENT_CHECKPOINT : ASCENT_CHECKPOINT - mod;
  const nextLabel = toNext === 1 ? "1 pomodoro" : `${toNext} pomodoros`;

  const milestones = [0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full select-none">
      {/* Level + steps */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MountainIcon className="h-3.5 w-3.5 text-indigo-500/80" />
          <span className="text-xs font-medium text-foreground">{title}</span>
        </div>
        <div className="flex items-baseline text-[11px] text-muted-foreground">
          <span className="min-w-4 text-right tabular-nums">{clampH}</span>
          <span className="tabular-nums"> / {ASCENT_MAX} steps</span>
        </div>
      </div>

      {/* Layered mountain with parallax */}
      <div ref={containerRef} className="relative mt-3 h-16 w-full overflow-hidden">
        {/* back ridge — shallower parallax drift */}
        <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-full w-full" aria-hidden>
          <motion.path
            d="M-16 90 L64 30 L126 56 L184 14 L240 52 L292 36 L320 46 L320 90 Z"
            className="fill-indigo-600/[0.04]"
            animate={{ x: -fraction * 8 }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </svg>
        {/* front ridge — the climb route */}
        <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-full w-full" aria-hidden>
          <motion.path
            d="M-6 90 L70 62 L140 40 L198 18 L232 34 L280 32 L320 42 L320 90 Z"
            className="fill-indigo-600/10"
            animate={{ x: -fraction * 3 }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </svg>

        {/* faint climb line */}
        <svg viewBox="0 0 320 90" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <line
            x1={BASE.x * 320}
            y1={BASE.y * 90}
            x2={PEAK.x * 320}
            y2={PEAK.y * 90}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="2 3"
            className="text-foreground/30"
          />
        </svg>

        {/* checkpoints */}
        {milestones.map((m) => {
          const p = pointAt(m);
          const reached = clampH >= Math.round(m * ASCENT_MAX);
          return (
            <span
              key={m}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.xFrac * 100}%`, top: `${p.yFrac * 100}%` }}
            >
              <AnimatePresence initial={false}>
                {reached ? (
                  <motion.span
                    key="filled"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22 }}
                    className="block h-1.5 w-1.5 rounded-full border border-indigo-600 bg-indigo-600"
                  />
                ) : (
                  <motion.span
                    key="empty"
                    initial={false}
                    exit={{ scale: 0.4, opacity: 0 }}
                    className="block h-1.5 w-1.5 rounded-full border border-border bg-background"
                  />
                )}
              </AnimatePresence>
            </span>
          );
        })}

        {/* the boulder */}
        {size.w > 0 && (
          <motion.div
            className="absolute left-0 top-0 z-10"
            initial={false}
            animate={{ x: size.w * boulder.xFrac, y: size.h * boulder.yFrac }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          >
            <motion.div
              animate={controls}
              className="-ml-[7px] -mt-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-indigo-600 bg-background shadow-sm"
            >
              <span
                className={`h-1 w-1 rounded-full ${clampH >= ASCENT_MAX ? "bg-amber-500" : "bg-indigo-600"}`}
              />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-foreground/50">
        <span>Next checkpoint · {nextLabel}</span>
        {clampH >= ASCENT_MAX ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">Peak reached</span>
        ) : (
          <span>checkpoint every {ASCENT_CHECKPOINT}</span>
        )}
      </div>
    </div>
  );
}