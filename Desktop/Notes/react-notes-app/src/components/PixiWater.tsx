import { useEffect, useRef } from "react";
import {
  Application,
  Container,
  Graphics,
  Mesh,
  MeshGeometry,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";
import type { Buffer } from "pixi.js";

const FISH_PATH =
  "M26.2 8 C26.2 5.2 21.6 3.3 17.2 3.3 C13 3.3 9.4 4.1 7.2 5.2 L7.2 4.2 C6 3.6 4.6 2.6 3 1.8 L0.8 3.4 C2 5 3.2 6.6 3.7 8 C3.2 9.4 2 11 0.8 12.6 L3 14.2 C4.6 13.4 6 12.4 7.2 11.8 L7.2 10.8 C9.4 11.9 13 12.7 17.2 12.7 C21.6 12.7 26.2 10.8 26.2 8 Z";
const FISH_FIN_PATH =
  "M13.2 3.4 C13.5 1.6 12.1 1 11.3 2.3 C10.9 2.9 10.7 3.5 10.8 4 Z";

const SURFACE_SEGMENTS = 96;
const TAU = Math.PI * 2;

interface WaveComponent {
  cycles: number;
  speed: number;
  weight: number;
  phase: number;
}

const WAVE_COMPONENTS: WaveComponent[] = [
  { cycles: 1.35, speed: 0.62, weight: 0.48, phase: 0.5 },
  { cycles: 0.62, speed: -0.31, weight: 0.3, phase: 1.9 },
  { cycles: 2.4, speed: 0.95, weight: 0.22, phase: 3.1 },
];

const VERT_SRC = `
attribute vec2 aPosition;
attribute vec2 aUV;
uniform mat3 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aUV;
  gl_Position = vec4(uProjectionMatrix * vec3(aPosition, 1.0), 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
varying vec2 vUv;
uniform vec4 uColorA;
uniform vec4 uColorB;
uniform float uTime;

void main() {
  float depth = clamp(vUv.y, 0.0, 1.0);
  vec4 c = mix(uColorB, uColorA, pow(1.0 - depth, 0.9));
  float crest = smoothstep(0.07, 0.0, depth);
  c.rgb += vec3(0.52, 0.6, 0.78) * crest * 0.16;
  float glint = smoothstep(0.6, 0.0, depth) * (0.5 + 0.5 * sin(vUv.x * 44.0 + uTime * 0.8));
  c.a += glint * 0.03;
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`;

interface FishSpec {
  zone: 0 | 1;
  size: number;
  frac: number;
  speed: number;
  phase: number;
  alpha: number;
  threshold: number;
  tint: number;
}

const FISH_SPECS: FishSpec[] = [
  { zone: 0, size: 0.62, frac: 0.5, speed: 0.9, phase: 1.3, alpha: 0.5, threshold: 0.2, tint: 0xabc0da },
  { zone: 1, size: 0.5, frac: 0.72, speed: 1.4, phase: 4.1, alpha: 0.34, threshold: 0.4, tint: 0x94a8c4 },
  { zone: 0, size: 0.56, frac: 0.38, speed: 1.05, phase: 2.5, alpha: 0.42, threshold: 0.65, tint: 0xb2c6de },
  { zone: 1, size: 0.46, frac: 0.84, speed: 1.7, phase: 0.4, alpha: 0.3, threshold: 0.9, tint: 0x8fa2bf },
];

interface FishSim {
  sprite: Sprite;
  spec: FishSpec;
  dir: number;
  x: number;
  xmin: number;
  xmax: number;
  speedPx: number;
}

interface Snap {
  waterLevel: number;
  running: boolean;
  paused: boolean;
  completedPoints: number;
}

interface WaterSim {
  app: Application;
  host: HTMLDivElement;
  circleMask: Graphics;
  water: Mesh<MeshGeometry, Shader>;
  pos: Float32Array;
  posBuf: Buffer;
  uniforms: UniformGroup;
  fishLayer: Container;
  fishes: FishSim[];
  fishTex: Texture;
  w: number;
  h: number;
  R: number;
  cx: number;
  cy: number;
  time: number;
  cur: number;
  vel: number;
  amp: number;
  rippleE: number;
  rippleT: number;
  lastCompleted: number;
  reduced: boolean;
  snap: Snap;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeFishTexture(): Texture {
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = 28 * scale;
  canvas.height = 16 * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.EMPTY;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fill(new Path2D(FISH_PATH));
  ctx.fill(new Path2D(FISH_FIN_PATH));
  const tex = Texture.from(canvas);
  tex.source.scaleMode = "linear";
  return tex;
}

function surfaceYAt(s: WaterSim, x: number): number {
  const base = s.h - s.cur * s.h;
  let y = base;
  if (s.amp > 0.0005) {
    for (const c of WAVE_COMPONENTS) {
      y +=
        s.amp *
        c.weight *
        Math.sin((c.cycles * TAU * x) / Math.max(1, s.w) + c.speed * s.time + c.phase);
    }
  }
  if (s.rippleE > 0.0005) {
    const d = (x - s.cx) / Math.max(1, s.R);
    const env = Math.exp(-(d * d) / 0.28);
    y += s.rippleE * 4.5 * env * Math.sin(9 * s.rippleT - 6 * d);
  }
  return Math.max(-8, Math.min(s.h - 1.5, y));
}

function buildGeometry(s: WaterSim): void {
  const n = SURFACE_SEGMENTS;
  const vertexCount = (n + 1) * 2;
  const pos = new Float32Array(vertexCount * 2);
  const uvs = new Float32Array(vertexCount * 2);
  const idx = new Uint32Array(n * 6);

  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const top = i * 2;
    const bottom = (n + 1 + i) * 2;
    uvs[top] = u;
    uvs[top + 1] = 0;
    uvs[bottom] = u;
    uvs[bottom + 1] = 1;
  }
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const t0 = i;
    const b0 = n + 1 + i;
    const t1 = i + 1;
    const b1 = n + 2 + i;
    idx[o] = t0;
    idx[o + 1] = b0;
    idx[o + 2] = t1;
    idx[o + 3] = t1;
    idx[o + 4] = b0;
    idx[o + 5] = b1;
  }

  const geometry = new MeshGeometry({ positions: pos, uvs, indices: idx });
  s.pos = pos;
  s.posBuf = geometry.getAttribute("aPosition").buffer;

  const shader = Shader.from({
    gl: { vertex: VERT_SRC, fragment: FRAG_SRC },
    resources: { uniforms: s.uniforms },
  });

  const water = new Mesh({ geometry, shader, texture: Texture.WHITE });
  water.blendMode = "normal";
  s.water = water;
}

