import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import type { TimerPhase } from "./PomodoroTimer";
import { ASCENT_MAX } from "@/hooks/use-pomodoro-stats";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 148;

/* One unified climb path: from the base (bottom-left) up to the summit
   checkpoint on the right, entirely inside the lower arc of the circle. */
const CLIMB_PATH =
  "M 68 252 C 116 262, 150 232, 186 220 C 212 211, 228 202, 238 190";

const SUMMIT = { x: 238, y: 190 };

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const PHASE_SESSION_LABEL: Record<TimerPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const PHASE_STATUS: Record<TimerPhase, string> = {
  focus: "Deep work",
  "short-break": "Short break",
  "long-break": "Long break",
};

/**
 * The Pomodoro timer is a mountain: countdown in the foreground, a layered
 * landscape behind it, and a climber pushing a stone along the interior route.
 * Every finished focus session steps the climber one rung up the path; each
 * `checkpointStep`-th session unlocks a checkpoint.
 */
export function ClimbTimer({
  secondsLeft,
  duration,
  phase,
  running,
  ascent,
  checkpointStep,
}: {
  secondsLeft: number;
  duration: number;
  phase: TimerPhase;
  running: boolean;
  ascent: number;
  checkpointStep: number;
}) {
  const prefersReduced = useReducedMotion();

  const progress = duration > 0 ? Math.min(1, Math.max(0, secondsLeft / duration)) : 0;
  const elapsed = 1 - progress;
  const completed = Math.min(ASCENT_MAX, Math.max(0, ascent));
  const step = Math.max(1, Math.min(ASCENT_MAX, Math.round(checkpointStep)));

  /* Position along the climb route. During a focus session the climber covers
     the next rung smoothly; during breaks he rests at the rung just reached. */
  const frac = Math.min(
    ASCENT_MAX,
    Math.max(0, completed + (phase === "focus" ? elapsed : 0)),
  );

  /* Ring + smoothed progression, keeps the arc and the climber in lockstep. */
  const ringProgress = useMotionValue(progress);
  const ringSpring = useSpring(ringProgress, { stiffness: 80, damping: 26 });
  const dashOffset = useTransform(ringSpring, (p) => 2 * Math.PI * RADIUS * (1 - p));

  useEffect(() => {
    ringProgress.set(progress);
  }, [progress, ringProgress]);

  /* Position / lean along the path. Route is static, so measure it once on
     mount into a fixed-size array and look up by index during render. */
  const SAMPLE_COUNT = 320;
  const pathRef = useRef<SVGPathElement>(null);
  const [samples, setSamples] = useState<{ x: number; y: number; deg: number }[]>([]);

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    const pts: { x: number; y: number; deg: number }[] = [];
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const p1 = el.getPointAtLength((i / SAMPLE_COUNT) * len);
      const t2 = Math.min(SAMPLE_COUNT, i + 1) / SAMPLE_COUNT;
      const p2 = el.getPointAtLength(t2 * len);
      const deg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
      pts.push({ x: p1.x, y: p1.y, deg });
    }
    setSamples(pts);
  }, []);

  const clampIndex = (v: number) => Math.max(0, Math.min(SAMPLE_COUNT, Math.round(v)));
  const sample =
    samples[clampIndex((frac / ASCENT_MAX) * SAMPLE_COUNT)] ?? {
      x: 68,
      y: 252,
      deg: 0,
    };

  /* Checkpoints at every `step` rungs; marker sits at that fraction of the path. */
  const checkpointCount = Math.floor(ASCENT_MAX / step);
  const checkpointPoints = Array.from(
    { length: checkpointCount },
    (_, i) => {
      const level = step * (i + 1);
      const pt =
        samples[clampIndex((level / ASCENT_MAX) * SAMPLE_COUNT)] ?? {
          x: 0,
          y: 0,
        };
      return { level, x: pt.x, y: pt.y };
    },
  );

  /* Checkpoint unlock pulse. */
  const [pulseAt, setPulseAt] = useState<number | null>(null);
  const prevFracRef = useRef(frac);
  useEffect(() => {
    const prev = prevFracRef.current;
    prevFracRef.current = frac;
    if (frac > prev) {
      const hit = checkpointPoints
        .filter((c) => prev < c.level && frac >= c.level)
        .map((c) => c.level)[0];
      if (hit) {
        setPulseAt(hit);
        const id = window.setTimeout(() => setPulseAt(null), 950);
        return () => window.clearTimeout(id);
      }
    }
  }, [frac, checkpointPoints]);

  const isActive = phase === "focus";
  const walking = running && isActive;
  const statusText = running
    ? PHASE_STATUS[phase]
    : secondsLeft === duration
      ? "Ready"
      : "Paused";

  // Lean into the slope (clamped). Applied as a native SVG transform so the
  // figure pivots around its feet, not the viewBox corner.
  const lean = isActive ? -Math.max(-24, Math.min(24, sample.deg)) : 0;
  const stoneRot = (frac / ASCENT_MAX) * 720;

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        {/* Progress ring */}
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth="1"
            className="stroke-border/50"
          />
          <motion.circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={`${isActive ? "stroke-indigo-600" : "stroke-foreground/25"}`}
            style={{ strokeDasharray: 2 * Math.PI * RADIUS, strokeDashoffset: dashOffset }}
          />
        </svg>

        {/* Interior: mountain + climber */}
        <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="climb-circle">
              <circle cx={CENTER} cy={CENTER} r={RADIUS - 2} />
            </clipPath>
          </defs>
          <g clipPath="url(#climb-circle)">
            {/* far ridge — slowest parallax */}
            <motion.path
              d="M 8 306 C 46 244 76 264 112 238 C 148 212 176 242 212 228 C 246 215 286 250 312 238 L 312 312 L 8 312 Z"
              className="fill-indigo-600/[0.05]"
              animate={{ x: prefersReduced ? 0 : -frac * 0.5 }}
              transition={{ type: "spring", stiffness: 90, damping: 24 }}
            />
            {/* near ridge — tighter landscape */}
            <motion.path
              d="M 8 320 L 8 292 C 40 274 64 282 92 264 C 122 246 148 264 176 250 C 210 232 244 258 280 242 C 296 234 306 240 312 238 L 312 320 Z"
              className="fill-indigo-600/[0.09]"
              animate={{ x: prefersReduced ? 0 : -frac * 0.18 }}
              transition={{ type: "spring", stiffness: 90, damping: 24 }}
            />

            {/* the climb route */}
            <path
              ref={pathRef}
              d={CLIMB_PATH}
              fill="none"
              strokeWidth="1"
              strokeDasharray="2 5"
              className="stroke-foreground/15"
            />

            {/* checkpoints */}
            {checkpointPoints.map(({ level, x, y }) => {
              const reached = frac >= level;
              return (
                <g key={level} transform={`translate(${x}, ${y})`}>
                  <motion.circle
                    r={2.6}
                    fill="none"
                    strokeWidth="1"
                    className="stroke-border"
                    animate={{ r: reached ? 4 : 2.6, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  />
                  {reached && (
                    <motion.circle
                      r={3}
                      className="fill-indigo-600"
                      initial={{ r: 0.5, opacity: 0 }}
                      animate={{ r: 5.5, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    />
                  )}
                  {pulseAt === level && (
                    <motion.circle
                      r={2.6}
                      fill="none"
                      strokeWidth="1.5"
                      className="stroke-indigo-500"
                      initial={{ r: 2.6, opacity: 0.9 }}
                      animate={prefersReduced ? { r: 8, opacity: 0.5 } : { r: 16, opacity: 0 }}
                      transition={{ duration: 0.95, ease: "easeOut" }}
                    />
                  )}
                </g>
              );
            })}

            {/* summit flag */}
            <g transform={`translate(${SUMMIT.x}, ${SUMMIT.y})`}>
              <line x1="0" y1="0" x2="0" y2="-7" strokeWidth="1.1" className="stroke-foreground/30" />
              <path
                d="M 0 -7 L 4.5 -5.5 L 0 -4 Z"
                fill="none"
                strokeWidth="1"
                className={frac >= ASCENT_MAX ? "stroke-foreground" : "stroke-foreground/25"}
              />
            </g>

            {/* the climber + stone — native SVG transforms, so rotation
                pivots at the contact point instead of the viewBox corner */}
            <motion.g
              animate={{ x: sample.x, y: sample.y }}
              transition={{ type: "spring", stiffness: 70, damping: 20 }}
            >
              <g transform={`rotate(${lean})`}>
                <motion.g
                  animate={walking ? { y: [0, -1.6, 0] } : { y: 0 }}
                  transition={walking ? { duration: 0.85, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                >
                  {/* stone */}
                  <g transform={`translate(12, -7) rotate(${stoneRot})`}>
                    <circle cx="0" cy="0" r="5.2" className="fill-indigo-600/90" />
                    <path
                      d="M -3.5 -3.2 C -3.2 -4.6 -1.8 -5.2 -0.4 -5 L 0 -3.4 Z"
                      className="fill-background/60"
                    />
                  </g>

                  {/* figure — climber leaning in to push the boulder */}
                  <g
                    className="text-foreground/85"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="2" cy="-19" r="2.2" />
                    <path d="M 1.6 -16.6 L 2.2 -9.5" />
                    <path d="M 2.2 -9.5 L 0.6 -4.8 L -1.4 -1" />
                    <path d="M 2.2 -9.5 L 4.6 -5.4 L 5.6 -1" />
                    <path d="M 2 -14.2 C 4.6 -13.4 6.8 -11.6 8.6 -9.2" />
                    <path d="M 2.1 -13 C 4.8 -12.4 7 -10.6 8.8 -7.8" />
                  </g>
                </motion.g>
              </g>
            </motion.g>
          </g>
        </svg>

        {/* Foreground: countdown */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/45">
                {PHASE_SESSION_LABEL[phase]}
              </span>
              <span className="mt-3 font-sans text-7xl font-extralight tracking-tight tabular-nums text-foreground sm:text-8xl">
                {formatTime(secondsLeft)}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={statusText}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-foreground/50"
                >
                  {running && isActive && (
                    <motion.span
                      className="h-1 w-1 rounded-full bg-indigo-500"
                      animate={prefersReduced ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
                      transition={prefersReduced ? {} : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  {statusText}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}