import { useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { CustomEase } from "gsap/CustomEase";
import type { TimerPhase } from "./PomodoroTimer";

gsap.registerPlugin(MotionPathPlugin, CustomEase);
CustomEase.create("architectural", "0.22, 0.61, 0.36, 1");

const VIEWBOX = { width: 640, height: 440 };
const BASE_Y = 350;
const TOP_Y = 142;
const TIMER_RADIUS = 128;

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
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
  const rootRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<SVGGElement>(null);
  const atmosphereRef = useRef<SVGGElement>(null);
  const progressRef = useRef<SVGCircleElement>(null);
  const completionRef = useRef<SVGGElement>(null);
  const visualPointsRef = useRef(Math.max(0, Math.floor(completedPoints)));
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const safeTotal = Math.max(1, Math.round(totalPoints));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const progress = phase === "focus" ? Math.min(1, Math.max(0, pomodoroProgress)) : 0;
  const complete = safeCompleted >= safeTotal;
  const circumference = 2 * Math.PI * TIMER_RADIUS;
  const sectionHeight = Math.max(5, (BASE_Y - TOP_Y - 12) / safeTotal);
  const sections = useMemo(() => Array.from({ length: safeTotal }, (_, index) => index), [safeTotal]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const beam = beamRef.current;
    const atmosphere = atmosphereRef.current;
    const progressRing = progressRef.current;
    const completion = completionRef.current;
    if (!root || !beam || !atmosphere || !progressRing || !completion) return;

    const ctx = gsap.context(() => {
      const previous = visualPointsRef.current;
      const delta = safeCompleted - previous;
      visualPointsRef.current = safeCompleted;

      gsap.set(progressRing, { strokeDashoffset: circumference * (1 - progress) });
      gsap.set(beam, { transformOrigin: "320px 150px", opacity: complete ? 0.34 : 0.11 });
      gsap.set(atmosphere, { x: 0 });

      if (delta > 0 && !reducedMotion) {
        gsap.timeline({ defaults: { ease: "architectural" } })
          .fromTo(completion, { opacity: 0, y: 15, scaleY: 0.72 }, { opacity: 1, y: 0, scaleY: 1, duration: 0.48, transformOrigin: "50% 100%" }, 0.15)
          .to(completion, { opacity: 0, duration: 0.28 }, 0.82)
          .fromTo(beam, { opacity: 0.08 }, { opacity: complete ? 0.38 : 0.18, duration: 0.42 }, 0.46);
      } else {
        gsap.set(completion, { opacity: 0, y: 0, scaleY: 1 });
      }

      const beamTween = complete && !reducedMotion
        ? gsap.to(beam, { rotation: 360, duration: 22, repeat: -1, ease: "none", transformOrigin: "320px 150px", paused: !running })
        : null;
      const driftTween = !reducedMotion
        ? gsap.to(atmosphere, { x: 7, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut", paused: !running })
        : null;

      if (beamTween) beamTween.paused(!running);
      if (driftTween) driftTween.paused(!running);
      return () => {
        beamTween?.kill();
        driftTween?.kill();
      };
    }, root);
    return () => ctx.revert();
  }, [complete, circumference, progress, reducedMotion, running, safeCompleted]);

  const towerSections = sections.map((index) => {
    const y = BASE_Y - 12 - (index + 1) * sectionHeight;
    const reached = index < safeCompleted;
    const width = 70 + (index / Math.max(1, safeTotal - 1)) * 18;
    return (
      <g key={index} opacity={reached ? 1 : 0.13}>
        <path d={`M ${320 - width / 2} ${y} L ${320 + width / 2} ${y} L ${320 + width / 2 - 3} ${y - sectionHeight + 1} L ${320 - width / 2 + 3} ${y - sectionHeight + 1} Z`} fill={reached ? "#b8c7d9" : "#738196"} />
        <path d={`M ${320 - width / 2 + 7} ${y - sectionHeight + 3} L ${320 + width / 2 - 7} ${y - sectionHeight + 3}`} stroke="#edf4fb" strokeOpacity={reached ? 0.42 : 0.12} strokeWidth="1" />
        {index % 4 === 3 && <path d={`M ${320 - width / 2 - 4} ${y - sectionHeight} L ${320 + width / 2 + 4} ${y - sectionHeight}`} stroke="#d7e4ef" strokeOpacity="0.5" strokeWidth="2" />}
      </g>
    );
  });

  return (
    <div ref={rootRef} className="focus-flow-visualization relative w-full max-w-[34rem]" aria-label={`${safeCompleted} of ${safeTotal} lighthouse construction points completed`}>
      <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="h-auto w-full overflow-visible" role="img">
        <defs>
          <linearGradient id="focus-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#12243a" /><stop offset="1" stopColor="#34516a" /></linearGradient>
          <linearGradient id="focus-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#274a61" /><stop offset="1" stopColor="#102638" /></linearGradient>
          <filter id="focus-soft-light"><feGaussianBlur stdDeviation="7" /></filter>
          <clipPath id="focus-world"><rect x="0" y="0" width="640" height="440" rx="24" /></clipPath>
        </defs>
        <g clipPath="url(#focus-world)">
          <rect width="640" height="440" fill="url(#focus-sky)" />
          <path d="M0 258 C120 232 188 264 286 240 C390 214 490 258 640 224 V440 H0Z" fill="#1b3a51" opacity="0.75" />
          <path d="M0 298 C126 276 220 314 336 280 C452 247 535 301 640 272 V440 H0Z" fill="url(#focus-sea)" />
          <g ref={atmosphereRef} opacity="0.45"><path d="M0 328 Q100 314 200 328 T400 328 T640 328" fill="none" stroke="#8eafc2" strokeOpacity="0.25" /><path d="M0 353 Q100 339 200 353 T400 353 T640 353" fill="none" stroke="#8eafc2" strokeOpacity="0.18" /></g>
          <g ref={beamRef} opacity="0.12"><path d="M320 150 L58 88 L58 120 Z" fill="#dcecf5" opacity="0.18" filter="url(#focus-soft-light)" /><path d="M320 150 L582 88 L582 120 Z" fill="#dcecf5" opacity="0.12" filter="url(#focus-soft-light)" /></g>
          <ellipse cx="320" cy="363" rx="112" ry="13" fill="#071624" opacity="0.38" />
          <g>{towerSections}<rect x="277" y="338" width="86" height="13" rx="2" fill="#d7e1e9" /><path d="M272 338 H368 L357 325 H283Z" fill="#aec0ce" /><rect x="286" y="130" width="68" height="10" rx="2" fill="#d7e1e9" /><path d="M295 130 V116 H345 V130" fill="none" stroke="#d7e1e9" strokeWidth="3" /><rect x="301" y="98" width="38" height="18" rx="2" fill="#8298a9" /><circle cx="320" cy="107" r="7" fill={complete ? "#f6e7b2" : "#a4b8c6"} /></g>
          <g ref={completionRef} opacity="0"><path d={`M274 ${BASE_Y - 12 - (safeCompleted) * sectionHeight} H366`} stroke="#e7f4fb" strokeWidth="3" /><circle cx="270" cy={BASE_Y - 12 - safeCompleted * sectionHeight - sectionHeight / 2} r="3" fill="#e7f4fb" /><circle cx="370" cy={BASE_Y - 12 - safeCompleted * sectionHeight - sectionHeight / 2} r="3" fill="#e7f4fb" /></g>
          {complete && <path d="M286 368 Q320 355 354 368" fill="none" stroke="#dcecf5" strokeOpacity="0.28" strokeWidth="3" />}
        </g>
        <circle cx="320" cy="220" r={TIMER_RADIUS} fill="#0b1c2c" fillOpacity="0.42" stroke="#d7e6f0" strokeOpacity="0.15" />
        <circle cx="320" cy="220" r={TIMER_RADIUS} fill="none" stroke="#d7e6f0" strokeOpacity="0.12" strokeWidth="2" />
        <circle ref={progressRef} cx="320" cy="220" r={TIMER_RADIUS} fill="none" stroke={phase === "focus" ? "#d7ebf5" : "#a9c0cd"} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} transform="rotate(-90 320 220)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-1 text-center text-white">
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">{PHASE_LABEL[phase]}</span>
        <span className="mt-3 text-6xl font-extralight tracking-tight tabular-nums sm:text-7xl">{formatTime(secondsLeft)}</span>
        <span className="mt-2 text-[11px] font-medium text-white/55">{running ? PHASE_STATUS[phase] : secondsLeft === duration ? "Ready" : "Paused"}</span>
        <span className="mt-5 text-[11px] font-medium tabular-nums text-white/70">{safeCompleted} / {safeTotal} points</span>
      </div>
    </div>
  );
}
