import { useState, useEffect, useReducer } from "react";
import { Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getStats, loadSessions } from "@/hooks/use-pomodoro-stats";
import type { PomodoroStats } from "@/hooks/use-pomodoro-stats";

const DEFAULT_GOAL = 4;

function goalKey(userId: number) {
  return `daily_focus_goal_${userId}`;
}

function getGoal(userId: number): number {
  try {
    const stored = localStorage.getItem(goalKey(userId));
    return stored ? parseInt(stored, 10) || DEFAULT_GOAL : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
}

function getTodayLocalCount(userId: number): number {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return loadSessions(userId).filter((s) =>
    `${s.date.slice(0, 4)}-${s.date.slice(5, 7)}-${s.date.slice(8, 10)}` === todayKey
  ).length;
}

export function DailyGoal() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  // Goal is derived from localStorage on every render so it stays in sync
  // with the stored value when the user changes (sign-in / sign-out).
  const goal = getGoal(userId);
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  const [completed, setCompleted] = useState(() => getTodayLocalCount(userId));

  // Fetch today's session count from the server (authenticated) or localStorage
  // (guest / offline), then poll for cross-device sync.
  useEffect(() => {
    let cancelled = false;
    const handler = async () => {
      try {
        const stats: PomodoroStats = await getStats(userId);
        if (!cancelled) setCompleted(stats.today.sessions);
      } catch {
        if (!cancelled) setCompleted(getTodayLocalCount(userId));
      }
    };
    handler();
    // Poll every 30s so another device's completed Pomodoro shows up
    const interval = setInterval(handler, 30000);
    // Refresh on local events and when the window regains focus
    window.addEventListener("pomodoro-updated", handler);
    window.addEventListener("focus", handler);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("pomodoro-updated", handler);
      window.removeEventListener("focus", handler);
    };
  }, [userId]);

  const percent = Math.min(100, Math.round((completed / goal) * 100));
  const done = completed >= goal;

  const setNewGoal = (g: number) => {
    localStorage.setItem(goalKey(userId), String(g));
    forceRender();
  };

  return (
    <div className="flex items-center gap-2">
      <Target className={`h-3.5 w-3.5 ${done ? "text-emerald-500" : "text-muted-foreground"}`} />
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? "bg-emerald-500" : "bg-primary"}`}
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
        {completed}/{goal}
      </span>
      {/* goal presets */}
      <div className="flex gap-0.5">
        {[2, 4, 6, 8].map((g) => (
          <button
            key={g}
            onClick={() => setNewGoal(g)}
            className={`rounded px-1 text-[9px] font-medium transition-all ${
              goal === g
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
