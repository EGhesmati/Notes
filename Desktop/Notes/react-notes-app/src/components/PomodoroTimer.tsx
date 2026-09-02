import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  ChevronRight,
  Clock,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { recordCompletion, usePomodoroStats, getDailyGoal, todaysFocus } from "@/hooks/use-pomodoro-stats";
import { NoteSelect } from "./NoteSelect";

type TimerPhase = "focus" | "short-break" | "long-break";

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15];
const LONG_BREAK_OPTIONS = [15, 20, 25, 30];

function stateKey(userId: number): string {
  return `pomodoro_state_${userId}`;
}

interface PersistedState {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  phase: TimerPhase;
  secondsLeft: number;
  pomoCount: number;
  running: boolean;
  startedAt: number | null;
}

function loadState(userId: number): PersistedState | null {
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      focusMin: parsed.focusMin ?? 25,
      breakMin: parsed.breakMin ?? 5,
      longBreakMin: parsed.longBreakMin ?? 15,
      phase: parsed.phase ?? "focus",
      secondsLeft: parsed.secondsLeft ?? 25 * 60,
      pomoCount: parsed.pomoCount ?? 0,
      running: parsed.running ?? false,
      startedAt: parsed.startedAt ?? null,
    };
  } catch {
    return null;
  }
}

function saveState(userId: number, state: PersistedState): void {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function clearState(userId: number): void {
  try {
    localStorage.removeItem(stateKey(userId));
  } catch {
    // ignore
  }
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function durFor(
  phase: TimerPhase,
  focusMin: number,
  breakMin: number,
  longBreakMin: number,
): number {
  if (phase === "focus") return focusMin * 60;
  if (phase === "long-break") return longBreakMin * 60;
  return breakMin * 60;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  focus: "Focus time complete",
  "short-break": "Short break complete",
  "long-break": "Long break complete",
};

const PHASE_SESSION_LABEL: Record<TimerPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

type AudioCtx = AudioContext & {
  webkitAudioContext?: typeof AudioContext;
};

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as AudioCtx).webkitAudioContext ||
      null;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  return _audioCtx;
}

function unlockAudio(): Promise<void> {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return Promise.resolve();
    if (ctx.state === "suspended") {
      return ctx.resume();
    }
  } catch {
    // audio not available
  }
  return Promise.resolve();
}

function playChime(): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state !== "running") {
      void ctx.resume();
    }
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // audio not available
  }
}

function DurationSelect({
  value,
  options,
  suffix = "m",
  onChange,
}: {
  value: number;
  options: number[];
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 cursor-pointer rounded-lg border border-border/60 bg-background px-3 text-sm font-semibold tabular-nums text-foreground/90 outline-none transition-colors hover:border-foreground/30 focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
          {suffix}
        </option>
      ))}
    </select>
  );
}

function DurationSetting({
  label,
  options,
  value,
  onChange,
  suffix = "m",
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-semibold text-foreground/90">{label}</span>
      <DurationSelect value={value} options={options} suffix={suffix} onChange={onChange} />
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        checked ? "bg-foreground" : "bg-foreground/15"
      }`}
    >
      <span
        className={`pointer-events-none absolute h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-all duration-200 ${
          checked ? "right-[3px]" : "left-[3px]"
        }`}
      />
    </span>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start justify-between gap-4 py-3 text-left"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground/90">{title}</div>
        <div className="mt-0.5 text-xs text-foreground/50">{description}</div>
      </div>
      <Switch checked={checked} />
    </button>
  );
}

function SessionIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${
            i < count ? "bg-foreground" : "bg-foreground/15"
          }`}
        />
      ))}
    </div>
  );
}

