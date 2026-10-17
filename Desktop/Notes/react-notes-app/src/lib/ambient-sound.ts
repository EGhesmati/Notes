// Procedural Ambient Sound Generator using Web Audio API
// Zero external assets, 100% offline, infinite playback without loops.

export type AmbientSoundType = "none" | "brown" | "rain" | "white" | "drone" | "campfire";

export interface AmbientSoundConfig {
  type: AmbientSoundType;
  volume: number; // 0 to 1
  timerOnly: boolean;
}

export const AMBIENT_SOUND_OPTIONS: { id: AmbientSoundType; label: string; icon: string }[] = [
  { id: "none", label: "Mute", icon: "VolumeX" },
  { id: "brown", label: "Brown Noise (Ocean)", icon: "Waves" },
  { id: "rain", label: "Gentle Rain", icon: "CloudRain" },
  { id: "white", label: "White Noise", icon: "Wind" },
  { id: "drone", label: "Focus Drone (432Hz)", icon: "Sparkles" },
  { id: "campfire", label: "Campfire Crackle", icon: "Flame" },
];

type CustomWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentType: AmbientSoundType = "none";
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private volume: number = 0.5;
  private isTimerRunning: boolean = false;
  private timerOnly: boolean = false;
  private isPlaying: boolean = false;
  private intervalIds: number[] = [];

  constructor() {
    // load saved preferences
    try {
      const savedType = localStorage.getItem("ambient_sound_type") as AmbientSoundType;
      if (savedType && AMBIENT_SOUND_OPTIONS.some((o) => o.id === savedType)) {
        this.currentType = savedType;
      }
      const savedVol = localStorage.getItem("ambient_sound_volume");
      if (savedVol !== null) {
        this.volume = Math.max(0, Math.min(1, parseFloat(savedVol) || 0.5));
      }
      const savedTimerOnly = localStorage.getItem("ambient_sound_timer_only");
      if (savedTimerOnly !== null) {
        this.timerOnly = savedTimerOnly === "1";
      }
    } catch {
      // ignore
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const win = window as CustomWindow;
      const AudioCtx = win.AudioContext || win.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getConfig(): AmbientSoundConfig {
    return {
      type: this.currentType,
      volume: this.volume,
      timerOnly: this.timerOnly,
    };
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem("ambient_sound_volume", String(this.volume));
    } catch {
      // ignore
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setTimerOnly(val: boolean) {
    this.timerOnly = val;
    try {
      localStorage.setItem("ambient_sound_timer_only", val ? "1" : "0");
    } catch {
      // ignore
    }
    this.evaluatePlayback();
  }

  public setTimerRunning(running: boolean) {
    this.isTimerRunning = running;
    if (this.timerOnly) {
      this.evaluatePlayback();
    }
  }

  public setSoundType(type: AmbientSoundType) {
    this.currentType = type;
    try {
      localStorage.setItem("ambient_sound_type", type);
    } catch {
      // ignore
    }
    this.evaluatePlayback();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      if (this.currentType === "none") {
        this.setSoundType("brown");
      } else {
        this.evaluatePlayback(true);
      }
    }
  }

  private evaluatePlayback(forceStart = false) {
    if (this.currentType === "none") {
      this.stop();
      return;
    }

    if (this.timerOnly && !this.isTimerRunning && !forceStart) {
      this.stop();
      return;
    }

    this.startSound(this.currentType);
  }

  private stop() {
    this.intervalIds.forEach((id) => clearInterval(id));
    this.intervalIds = [];

    this.activeNodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];
    this.isPlaying = false;
  }

  private startSound(type: AmbientSoundType) {
    this.stop();
    const ctx = this.initCtx();
    if (!ctx || !this.masterGain) return;

    this.isPlaying = true;

    if (type === "white") {
      this.playWhiteNoise(ctx, this.masterGain);
    } else if (type === "brown") {
      this.playBrownNoise(ctx, this.masterGain);
    } else if (type === "rain") {
      this.playRain(ctx, this.masterGain);
    } else if (type === "drone") {
      this.playDrone(ctx, this.masterGain);
    } else if (type === "campfire") {
      this.playCampfire(ctx, this.masterGain);
    }
  }

  // --- Audio Synthesis Implementations ---

  private playWhiteNoise(ctx: AudioContext, destination: GainNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 8000;

    const gain = ctx.createGain();
    gain.gain.value = 0.25;

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    whiteNoise.start();
    this.activeNodes.push(whiteNoise, filter, gain);
  }

  private playBrownNoise(ctx: AudioContext, destination: GainNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // boost gain slightly
    }

    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    // Slow swell LFO for subtle ocean breathing effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1; // 10s wave cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;

    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.7;

    lfo.connect(swellGain.gain);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;

    brownNoise.connect(filter);
    filter.connect(swellGain);
    swellGain.connect(destination);

    brownNoise.start();
    lfo.start();
    this.activeNodes.push(brownNoise, lfo, lfoGain, swellGain, filter);
  }

  private playRain(ctx: AudioContext, destination: GainNode) {
    // Rain = bandpass filtered pinkish noise + random gentle droplets
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.5;
    }

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    rainSource.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    rainSource.start();

    this.activeNodes.push(rainSource, filter, gain);

    // Random water drops
    const dropInterval = window.setInterval(() => {
      if (!this.isPlaying || ctx.state !== "running") return;
      try {
        const osc = ctx.createOscillator();
        const dropGain = ctx.createGain();
        const now = ctx.currentTime;
        const freq = 1200 + Math.random() * 1400;

        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.06);

        dropGain.gain.setValueAtTime(0.04 * Math.random(), now);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

        osc.connect(dropGain);
        dropGain.connect(destination);

        osc.start(now);
        osc.stop(now + 0.07);
      } catch {
        // ignore
      }
    }, 180);

    this.intervalIds.push(dropInterval);
  }

  private playDrone(ctx: AudioContext, destination: GainNode) {
    // 432 Hz warm meditation / focus drone with fifth (648 Hz) and octave
    const baseFreq = 108; // sub fundamental
    const freqs = [baseFreq, baseFreq * 2, baseFreq * 3, baseFreq * 4];

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.25;
    droneGain.connect(destination);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq + (Math.random() - 0.5) * 0.8; // subtle micro-detuning
      oscGain.gain.value = 0.3 / (idx + 1);

      osc.connect(oscGain);
      oscGain.connect(droneGain);
      osc.start();
      this.activeNodes.push(osc, oscGain);
    });

    this.activeNodes.push(droneGain);
  }

  private playCampfire(ctx: AudioContext, destination: GainNode) {
    // Warm low brown rumble
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.015 * white) / 1.015;
      lastOut = output[i];
      output[i] *= 2.5;
    }

    const fireRumble = ctx.createBufferSource();
    fireRumble.buffer = noiseBuffer;
    fireRumble.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.45;

    fireRumble.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(destination);
    fireRumble.start();

    this.activeNodes.push(fireRumble, filter, rumbleGain);

    // Crackle pops
    const popInterval = window.setInterval(() => {
      if (!this.isPlaying || ctx.state !== "running") return;
      if (Math.random() > 0.4) return;
      try {
        const pop = ctx.createBufferSource();
        const popLen = Math.floor(ctx.sampleRate * 0.015);
        const popBuf = ctx.createBuffer(1, popLen, ctx.sampleRate);
        const popData = popBuf.getChannelData(0);
        for (let i = 0; i < popLen; i++) {
          popData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (popLen * 0.3));
        }
        pop.buffer = popBuf;

        const popFilter = ctx.createBiquadFilter();
        popFilter.type = "highpass";
        popFilter.frequency.value = 800 + Math.random() * 1200;

        const popGain = ctx.createGain();
        popGain.gain.value = 0.15 * Math.random();

        pop.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(destination);

        pop.start();
      } catch {
        // ignore
      }
    }, 120);

    this.intervalIds.push(popInterval);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const ambientSound = new AmbientSoundEngine();
