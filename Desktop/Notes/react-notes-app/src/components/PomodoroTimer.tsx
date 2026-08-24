import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { X, Plus, Check, ChevronDown, ChevronUp, Clock, Bell, BellOff, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { recordCompletion, PomoStat } from "@/hooks/use-pomodoro-stats";
import NoteSelect from "./NoteSelect";

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

export default function PomodoroTimer() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number | null>(null);
  const restored = useRef(false);

  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState<"focus" | "short-break" | "long-break">("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(focusMin * 60);
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
  const [pendingCompletion, setPendingCompletion] = useState<{ duration: number } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteOptions, setNoteOptions] = useState<{ id: number; title: string }[]>([]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endAtRef.current = null;
    setRunning(false);
    setElapsed(0);
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
    setElapsed(0);
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
      setPendingCompletion({ duration: focusMin * 60 - elapsed });
      setNotePickerOpen(true);
    } else {
      nextPhase();
    }
  }, [phase, focusMin, elapsed, nextPhase]);

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
      setElapsed(dur - left);
      setRemaining(left);

      if (left <= 10 && left > 0 && sound && !notified) {
        setNotified(true);
        playBeep();
      }

      if (left === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        endAtRef.current = null;
        playChime();
        if (sound) {
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
  }, [running, phase, focusMin, breakMin, secondsLeft, pomoCount, userId, sound, notified, notify, confirmCompletion]);

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
    setElapsed(0);
    setRemaining(dur);
    setNotified(false);
    clearState(userId);
  }, [clearTimer, phase, focusMin, breakMin, userId]);

  const changeFocus = useCallback(
    (val: number) => {
      setFocusMin(val);
      if (!running) {
        setSecondsLeft(val * 60);
        setRemaining(val * 60);
      }
    },
    [running],
  );

  const changeBreak = useCallback(
    (val: number) => {
      setBreakMin(val);
      if (!running) {
        setSecondsLeft(val * 60);
        setRemaining(val * 60);
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
      setNoteOptions(data.map((n: any) => ({ id: n.id, title: n.title || "Untitled" })));
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
      setRemaining(saved.secondsLeft);
      setPomoCount(saved.pomoCount);
      if (saved.running && saved.startedAt) {
        const dur = saved.phase === "focus" ? saved.focusMin * 60 : saved.phase === "long-break" ? LONG_BREAK_MIN * 60 : saved.breakMin * 60;
        const elapsedSinceStart = Math.floor((Date.now() - saved.startedAt) / 1000);
        const newRemaining = Math.max(0, saved.secondsLeft - elapsedSinceStart);
        setSecondsLeft(newRemaining);
        setRemaining(newRemaining);
        setElapsed(elapsedSinceStart);
        setRunning(true);
        endAtRef.current = saved.startedAt + dur * 1000;
        intervalRef.current = setInterval(() => {
          if (!endAtRef.current) return;
          const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
          setSecondsLeft(left);
          setElapsed(dur - left);
          setRemaining(left);
          if (left <= 10 && left > 0 && sound && !notified) {
            setNotified(true);
            playBeep();
          }
          if (left === 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            endAtRef.current = null;
            playChime();
            if (sound) {
              notify(PHASE_LABEL[saved.phase], "Time's up! 🍅");
            }
            setRunning(false);
            setPendingCompletion({ duration: dur - elapsedSinceStart });
            setNotePickerOpen(true);
          }
        }, 250);
      }
    }
  }, [userId, sound, notified, notify]);

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
      setRemaining(dur);
      setPomoCount(newCount);
      setSelectedNoteId(null);
    } else {
      const dur = focusMin * 60;
      recordCompletion(userId, phase, breakMin * 60);
      setPhase("focus");
      setSecondsLeft(dur);
      setRemaining(dur);
      setSelectedNoteId(null);
    }
    setElapsed(0);
    setNotified(false);
    setPendingCompletion(null);
  }, [phase, pomoCount, breakMin, focusMin, userId, selectedNoteId]);

  const handleNoteSelect = useCallback(
    (noteId: number) => {
      setSelectedNoteId(noteId);
      setNotePickerOpen(false);
    },
    [],
  );

  const handleClearNotes = useCallback(() => {
    setSelectedNoteId(null);
    setNotePickerOpen(false);
  }, []);

  const duration = phase === "focus" ? focusMin * 60 : phase === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60;
  const label = PHASE_LABEL[phase];
  const color = PHASE_COLOR[phase];

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
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,_calc(100vw-1rem))] max-h-[calc(100vh-4rem)] origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl sm:w-[24rem]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg bg-gradient-to-r ${color} p-1.5 text-white shadow-sm`}>
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pomodoro Timer</p>
                <p className="text-sm font-medium text-foreground">{label}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-4 sm:max-h-[28rem]">
            {/* Timer Display */}
            <div className="mb-4 flex flex-col items-center">
              <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${color} px-3 py-1 text-xs font-medium text-white shadow-sm`}>
                {running ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    Running
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                    Paused
                  </>
                )}
              </div>
              <div className={`mb-1 bg-gradient-to-r ${color} bg-clip-text text-center`}>
                <span className="font-mono text-5xl font-bold text-transparent">{formatTime(phase === "focus" ? secondsLeft : secondsLeft)}</span>
              </div>
              {pomoCount > 0 && (
                <Badge variant="outline" className="mt-1 text-xs">
                  #{pomoCount + 1} • {pomoCount} completed
                </Badge>
              )}
            </div>

            {/* Controls */}
            <div className="mb-4 flex items-center justify-center gap-2">
              {!running ? (
                <Button
                  onClick={start}
                  className={`flex-1 bg-gradient-to-r ${color} text-white shadow-sm hover:opacity-90`}
                >
                  Start
                </Button>
              ) : (
                <Button
                  onClick={pause}
                  variant="secondary"
                  className="flex-1"
                >
                  Pause
                </Button>
              )}
              <Button
                onClick={reset}
                variant="outline"
                size="icon"
                className="h-10 w-10"
                title="Reset"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Settings Toggle */}
            <Button
              onClick={() => setCustomFocusOpen(true)}
              variant="ghost"
              size="sm"
              className="mb-2 h-8 w-full justify-between text-xs"
            >
              <span>⚙️ Settings</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>

            {/* Quick Duration Selectors - Inline */}
            <div className="space-y-3">
              {/* Focus Duration */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">Focus Duration</span>
                  <button
                    onClick={() => setCustomFocusOpen(true)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Edit3 className="h-3 w-3" />
                    Custom
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cycleFocus(-1)}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-lg font-bold">{focusMin}</span>
                    <span className="ml-1 text-xs text-muted-foreground">min</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cycleFocus(1)}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2 flex gap-1">
                  {FOCUS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => changeFocus(opt)}
                      className={`flex-1 rounded-md py-1 text-[10px] font-medium transition-colors ${
                        focusMin === opt
                          ? `bg-gradient-to-r ${color} text-white`
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Break Duration */}
              <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">Break Duration</span>
                  <button
                    onClick={() => setCustomBreakOpen(true)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Edit3 className="h-3 w-3" />
                    Custom
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cycleBreak(-1)}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-lg font-bold">{breakMin}</span>
                    <span className="ml-1 text-xs text-muted-foreground">min</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => cycleBreak(1)}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2 flex gap-1">
                  {BREAK_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => changeBreak(opt)}
                      className={`flex-1 rounded-md py-1 text-[10px] font-medium transition-colors ${
                        breakMin === opt
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2">
                  {sound ? (
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">Sound Alerts</span>
                </div>
                <button
                  onClick={() => setSound(!sound)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    sound ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      sound ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Notification Permission */}
              {!("Notification" in window) || Notification.permission === "denied" ? (
                <Button
                  onClick={requestNotification}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  Enable Browser Notifications
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Custom Focus Duration Modal - Inline Style */}
      {customFocusOpen && (
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
        </div>
      )}

      {/* Custom Break Duration Modal - Inline Style */}
      {customBreakOpen && (
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
        </div>
      )}

      {/* Note Selection Modal */}
      {notePickerOpen && (
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
                onSelect={handleNoteSelect}
                notes={noteOptions}
                selectedId={selectedNoteId}
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
        </div>
      )}
    </div>
  );
}


