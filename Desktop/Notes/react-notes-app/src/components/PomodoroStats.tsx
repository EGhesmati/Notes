import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, X, Flame, Timer, Target, Trophy } from "lucide-react";
import { getStats, type PomodoroStats } from "@/hooks/use-pomodoro-stats";

function formatHours(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const maxBar = 10;

export function PomodoroStatsPanel() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<PomodoroStats | null>(null);

  const refresh = useCallback(() => {
    setStats(getStats());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        title="Statistics"
      >
        <BarChart3 className="h-[18px] w-[18px]" />
      </Button>

      {open && stats && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Statistics</span>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-6 w-6 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Today */}
          <div className="mb-3 rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Target className="h-3 w-3" /> {stats.today.sessions} sessions
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" /> {formatHours(stats.today.focusMin)}
              </span>
            </div>
          </div>

          {/* Week */}
          <div className="mb-3 rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">This Week</p>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Target className="h-3 w-3" /> {stats.week.sessions} sessions
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" /> {formatHours(stats.week.focusMin)}
              </span>
              {stats.week.streak > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Flame className="h-3 w-3" /> {stats.week.streak}d
                </span>
              )}
            </div>
          </div>

          {/* Month */}
          <div className="mb-3 rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">This Month</p>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Target className="h-3 w-3" /> {stats.month.sessions} sessions
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-3 w-3" /> {formatHours(stats.month.focusMin)}
              </span>
            </div>
            {stats.month.bestDay && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                <Trophy className="mr-0.5 inline h-3 w-3 text-amber-500" />
                Best: {stats.month.bestDay.day} ({stats.month.bestDay.sessions})
              </p>
            )}
          </div>

          {/* Chart */}
          <div className="mb-3 rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last 7 Days</p>
            <div className="space-y-1">
              {stats.dailyChart.map((d) => {
                const width = Math.max(1, Math.min(maxBar, d.sessions));
                return (
                  <div key={d.label} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 text-right text-muted-foreground">{d.label}</span>
                    <div className="flex-1 rounded-full bg-muted">
                      <div
                        className="h-3 rounded-full bg-primary/60 transition-all"
                        style={{ width: `${(width / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-left font-mono text-muted-foreground">{d.sessions}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Streaks */}
          {(stats.currentStreak > 0 || stats.longestStreak > 0) && (
            <div className="mb-3 rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Streaks</p>
              <div className="flex items-center gap-3 text-xs">
                {stats.currentStreak > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Flame className="h-3 w-3" /> Current: {stats.currentStreak}d
                  </span>
                )}
                {stats.longestStreak > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Trophy className="h-3 w-3" /> Best: {stats.longestStreak}d
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Completion rate */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completion</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-medium text-muted-foreground">{stats.completionRate}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
