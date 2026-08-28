import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, ChevronDown, ChevronUp, Clock, Bell, BellOff, Edit3, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { recordCompletion } from "@/hooks/use-pomodoro-stats";
import { NoteSelect } from "./NoteSelect";

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15];
const LONG_BREAK_MIN = 15;

function stateKey(userId: number): string {
  return `pomodoro_state_${userId}`;
}

interface TimerState {
  focusMin: number;
  breakMin: number;
  phase: "focus" | "short-break" | "long-break";
  secondsLeft: number;
  pomoCount: number;
  running: boolean;
  startedAt: number | null;
}

function loadState(userId: number): TimerState | null {
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function saveState(userId: number, state: TimerState): void {
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
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const PHASE_LABEL: Record<string, string> = {
  focus: "Focus Time",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

const PHASE_COLOR: Record<string, string> = {
  focus: "from-violet-500 to-fuchsia-500",
  "short-break": "from-emerald-500 to-teal-500",
  "long-break": "from-sky-500 to-blue-500",
};

const RING_COLOR: Record<string, string> = {
  focus: "text-violet-500",
  "short-break": "text-emerald-500",
  "long-break": "text-sky-500",
};

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

function playBeep(): void {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // audio not available
  }
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

export function PomodoroTimer() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number | null>(null);
  const restored = useRef(false);

  const soundRef = useRef(true);

  const [open, setOpen] = useState(false);

  const [sound, _setSound] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`pomodoro_sound_${userId}`);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });

  // keep a ref in sync so running intervals read the latest value
  useEffect(() => {
    soundRef.current = sound;
    try {
      localStorage.setItem(`pomodoro_sound_${userId}`, sound ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sound, userId]);

  const setSound = (v: boolean) => {
    soundRef.current = v;
    _setSound(v);
  };
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState<"focus" | "short-break" | "long-break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const [running, setRunning] = useState(false);
  const [pomoCount, setPomoCount] = useState(0);
  const [notified, setNotified] = useState(false);

  // Custom duration modal states
  const [customFocusOpen, setCustomFocusOpen] = useState(false);
  const [customFocusVal, setCustomFocusVal] = useState("");
  const [customBreakOpen, setCustomBreakOpen] = useState(false);
  const [customBreakVal, setCustomBreakVal] = useState("");

  // Note picker state
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteOptions, setNoteOptions] = useState<{ id: number; text: string }[]>([]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endAtRef.current = null;
    setRunning(false);
    setNotified(false);
  }, []);

  const nextPhase = useCallback(() => {
    if (phase === "focus") {
      const newCount = pomoCount + 1;
      const isLongBreak = newCount % 4 === 0;
      setPhase(isLongBreak ? "long-break" : "short-break");
      setSecondsLeft((isLongBreak ? LONG_BREAK_MIN : breakMin) * 60);
      setPomoCount(newCount);
    } else {
      setPhase("focus");
      setSecondsLeft(focusMin * 60);
    }
    setRunning(false);
    endAtRef.current = null;
    clearState(userId);
  }, [phase, pomoCount, breakMin, focusMin, userId]);

  const notify = useCallback(
    (title: string, body: string) => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/favicon.ico" });
        } catch {
          // notification failed
        }
      }
    },
    [],
  );

  const confirmCompletion = useCallback(() => {
    if (phase === "focus") {
      setNotePickerOpen(true);
    } else {
      nextPhase();
    }
  }, [phase, nextPhase]);

  const start = useCallback(() => {
    if (running) {
      // Pause
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      endAtRef.current = null;
      setRunning(false);
      saveState(userId, {
        focusMin,
        breakMin,
        phase,
        secondsLeft,
        pomoCount,
        running: false,
        startedAt: null,
      });
      return;
    }

    // Calculate remaining time for accurate countdown
    const dur = phase === "focus" ? focusMin * 60 : phase === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60;
    const startedAt = Date.now() + (dur - secondsLeft) * 1000;
    endAtRef.current = startedAt + dur * 1000;

    setRunning(true);
    setNotified(false);
    intervalRef.current = setInterval(() => {
      if (!endAtRef.current) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(left);

      if (left <= 10 && left > 0 && soundRef.current && !notified) {
        setNotified(true);
        playBeep();
      }

      if (left === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        endAtRef.current = null;
        playChime();
        if (soundRef.current) {
          notify(PHASE_LABEL[phase], "Time's up! 🍅");
        }
        confirmCompletion();
      }
    }, 250);

    saveState(userId, {
      focusMin,
      breakMin,
      phase,
      secondsLeft: dur,
      pomoCount,
      running: true,
      startedAt,
    });
  }, [running, phase, focusMin, breakMin, secondsLeft, pomoCount, userId, notified, notify, confirmCompletion]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endAtRef.current = null;
    setRunning(false);
    saveState(userId, {
      focusMin,
      breakMin,
      phase,
      secondsLeft,
      pomoCount,
      running: false,
      startedAt: null,
    });
  }, [userId, focusMin, breakMin, phase, secondsLeft, pomoCount]);

  const reset = useCallback(() => {
    clearTimer();
    const dur = phase === "focus" ? focusMin * 60 : phase === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60;
    setSecondsLeft(dur);
    setNotified(false);
    clearState(userId);
  }, [clearTimer, phase, focusMin, breakMin, userId]);

  const changeFocus = useCallback(
    (val: number) => {
      setFocusMin(val);
      if (!running) {
        setSecondsLeft(val * 60);
      }
    },
    [running],
  );

  const changeBreak = useCallback(
    (val: number) => {
      setBreakMin(val);
      if (!running) {
        setSecondsLeft(val * 60);
      }
    },
    [running],
  );

  const onNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNoteOptions(data.map((n: any) => ({ id: n.id, text: n.title || n.text || "Untitled" })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (notePickerOpen) {
      onNotes();
    }
  }, [notePickerOpen, onNotes]);

  // Restore state on mount
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadState(userId);
    if (saved) {
      setFocusMin(saved.focusMin);
      setBreakMin(saved.breakMin);
      setPhase(saved.phase);
      setSecondsLeft(saved.secondsLeft);
      setPomoCount(saved.pomoCount);
      if (saved.running && saved.startedAt) {
        const dur = saved.phase === "focus" ? saved.focusMin * 60 : saved.phase === "long-break" ? LONG_BREAK_MIN * 60 : saved.breakMin * 60;
        const elapsedSinceStart = Math.floor((Date.now() - saved.startedAt) / 1000);
        const newRemaining = Math.max(0, saved.secondsLeft - elapsedSinceStart);
        setSecondsLeft(newRemaining);
        setRunning(true);
        endAtRef.current = saved.startedAt + dur * 1000;
        intervalRef.current = setInterval(() => {
          if (!endAtRef.current) return;
          const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left <= 10 && left > 0 && soundRef.current && !notified) {
            setNotified(true);
            playBeep();
          }
          if (left === 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            endAtRef.current = null;
            playChime();
            if (soundRef.current) {
              notify(PHASE_LABEL[saved.phase], "Time's up! 🍅");
            }
            setRunning(false);
            setNotePickerOpen(true);
          }
        }, 250);
      }
    }
  }, [userId, notified, notify]);

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

  const advance = useCallback(() => {
    if (phase === "focus") {
      const newCount = pomoCount + 1;
      const isLongBreak = newCount % 4 === 0;
      const dur = isLongBreak ? LONG_BREAK_MIN * 60 : breakMin * 60;
      recordCompletion(userId, "focus", focusMin * 60, selectedNoteId);
      setPhase(isLongBreak ? "long-break" : "short-break");
      setSecondsLeft(dur);
      setPomoCount(newCount);
      setSelectedNoteId(null);
    } else {
      const dur = focusMin * 60;
      recordCompletion(userId, phase, breakMin * 60);
      setPhase("focus");
      setSecondsLeft(dur);
      setSelectedNoteId(null);
    }
    setNotified(false);
  }, [phase, pomoCount, breakMin, focusMin, userId, selectedNoteId]);

  const handleClearNotes = useCallback(() => {
    setSelectedNoteId(null);
    setNotePickerOpen(false);
  }, []);

  const label = PHASE_LABEL[phase];
  const color = PHASE_COLOR[phase];
  const duration = phase === "focus" ? focusMin * 60 : phase === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60;
  const progress = duration > 0 ? Math.min(1, Math.max(0, secondsLeft / duration)) : 0;

  const isValidNumber = (val: string) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 && num <= 180;
  };

  const confirmCustomFocus = useCallback(() => {
    if (isValidNumber(customFocusVal)) {
      const val = parseInt(customFocusVal, 10);
      changeFocus(val);
      setCustomFocusOpen(false);
      setCustomFocusVal("");
    }
  }, [customFocusVal, changeFocus]);

  const confirmCustomBreak = useCallback(() => {
    if (isValidNumber(customBreakVal)) {
      const val = parseInt(customBreakVal, 10);
      changeBreak(val);
      setCustomBreakOpen(false);
      setCustomBreakVal("");
    }
  }, [customBreakVal, changeBreak]);

  const cycleFocus = useCallback(
    (delta: number) => {
      const currentIdx = FOCUS_OPTIONS.indexOf(focusMin);
      const newIdx = Math.max(0, Math.min(FOCUS_OPTIONS.length - 1, currentIdx + delta));
      changeFocus(FOCUS_OPTIONS[newIdx]);
    },
    [focusMin, changeFocus],
  );

  const cycleBreak = useCallback(
    (delta: number) => {
      const currentIdx = BREAK_OPTIONS.indexOf(breakMin);
      const newIdx = Math.max(0, Math.min(BREAK_OPTIONS.length - 1, currentIdx + delta));
      changeBreak(BREAK_OPTIONS[newIdx]);
    },
    [breakMin, changeBreak],
  );

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
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,_calc(100vw-1rem))] max-h-[calc(100vh-4rem)] origin-top-right overflow-hidden rounded-[1.75rem] border border-white/20 bg-background/80 shadow-2xl shadow-black/20 backdrop-blur-2xl dark:bg-background/70 sm:w-[24rem]">
          {/* iOS-style sheet handle */}
          <div className="flex items-center justify-between px-5 pt-3">
            <span className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/20" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Header */}
          <div className="pt-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Pomodoro
            </p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{label}</p>
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 pb-5 pt-2 sm:max-h-[28rem]">
            {/* Timer Display */}
            <div className="mb-5 flex flex-col items-center">
              <div className="relative flex h-48 w-48 items-center justify-center">
                {/* progress ring */}
                <svg viewBox="0 0 200 200" className={`h-full w-full -rotate-90 ${RING_COLOR[phase]}`}>
                  <circle cx="100" cy="100" r="90" fill="none" strokeWidth="9" className="stroke-muted/30" />
                  <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    stroke="currentColor"
                    className="transition-[stroke-dashoffset] duration-500"
                    strokeDasharray={Math.PI * 180}
                    strokeDashoffset={Math.PI * 180 * (1 - progress)}
                  />
                </svg>
                {/* soft glow blob behind */}
                <div className={`absolute h-28 w-28 rounded-full bg-gradient-to-br ${color} opacity-20 blur-2xl`} />
                <div className="relative z-10 flex flex-col items-center">
                  <span className={`mb-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                    running
                      ? `bg-gradient-to-r ${color} text-white`
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {running ? "In Progress" : "Ready"}
                  </span>
                  <span className="font-mono text-6xl font-light leading-none tracking-tight text-foreground tabular-nums">
                    {formatTime(secondsLeft)}
                  </span>
                  {pomoCount > 0 && (
                    <span className="mt-2 text-[11px] font-medium text-muted-foreground/80">
                      #{pomoCount + 1} · {pomoCount} complete
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls — iOS-style big circular control */}
            <div className="mb-5 flex items-center justify-center gap-9">
              <button
                type="button"
                onClick={reset}
                title="Reset"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-white/60 text-muted-foreground transition-transform hover:scale-105 active:scale-95 dark:bg-white/5"
              >
                <RotateCcw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={running ? pause : start}
                title={running ? "Pause" : "Start"}
                className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${color} text-white shadow-lg shadow-black/10 transition-transform hover:scale-105 active:scale-95`}
              >
                {running ? (
                  <Pause className="h-8 w-8 fill-current" />
                ) : (
                  <Play className="ml-1 h-8 w-8 fill-current" />
                )}
              </button>
            </div>

            {/* Settings Toggle */}
            {/* Settings */}
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Settings
            </p>

            <div className="overflow-hidden rounded-2xl border border-border/60 bg-white/70 shadow-sm dark:bg-white/5">
              {/* Focus Duration */}
              <div className="px-4 pb-4 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Focus Duration</span>
                  <button
                    type="button"
                    onClick={() => setCustomFocusOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Edit3 className="h-3 w-3" />
                    Custom
                  </button>
                </div>
                <div className="mb-2 flex items-center gap-1 rounded-full bg-muted/70 p-1">
                  {FOCUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => changeFocus(opt)}
                      className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all ${
                        focusMin === opt
                          ? `bg-gradient-to-r ${color} text-white shadow-sm`
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt}m
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => cycleFocus(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-white/60 text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <span className="min-w-14 text-center font-mono text-base font-semibold tabular-nums text-foreground">
                    {focusMin} <span className="text-[11px] font-normal text-muted-foreground">min</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cycleFocus(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-white/60 text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="h-px bg-border/60" />

              {/* Break Duration */}
              <div className="px-4 pb-4 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Break Duration</span>
                  <button
                    type="button"
                    onClick={() => setCustomBreakOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Edit3 className="h-3 w-3" />
                    Custom
                  </button>
                </div>
                <div className="mb-2 flex items-center gap-1 rounded-full bg-muted/70 p-1">
                  {BREAK_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => changeBreak(opt)}
                      className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all ${
                        breakMin === opt
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt}m
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => cycleBreak(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-white/60 text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <span className="min-w-14 text-center font-mono text-base font-semibold tabular-nums text-foreground">
                    {breakMin} <span className="text-[11px] font-normal text-muted-foreground">min</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cycleBreak(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-white/60 text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="h-px bg-border/60" />

              {/* Sound Alerts */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    sound ? "bg-primary/10 text-primary" : "bg-muted/70 text-muted-foreground"
                  }`}>
                    {sound ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium leading-tight text-foreground">Sound Alerts</span>
                    <span className="text-[11px] text-muted-foreground/80">
                      {sound ? "Chime & notification on" : "Muted"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sound}
                  aria-label="Toggle sound alerts"
                  onClick={() => setSound(!sound)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    sound ? "bg-gradient-to-r from-primary to-primary/80" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute h-[18px] w-[18px] rounded-full bg-white shadow-md transition-all duration-200 ${
                      sound ? "left-[23px]" : "left-[3px]"
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-border/60" />

              {/* Notification Permission */}
              {!("Notification" in window) || Notification.permission === "denied" ? (
                <button
                  type="button"
                  onClick={requestNotification}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Enable Browser Notifications
                  <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
                </button>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Browser Notifications</span>
                    <span className="text-[11px] text-muted-foreground/80">Enabled</span>
                  </div>
                  <Check className="h-4 w-4 text-emerald-500" />
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
              <div className="border-t border-border/50 px-4 py-3 flex gap-2">
                <Button
                  onClick={() => {
                    if (selectedNoteId !== null) {
                      advance();
                    }
                  }}
                  disabled={selectedNoteId === null}
                  className={`flex-1 bg-gradient-to-r ${PHASE_COLOR[phase]} text-white`}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Save with Note
                </Button>
                <Button
                  onClick={() => {
                    setSelectedNoteId(null);
                    advance();
                  }}
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


