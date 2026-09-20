import { Canvas, useFrame } from "@react-three/fiber";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";
import type { Group } from "three";
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

function Panel({ position, vertical = false }: { position: [number, number, number]; vertical?: boolean }) {
  return (
    <mesh position={position} rotation={vertical ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
      <boxGeometry args={vertical ? [0.08, 0.42, 0.025] : [0.42, 0.08, 0.025]} />
      <meshStandardMaterial color="#a8bfd4" roughness={0.58} metalness={0.42} />
    </mesh>
  );
}

function Station({ completedPoints, totalPoints, running }: { completedPoints: number; totalPoints: number; running: boolean }) {
  const group = useRef<Group>(null);
  const completed = Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)));
  const modules = completed >= Math.ceil(totalPoints * 0.25);
  const arrays = completed >= Math.ceil(totalPoints * 0.5);
  const antenna = completed >= Math.ceil(totalPoints * 0.75);

  useLayoutEffect(() => {
    if (!group.current) return;
    gsap.fromTo(group.current.scale, { x: 0.94, y: 0.94, z: 0.94 }, {
      x: 1, y: 1, z: 1, duration: 0.55, ease: "back.out(1.8)",
    });
  }, [completed]);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (running ? 0.12 : 0.035);
  });

  return (
    <group ref={group} position={[0, -0.12, 0]}>
      <mesh>
        <sphereGeometry args={[0.34, 20, 12]} />
        <meshStandardMaterial color="#c8d7e3" roughness={0.38} metalness={0.52} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.11, 0.11, 0.78, 16]} />
        <meshStandardMaterial color="#718ca5" roughness={0.42} metalness={0.62} />
      </mesh>
      <mesh position={[0, 0.04, 0.32]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshStandardMaterial color="#5eead4" emissive="#2dd4bf" emissiveIntensity={running ? 1.4 : 0.45} />
      </mesh>
      {modules ? (
        <>
          <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.3, 0.18, 0.18]} />
            <meshStandardMaterial color="#9db5c8" roughness={0.45} metalness={0.5} />
          </mesh>
          <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.3, 0.18, 0.18]} />
            <meshStandardMaterial color="#9db5c8" roughness={0.45} metalness={0.5} />
          </mesh>
        </>
      ) : null}
      {arrays ? (
        <>
          <Panel position={[-0.98, 0, 0]} vertical />
          <Panel position={[0.98, 0, 0]} vertical />
          <Panel position={[-1.22, 0, 0]} vertical />
          <Panel position={[1.22, 0, 0]} vertical />
        </>
      ) : null}
      {antenna ? (
        <>
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.55, 8]} />
            <meshStandardMaterial color="#6f899e" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.86, 0]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={running ? 1 : 0.25} />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function SpaceStationScene({ completedPoints, totalPoints, running }: { completedPoints: number; totalPoints: number; running: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-[9%] bottom-[8%] top-[49%] z-0 overflow-hidden rounded-b-full">
      <Canvas orthographic camera={{ position: [0, 0, 5], zoom: 118 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[2, 3, 4]} intensity={2.2} color="#dbeafe" />
        <pointLight position={[0, 0.5, 2]} intensity={1.2} color="#a5f3fc" />
        <Station completedPoints={completedPoints} totalPoints={totalPoints} running={running} />
      </Canvas>
    </div>
  );
}

export function ClimbTimer({
  secondsLeft,
  duration,
  phase,
  running,
  completedPoints,
  totalPoints,
}: {
  secondsLeft: number;
  duration: number;
  phase: TimerPhase;
  running: boolean;
  completedPoints: number;
  totalPoints: number;
}) {
  const isFocus = phase === "focus";
  const paused = !running && secondsLeft !== duration;
  const status = isFocus && secondsLeft <= 0 && !running
    ? "Focus complete"
    : running ? PHASE_STATUS[phase] : paused ? "Paused" : "Ready";

  return (
    <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-[14.5rem]">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-border/70 bg-background shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.025),inset_0_-10px_24px_hsl(var(--foreground)/0.025)]">
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-foreground/[0.025]" />
        <SpaceStationScene completedPoints={completedPoints} totalPoints={totalPoints} running={running} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 flex justify-center">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.34em] text-foreground/70">
            {PHASE_LABEL[phase]}
          </span>
          <span className="mt-1 font-sans text-[2.65rem] font-light tracking-tight tabular-nums text-foreground sm:text-[2.9rem]">
            {formatTime(secondsLeft)}
          </span>
          <span className="mt-3 rounded-full border border-indigo-500/15 bg-background/90 px-2.5 py-0.5 text-[10px] font-medium text-foreground/65 shadow-sm">
            {running && isFocus ? <span className="mr-1 inline-block h-1 w-1 rounded-full bg-indigo-500" /> : null}
            {status}
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-[6%] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[9px] font-medium tabular-nums text-foreground/45">
        {Math.min(totalPoints, Math.max(0, Math.floor(completedPoints)))} / {totalPoints}
        <div className="h-px w-10 overflow-hidden bg-foreground/10">
          <div className="h-full bg-indigo-500/35" style={{ width: `${Math.min(100, Math.max(0, (completedPoints / Math.max(1, totalPoints)) * 100))}%` }} />
        </div>
      </div>
    </div>
  );
}
