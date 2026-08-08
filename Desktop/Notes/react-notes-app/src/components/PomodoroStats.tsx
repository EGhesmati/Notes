import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

type Phase = "focus" | "short-break" | "long-break";

interface PomoStat {
  ts: number;
  duration: number; // seconds
  phase: Phase;
}

function statsKey(userId: number) {
  return `pomodoro_stats_${userId}`;
}

function loadStats(userId: number): PomoStat[] {
  try {
    const raw = localStorage.getItem(statsKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as PomoStat[];
  } catch {
    return [];
  }
}

export default function PomodoroStats() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [stats, setStats] = useState<PomoStat[]>(() => loadStats(userId));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === statsKey(userId)) {
        setStats(loadStats(userId));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  // refresh when mounted in case PomodoroTimer updated same-tab (no storage event)
  useEffect(() => {
    setStats(loadStats(userId));
  }, [userId]);

  const totals = useMemo(() => {
    const totalCompleted = stats.filter((s) => s.phase === "focus").length;
    const totalMinutes = Math.round(stats.reduce((acc, s) => acc + s.duration, 0) / 60);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayCompleted = stats.filter((s) => s.phase === "focus" && s.ts >= todayMs).length;
    return { totalCompleted, totalMinutes, todayCompleted };
  }, [stats]);

  return (
    <div className="ml-2 flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        {totals.totalCompleted} pomo{totals.totalCompleted !== 1 && "s"}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {totals.todayCompleted} today
      </Badge>
      <Badge variant="ghost" className="text-xs">
        {totals.totalMinutes} min
      </Badge>
    </div>
  );
}
