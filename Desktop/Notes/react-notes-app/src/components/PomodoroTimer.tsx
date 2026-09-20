import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  AnimatePresence,
  MotionConfig,
} from "framer-motion";
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
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { recordCompletion, usePomodoroStats, getDailyGoal, todaysFocus, getAscent, incrementAscent, resetAscent, setAscent as setAscentPoints } from "@/hooks/use-pomodoro-stats";
import { NoteSelect } from "./NoteSelect";
import { JourneySummary } from "./AscentMountain";
import { ClimbTimer } from "./ClimbTimer";

export type TimerPhase = "focus" | "short-break" | "long-break";

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
  totalPoints?: number;
}

function loadState(userId: number): PersistedState | null {
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const savedPoints = localStorage.getItem(`pomodoro_total_points_${userId}`);
    const configuredPoints = savedPoints === null ? 16 : Number(savedPoints);
    return {
      focusMin: parsed.focusMin ?? 25,
      breakMin: parsed.breakMin ?? 5,
      longBreakMin: parsed.longBreakMin ?? 15,
      phase: parsed.phase ?? "focus",
      secondsLeft: parsed.secondsLeft ?? 25 * 60,
      pomoCount: parsed.pomoCount ?? 0,
      running: parsed.running ?? false,
      startedAt: parsed.startedAt ?? null,
      totalPoints: Math.max(4, Math.min(64, parsed.totalPoints ?? (Number.isFinite(configuredPoints) ? configuredPoints : 16))),
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

function DurationSetting({
  label,
  options,
  value,
  isCustom,
  customInput,
  onChange,
  onCustomInputChange,
  onCustomInputBlur,
  max = 180,
  suffix = "m",
}: {
  label: string;
  options: number[];
  value: number;
  isCustom: boolean;
  customInput: string;
  onChange: (v: number | "custom") => void;
  onCustomInputChange: (v: string) => void;
  onCustomInputBlur: () => void;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center justify-end gap-2">
        <select
          value={isCustom ? "custom" : value}
          onChange={(e) => onChange(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          className="h-8 cursor-pointer rounded-md border border-border bg-card px-2.5 text-sm font-medium tabular-nums text-foreground outline-none transition-colors hover:border-foreground/25 focus:border-foreground/40 focus:ring-2 focus:ring-ring"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
              {suffix}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {isCustom && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={max}
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              onBlur={onCustomInputBlur}
              placeholder="Min"
              className="h-8 w-20 border-border bg-card text-sm"
            />
            <span className="text-xs font-medium text-foreground/50">{suffix}</span>
          </div>
        )}
      </div>
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

function StepperButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
    >
      {label}
    </button>
  );
}

function ProgressPointsSetting({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground/90">Climb length</div>
        <div className="mt-0.5 text-xs text-foreground/50">
          {value} points · one per completed Pomodoro
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StepperButton label="−" disabled={value <= 4} onClick={() => onChange(value - 4)} />
        <input
          aria-label="Progress points"
          type="number"
          min={4}
          max={64}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.max(4, Math.min(64, Math.round(next))));
          }}
          className="h-8 w-12 rounded-md border border-border bg-card text-center text-sm font-semibold tabular-nums text-foreground outline-none focus:border-foreground/40"
        />
        <StepperButton label="+" disabled={value >= 64} onClick={() => onChange(value + 4)} />
      </div>
    </div>
  );
}

function SessionIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            i < count ? "bg-foreground/70" : "bg-foreground/15"
          }`}
        />
      ))}
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
    <motion.button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      whileTap={{ scale: 0.93, opacity: 0.7 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {icon}
      {label}
    </motion.button>
  );
}

export function PomodoroTimer() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number | null>(null);
  const completionHandledRef = useRef(false);
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

  const [totalPoints, setTotalPoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`pomodoro_total_points_${userId}`);
      return saved === null ? 16 : Math.max(4, Math.min(64, Number(saved) || 16));
    } catch {
      return 16;
    }
  });

  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [customFocusInput, setCustomFocusInput] = useState("25");
  const [customBreakInput, setCustomBreakInput] = useState("5");
  const [customLongBreakInput, setCustomLongBreakInput] = useState("15");
  const [isCustomFocus, setIsCustomFocus] = useState(false);
  const [isCustomBreak, setIsCustomBreak] = useState(false);
  const [isCustomLongBreak, setIsCustomLongBreak] = useState(false);
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const [pomodoroProgress, setPomodoroProgress] = useState(0);
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

  const [ascent, setAscent] = useState<number>(() => getAscent(userId));
  const ascentRef = useRef(ascent);
  const totalPointsRef = useRef(totalPoints);

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
    ascentRef.current = ascent;
    totalPointsRef.current = totalPoints;
    try {
      localStorage.setItem(`pomodoro_sound_${userId}`, sound ? "1" : "0");
      localStorage.setItem(`pomodoro_autostart_${userId}`, autoStart ? "1" : "0");
      localStorage.setItem(`pomodoro_total_points_${userId}`, String(totalPoints));
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
    ascent,
    totalPoints,
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
      completionHandledRef.current = false;
      const phaseDuration = durFor(next, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
      setPomodoroProgress(next === "focus" ? Math.min(1, Math.max(0, 1 - remaining / phaseDuration)) : 0);
      runningRef.current = true;
      setRunning(true);
      intervalRef.current = setInterval(() => {
        if (!endAtRef.current) return;
        const now = Date.now();
        const left = Math.max(0, Math.ceil((endAtRef.current - now) / 1000));
        setPomodoroProgress(next === "focus"
          ? Math.min(1, Math.max(0, 1 - (endAtRef.current - now) / (phaseDuration * 1000)))
          : 0);
        secondsLeftRef.current = left;
        setSecondsLeft(left);
        if (left === 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          endAtRef.current = null;
          setPomodoroProgress(next === "focus" ? 1 : 0);
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
        if (completionHandledRef.current) return;
        completionHandledRef.current = true;
        // Freeze the completed scene at the checkpoint while the user
        // optionally associates the session with a note.
        const completedCount = pomoCountRef.current + 1;
        const currentPoints = getAscent(userIdRef.current);
        const nextPoints = currentPoints < totalPointsRef.current
          ? incrementAscent(userIdRef.current)
          : currentPoints;
        ascentRef.current = Math.min(totalPointsRef.current, nextPoints);
        setAscent(ascentRef.current);
        pomoCountRef.current = completedCount;
        setPomoCount(completedCount);
        runningRef.current = false;
        setRunning(false);
        setPomodoroProgress(1);
        saveState(userIdRef.current, {
          focusMin: focusMinRef.current,
          breakMin: breakMinRef.current,
          longBreakMin: longBreakMinRef.current,
          phase: "focus",
          secondsLeft: 0,
          pomoCount: completedCount,
          totalPoints: totalPointsRef.current,
          running: false,
          startedAt: null,
        });
        setNotePickerOpen(true);
        return;
      }
      setPhase("focus");
      setSelectedNoteId(null);
      const focusDur = focusMinRef.current * 60;
      if (autoStartRef.current) {
        if (pomoCountRef.current % 4 === 0 && ascentRef.current >= totalPointsRef.current) {
          ascentRef.current = 0;
          setAscent(0);
        }
        beginCountdown({ next: "focus", remaining: focusDur });
      } else {
        setSecondsLeft(focusDur);
        setPomodoroProgress(0);
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
      const next: TimerPhase = count % 4 === 0 ? "long-break" : "short-break";
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
      recordCompletion(userIdRef.current, "focus", focusMinRef.current * 60, noteId);
      setNotePickerOpen(false);
      setSelectedNoteId(null);
      setPomoCount(count);

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
        setPomodoroProgress(0);
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
    if (phaseRef.current === "focus" && pomoCountRef.current % 4 === 0 && ascentRef.current >= totalPointsRef.current) {
      ascentRef.current = 0;
      setAscent(0);
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
    setPomodoroProgress(0);
    clearState(userIdRef.current);
  }, []);

  const resetPoints = useCallback(() => {
    resetAscent(userIdRef.current);
    ascentRef.current = 0;
    setAscent(0);
  }, []);

  const handleTotalPointsChange = useCallback((value: number) => {
    const next = Math.max(4, Math.min(64, Math.round(value)));
    setTotalPoints(next);
    if (ascentRef.current > next) {
      const clamped = setAscentPoints(userIdRef.current, next);
      ascentRef.current = clamped;
      setAscent(clamped);
    }
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
      const next: TimerPhase = "short-break";
      const nextDur = durFor(next, focusMinRef.current, breakMinRef.current, longBreakMinRef.current);
      setPhase(next);
      setPomoCount(count);
      secondsLeftRef.current = nextDur;
      setSecondsLeft(nextDur);
      setPomodoroProgress(0);
      runningRef.current = false;
      setRunning(false);
    } else {
      const nextDur = focusMinRef.current * 60;
      setPhase("focus");
      secondsLeftRef.current = nextDur;
      setSecondsLeft(nextDur);
      setPomodoroProgress(0);
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

  const validateCustom = (val: string, max: number): number | null => {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0 || num > max) return null;
    return num;
  };

  const handleFocusChange = useCallback(
    (val: number | "custom") => {
      if (val === "custom") {
        setIsCustomFocus(true);
        const num = validateCustom(customFocusInput, 180);
        if (num !== null) changeFocus(num);
      } else {
        setIsCustomFocus(false);
        changeFocus(val);
      }
    },
    [customFocusInput, changeFocus],
  );

  const handleCustomFocusChange = useCallback(
    (val: string) => {
      setCustomFocusInput(val);
      const num = validateCustom(val, 180);
      if (num !== null) changeFocus(num);
    },
    [changeFocus],
  );

  const handleCustomFocusBlur = useCallback(() => {
    const num = validateCustom(customFocusInput, 180);
    if (num === null) {
      setCustomFocusInput(String(focusMin));
    } else {
      changeFocus(num);
    }
  }, [customFocusInput, focusMin, changeFocus]);

  const handleBreakChange = useCallback(
    (val: number | "custom") => {
      if (val === "custom") {
        setIsCustomBreak(true);
        const num = validateCustom(customBreakInput, 60);
        if (num !== null) changeBreak(num);
      } else {
        setIsCustomBreak(false);
        changeBreak(val);
      }
    },
    [customBreakInput, changeBreak],
  );

  const handleCustomBreakChange = useCallback(
    (val: string) => {
      setCustomBreakInput(val);
      const num = validateCustom(val, 60);
      if (num !== null) changeBreak(num);
    },
    [changeBreak],
  );

  const handleCustomBreakBlur = useCallback(() => {
    const num = validateCustom(customBreakInput, 60);
    if (num === null) {
      setCustomBreakInput(String(breakMin));
    } else {
      changeBreak(num);
    }
  }, [customBreakInput, breakMin, changeBreak]);

  const handleLongBreakChange = useCallback(
    (val: number | "custom") => {
      if (val === "custom") {
        setIsCustomLongBreak(true);
        const num = validateCustom(customLongBreakInput, 60);
        if (num !== null) changeLongBreak(num);
      } else {
        setIsCustomLongBreak(false);
        changeLongBreak(val);
      }
    },
    [customLongBreakInput, changeLongBreak],
  );

  const handleCustomLongBreakChange = useCallback(
    (val: string) => {
      setCustomLongBreakInput(val);
      const num = validateCustom(val, 60);
      if (num !== null) changeLongBreak(num);
    },
    [changeLongBreak],
  );

  const handleCustomLongBreakBlur = useCallback(() => {
    const num = validateCustom(customLongBreakInput, 60);
    if (num === null) {
      setCustomLongBreakInput(String(longBreakMin));
    } else {
      changeLongBreak(num);
    }
  }, [customLongBreakInput, longBreakMin, changeLongBreak]);

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
    setTotalPoints(saved.totalPoints ?? 16);
    setCustomFocusInput(String(saved.focusMin));
    setCustomBreakInput(String(saved.breakMin));
    setCustomLongBreakInput(String(saved.longBreakMin));
    setIsCustomFocus(!FOCUS_OPTIONS.includes(saved.focusMin));
    setIsCustomBreak(!BREAK_OPTIONS.includes(saved.breakMin));
    setIsCustomLongBreak(!LONG_BREAK_OPTIONS.includes(saved.longBreakMin));
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
    <MotionConfig reducedMotion="user">
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

      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.99 }}
          transition={{
            opacity: { duration: 0.18, ease: "easeOut" },
            y: { type: "spring", stiffness: 380, damping: 32 },
            scale: { type: "spring", stiffness: 380, damping: 32 },
          }}
          className="fixed inset-x-3 top-14 z-50 mx-auto flex max-h-[calc(100svh-5rem)] max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-foreground/5 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[22rem]"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border/50 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground/70">
                <Clock className="h-3 w-3" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold tracking-tight text-foreground">Focus Flow</span>
                <span className="text-[11px] text-foreground/45">Pomodoro</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="mr-1.5 flex min-w-16 items-center justify-end text-[11px] font-medium tabular-nums text-foreground/50">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={pomoCount + 1}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="inline-block"
                  >
                    Session {pomoCount + 1}
                  </motion.span>
                </AnimatePresence>
              </div>
              <motion.button
                type="button"
                onClick={scrollToSettings}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setOpen(false)}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/45 transition-colors hover:bg-foreground/5 hover:text-foreground"
                title="Close"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* 1. Timer */}
            <div className="flex flex-col items-center px-8 pt-10 pb-2">
              <ClimbTimer
                secondsLeft={secondsLeft}
                duration={duration}
                phase={phase}
                running={running}
                pomodoroProgress={pomodoroProgress}
                completedPoints={ascent}
                totalPoints={totalPoints}
              />
            </div>

            {/* 2. Primary control */}
            <div className="flex flex-col items-center px-8 pt-4 pb-5">
              <motion.button
                type="button"
                onClick={start}
                title={running ? "Pause" : "Start"}
                aria-label={running ? "Pause" : "Start"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="flex h-11 w-full max-w-[15rem] items-center justify-center overflow-hidden rounded-full bg-foreground text-sm font-medium text-primary-foreground shadow-sm"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={running ? "running" : "idle"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="flex items-center justify-center gap-2"
                  >
                    {running ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}
                    {running ? "Pause" : "Start"}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              <div className="mt-4 flex items-center gap-2 text-[10px] text-foreground/45">
                <SessionIndicator count={cycleInCycle} />
                <span className="tabular-nums">
                  {cycleInCycle} of 4 in cycle
                </span>
                <button
                  type="button"
                  onClick={resetCycle}
                  title="Reset cycle"
                  aria-label="Reset cycle count"
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded text-foreground/35 transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            {/* 3. Progression */}
            <div className="border-t border-border/50 px-8 py-5">
              <JourneySummary height={ascent} totalPoints={totalPoints} />

              <div className="mt-5 flex items-center justify-center gap-1">
                <SecondaryButton onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset timer" />
                <span className="mx-1 h-1 w-1 rounded-full bg-border" />
                <SecondaryButton onClick={resetPoints} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset points" />
                <span className="mx-1 h-1 w-1 rounded-full bg-border" />
                <SecondaryButton onClick={skipPhase} icon={<SkipForward className="h-3.5 w-3.5" />} label="Skip" />
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
                    isCustom={isCustomFocus}
                    customInput={customFocusInput}
                    onChange={handleFocusChange}
                    onCustomInputChange={handleCustomFocusChange}
                    onCustomInputBlur={handleCustomFocusBlur}
                    max={180}
                  />
                  <DurationSetting
                    label="Short break"
                    options={BREAK_OPTIONS}
                    value={breakMin}
                    isCustom={isCustomBreak}
                    customInput={customBreakInput}
                    onChange={handleBreakChange}
                    onCustomInputChange={handleCustomBreakChange}
                    onCustomInputBlur={handleCustomBreakBlur}
                    max={60}
                  />
                  <DurationSetting
                    label="Long break"
                    options={LONG_BREAK_OPTIONS}
                    value={longBreakMin}
                    isCustom={isCustomLongBreak}
                    customInput={customLongBreakInput}
                    onChange={handleLongBreakChange}
                    onCustomInputChange={handleCustomLongBreakChange}
                    onCustomInputBlur={handleCustomLongBreakBlur}
                    max={60}
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
                  <ProgressPointsSetting value={totalPoints} onChange={handleTotalPointsChange} />
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
        </motion.div>
      )}
      </AnimatePresence>

      {createPortal(
          <AnimatePresence>
            {notePickerOpen && (
              <motion.div
                key="note-picker"
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <motion.div
                  className="w-[min(24rem,_calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm sm:w-[26rem]"
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{
                    opacity: { duration: 0.16, ease: "easeOut" },
                    y: { type: "spring", stiffness: 380, damping: 30 },
                    scale: { type: "spring", stiffness: 380, damping: 30 },
                  }}
                >
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {createPortal(
          <AnimatePresence>
            {recapOpen && (
              <motion.div
                key="recap"
                className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
                onClick={() => setRecapOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <motion.div
                  className="w-[min(24rem,_calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{
                    opacity: { duration: 0.16, ease: "easeOut" },
                    y: { type: "spring", stiffness: 380, damping: 30 },
                    scale: { type: "spring", stiffness: 380, damping: 30 },
                  }}
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
    </MotionConfig>
  );
}