function applyCircleMask(s: WaterSim): void {
  s.circleMask.clear().circle(s.cx, s.cy, s.R).fill(0xffffff);
}

function placeFish(s: WaterSim): void {
  const left = { min: 0.08, max: 0.42 };
  const right = { min: 0.58, max: 0.92 };
  for (const f of s.fishes) {
    const zone = f.spec.zone === 0 ? left : right;
    f.xmin = zone.min * s.w;
    f.xmax = zone.max * s.w;
    if (f.x < f.xmin || f.x > f.xmax) f.x = (f.xmin + f.xmax) * 0.5;
    f.speedPx = f.spec.speed * s.w * 0.06;
  }
}

function updateFish(s: WaterSim, dt: number): void {
  const column = s.cur * s.h;
  for (const f of s.fishes) {
    const spec = f.spec;
    const fade = smoothstep(spec.threshold - 0.12, spec.threshold + 0.02, s.cur);
    if (fade <= 0.003 || column < 2) {
      f.sprite.visible = false;
      continue;
    }
    f.sprite.visible = true;
    f.sprite.alpha = spec.alpha * fade;
    f.sprite.tint = spec.tint;

    const len = spec.size * s.w * 0.1;
    const texW = s.fishTex.width || 28 * 4;
    const scale = len / texW;
    const motion = s.reduced ? 0.12 : 1;

    f.x += f.dir * f.speedPx * dt * motion;
    if (f.x > f.xmax) {
      f.x = f.xmax;
      f.dir = -1;
    } else if (f.x < f.xmin) {
      f.x = f.xmin;
      f.dir = 1;
    }

    const surfMean = s.h - column;
    let y = surfMean + spec.frac * column + Math.sin(s.time * 0.55 * motion + spec.phase * 3) * 1.5 * motion;
    const surfAt = surfaceYAt(s, f.x);
    const minY = surfAt + len * 0.3;
    if (y < minY) y = minY;
    if (y > s.h - 2) y = s.h - 2;

    f.sprite.x = f.x;
    f.sprite.y = y;
    f.sprite.scale.set(scale * f.dir, scale);
    f.sprite.rotation = Math.sin(s.time * 0.6 * motion + spec.phase * 5) * 0.06;
  }
}

