import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { recordCompletion } from "@/hooks/use-pomodoro-stats";
import { NoteSelect } from "./NoteSelect";

type TimerPhase = "focus" | "short-break" | "long-break";

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15];
const LONG_BREAK_MIN = 15;

function stateKey(userId: number): string {
  return `pomodoro_state_${userId}`;
}

interface PersistedState {
  focusMin: number;
  breakMin: number;
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
    return JSON.parse(raw) as PersistedState;
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

function durFor(phase: TimerPhase, focusMin: number, breakMin: number): number {
  if (phase === "focus") return focusMin * 60;
  if (phase === "long-break") return LONG_BREAK_MIN * 60;
  return breakMin * 60;
}

const PHASE_LABEL: Record<TimerPhase, string> = {
  focus: "Focus time complete",
  "short-break": "Short break complete",
  "long-break": "Long break complete",
};

const PHASE_COLOR: Record<TimerPhase, string> = {
  focus: "from-foreground to-foreground/70",
  "short-break": "from-emerald-500 to-teal-500",
  "long-break": "from-sky-500 to-blue-500",
};

const RING_COLOR: Record<TimerPhase, string> = {
  focus: "text-foreground",
  "short-break": "text-emerald-500",
  "long-break": "text-sky-500",
};

const PHASE_SESSION_LABEL: Record<TimerPhase, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const PHASE_DOT: Record<TimerPhase, string> = {
  focus: "bg-foreground",
  "short-break": "bg-emerald-500",
  "long-break": "bg-sky-500",
};

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

function playChime(): void {
  try {
    const ctx = getAudioCtx();
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

function DurationSetting({
  title,
  options,
  value,
  onChange,
  onCustom,
  cycle,
}: {
  title: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  onCustom: () => void;
  cycle: (delta: number) => void;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => cycle(-1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Decrease ${title.toLowerCase()}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center font-mono text-sm font-semibold tabular-nums text-foreground">
            {value}
          </span>
          <span className="mr-1 text-xs text-muted-foreground">min</span>
          <button
            type="button"
            onClick={() => cycle(1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Increase ${title.toLowerCase()}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCustom}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Custom ${title.toLowerCase()}`}
            title="Custom"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-lg bg-muted/60 p-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              value === opt
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt}m
          </button>
        ))}
      </div>
    </div>
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
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="pr-4">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[22px] w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? "bg-foreground" : "bg-muted dark:bg-secondary"
        }`}
      >
        <span
          className={`pointer-events-none absolute h-4 w-4 rounded-full bg-background shadow transition-all duration-200 ${
            checked ? "right-[3px]" : "left-[3px]"
          }`}
        />
      </button>
    </div>
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
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [pomoCount, setPomoCount] = useState(0);

  // Mirror state into refs so timer intervals always read the latest values.
  const phaseRef = useRef(phase);
  const pomoCountRef = useRef(pomoCount);
  const focusMinRef = useRef(focusMin);
  const breakMinRef = useRef(breakMin);
  const secondsLeftRef = useRef(secondsLeft);
  const runningRef = useRef(running);
  const selectedNoteIdRef = useRef<number | null>(null);
  const userIdRef = useRef(userId);

  // Custom duration modal states
  const [customFocusOpen, setCustomFocusOpen] = useState(false);
  const [customFocusVal, setCustomFocusVal] = useState("");
  const [customBreakOpen, setCustomBreakOpen] = useState(false);
  const [customBreakVal, setCustomBreakVal] = useState("");

  // Note picker state
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteOptions, setNoteOptions] = useState<{ id: number; text: string }[]>([]);

  // Settings scroll target
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    pomoCountRef.current = pomoCount;
    focusMinRef.current = focusMin;
    breakMinRef.current = breakMin;
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
  }, [phase, pomoCount, focusMin, breakMin, secondsLeft, running, selectedNoteId, userId, sound, autoStart]);

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
          playChime();
          if (soundRef.current) {
            notify(PHASE_LABEL[next], "Time's up! 🍅");
          }
          handleCompleteRef.current(next);
        }
      }, 250);
      saveState(userIdRef.current, {
        focusMin: focusMinRef.current,
        breakMin: breakMinRef.current,
        phase: next,
        secondsLeft: remaining,
        pomoCount: pomoCountRef.current,
        running: true,
        startedAt,
      });
    },
    [notify, durFor, saveState, clearInterval, setRunning, setSecondsLeft],
  );

  // Advance to the next phase after a completion. Uses refs for fresh values.
  const handleComplete = useCallback(
    (completedPhase: TimerPhase) => {
      if (completedPhase === "focus") {
        // Focus finished -> note association first, then advance to a break.
        setNotePickerOpen(true);
        return;
      }
      // Break finished -> back to focus.
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
    handleCompleteRef.current = handleComplete;
  }, [handleComplete]);

  // Advance after a focus completion, given an associated note (or none).
  const finishFocus = useCallback(
    (noteId: number | null) => {
      const count = pomoCountRef.current;
      const next: TimerPhase = (count + 1) % 4 === 0 ? "long-break" : "short-break";
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current);
      recordCompletion(userIdRef.current, "focus", focusMinRef.current * 60, noteId);
      setNotePickerOpen(false);
      setSelectedNoteId(null);
      setPomoCount(count + 1);
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
    [beginCountdown],
  );

  const start = useCallback(() => {
    if (runningRef.current) {
      // Pause
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      endAtRef.current = null;
      runningRef.current = false;
      setRunning(false);
      saveState(userIdRef.current, {
        focusMin: focusMinRef.current,
        breakMin: breakMinRef.current,
        phase: phaseRef.current,
        secondsLeft: secondsLeftRef.current,
        pomoCount: pomoCountRef.current,
        running: false,
        startedAt: null,
      });
      return;
    }
    const dur = durFor(phaseRef.current, focusMinRef.current, breakMinRef.current);
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
    const dur = durFor(phaseRef.current, focusMinRef.current, breakMinRef.current);
    secondsLeftRef.current = dur;
    setSecondsLeft(dur);
    clearState(userIdRef.current);
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
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current);
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

  const changeFocus = useCallback(
    (val: number) => {
      setFocusMin(val);
      if (!runningRef.current) {
        secondsLeftRef.current = val * 60;
        setSecondsLeft(val * 60);
      }
    },
    [],
  );

  const changeBreak = useCallback(
    (val: number) => {
      setBreakMin(val);
      if (!runningRef.current) {
        secondsLeftRef.current = val * 60;
        setSecondsLeft(val * 60);
      }
    },
    [],
  );

  const onNotes = useCallback(async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await fetch(`${API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNoteOptions(data.map((n: any) => ({ id: n.id, text: n.text || n.title || "Untitled" })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (notePickerOpen) {
      onNotes();
    }
  }, [notePickerOpen, onNotes]);

  const beginCountdownRef = useRef(beginCountdown);

  // Restore state on mount
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadState(userId);
    if (!saved) return;
    setFocusMin(saved.focusMin);
    setBreakMin(saved.breakMin);
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
        secondsLeftRef.current = remaining;
        runningRef.current = true;
        userIdRef.current = userId;
        beginCountdownRef.current({ next: saved.phase, remaining });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Keep a ref to the latest beginCountdown for the restore path.
  useEffect(() => {
    beginCountdownRef.current = beginCountdown;
  }, [beginCountdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  const duration = durFor(phase, focusMin, breakMin);
  const progress = duration > 0 ? Math.min(1, Math.max(0, secondsLeft / duration)) : 0;
  const CENTER = Math.PI * 172; // circumference for r=86

  const isValidNumber = (val: string) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 && num <= 180;
  };

  const confirmCustomFocus = useCallback(() => {
    if (isValidNumber(customFocusVal)) {
      changeFocus(parseInt(customFocusVal, 10));
      setCustomFocusOpen(false);
      setCustomFocusVal("");
    }
  }, [customFocusVal, changeFocus]);

  const confirmCustomBreak = useCallback(() => {
    if (isValidNumber(customBreakVal)) {
      changeBreak(parseInt(customBreakVal, 10));
      setCustomBreakOpen(false);
      setCustomBreakVal("");
    }
  }, [customBreakVal, changeBreak]);

  const cycleFocus = useCallback(
    (delta: number) => {
      const idx = FOCUS_OPTIONS.indexOf(focusMin);
      const next = Math.max(0, Math.min(FOCUS_OPTIONS.length - 1, idx + delta));
      changeFocus(FOCUS_OPTIONS[next]);
    },
    [focusMin, changeFocus],
  );

  const cycleBreak = useCallback(
    (delta: number) => {
      const idx = BREAK_OPTIONS.indexOf(breakMin);
      const next = Math.max(0, Math.min(BREAK_OPTIONS.length - 1, idx + delta));
      changeBreak(BREAK_OPTIONS[next]);
    },
    [breakMin, changeBreak],
  );

  const cycleInCycle = pomoCount % 4;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 w-8 rounded-full transition-all ${
          open
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        }`}
        title="Pomodoro timer"
      >
        <Clock className="h-[18px] w-[18px]" />
      </Button>

      {/* Main Panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(26rem,_calc(100vw-1rem))] max-h-[calc(100vh-2rem)] origin-top-right overflow-hidden overflow-y-auto rounded-2xl border border-border/70 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-xl sm:w-[26rem]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${PHASE_DOT[phase]}`} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Pomodoro
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={scrollToSettings}
                className="text-muted-foreground hover:text-foreground"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                title="Close"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Focus Area */}
          <div className="flex flex-col items-center px-6 pt-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {PHASE_SESSION_LABEL[phase]}
            </span>

            <div className={`relative mt-4 flex h-52 w-52 items-center justify-center ${RING_COLOR[phase]}`}>
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle cx="100" cy="100" r="86" fill="none" strokeWidth="7" className="stroke-muted/30" />
                <circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  stroke="currentColor"
                  className="transition-[stroke-dashoffset] duration-500"
                  strokeDasharray={CENTER}
                  strokeDashoffset={CENTER * (1 - progress)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[52px] font-medium leading-none tracking-tight tabular-nums text-foreground">
                  {formatTime(secondsLeft)}
                </span>
                <span className="mt-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                  {running ? "Running" : secondsLeft === duration ? "Ready" : "Paused"}
                </span>
              </div>
            </div>

            {/* Session status */}
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Session {pomoCount + 1}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>{pomoCount} completed</span>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              title="Reset"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-all hover:text-foreground active:scale-95"
            >
              <RotateCcw className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={start}
              title={running ? "Pause" : "Start"}
              className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${PHASE_COLOR[phase]} text-primary-foreground shadow-md shadow-black/10 transition-transform hover:scale-[1.04] active:scale-95`}
            >
              {running ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={skipPhase}
              title="Skip"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-all hover:text-foreground active:scale-95"
            >
              <SkipForward className="h-[18px] w-[18px] fill-current" />
            </button>
          </div>

          {/* Compact cycle progress */}
          <div className="mt-6 flex flex-col items-center gap-2 px-6">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 w-7 rounded-full transition-colors ${i < cycleInCycle ? "bg-foreground" : "bg-muted"}`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {cycleInCycle} of 4 in this cycle
            </span>
          </div>

          {/* Settings */}
          <div ref={settingsRef} className="mt-7 scroll-mt-4 px-5 pb-3">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Settings
            </p>
            <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/60">
              <DurationSetting
                title="Focus duration"
                options={FOCUS_OPTIONS}
                value={focusMin}
                onChange={changeFocus}
                onCustom={() => setCustomFocusOpen(true)}
                cycle={cycleFocus}
              />
              <DurationSetting
                title="Short break"
                options={BREAK_OPTIONS}
                value={breakMin}
                onChange={changeBreak}
                onCustom={() => setCustomBreakOpen(true)}
                cycle={cycleBreak}
              />
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm font-medium text-foreground">Long break</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  {LONG_BREAK_MIN} min
                </span>
              </div>
              <ToggleRow
                title="Auto-start"
                description="Begin the next session automatically"
                checked={autoStart}
                onChange={setAutoStart}
              />
              <ToggleRow
                title="Sound alerts"
                description={sound ? "Chime and notification on" : "Muted"}
                checked={sound}
                onChange={setSound}
              />
              {!("Notification" in window) || Notification.permission === "denied" ? (
                <button
                  type="button"
                  onClick={requestNotification}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Enable browser notifications
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <div className="text-sm font-medium text-foreground">Browser notifications</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Enabled</div>
                  </div>
                  <Check className="h-4 w-4 text-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Focus Duration Modal */}
      {customFocusOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-[min(20rem,_calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:w-[22rem]">
              <h3 className="mb-3 text-sm font-semibold">Custom Focus Duration</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={customFocusVal}
                  onChange={(e) => setCustomFocusVal(e.target.value)}
                  placeholder="Minutes (1-180)"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && confirmCustomFocus()}
                />
                <Button onClick={confirmCustomFocus} className="shrink-0">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Enter minutes between 1 and 180</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomFocusOpen(false);
                  setCustomFocusVal("");
                }}
                className="mt-3 w-full text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>,
          document.body,
        )}

      {/* Custom Break Duration Modal */}
      {customBreakOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-[min(20rem,_calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:w-[22rem]">
              <h3 className="mb-3 text-sm font-semibold">Custom Break Duration</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={customBreakVal}
                  onChange={(e) => setCustomBreakVal(e.target.value)}
                  placeholder="Minutes (1-60)"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && confirmCustomBreak()}
                />
                <Button onClick={confirmCustomBreak} className="shrink-0">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Enter minutes between 1 and 60</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomBreakOpen(false);
                  setCustomBreakVal("");
                }}
                className="mt-3 w-full text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>,
          document.body,
        )}

      {/* Note Selection Modal */}
      {notePickerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-[min(24rem,_calc(100vw-2rem))] max-h-[calc(100vh-4rem)] rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl sm:w-[26rem]">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <h3 className="text-sm font-semibold">Associate with Note</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearNotes}
                  className="h-6 w-6 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-[20rem] overflow-y-auto p-4">
                <NoteSelect
                  notes={noteOptions}
                  value={selectedNoteId}
                  onChange={(id) => setSelectedNoteId(id)}
                />
              </div>
              <div className="flex gap-2 border-t border-border/50 px-4 py-3">
                <Button
                  onClick={() => {
                    if (selectedNoteId !== null) {
                      finishFocus(selectedNoteId);
                    }
                  }}
                  disabled={selectedNoteId === null}
                  className={`flex-1 bg-gradient-to-r ${PHASE_COLOR[phase]} text-primary-foreground`}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Save with Note
                </Button>
                <Button
                  onClick={() => finishFocus(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Skip Note
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
