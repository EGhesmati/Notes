import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import gsap from "gsap";
import type { TimerPhase } from "./PomodoroTimer";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 148;
const BASE_Y = 270;
const TOWER_TOP = 92;

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
  const constructionRef = useRef<SVGGElement>(null);
  const towerRef = useRef<SVGGElement>(null);
  const beamRef = useRef<SVGGElement>(null);
  const atmosphereRef = useRef<SVGGElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const visualPointsRef = useRef(completedPoints);

  const safeTotal = Math.max(1, Math.round(totalPoints));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const currentProgress = phase === "focus" ? Math.min(1, Math.max(0, pomodoroProgress)) : 0;
  const ringProgress = useMotionValue(currentProgress);
  const dashOffset = useTransform(ringProgress, (value) => 2 * Math.PI * RADIUS * (1 - value));
  const isFocus = phase === "focus";
  const complete = safeCompleted >= safeTotal;
  const statusText = isFocus && secondsLeft <= 0 && !running
    ? complete ? "Lighthouse complete" : "Focus complete"
    : running ? PHASE_STATUS[phase] : secondsLeft === duration ? "Ready" : "Paused";

  const sections = useMemo(
    () => Array.from({ length: safeTotal }, (_, index) => index),
    [safeTotal],
  );
  const sectionHeight = (BASE_Y - TOWER_TOP - 20) / safeTotal;
  const currentSection = Math.min(safeTotal - 1, safeCompleted);
  const yFor = (index: number) => BASE_Y - 15 - (index + 1) * sectionHeight;

  useEffect(() => {
    ringProgress.set(currentProgress);
  }, [currentProgress, ringProgress]);

  useEffect(() => {
    const construction = constructionRef.current;
    const tower = towerRef.current;
    const beam = beamRef.current;
    const atmosphere = atmosphereRef.current;
    if (!construction || !tower || !beam || !atmosphere) return;

    timelineRef.current?.kill();
    const previous = visualPointsRef.current;
    const delta = safeCompleted - previous;
    visualPointsRef.current = safeCompleted;

    if (delta < 0) {
      gsap.set(tower, { scaleY: 1 });
      gsap.set(beam, { opacity: complete ? 0.5 : 0.14, scale: 1, rotation: 0 });
    }

    gsap.set(construction, {
      opacity: isFocus && !complete ? 0.25 + currentProgress * 0.55 : 0,
      y: isFocus && !complete ? (1 - currentProgress) * 3 : 0,
      scaleY: isFocus && !complete ? 0.76 + currentProgress * 0.24 : 1,
      transformOrigin: "50% 100%",
    });

    timelineRef.current = gsap.timeline({ paused: !running && delta <= 0 });
    if (delta > 0) {
      timelineRef.current
        .fromTo(tower, { scaleY: 0.985 }, { scaleY: 1, duration: prefersReduced ? 0 : 0.85, ease: "power2.out", transformOrigin: "50% 100%" })
        .fromTo(beam, { opacity: 0.15, scale: 0.88 }, { opacity: complete ? 0.56 : 0.3, scale: 1, duration: prefersReduced ? 0 : 0.7, ease: "power2.out" }, 0.12);
    }
    if (complete) {
      gsap.to(beam, { rotation: 360, duration: prefersReduced ? 0 : 16, repeat: -1, ease: "none", transformOrigin: "0 0" });
    } else {
      gsap.killTweensOf(beam);
    }
    return () => {
      timelineRef.current?.kill();
      gsap.killTweensOf([beam, atmosphere]);
    };
  }, [complete, currentProgress, isFocus, prefersReduced, running, safeCompleted]);

  useEffect(() => {
    const atmosphere = atmosphereRef.current;
    if (!atmosphere || prefersReduced) return;
    const drift = gsap.to(atmosphere, { x: 3, duration: 5, yoyo: true, repeat: -1, ease: "sine.inOut", paused: !running });
    return () => { drift.kill(); };
  }, [prefersReduced, running]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1" className="stroke-border/50" />
          <motion.circle
            cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1.7" strokeLinecap="round"
            className={`${isFocus ? "stroke-indigo-600" : "stroke-foreground/25"}`}
            style={{ strokeDasharray: 2 * Math.PI * RADIUS, strokeDashoffset: dashOffset, filter: isFocus ? "drop-shadow(0 0 4px rgb(99 102 241 / 0.26))" : undefined }}
          />
        </svg>

        <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full">
          <defs>
            <clipPath id="lighthouse-world"><circle cx={CENTER} cy={CENTER} r={RADIUS - 2} /></clipPath>
          </defs>
          <g clipPath="url(#lighthouse-world)">
            <rect x="0" y="0" width="320" height="320" className="fill-background" />
            <g ref={atmosphereRef}>
              <path d="M 0 204 C 46 188 72 204 108 190 C 154 172 184 198 224 180 C 260 164 292 184 320 170 L 320 320 L 0 320 Z" className="fill-foreground/[0.025]" />
              <path d="M 0 238 C 46 220 82 242 120 224 C 160 205 202 240 240 216 C 270 198 296 220 320 208 L 320 320 L 0 320 Z" className="fill-foreground/[0.045]" />
              <path d="M 0 270 C 55 258 94 270 138 260 C 188 248 225 270 270 254 C 292 246 306 254 320 248 L 320 320 L 0 320 Z" className="fill-foreground/[0.07]" />
              <path d="M 0 282 Q 42 274 84 282 T 168 282 T 252 282 T 336 282" fill="none" strokeWidth="1" className="stroke-foreground/10" />
              <path d="M 0 294 Q 42 286 84 294 T 168 294 T 252 294 T 336 294" fill="none" strokeWidth="0.8" className="stroke-foreground/10" />
            </g>

            <g ref={beamRef} opacity={complete ? 0.5 : 0.14}>
              <path d="M 160 106 L 76 62 L 76 82 Z" className="fill-indigo-500/[0.08]" />
              <path d="M 160 106 L 244 62 L 244 82 Z" className="fill-indigo-500/[0.06]" />
            </g>

            <g ref={towerRef}>
              <rect x="136" y={BASE_Y - 13} width="48" height="13" rx="2" className="fill-foreground/[0.08]" />
              {sections.map((index) => {
                const y = yFor(index);
                const reached = index < safeCompleted;
                const current = index === currentSection && !reached && isFocus;
                return (
                  <g key={index} opacity={reached ? 1 : current ? 0.42 + currentProgress * 0.48 : 0.12}>
                    <path d={`M ${136 - index * 0.22} ${y} L ${184 + index * 0.22} ${y} L ${180 + index * 0.18} ${y - sectionHeight + 1} L ${140 - index * 0.18} ${y - sectionHeight + 1} Z`} className={reached ? "fill-foreground/[0.18]" : "fill-transparent"} />
                    <path d={`M 142 ${y - sectionHeight + 3} L 178 ${y - sectionHeight + 3}`} strokeWidth="1" className={reached ? "stroke-foreground/30" : "stroke-foreground/10"} />
                    {index % 4 === 3 && <path d={`M 133 ${y - sectionHeight} L 187 ${y - sectionHeight}`} strokeWidth="1.5" className="stroke-indigo-500/30" />}
                  </g>
                );
              })}
              <path d="M 132 107 L 188 107 L 184 96 L 136 96 Z" className="fill-foreground/[0.18]" />
              <rect x="139" y="96" width="42" height="8" rx="1.5" className="fill-indigo-500/15" />
              <path d="M 145 96 L 145 88 L 175 88 L 175 96" fill="none" strokeWidth="1.5" className="stroke-foreground/55" />
              <path d="M 148 88 L 148 80 L 172 80 L 172 88 Z" className="fill-foreground/[0.2]" />
              <circle cx="160" cy="84" r="4" className={`${complete ? "fill-indigo-500/70" : "fill-indigo-500/20"}`} />
            </g>

            <g ref={constructionRef} transform={`translate(0,0)`}>
              <path d={`M 142 ${yFor(currentSection) - sectionHeight} L 178 ${yFor(currentSection) - sectionHeight}`} strokeWidth="2" className="stroke-indigo-500/60" />
              <path d={`M 143 ${yFor(currentSection) - sectionHeight + 5} L 177 ${yFor(currentSection) - sectionHeight + 5}`} strokeWidth="1" className="stroke-indigo-500/35" />
              <circle cx="132" cy={yFor(currentSection) - sectionHeight / 2} r="2" className="fill-indigo-500/55" />
              <circle cx="188" cy={yFor(currentSection) - sectionHeight / 2} r="2" className="fill-indigo-500/55" />
            </g>

            <g transform="translate(160,78)">
              <path d="M 0 -9 L 0 0" strokeWidth="1" className="stroke-foreground/55" />
              <path d="M 0 -9 L 7 -6 L 0 -3 Z" className={`${complete ? "fill-indigo-500/70" : "fill-indigo-500/35"}`} />
            </g>
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="z-10 flex flex-col items-center">
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground/45">{PHASE_SESSION_LABEL[phase]}</span>
              <span className="mt-3 font-sans text-7xl font-extralight tracking-tight tabular-nums text-foreground sm:text-8xl">{formatTime(secondsLeft)}</span>
              <motion.span key={statusText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-foreground/50">
                {running && isFocus && <span className="h-1 w-1 rounded-full bg-indigo-500" />}
                {statusText}
              </motion.span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
