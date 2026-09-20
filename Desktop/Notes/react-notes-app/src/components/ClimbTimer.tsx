import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import * as THREE from "three";
import type { TimerPhase } from "./PomodoroTimer";

const RADIUS = 148;
const WORLD_WIDTH = 320;
const WORLD_HEIGHT = 260;

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

function pathPoint(progress: number): THREE.Vector3 {
  const t = Math.min(1, Math.max(0, progress));
  const x = -112 + t * 224;
  const y = -88 + Math.sin(t * Math.PI * 0.92) * 32 + t * 86;
  return new THREE.Vector3(x, y, 8);
}

function makeMountain(color: number, scale: number, z: number, opacity: number): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(100 * scale, 130 * scale, 4);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, -42, z);
  mesh.rotation.y = Math.PI / 4;
  return mesh;
}

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
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<THREE.Group | null>(null);
  const climberRef = useRef<THREE.Group | null>(null);
  const stoneRef = useRef<THREE.Mesh | null>(null);
  const progressRef = useRef(0);

  const safeTotal = Math.max(1, Math.round(totalPoints));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const currentPomodoroProgress = phase === "focus" ? Math.min(1, Math.max(0, pomodoroProgress)) : 0;
  const journeyProgress = Math.min(1, Math.max(0, (safeCompleted + currentPomodoroProgress) / safeTotal));
  const ringProgress = useMotionValue(currentPomodoroProgress);
  const dashOffset = useTransform(ringProgress, (value) => 2 * Math.PI * RADIUS * (1 - value));
  const isFocus = phase === "focus";
  const statusText = isFocus && secondsLeft <= 0 && !running
    ? "Focus complete"
    : running
      ? PHASE_STATUS[phase]
      : secondsLeft === duration
        ? "Ready"
        : "Paused";

  const checkpointProgress = useMemo(
    () => Array.from({ length: safeTotal }, (_, index) => (index + 1) / safeTotal),
    [safeTotal],
  );

  useEffect(() => {
    ringProgress.set(currentPomodoroProgress);
  }, [currentPomodoroProgress, ringProgress]);

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-WORLD_WIDTH / 2, WORLD_WIDTH / 2, WORLD_HEIGHT / 2, -WORLD_HEIGHT / 2, 0.1, 1000);
    camera.position.set(0, 0, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(WORLD_WIDTH, WORLD_HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "h-full w-full";
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);
    worldRef.current = world;
    world.add(makeMountain(0x6366f1, 1.25, -4, 0.045));
    world.add(makeMountain(0x6366f1, 0.95, 0, 0.085));
    world.add(makeMountain(0x4f46e5, 0.65, 4, 0.12));

    const route = new THREE.CatmullRomCurve3(
      Array.from({ length: 9 }, (_, index) => pathPoint(index / 8)),
    );
    const routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(route.getPoints(96)),
      new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.32 }),
    );
    world.add(routeLine);

    const markerGeometry = new THREE.SphereGeometry(2.2, 12, 8);
    checkpointProgress.forEach((point, index) => {
      const marker = new THREE.Mesh(
        markerGeometry,
        new THREE.MeshBasicMaterial({
          color: index % 4 === 3 || index === safeTotal - 1 ? 0xa5b4fc : 0x6366f1,
          transparent: true,
          opacity: safeCompleted >= index + 1 ? 0.95 : 0.28,
        }),
      );
      marker.position.copy(pathPoint(point));
      world.add(marker);
    });

    const climber = new THREE.Group();
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x172033 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(4, 11, 4, 8), bodyMaterial);
    body.rotation.z = -0.28;
    climber.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 12), bodyMaterial);
    head.position.set(-2, 10, 0);
    climber.add(head);
    const armGeometry = new THREE.CapsuleGeometry(1.15, 9, 3, 6);
    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(armGeometry, bodyMaterial);
      arm.position.set(5, 2 + side * 1.6, 0);
      arm.rotation.z = 1.05;
      climber.add(arm);
    });
    world.add(climber);
    climberRef.current = climber;

    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(9, 2),
      new THREE.MeshBasicMaterial({ color: 0x4f46e5 }),
    );
    stone.position.set(14, 0, 1);
    world.add(stone);
    stoneRef.current = stone;

    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 17, 8), new THREE.MeshBasicMaterial({ color: 0x64748b }));
    pole.position.y = 8;
    flag.add(pole);
    const pennant = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ color: 0x818cf8, side: THREE.DoubleSide }));
    pennant.position.set(4, 14, 0);
    flag.add(pennant);
    flag.position.copy(pathPoint(1));
    world.add(flag);

    let frame = 0;
    const render = () => {
      const point = pathPoint(progressRef.current);
      if (climberRef.current) {
        climberRef.current.position.lerp(point, 0.16);
        climberRef.current.rotation.z = -0.24;
        climberRef.current.position.y += running && !prefersReduced ? Math.sin(Date.now() / 280) * 0.7 : 0;
      }
      if (stoneRef.current) {
        stoneRef.current.position.set(point.x + 14, point.y - 1, 9);
        if (running && !prefersReduced) stoneRef.current.rotation.z += 0.008;
      }
      if (worldRef.current && running && !prefersReduced) worldRef.current.position.x = Math.sin(Date.now() / 2400) * 1.4;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
        }
      });
    };
  }, [checkpointProgress, prefersReduced, running, safeCompleted, safeTotal]);

  useEffect(() => {
    progressRef.current = journeyProgress;
  }, [journeyProgress]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
          <circle cx="160" cy="160" r={RADIUS} fill="none" strokeWidth="1" className="stroke-border/50" />
          <motion.circle
            cx="160" cy="160" r={RADIUS} fill="none" strokeWidth="1.7" strokeLinecap="round"
            className={`${isFocus ? "stroke-indigo-600" : "stroke-foreground/25"}`}
            style={{ strokeDasharray: 2 * Math.PI * RADIUS, strokeDashoffset: dashOffset, filter: isFocus ? "drop-shadow(0 0 4px rgb(99 102 241 / 0.26))" : undefined }}
          />
        </svg>
        <div className="absolute inset-[9%] overflow-hidden rounded-full">
          <div ref={sceneHostRef} className="absolute inset-0 opacity-95" aria-hidden="true" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-indigo-100/20 via-transparent to-indigo-950/[0.08] dark:from-indigo-300/[0.04]" />
        </div>
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
