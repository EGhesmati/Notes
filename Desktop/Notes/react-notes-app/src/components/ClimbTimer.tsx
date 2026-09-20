import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TimerPhase } from "./PomodoroTimer";

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

type SceneProps = {
  running: boolean;
  paused: boolean;
  progress: number;
  completedPoints: number;
  totalPoints: number;
  complete: boolean;
};

function LighthouseScene({ running, paused, progress, completedPoints, totalPoints, complete }: SceneProps) {
  const lampRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const oceanRef = useRef<THREE.Mesh>(null);
  const safeTotal = Math.max(1, Math.round(totalPoints));
  const completed = Math.min(safeTotal, Math.max(0, Math.floor(completedPoints)));
  const sections = useMemo(() => Array.from({ length: safeTotal }, (_, index) => index), [safeTotal]);
  const sectionHeight = 0.58 / safeTotal;
  const active = running && !paused;

  useFrame((_, delta) => {
    const speed = active ? 0.45 : 0.08;
    if (lampRef.current) lampRef.current.rotation.y += delta * speed;
    if (beamRef.current) beamRef.current.rotation.y += delta * speed * 0.8;
    if (oceanRef.current) oceanRef.current.position.x = Math.sin(performance.now() * 0.00035) * (active ? 0.012 : 0.004);
  });

  return (
    <group position={[0, -0.12, 0]}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[-3, 4, 4]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[3, 1, 2]} intensity={0.7} color="#c7c9ff" />

      <mesh ref={oceanRef} position={[0, -0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.2]} />
        <meshStandardMaterial color="#eef0f5" roughness={1} />
      </mesh>
      <mesh position={[0, -0.59, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.1, 0.02]} />
        <meshBasicMaterial color="#cfd3df" transparent opacity={0.55} />
      </mesh>

      <group position={[0, -0.18, 0]}>
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[0.78, 0.12, 0.38]} />
          <meshStandardMaterial color="#b7bbc7" roughness={0.85} />
        </mesh>
        {sections.map((index) => {
          const y = -0.44 + index * sectionHeight;
          const reached = index < completed;
          const current = index === completed && running;
          return (
            <mesh key={index} position={[0, y, 0]} scale={[reached ? 1 : 0.98, 0.94, reached ? 1 : 0.98]}>
              <boxGeometry args={[0.42 + index * 0.004, sectionHeight * 0.9, 0.3]} />
              <meshStandardMaterial color={reached ? "#d6d8df" : current ? "#e5e6f7" : "#f3f4f7"} emissive={current ? "#5c63c4" : "#000000"} emissiveIntensity={current ? progress * 0.08 : 0} roughness={0.8} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.19, 0]}>
          <cylinderGeometry args={[0.28, 0.35, 0.08, 4]} />
          <meshStandardMaterial color="#b2b6c2" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 12]} />
          <meshStandardMaterial color="#dfe1e7" roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <coneGeometry args={[0.26, 0.12, 4]} />
          <meshStandardMaterial color="#9ea3b1" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color={complete ? "#f6c453" : "#777de0"} emissive={complete ? "#e6a827" : "#373b9d"} emissiveIntensity={complete ? 1.2 : 0.25} />
        </mesh>

        <group ref={lampRef} position={[0, 0.48, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 1.25, 8]} />
            <meshBasicMaterial color="#7378c8" transparent opacity={active ? 0.2 : 0.08} />
          </mesh>
        </group>
        <mesh ref={beamRef} position={[0.48, 0.48, -0.02]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.11, 0.9, 16, 1, true]} />
          <meshBasicMaterial color="#8388dc" transparent opacity={active ? 0.07 : 0.025} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function ThreeScene(props: SceneProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-full">
      <Canvas
        orthographic
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], zoom: 185, near: 0.1, far: 20 }}
        gl={{ alpha: true, antialias: true }}
      >
        <LighthouseScene {...props} />
      </Canvas>
    </div>
  );
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
  const isFocus = phase === "focus";
  const paused = !running && secondsLeft !== duration;
  const complete = completedPoints >= totalPoints;
  const status = isFocus && secondsLeft <= 0 && !running
    ? complete ? "Lighthouse complete" : "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]" />
      <ThreeScene
        running={running}
        paused={paused}
        progress={isFocus ? pomodoroProgress : 0}
        completedPoints={completedPoints}
        totalPoints={totalPoints}
        complete={complete}
      />
      <div className="pointer-events-none absolute inset-x-0 top-[11%] flex justify-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-foreground/70">
            {PHASE_LABEL[phase]}
          </span>
          <span className="mt-1 font-sans text-5xl font-light tracking-tight tabular-nums text-foreground sm:text-[3.4rem]">
            {formatTime(secondsLeft)}
          </span>
          <span className="mt-1.5 rounded-full border border-indigo-500/15 bg-indigo-500/[0.07] px-2.5 py-0.5 text-[10px] font-medium text-foreground/65">
            {running && isFocus ? <span className="mr-1 inline-block h-1 w-1 rounded-full bg-indigo-500" /> : null}
            {status}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[7%] left-1/2 -translate-x-1/2 text-[9px] font-medium tabular-nums text-foreground/50">
        {Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)))} / {totalPoints}
      </div>
    </div>
  );
}
