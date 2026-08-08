import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

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

  const allStats = useMemo(() => [...serverStats, ...queued], [serverStats, queued]);

  const totals = useMemo(() => {
    const all = allStats;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const yearMs = 365 * dayMs;
    const all = [...serverStats, ...queued];
    const totalCompleted = all.filter((s) => s.phase === "focus").length;
    const totalMinutes = Math.round(all.reduce((acc, s) => acc + s.duration, 0) / 60);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayCompleted = all.filter((s) => s.phase === "focus" && s.ts >= todayMs).length;
    const weekCompleted = all.filter((s) => s.phase === "focus" && s.ts >= now - weekMs).length;
    const yearCompleted = all.filter((s) => s.phase === "focus" && s.ts >= now - yearMs).length;
    const dayMinutes = Math.round(
      all.filter((s) => s.phase === "focus" && s.ts >= now - dayMs).reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    const weekMinutes = Math.round(
      all.filter((s) => s.phase === "focus" && s.ts >= now - weekMs).reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    const yearMinutes = Math.round(
      all.filter((s) => s.phase === "focus" && s.ts >= now - yearMs).reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    return { totalCompleted, totalMinutes, todayCompleted, weekCompleted, yearCompleted, dayMinutes, weekMinutes, yearMinutes };
  }, [allStats, serverStats, queued]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        title="Pomodoro stats"
      >
        <BarChart3 className="h-[18px] w-[18px]" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pomodoro stats</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <Badge variant="secondary" className="justify-center text-xs">
              Day {totals.todayCompleted}
            </Badge>
            <Badge variant="outline" className="justify-center text-xs">
              Week {totals.weekCompleted}
            </Badge>
            <Badge variant="outline" className="justify-center text-xs">
              Year {totals.yearCompleted}
            </Badge>
          </div>

          <div className="space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Daily focus</span>
                <span>{totals.dayMinutes}m</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (totals.dayMinutes / 240) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Weekly focus</span>
                <span>{totals.weekMinutes}m</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${Math.min(100, (totals.weekMinutes / 1680) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Yearly focus</span>
                <span>{totals.yearMinutes}m</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-sky-500/80 transition-all" style={{ width: `${Math.min(100, (totals.yearMinutes / 87600) * 100)}%` }} />
              </div>
            </div>
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground">
            Total: {totals.totalCompleted} completed • {totals.totalMinutes} minutes
          </p>
        </div>
      )}
    </div>
  );
}