function fireRipple(s: WaterSim): void {
  s.rippleE = 1;
  s.rippleT = 0;
  const delta = Math.abs(s.snap.waterLevel - s.cur);
  const dir = Math.sign(s.snap.waterLevel - s.cur) || 1;
  s.vel += Math.min(0.6, delta * 3.2) * dir;
}

function updateWater(s: WaterSim): void {
  const { w, h } = s;
  const n = SURFACE_SEGMENTS;
  const step = w / n;
  for (let i = 0; i <= n; i++) {
    const x = i * step;
    const y = surfaceYAt(s, x);
    const top = i * 2;
    const bottom = (n + 1 + i) * 2;
    s.pos[top] = x;
    s.pos[top + 1] = y;
    s.pos[bottom] = x;
    s.pos[bottom + 1] = h;
  }
  s.posBuf.update();
}

function tick(s: WaterSim, dt: number): void {
  s.time += dt;
  const snap = s.snap;

  if (snap.completedPoints > s.lastCompleted) {
    s.lastCompleted = snap.completedPoints;
    fireRipple(s);
  }

  if (s.reduced) {
    s.cur = snap.waterLevel;
    s.vel = 0;
    s.amp = 0;
    s.rippleE = 0;
  } else {
    if (s.cur > 1) {
      s.cur = 1;
      if (s.vel > 0) s.vel = 0;
    }
    if (s.cur < 0) {
      s.cur = 0;
      if (s.vel < 0) s.vel = 0;
    }
    const k = 34;
    const c = 2 * 0.72 * Math.sqrt(k);
    const acc = k * (snap.waterLevel - s.cur) - c * s.vel;
    s.vel += acc * dt;
    s.cur += s.vel * dt;
    s.cur = Math.max(0, Math.min(1, s.cur));

    const ampTarget = snap.running ? 2.4 : snap.paused ? 0.5 : 0.22;
    s.amp += (ampTarget - s.amp) * (1 - Math.exp(-dt * 1.6));

    if (s.rippleE > 0.001) {
      s.rippleE *= Math.exp(-dt * 2.0);
      s.rippleT += dt;
    } else {
      s.rippleE = 0;
    }
  }

  s.water.visible = s.cur > 0.002;
  updateWater(s);
  updateFish(s, dt);
  s.uniforms.uniforms.uTime = s.time;
  s.uniforms.update();
}

function destroySim(s: WaterSim): void {
  try {
    s.app.destroy(true, { children: true });
  } catch {
    s.app.destroy();
  }
}

