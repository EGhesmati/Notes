import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarDays, Sparkles, TrendingUp, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePomodoroStats } from "@/hooks/use-pomodoro-stats";

export default function PomodoroStats() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [open, setOpen] = useState(false);

  // complete dataset (local + server-synced), kept reactive by the shared hook
  const { stats: allStats } = usePomodoroStats(userId);

  const totals = useMemo(() => {
    const all = allStats;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const yearMs = 365 * dayMs;
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
  }, [allStats]);

  const bars = [
    {
      label: "Daily",
      value: totals.dayMinutes,
      target: 240,
      color: "from-violet-500 to-fuchsia-500",
      sessions: totals.todayCompleted,
    },
    {
      label: "Weekly",
      value: totals.weekMinutes,
      target: 1680,
      color: "from-emerald-500 to-teal-500",
      sessions: totals.weekCompleted,
    },
    {
      label: "Yearly",
      value: totals.yearMinutes,
      target: 87600,
      color: "from-sky-500 to-blue-500",
      sessions: totals.yearCompleted,
    },
  ];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 w-8 rounded-full transition-all ${
          open
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        }`}
        title="Pomodoro stats"
      >
        <BarChart3 className="h-[18px] w-[18px]" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,_calc(100vw-2rem))] max-h-[calc(100vh-4rem)] origin-top-right overflow-y-auto rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:w-96">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pomodoro analytics</p>
                <p className="text-sm font-medium text-foreground">Your focus performance</p>
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

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Today</p>
              <p className="text-base font-semibold">{totals.todayCompleted}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Week</p>
              <p className="text-base font-semibold">{totals.weekCompleted}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">Year</p>
              <p className="text-base font-semibold">{totals.yearCompleted}</p>
            </div>
          </div>

          <div className="space-y-3">
            {bars.map((bar) => {
              const pct = Math.min(100, (bar.value / bar.target) * 100);
              return (
                <div key={bar.label} className="rounded-xl border border-border/60 bg-background/60 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{bar.label} focus</span>
                    </div>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {bar.sessions} sessions
                    </Badge>
                  </div>
                  <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted/80">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${bar.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{bar.value} minutes</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-1 rounded-xl border border-border/60 bg-background/70 px-2.5 py-2 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Total progress</span>
            </div>
            <div className="font-medium">
              {totals.totalCompleted} sessions • {totals.totalMinutes} min
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Keep your streak alive. One session now beats perfect plans later.
          </p>
        </div>
      )}
    </div>
  );
}
