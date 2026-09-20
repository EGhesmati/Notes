import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import type { TimerPhase } from "./PomodoroTimer";

gsap.registerPlugin(MotionPathPlugin);

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 148;
const SAMPLE_COUNT = 320;
const CLIMB_PATH = "M 48 258 C 74 268, 94 255, 112 242 C 134 228, 150 225, 166 216 C 188 205, 198 190, 211 178 C 224 166, 228 150, 240 136";
const FALLBACK = { x: 48, y: 258, deg: -10 };

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
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

type Point = { x: number; y: number; deg: number };

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
  const prefersReduced = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const climberRef = useRef<SVGGElement>(null);
  const stoneRef = useRef<SVGGElement>(null);
  const motionTlRef = useRef<gsap.core.Timeline | null>(null);
  const visualProgressRef = useRef(0);
  const [samples, setSamples] = useState<Point[]>([]);

  const currentPomodoroProgress = phase === "focus"
    ? Math.min(1, Math.max(0, pomodoroProgress))
    : 0;
  const safeTotal = Math.max(1, Math.round(totalPoints));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const journeyProgress = Math.min(1, Math.max(0, (safeCompleted + currentPomodoroProgress) / safeTotal));
  const initialProgressRef = useRef(journeyProgress);
  const ringProgress = useMotionValue(currentPomodoroProgress);
  const dashOffset = useTransform(ringProgress, (p) => 2 * Math.PI * RADIUS * (1 - p));

  useLayoutEffect(() => {
    const path = pathRef.current;
    const climber = climberRef.current;
    if (!path || !climber) return;
    const length = path.getTotalLength();
    const nextSamples: Point[] = [];
    for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
      const a = path.getPointAtLength((i / SAMPLE_COUNT) * length);
      const b = path.getPointAtLength((Math.min(SAMPLE_COUNT, i + 1) / SAMPLE_COUNT) * length);
      nextSamples.push({ x: a.x, y: a.y, deg: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI });
    }
    setSamples(nextSamples);
    gsap.set(climber, { motionPath: { path, autoRotate: false, start: initialProgressRef.current, end: initialProgressRef.current } });
    visualProgressRef.current = initialProgressRef.current;
    return () => {
      motionTlRef.current?.kill();
      gsap.killTweensOf(climber);
    };
  }, []);

  useEffect(() => {
    ringProgress.set(currentPomodoroProgress);
  }, [currentPomodoroProgress, ringProgress]);

  useEffect(() => {
    const climber = climberRef.current;
    const path = pathRef.current;
    if (!climber || !path) return;
    motionTlRef.current?.kill();
    const from = visualProgressRef.current;
    const distance = Math.abs(journeyProgress - from);
    if (distance < 0.0001) return;
    const completionTravel = !running && secondsLeft <= 0 && journeyProgress > from;
    if (!running && !completionTravel) return;
    if (prefersReduced) {
      gsap.set(climber, { motionPath: { path, autoRotate: false, start: journeyProgress, end: journeyProgress } });
      visualProgressRef.current = journeyProgress;
      return;
    }
    motionTlRef.current = gsap.timeline({
      onComplete: () => { visualProgressRef.current = journeyProgress; },
      onUpdate: () => {
        const timelineProgress = motionTlRef.current?.progress() ?? 1;
        visualProgressRef.current = from + (journeyProgress - from) * timelineProgress;
      },
    });
    motionTlRef.current.to(climber, {
      duration: completionTravel ? 1.05 : Math.max(0.12, distance * 1.8),
      ease: completionTravel ? "power2.inOut" : "none",
      motionPath: { path, autoRotate: false, start: from, end: journeyProgress },
    });
    if (stoneRef.current) {
      motionTlRef.current.to(stoneRef.current, {
        duration: completionTravel ? 1.05 : 0.25,
        rotate: "+=18",
        transformOrigin: "50% 50%",
        ease: "power1.inOut",
      }, 0);
    }
  }, [journeyProgress, running, secondsLeft, prefersReduced]);

  useEffect(() => {
    const climber = climberRef.current;
    if (!climber || prefersReduced) return;
    if (!running) {
      gsap.killTweensOf(climber, "y");
      return;
    }
    const effort = gsap.to(climber, { y: -1.3, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
    return () => { effort.kill(); };
  }, [running, prefersReduced]);

  const sample = samples[Math.max(0, Math.min(SAMPLE_COUNT, Math.round(journeyProgress * SAMPLE_COUNT)))] ?? FALLBACK;
  const checkpoints = Array.from({ length: safeTotal }, (_, index) => {
    const point = samples[Math.round(((index + 1) / safeTotal) * SAMPLE_COUNT)] ?? FALLBACK;
    return { index: index + 1, ...point };
  });
  const isFocus = phase === "focus";
  const completedState = isFocus && secondsLeft <= 0 && !running;
  const statusText = completedState ? "Focus complete" : running ? PHASE_STATUS[phase] : secondsLeft === duration ? "Ready" : "Paused";
  const lean = isFocus ? -Math.max(-24, Math.min(24, sample.deg)) : 0;

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1" className="stroke-border/50" />
          <motion.circle
            cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1.7" strokeLinecap="round"
            className={`${isFocus ? "stroke-indigo-600" : "stroke-foreground/25"}`}
            style={{ strokeDasharray: 2 * Math.PI * RADIUS, strokeDashoffset: dashOffset, filter: isFocus ? "drop-shadow(0 0 3px rgb(99 102 241 / 0.25))" : undefined }}
          />
        </svg>

        <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="climb-circle"><circle cx={CENTER} cy={CENTER} r={RADIUS - 2} /></clipPath>
          </defs>
          <g clipPath="url(#climb-circle)">
            <motion.path d="M 0 304 C 40 244 80 268 116 232 C 156 198 190 232 224 204 C 260 176 292 214 324 184 L 324 324 L 0 324 Z" className="fill-indigo-600/[0.035]" style={{ x: prefersReduced ? 0 : -journeyProgress * 2.5 }} />
            <motion.path d="M 0 324 L 0 284 C 42 264 66 280 104 252 C 138 228 164 255 198 232 C 234 208 270 244 324 210 L 324 324 Z" className="fill-indigo-600/[0.08]" style={{ x: prefersReduced ? 0 : -journeyProgress }} />
            <path ref={pathRef} d={CLIMB_PATH} fill="none" strokeWidth="1" strokeDasharray="2 5" className="stroke-foreground/15" />

            {checkpoints.map((checkpoint) => {
              const reached = safeCompleted >= checkpoint.index;
              const major = checkpoint.index % 4 === 0 || checkpoint.index === safeTotal;
              return (
                <g key={checkpoint.index} transform={`translate(${checkpoint.x},${checkpoint.y})`}>
                  <circle r={major ? 3 : 2} fill="none" strokeWidth="1" className={reached ? "stroke-indigo-500" : "stroke-border"} />
                  {reached && <circle r={major ? 4.5 : 3} className="fill-indigo-600/80" />}
                </g>
              );
            })}

            <g transform={`translate(${samples[SAMPLE_COUNT]?.x ?? 240},${samples[SAMPLE_COUNT]?.y ?? 136})`}>
              <line x1="0" y1="0" x2="0" y2="-8" strokeWidth="1.1" className="stroke-foreground/35" />
              <path d="M 0 -8 L 5 -6.5 L 0 -4.5 Z" fill="none" strokeWidth="1" className={safeCompleted >= safeTotal ? "stroke-foreground" : "stroke-foreground/25"} />
            </g>

            <motion.g ref={climberRef} initial={false}>
              <g transform={`rotate(${lean})`}>
                <g className="text-foreground/85" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="-3" cy="-19" r="2.3" />
                  <path d="M -3.4 -16.5 L -1 -9.5 L -3.5 -3.3 L -6 -1" />
                  <path d="M -1 -9.5 L 3 -4.5 L 3.5 -1" />
                  <path d="M -2.5 -14.2 L 7 -10 L 10 -7" />
                  <path d="M -1.5 -13 L 7 -9 L 10 -5.5" />
                </g>
                <g ref={stoneRef} transform="translate(13,-7)">
                  <circle cx="0" cy="0" r="8" className="fill-indigo-600/90" />
                  <path d="M -5 -4 C -3 -7 1 -8 4 -6 L 2 -3 Z" className="fill-background/45" />
                </g>
              </g>
            </motion.g>
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="flex flex-col items-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/45">{PHASE_SESSION_LABEL[phase]}</span>
              <span className="mt-3 font-sans text-7xl font-extralight tracking-tight tabular-nums text-foreground sm:text-8xl">{formatTime(secondsLeft)}</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={statusText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-foreground/50">
                  {running && isFocus && <span className="h-1 w-1 rounded-full bg-indigo-500" />}
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
