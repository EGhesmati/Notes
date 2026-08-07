import { useState, useEffect } from "react";
import { Target } from "lucide-react";

const GOAL_KEY = "daily_focus_goal";
const DEFAULT_GOAL = 4;

function getTodaySessions(): number {
  try {
    const raw = localStorage.getItem("pomodoro_sessions");
    if (!raw) return 0;
    const sessions: { date: string }[] = JSON.parse(raw);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return sessions.filter((s) => {
      const d = new Date(s.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === todayKey;
    }).length;
  } catch {
    return 0;
  }
}

function getGoal(): number {
  try {
    const stored = localStorage.getItem(GOAL_KEY);
    return stored ? parseInt(stored, 10) || DEFAULT_GOAL : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
}

export function DailyGoal() {
  const [goal, setGoal] = useState(getGoal);
  const [completed, setCompleted] = useState(getTodaySessions);

  // listen for pomodoro session updates
  useEffect(() => {
    const handler = () => setCompleted(getTodaySessions());
    window.addEventListener("pomodoro-updated", handler);
    return () => window.removeEventListener("pomodoro-updated", handler);
  }, []);

  const percent = Math.min(100, Math.round((completed / goal) * 100));
  const done = completed >= goal;

  const setNewGoal = (g: number) => {
    setGoal(g);
    localStorage.setItem(GOAL_KEY, String(g));
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