function TimerDisplay({
  secondsLeft,
  duration,
  phase,
  running,
}: {
  secondsLeft: number;
  duration: number;
  phase: TimerPhase;
  running: boolean;
}) {
  const progress = duration > 0 ? Math.min(1, Math.max(0, secondsLeft / duration)) : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const statusText = running ? "Running" : secondsLeft === duration ? "Ready" : "Paused";

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 260 260" className="h-60 w-60 -rotate-90 sm:h-64 sm:w-64">
        <circle
          cx="130"
          cy="130"
          r={radius}
          fill="none"
          strokeWidth="1"
          className="stroke-border"
        />
        <circle
          cx="130"
          cy="130"
          r={radius}
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`transition-[stroke-dashoffset] duration-700 ease-in-out ${
            phase === "focus" ? "stroke-indigo-600" : "stroke-foreground/25"
          }`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50">
          {PHASE_SESSION_LABEL[phase]}
        </span>
        <span className="mt-2 font-sans text-6xl font-semibold tracking-tight tabular-nums text-foreground sm:text-7xl">
          {formatTime(secondsLeft)}
        </span>
        <span className="mt-2 text-xs font-medium text-foreground/40">
          {statusText}
        </span>
      </div>
    </div>
  );
}

function SecondaryButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}

export function PomodoroTimer() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number | null>(null);
  const restored = useRef(false);

  const soundRef = useRef(true);
  const autoStartRef = useRef(false);

  const [open, setOpen] = useState(false);

  const [sound, _setSound] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`pomodoro_sound_${userId}`);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });

  const [autoStart, setAutoStart] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`pomodoro_autostart_${userId}`);
      return saved === null ? false : saved === "1";
    } catch {
      return false;
    }
  });

  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [pomoCount, setPomoCount] = useState(0);

  const phaseRef = useRef(phase);
  const pomoCountRef = useRef(pomoCount);
  const focusMinRef = useRef(focusMin);
  const breakMinRef = useRef(breakMin);
  const longBreakMinRef = useRef(longBreakMin);
  const secondsLeftRef = useRef(secondsLeft);
  const runningRef = useRef(running);
  const selectedNoteIdRef = useRef<number | null>(null);
  const userIdRef = useRef(userId);

  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteOptions, setNoteOptions] = useState<{ id: number; text: string }[]>([]);

  const [recapOpen, setRecapOpen] = useState(false);
  const { stats: pomoStats } = usePomodoroStats(userId);
  const recap = useMemo(() => todaysFocus(pomoStats), [pomoStats]);

  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    pomoCountRef.current = pomoCount;
    focusMinRef.current = focusMin;
    breakMinRef.current = breakMin;
    longBreakMinRef.current = longBreakMin;
    secondsLeftRef.current = secondsLeft;
    runningRef.current = running;
    selectedNoteIdRef.current = selectedNoteId;
    userIdRef.current = userId;
    soundRef.current = sound;
    autoStartRef.current = autoStart;
    try {
      localStorage.setItem(`pomodoro_sound_${userId}`, sound ? "1" : "0");
      localStorage.setItem(`pomodoro_autostart_${userId}`, autoStart ? "1" : "0");
    } catch {
      // ignore
    }
  }, [
    phase,
    pomoCount,
    focusMin,
    breakMin,
    longBreakMin,
    secondsLeft,
    running,
    selectedNoteId,
    userId,
    sound,
    autoStart,
  ]);

  const setSound = (v: boolean) => {
    soundRef.current = v;
    _setSound(v);
  };

  const notify = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch {
        // notification failed
      }
    }
  }, []);

  interface CountdownOpts {
    next: TimerPhase;
    remaining: number;
  }

  const beginCountdown = useCallback(
    ({ next, remaining }: CountdownOpts) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const startedAt = Date.now();
      endAtRef.current = startedAt + remaining * 1000;
      runningRef.current = true;
      setRunning(true);
      intervalRef.current = setInterval(() => {
        if (!endAtRef.current) return;
        const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
        secondsLeftRef.current = left;
        setSecondsLeft(left);
        if (left === 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          endAtRef.current = null;
          if (soundRef.current) {
            playChime();
            notify(PHASE_LABEL[next], "Time's up!");
          }
          handleCompleteRef.current(next);
        }
      }, 250);
      saveState(userIdRef.current, {
        focusMin: focusMinRef.current,
        breakMin: breakMinRef.current,
        longBreakMin: longBreakMinRef.current,
        phase: next,
        secondsLeft: remaining,
        pomoCount: pomoCountRef.current,
        running: true,
        startedAt,
      });
    },
    [notify],
  );

  const handleComplete = useCallback(
    (completedPhase: TimerPhase) => {
      if (completedPhase === "focus") {
        setNotePickerOpen(true);
        return;
      }
      setPhase("focus");
      setSelectedNoteId(null);
      const focusDur = focusMinRef.current * 60;
      if (autoStartRef.current) {
        beginCountdown({ next: "focus", remaining: focusDur });
      } else {
        setSecondsLeft(focusDur);
        runningRef.current = false;
        setRunning(false);
        endAtRef.current = null;
        clearState(userIdRef.current);
      }
    },
    [beginCountdown],
  );

  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  const finishFocus = useCallback(
    (noteId: number | null) => {
      const count = pomoCountRef.current;
      const next: TimerPhase = (count + 1) % 4 === 0 ? "long-break" : "short-break";
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
      recordCompletion(userIdRef.current, "focus", focusMinRef.current * 60, noteId);
      setNotePickerOpen(false);
      setSelectedNoteId(null);
      setPomoCount(count + 1);

      const goalMin = getDailyGoal(userIdRef.current);
      const newTodayMin = recap.minutes + Math.round(focusMinRef.current);
      if (goalMin > 0 && newTodayMin >= goalMin) {
        setRecapOpen(true);
      }

      if (autoStartRef.current) {
        setPhase(next);
        beginCountdown({ next, remaining: nextDur });
      } else {
        setPhase(next);
        setSecondsLeft(nextDur);
        runningRef.current = false;
        setRunning(false);
        endAtRef.current = null;
        clearState(userIdRef.current);
      }
    },
    [beginCountdown, recap],
  );

  const start = useCallback(() => {
    unlockAudio();
    if (runningRef.current) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      endAtRef.current = null;
      runningRef.current = false;
      setRunning(false);
      saveState(userIdRef.current, {
        focusMin: focusMinRef.current,
        breakMin: breakMinRef.current,
        longBreakMin: longBreakMinRef.current,
        phase: phaseRef.current,
        secondsLeft: secondsLeftRef.current,
        pomoCount: pomoCountRef.current,
        running: false,
        startedAt: null,
      });
      return;
    }
    const dur = durFor(phaseRef.current, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
    const remaining = Math.max(1, Math.min(secondsLeftRef.current > 0 ? secondsLeftRef.current : dur, dur));
    beginCountdown({
      next: phaseRef.current,
      remaining,
    });
  }, [beginCountdown]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endAtRef.current = null;
    runningRef.current = false;
    setRunning(false);
    const dur = durFor(phaseRef.current, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
    secondsLeftRef.current = dur;
    setSecondsLeft(dur);
    clearState(userIdRef.current);
  }, []);

  const resetCycle = useCallback(() => {
    pomoCountRef.current = 0;
    setPomoCount(0);
    saveState(userIdRef.current, {
      focusMin: focusMinRef.current,
      breakMin: breakMinRef.current,
      longBreakMin: longBreakMinRef.current,
      phase: phaseRef.current,
      secondsLeft: secondsLeftRef.current,
      pomoCount: 0,
      running: runningRef.current,
      startedAt: endAtRef.current,
    });
  }, []);

  const skipPhase = useCallback(() => {
    const p = phaseRef.current;
    const count = pomoCountRef.current;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    endAtRef.current = null;
    setSelectedNoteId(null);
    if (p === "focus") {
      const next: TimerPhase = (count + 1) % 4 === 0 ? "long-break" : "short-break";
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
      setPhase(next);
      setPomoCount(count + 1);
      secondsLeftRef.current = nextDur;
      setSecondsLeft(nextDur);
      runningRef.current = false;
      setRunning(false);
    } else {
      const nextDur = focusMinRef.current * 60;
      setPhase("focus");
      secondsLeftRef.current = nextDur;
      setSecondsLeft(nextDur);
      runningRef.current = false;
      setRunning(false);
    }
    clearState(userIdRef.current);
  }, []);

  const changeFocus = useCallback((val: number) => {
    setFocusMin(val);
    if (!runningRef.current && phaseRef.current === "focus") {
      secondsLeftRef.current = val * 60;
      setSecondsLeft(val * 60);
    }
  }, []);

  const changeBreak = useCallback((val: number) => {
    setBreakMin(val);
    if (!runningRef.current && phaseRef.current === "short-break") {
      secondsLeftRef.current = val * 60;
      setSecondsLeft(val * 60);
    }
  }, []);

  const changeLongBreak = useCallback((val: number) => {
    setLongBreakMin(val);
    if (!runningRef.current && phaseRef.current === "long-break") {
      secondsLeftRef.current = val * 60;
      setSecondsLeft(val * 60);
    }
  }, []);

  const onNotes = useCallback(async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id: number; text?: string; title?: string }[];
      setNoteOptions(data.map((n) => ({ id: n.id, text: n.text || n.title || "Untitled" })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (notePickerOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void onNotes();
    }
  }, [notePickerOpen, onNotes]);

  const beginCountdownRef = useRef(beginCountdown);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadState(userId);
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFocusMin(saved.focusMin);
    setBreakMin(saved.breakMin);
    setLongBreakMin(saved.longBreakMin);
    setPhase(saved.phase);
    setSecondsLeft(saved.secondsLeft);
    setPomoCount(saved.pomoCount);
    if (saved.running && saved.startedAt) {
      const elapsed = Math.floor((Date.now() - saved.startedAt) / 1000);
      const remaining = Math.max(0, saved.secondsLeft - elapsed);
      if (remaining > 0) {
        phaseRef.current = saved.phase;
        pomoCountRef.current = saved.pomoCount;
        focusMinRef.current = saved.focusMin;
        breakMinRef.current = saved.breakMin;
        longBreakMinRef.current = saved.longBreakMin;
        secondsLeftRef.current = remaining;
        runningRef.current = true;
        userIdRef.current = userId;
        beginCountdownRef.current({ next: saved.phase, remaining });
      }
    }
  }, [userId]);

  useEffect(() => {
    beginCountdownRef.current = beginCountdown;
  }, [beginCountdown]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    if (open) {
      const phaseLabel = PHASE_SESSION_LABEL[phase];
      document.title = `${formatTime(secondsLeft)} · ${phaseLabel} · Pomodoro`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [open, secondsLeft, phase]);

  const requestNotification = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const scrollToSettings = useCallback(() => {
    settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleClearNotes = useCallback(() => {
    setSelectedNoteId(null);
    setNotePickerOpen(false);
  }, []);

  const duration = durFor(phase, focusMin, breakMin, longBreakMin);

  const cycleInCycle = pomoCount % 4;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 w-8 rounded-full transition-colors ${
          open
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
        title="Pomodoro timer"
      >
        <Clock className="h-[18px] w-[18px]" />
      </Button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-50 mx-auto flex max-h-[calc(100svh-5rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem]">
          <header className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground/5 text-foreground/70">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-medium leading-none text-foreground/50">Focus Flow</span>
                <span className="text-xs font-semibold leading-tight text-foreground">Pomodoro</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-foreground/50">Session {pomoCount + 1}</span>
              <button
                type="button"
                onClick={scrollToSettings}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
                title="Close"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center px-5 pt-8 pb-8">
              <TimerDisplay secondsLeft={secondsLeft} duration={duration} phase={phase} running={running} />

              <div className="mt-6 flex flex-col items-center gap-6">
                <button
                  type="button"
                  onClick={start}
                  title={running ? "Pause" : "Start"}
                  aria-label={running ? "Pause" : "Start"}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-all hover:bg-foreground/90 active:scale-95"
                >
                  {running ? (
                    <Pause className="h-6 w-6 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  )}
                </button>

                <div className="flex flex-col items-center gap-2">
                  <SessionIndicator count={cycleInCycle} />
                  <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                    <span>Session {pomoCount + 1}</span>
                    <span>·</span>
                    <span>{cycleInCycle} of 4 completed</span>
                    <button
                      type="button"
                      onClick={resetCycle}
                      title="Reset cycle"
                      aria-label="Reset cycle count"
                      className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <SecondaryButton onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset" />
                  <SecondaryButton onClick={skipPhase} icon={<SkipForward className="h-3.5 w-3.5" />} label="Skip" />
                </div>
              </div>
            </div>

            <footer ref={settingsRef} className="border-t border-border/50 bg-foreground/[0.02] px-5 py-5">
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </div>

                <div className="divide-y divide-border/40">
                  <DurationSetting
                    label="Focus"
                    options={FOCUS_OPTIONS}
                    value={focusMin}
                    onChange={changeFocus}
                  />
                  <DurationSetting
                    label="Short break"
                    options={BREAK_OPTIONS}
                    value={breakMin}
                    onChange={changeBreak}
                  />
                  <DurationSetting
                    label="Long break"
                    options={LONG_BREAK_OPTIONS}
                    value={longBreakMin}
                    onChange={changeLongBreak}
                  />
                </div>

                <div className="divide-y divide-border/40">
                  <ToggleRow
                    title="Auto-start next session"
                    description="Begin the next phase automatically"
                    checked={autoStart}
                    onChange={setAutoStart}
                  />
                  <ToggleRow
                    title="Sound alerts"
                    description={sound ? "Chime and notification on" : "Muted"}
                    checked={sound}
                    onChange={setSound}
                  />
                </div>

                {!("Notification" in window) || Notification.permission === "denied" ? (
                  <button
                    type="button"
                    onClick={requestNotification}
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-left text-xs font-semibold text-foreground/80 transition-colors hover:bg-foreground/5"
                  >
                    Enable browser notifications
                    <ChevronRight className="h-3.5 w-3.5 text-foreground/40" />
                  </button>
                ) : null}
              </div>
            </footer>
          </div>
        </div>
      )}

      {notePickerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="w-[min(24rem,_calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm sm:w-[26rem]">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Associate with Note</h3>
                <Button variant="ghost" size="icon" onClick={handleClearNotes} className="h-6 w-6 text-foreground/50 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-[20rem] overflow-y-auto p-4">
                <NoteSelect notes={noteOptions} value={selectedNoteId} onChange={(id) => setSelectedNoteId(id)} />
              </div>
              <div className="flex gap-2 border-t border-border/50 px-4 py-3">
                <Button
                  onClick={() => {
                    if (selectedNoteId !== null) {
                      finishFocus(selectedNoteId);
                    }
                  }}
                  disabled={selectedNoteId === null}
                  className="flex-1 bg-foreground text-primary-foreground hover:bg-foreground/90"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Save with Note
                </Button>
                <Button onClick={() => finishFocus(null)} variant="outline" className="flex-1">
                  Skip Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {recapOpen &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => setRecapOpen(false)}>
            <div
              className="w-[min(24rem,_calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-border/50 bg-foreground px-4 py-3">
                <Trophy className="h-4 w-4 text-primary-foreground" />
                <h3 className="text-sm font-semibold text-primary-foreground">Daily Goal Reached</h3>
              </div>
              <div className="px-4 py-4">
                <p className="mb-4 text-sm text-foreground/70">You reached your focus goal for today. Nice work.</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border/50 bg-foreground/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                      <Clock className="h-3.5 w-3.5 text-foreground/50" />
                      {recap.minutes}
                    </div>
                    <div className="mt-1 text-[10px] text-foreground/50">min focused</div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-foreground/[0.02] p-3 text-center">
                    <div className="text-lg font-semibold text-foreground">{recap.sessions}</div>
                    <div className="mt-1 text-[10px] text-foreground/50">sessions</div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-foreground/[0.02] p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-lg font-semibold text-indigo-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {getDailyGoal(userId)}m
                    </div>
                    <div className="mt-1 text-[10px] text-foreground/50">goal</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t border-border/50 px-4 py-3">
                <Button onClick={() => setRecapOpen(false)} className="bg-foreground text-primary-foreground hover:bg-foreground/90">
                  <Check className="mr-2 h-4 w-4" />
                  Got it
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