async function createWaterSim(host: HTMLDivElement, snap: Snap): Promise<WaterSim> {
  const size = Math.max(1, host.clientWidth || 1);
  const app = new Application();
  await app.init({
    width: size,
    height: size,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    powerPreference: "high-performance",
    preference: "webgl",
  });

  const canvas = app.canvas;
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fishTex = makeFishTexture();
  const w = size;
  const h = size;
  const R = size / 2;
  const cx = size / 2;
  const cy = size / 2;

  const uniforms = new UniformGroup({
    uColorA: { value: new Float32Array([0.78, 0.84, 0.97, 0.36]), type: "vec4<f32>" },
    uColorB: { value: new Float32Array([0.34, 0.39, 0.62, 0.46]), type: "vec4<f32>" },
    uTime: { value: 0, type: "f32" },
  });

  const circleMask = new Graphics();
  const root = new Container();
  const fishLayer = new Container();

  const s: WaterSim = {
    app,
    host,
    circleMask,
    water: null as unknown as Mesh,
    pos: new Float32Array(0),
    posBuf: null as unknown as Buffer,
    uniforms,
    fishLayer,
    fishes: [],
    fishTex,
    w,
    h,
    R,
    cx,
    cy,
    time: 0,
    cur: snap.waterLevel,
    vel: 0,
    amp: reduced ? 0 : 0.22,
    rippleE: 0,
    rippleT: 0,
    lastCompleted: snap.completedPoints,
    reduced,
    snap,
  };

  buildGeometry(s);
  applyCircleMask(s);
  updateWater(s);
  updateFish(s, 0);

  root.addChild(circleMask);
  root.addChild(s.water);
  root.addChild(fishLayer);
  root.mask = circleMask;

  const baseX = (zone: 0 | 1) => {
    const min = (zone === 0 ? 0.08 : 0.58) * w;
    const max = (zone === 0 ? 0.42 : 0.92) * w;
    return min + (max - min) * (zone === 0 ? 0.24 : 0.76);
  };

  for (const spec of FISH_SPECS) {
    const sprite = new Sprite(fishTex);
    sprite.anchor.set(0.5, 0.5);
    const f: FishSim = {
      sprite,
      spec,
      dir: spec.zone === 0 ? 1 : -1,
      x: baseX(spec.zone),
      xmin: 0,
      xmax: 0,
      speedPx: 0,
    };
    s.fishes.push(f);
    fishLayer.addChild(sprite);
  }
  placeFish(s);
  updateFish(s, 0);

  app.stage.addChild(root);
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    tick(s, dt);
  });

  const observer = new ResizeObserver(() => {
    const width = Math.max(1, host.clientWidth || 1);
    if (width === s.w) return;
    app.renderer.resize(width, width);
    s.w = width;
    s.h = width;
    s.R = width / 2;
    s.cx = width / 2;
    s.cy = width / 2;
    applyCircleMask(s);
    placeFish(s);
  });

  observer.observe(host);

  (s as unknown as { destroyExtra: () => void }).destroyExtra = () => {
    observer.disconnect();
  };
  return s;
}

export function PixiWater({
  waterLevel,
  running,
  paused,
  completedPoints,
}: {
  waterLevel: number;
  running: boolean;
  paused: boolean;
  completedPoints: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<WaterSim | null>(null);
  const snapRef = useRef<Snap>({ waterLevel, running, paused, completedPoints });

  useEffect(() => {
    snapRef.current = { waterLevel, running, paused, completedPoints };
    const store = simRef.current;
    if (store) Object.assign(store.snap, snapRef.current);
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    if (simRef.current) return;
    void createWaterSim(host, { ...snapRef.current }).then((value) => {
      if (disposed) {
        destroySim(value);
      } else {
        simRef.current = value;
      }
    });
    return () => {
      disposed = true;
      if (simRef.current) {
        const value = simRef.current;
        simRef.current = null;
        const destroyExtra = (value as unknown as { destroyExtra: () => void }).destroyExtra;
        destroyExtra?.();
        destroySim(value);
      }
    };
  }, []);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />;
}