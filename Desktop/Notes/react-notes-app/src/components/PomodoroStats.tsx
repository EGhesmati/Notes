import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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

function saveStats(userId: number, stats: PomoStat[]) {
  try {
    localStorage.setItem(statsKey(userId), JSON.stringify(stats));
  } catch {}
}

export default function PomodoroStats() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [serverStats, setServerStats] = useState<PomoStat[]>([]);
  const [queued, setQueued] = useState<PomoStat[]>(() => loadStats(userId));

  // load queued local stats
  useEffect(() => {
    setQueued(loadStats(userId));
  }, [userId]);

  // listen for local storage changes to queued stats
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === statsKey(userId)) {
        setQueued(loadStats(userId));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  // fetch server stats when logged in and try to sync queued items
  useEffect(() => {
    let mounted = true;
    async function fetchAndSync() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        // fetch server-side records
        const res = await fetch(`${API_URL}/api/pomodoros`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (mounted) setServerStats(data as PomoStat[]);
        }
      } catch {
        // ignore
      }

      // try to sync queued items
      const q = loadStats(userId);
      if (q.length === 0) return;
      const remaining: PomoStat[] = [];
      for (const item of q) {
        try {
          const r = await fetch(`${API_URL}/api/pomodoros`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ts: item.ts, duration: item.duration, phase: item.phase }),
          });
          if (!r.ok) remaining.push(item);
        } catch {
          remaining.push(item);
        }
      }
      saveStats(userId, remaining);
      setQueued(remaining);
      // refresh server data after sync
      try {
        const res2 = await fetch(`${API_URL}/api/pomodoros`, { headers: { Authorization: `Bearer ${token}` } });
        if (res2.ok) {
          const data2 = await res2.json();
          if (mounted) setServerStats(data2 as PomoStat[]);
        }
      } catch {}
    }
    fetchAndSync();
    return () => { mounted = false; };
  }, [userId]);

  const totals = useMemo(() => {
    const all = [...serverStats, ...queued];
    const totalCompleted = all.filter((s) => s.phase === "focus").length;
    const totalMinutes = Math.round(all.reduce((acc, s) => acc + s.duration, 0) / 60);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayCompleted = all.filter((s) => s.phase === "focus" && s.ts >= todayMs).length;
    return { totalCompleted, totalMinutes, todayCompleted };
  }, [serverStats, queued]);

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
