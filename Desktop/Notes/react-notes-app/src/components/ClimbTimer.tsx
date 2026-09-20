import { useEffect, useId, useMemo, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import gsap from "gsap";
import type { TimerPhase } from "./PomodoroTimer";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 148;
const LIGHTHOUSE_X = 244;
const BASE_Y = 276;
const TOWER_TOP = 128;

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
  const clipId = useId().replace(/:/g, "");
  const constructionRef = useRef<SVGGElement>(null);
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
  const sectionHeight = (BASE_Y - TOWER_TOP - 22) / safeTotal;
  const currentSection = Math.min(safeTotal - 1, safeCompleted);
  const yFor = (index: number) => BASE_Y - 14 - (index + 1) * sectionHeight;

  useEffect(() => {
    ringProgress.set(currentProgress);
  }, [currentProgress, ringProgress]);

  useEffect(() => {
    const construction = constructionRef.current;
    const beam = beamRef.current;
    const atmosphere = atmosphereRef.current;
    if (!construction || !beam || !atmosphere) return;

    const previous = visualPointsRef.current;
    const delta = safeCompleted - previous;
    visualPointsRef.current = safeCompleted;
    timelineRef.current?.revert();
    timelineRef.current?.kill();

    gsap.context(() => {
      gsap.set(construction, {
        opacity: isFocus && !complete ? 0.25 + currentProgress * 0.55 : 0,
        y: isFocus && !complete ? (1 - currentProgress) * -4 : 0,
      });
      gsap.set(beam, { opacity: complete ? 0.38 : 0.1, rotation: 0, transformOrigin: `${LIGHTHOUSE_X}px 112px` });

      const timeline = gsap.timeline({ paused: !running && delta <= 0 });
      if (delta > 0 && !prefersReduced) {
        timeline
          .fromTo(construction, { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: "power2.out" })
          .to(beam, { opacity: complete ? 0.5 : 0.28, duration: 0.6, ease: "power2.out" }, 0.1);
      }
      timelineRef.current = timeline;

      if (complete && running && !prefersReduced) {
        gsap.to(beam, { rotation: 360, duration: 16, repeat: -1, ease: "none", transformOrigin: `${LIGHTHOUSE_X}px 112px` });
      }
      if (running && !prefersReduced) {
        gsap.to(atmosphere, { x: 2, duration: 5, yoyo: true, repeat: -1, ease: "sine.inOut" });
      }
    });

    return () => {
      timelineRef.current?.revert();
      timelineRef.current?.kill();
      gsap.killTweensOf([beam, atmosphere, construction]);
    };
  }, [complete, currentProgress, isFocus, prefersReduced, running, safeCompleted]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        <svg viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1" className="stroke-border/50" />
          <motion.circle
            cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="1.7" strokeLinecap="round"
            className={isFocus ? "stroke-indigo-600" : "stroke-foreground/25"}
            style={{ strokeDasharray: 2 * Math.PI * RADIUS, strokeDashoffset: dashOffset }}
          />
        </svg>

        <svg viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <clipPath id={clipId}><circle cx={CENTER} cy={CENTER} r={RADIUS - 2} /></clipPath>
          </defs>

          <g clipPath={`url(#${clipId})`}>
            <g id="background">
              <rect width={SIZE} height={SIZE} className="fill-background" />
              <path d="M0 160 C55 144 92 158 132 150 C180 140 214 154 260 144 C285 139 305 141 320 138 L320 220 L0 220Z" className="fill-foreground/[0.025]" />
            </g>

            <g id="environment">
              <g ref={atmosphereRef}>
                <path d="M0 224 C45 213 82 226 122 215 C170 202 207 224 252 210 C282 201 304 211 320 207 L320 320 L0 320Z" className="fill-foreground/[0.045]" />
              </g>
              <path d="M0 263 C52 253 88 266 132 256 C177 246 218 265 262 252 C286 245 305 251 320 247 L320 320 L0 320Z" className="fill-foreground/[0.075]" />
              <path d="M0 282 Q42 274 84 282 T168 282 T252 282 T336 282" fill="none" strokeWidth="1" className="stroke-foreground/10" />
              <path d="M0 295 Q42 287 84 295 T168 295 T252 295 T336 295" fill="none" strokeWidth="0.8" className="stroke-foreground/10" />
            </g>

            <g id="beam" ref={beamRef}>
              <path d={`M${LIGHTHOUSE_X - 3} 112 L178 87 L178 102Z`} className="fill-indigo-500/[0.07]" />
              <path d={`M${LIGHTHOUSE_X + 3} 112 L302 87 L302 102Z`} className="fill-indigo-500/[0.05]" />
            </g>

            <g id="lighthouse">
              <rect x={LIGHTHOUSE_X - 22} y={BASE_Y - 13} width="44" height="13" rx="2" className="fill-foreground/[0.1]" />
              {sections.map((index) => {
                const y = yFor(index);
                const reached = index < safeCompleted;
                const current = index === currentSection && !reached && isFocus;
                const left = LIGHTHOUSE_X - 17 - index * 0.08;
                const right = LIGHTHOUSE_X + 17 + index * 0.08;
                return (
                  <g key={index} opacity={reached ? 1 : current ? 0.45 + currentProgress * 0.4 : 0.16}>
                    <path d={`M${left} ${y} L${right} ${y} L${right - 3} ${y - sectionHeight + 1} L${left + 3} ${y - sectionHeight + 1}Z`} className={reached ? "fill-foreground/[0.18]" : "fill-transparent"} />
                    <path d={`M${left + 5} ${y - sectionHeight + 3} L${right - 5} ${y - sectionHeight + 3}`} strokeWidth="1" className={reached ? "stroke-foreground/30" : "stroke-foreground/10"} />
                    {index % 4 === 3 && <path d={`M${left - 4} ${y - sectionHeight} L${right + 4} ${y - sectionHeight}`} strokeWidth="1.5" className="stroke-indigo-500/30" />}
                  </g>
                );
              })}
              <path d={`M${LIGHTHOUSE_X - 26} 129 L${LIGHTHOUSE_X + 26} 129 L${LIGHTHOUSE_X + 21} 118 L${LIGHTHOUSE_X - 21} 118Z`} className="fill-foreground/[0.18]" />
              <rect x={LIGHTHOUSE_X - 19} y="118" width="38" height="8" rx="1.5" className="fill-indigo-500/15" />
              <path d={`M${LIGHTHOUSE_X - 14} 118 L${LIGHTHOUSE_X - 14} 110 L${LIGHTHOUSE_X + 14} 110 L${LIGHTHOUSE_X + 14} 118`} fill="none" strokeWidth="1.5" className="stroke-foreground/55" />
              <path d={`M${LIGHTHOUSE_X - 11} 110 L${LIGHTHOUSE_X - 11} 102 L${LIGHTHOUSE_X + 11} 102 L${LIGHTHOUSE_X + 11} 110Z`} className="fill-foreground/[0.2]" />
              <circle cx={LIGHTHOUSE_X} cy="106" r="4" className={complete ? "fill-indigo-500/70" : "fill-indigo-500/20"} />
            </g>

            <g id="construction" ref={constructionRef}>
              <path d={`M${LIGHTHOUSE_X - 15} ${yFor(currentSection) - sectionHeight} L${LIGHTHOUSE_X + 15} ${yFor(currentSection) - sectionHeight}`} strokeWidth="2" className="stroke-indigo-500/60" />
              <path d={`M${LIGHTHOUSE_X - 14} ${yFor(currentSection) - sectionHeight + 5} L${LIGHTHOUSE_X + 14} ${yFor(currentSection) - sectionHeight + 5}`} strokeWidth="1" className="stroke-indigo-500/35" />
            </g>
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-[17%] flex items-center justify-center rounded-full bg-background/95">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="z-10 flex flex-col items-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-foreground/45">{PHASE_SESSION_LABEL[phase]}</span>
              <span className="mt-2 font-sans text-5xl font-extralight tracking-tight tabular-nums text-foreground sm:text-6xl">{formatTime(secondsLeft)}</span>
              <motion.span key={statusText} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-foreground/50">
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
