import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Timer, X, Volume2, VolumeX } from "lucide-react";
import { logSession } from "@/hooks/use-pomodoro-stats";
import type { NoteItem } from "@/types";

type Phase = "focus" | "short-break" | "long-break";

const FOCUS_OPTIONS = [25, 60, 90];
const BREAK_OPTIONS = [5, 10, 15];
const LONG_BREAK_MIN = 30;

const STORAGE_KEY = "pomodoro_state";

interface TimerState {
  focusMin: number;
  breakMin: number;
  phase: Phase;
  secondsLeft: number;
  pomoCount: number;
  running: boolean;
  startedAt: number | null; // timestamp when started
}

function loadState(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: TimerState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<Phase, string> = {
  focus: "Focus",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

const PHASE_COLOR: Record<Phase, string> = {
  focus: "text-rose-500",
  "short-break": "text-emerald-500",
  "long-break": "text-sky-500",
};

// shared audio context — created lazily, resumed on user gesture
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch {
    return null;
  }
}

function playBeep() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ignore
  }
}

function playChime() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    // ignore
  }
}

export function PomodoroTimer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtRef = useRef<number | null>(null);

  const restored = loadState();

  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [focusMin, setFocusMin] = useState(restored?.focusMin ?? 25);
  const [breakMin, setBreakMin] = useState(restored?.breakMin ?? 5);
  const [phase, setPhase] = useState<Phase>(restored?.phase ?? "focus");
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (restored?.running && restored?.startedAt) {
      const elapsed = Math.floor((Date.now() - restored.startedAt) / 1000);
      const remaining = Math.max(0, (restored.secondsLeft || 25 * 60) - elapsed);
      endAtRef.current = Date.now() + remaining * 1000;
      return remaining;
    }
    return restored?.secondsLeft ?? 25 * 60;
  });
  const [running, setRunning] = useState(restored?.running ?? false);
  const [pomoCount, setPomoCount] = useState(restored?.pomoCount ?? 0);
  const [notified, setNotified] = useState(false);
  const [linkedNoteId, setLinkedNoteId] = useState<number | null>(null);
  const [linkedNoteTitle, setLinkedNoteTitle] = useState("");

  const notes = useMemo<NoteItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("notes") || "[]");
    } catch {
      return [];
    }
  }, [open]); // refresh when panel opens

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const nextPhase = useCallback(
    (current: Phase): Phase => {
      if (current === "focus") {
        const next = pomoCount + 1;
        return next % 4 === 0 ? "long-break" : "short-break";
      }
      return "focus";
    },
    [pomoCount],
  );

  const startPhase = useCallback(
    (p: Phase, count: number) => {
      setPhase(p);
      setPomoCount(count);
      const dur = p === "focus" ? focusMin * 60 : p === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60;
      setSecondsLeft(dur);
      setNotified(false);
    },
    [focusMin, breakMin],
  );

  const notify = useCallback(
    (phaseLabel: string) => {
      if (sound) {
        phaseLabel === "Focus" ? playChime() : playBeep();
      }
      if (Notification.permission === "granted") {
        new Notification("Pomodoro", {
          body: `${phaseLabel} finished!`,
          icon: "/Notes/favicon.svg",
        });
      }
      setNotified(true);
    },
    [sound],
  );

  const start = useCallback(() => {
    getAudioCtx(); // resume audio context on user gesture
    setNotified(false);
    setRunning(true);
    const endAt = Date.now() + secondsLeft * 1000;
    endAtRef.current = endAt;
    saveState({
      focusMin,
      breakMin,
      phase,
      secondsLeft,
      pomoCount,
      running: true,
      startedAt: Date.now(),
    });
  }, [focusMin, breakMin, phase, secondsLeft, pomoCount]);

  const pause = useCallback(() => {
    clearTimer();
    setRunning(false);
    clearState();
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setRunning(false);
    setNotified(false);
    clearState();
    startPhase("focus", 0);
  }, [clearTimer, startPhase]);

  const changeFocus = useCallback(
    (m: number) => {
      clearTimer();
      setFocusMin(m);
      setRunning(false);
      setPhase("focus");
      setPomoCount(0);
      setSecondsLeft(m * 60);
      setNotified(false);
      clearState();
    },
    [clearTimer],
  );

  const changeBreak = useCallback(
    (m: number) => {
      clearTimer();
      setBreakMin(m);
      clearState();
    },
    [clearTimer],
  );

  // tick — uses wall-clock time so background tabs don't lag
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((endAtRef.current ?? 0) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setRunning(false);
        clearState();
        const label = PHASE_LABEL[phase];
        setTimeout(() => notify(label), 50);
      }
    }, 250); // faster tick for smooth display
    return clearTimer;
  }, [running, phase, notify, clearTimer]);

  // update tab title
  useEffect(() => {
    if (running) {
      document.title = `${formatTime(secondsLeft)} · NoteApp`;
    } else {
      document.title = "NoteApp";
    }
    return () => {
      document.title = "NoteApp";
    };
  }, [running, secondsLeft]);

  // request notification permission on first start
  const requestNotification = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const advance = useCallback(() => {
    if (phase === "focus") {
      logSession(focusMin, true, linkedNoteId ?? undefined, linkedNoteTitle || undefined);
      const newCount = pomoCount + 1;
      startPhase(nextPhase(phase), newCount);
    } else {
      startPhase("focus", pomoCount);
    }
    setRunning(true);
    const dur = phase === "focus"
      ? (nextPhase(phase) === "long-break" ? LONG_BREAK_MIN * 60 : breakMin * 60)
      : focusMin * 60;
    endAtRef.current = Date.now() + dur * 1000;
    saveState({
      focusMin,
      breakMin,
      phase: phase === "focus" ? nextPhase(phase) : "focus",
      secondsLeft: dur,
      pomoCount: phase === "focus" ? pomoCount + 1 : pomoCount,
      running: true,
      startedAt: Date.now(),
    });
  }, [phase, pomoCount, focusMin, breakMin, nextPhase, startPhase]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen((o) => !o);
          requestNotification();
        }}
        className={`h-8 w-8 rounded-full relative ${
          running ? "text-primary" : "text-muted-foreground"
        } hover:text-foreground`}
        title="Pomodoro"
      >
        <Timer className="h-[18px] w-[18px]" />
        {running && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Pomodoro</span>
              <button
                onClick={() => setSound((s) => !s)}
                className="text-muted-foreground hover:text-foreground"
                title={sound ? "Mute" : "Unmute"}
              >
                {sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              </button>
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

          {/* Phase label */}
          <p className={`mb-1 text-center text-xs font-semibold uppercase tracking-wider ${PHASE_COLOR[phase]}`}>
            {PHASE_LABEL[phase]}
            {pomoCount > 0 && phase === "focus" && ` #${pomoCount + 1}`}
          </p>

          {/* Timer */}
          <div
            className={`mb-3 text-center text-4xl font-mono font-bold tabular-nums tracking-wider ${
              notified ? "animate-pulse" : "text-foreground"
            }`}
          >
            {formatTime(secondsLeft)}
          </div>

          {/* Controls */}
          <div className="mb-4 flex items-center justify-center gap-2">
            {notified ? (
              <Button size="sm" onClick={advance} className="h-8 gap-1.5">
                <Play className="h-3.5 w-3.5" />
                {phase === "focus" ? "Start break" : "Start focus"}
              </Button>
            ) : running ? (
              <Button size="sm" variant="outline" onClick={pause} className="h-8 gap-1.5">
                <Pause className="h-3.5 w-3.5" />
                Pause
              </Button>
            ) : (
              <Button size="sm" onClick={start} disabled={secondsLeft === 0} className="h-8 gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Start
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={reset} className="h-8 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Pomo dots */}
          <div className="mb-3 flex items-center justify-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all ${
                  i < pomoCount % 4
                    ? "bg-primary"
                    : pomoCount >= 4 && i === 0
                      ? "bg-primary/40"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Settings */}
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Focus</p>
          <div className="mb-3 flex gap-1.5">
            {FOCUS_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => changeFocus(m)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                  focusMin === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Short break</p>
          <div className="flex gap-1.5">
            {BREAK_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => changeBreak(m)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                  breakMin === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Long break: {LONG_BREAK_MIN}m (every 4th)
          </p>

          {/* Link to note */}
          {notes.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                {linkedNoteId ? "Tracking" : "Track for note"}
              </p>
              <div className="flex flex-wrap gap-1">
                {notes.slice(0, 5).map((n) => {
                  const active = n.id === linkedNoteId;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setLinkedNoteId(null);
                          setLinkedNoteTitle("");
                        } else {
                          setLinkedNoteId(n.id);
                          setLinkedNoteTitle(n.text.slice(0, 40));
                        }
                      }}
                      className={`max-w-[130px] truncate rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                        active
                          ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {n.text.slice(0, 20)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
