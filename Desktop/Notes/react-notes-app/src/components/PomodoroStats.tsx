import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarDays, CheckCircle2, Flame, Sparkles, TrendingUp, Trophy, X, Clock, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePomodoroStats } from "@/hooks/use-pomodoro-stats";
import type { PomoStat } from "@/hooks/use-pomodoro-stats";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Calculate current focus streak (consecutive days with ≥1 session). */
function calculateStreak(stats: PomoStat[]): number {
  const focusStats = stats.filter((s) => s.phase === "focus");
  if (focusStats.length === 0) return 0;

  // Get unique dates (YYYY-MM-DD) that have focus sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeDays = new Set<string>();

  for (const s of focusStats) {
    const date = new Date(s.ts);
    date.setHours(0, 0, 0, 0);
    activeDays.add(date.toISOString().slice(0, 10));
  }

  let streak = 0;
  const checkDate = new Date(today);

  // Check if today has activity; if not, start from yesterday
  const todayStr = checkDate.toISOString().slice(0, 10);
  if (!activeDays.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days backward
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (activeDays.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/** Get last 7 days focus data for trend visualization. */
function getWeeklyTrend(stats: PomoStat[]): Array<{ day: string; minutes: number; sessions: number }> {
  const focusStats = stats.filter((s) => s.phase === "focus");
  const dayMs = 24 * 60 * 60 * 1000;
  const result: Array<{ day: string; minutes: number; sessions: number }> = [];

  for (let i = 6; i >= 0; i--) {
    const startOfDay = new Date();
    startOfDay.setDate(startOfDay.getDate() - i);
    startOfDay.setHours(0, 0, 0, 0);
    const startDate = startOfDay.getTime();
    const endDate = startDate + dayMs;

    const dayStats = focusStats.filter((s) => s.ts >= startDate && s.ts < endDate);
    const dayName = startOfDay.toLocaleDateString("en-US", { weekday: "short" });
    const minutes = Math.round(dayStats.reduce((acc, s) => acc + s.duration, 0) / 60);
    const sessions = dayStats.length;

    result.push({ day: dayName, minutes, sessions });
  }

  return result;
}

/** Get top notes by focus time. */
interface NoteBreakdown {
  noteId: number;
  noteTitle: string;
  minutes: number;
  sessions: number;
  percentage: number;
}

function getTopNotes(stats: PomoStat[], limit: number = 5): NoteBreakdown[] {
  const focusStats = stats.filter((s) => s.phase === "focus" && s.noteId);
  if (focusStats.length === 0) return [];

  const totalTime = focusStats.reduce((acc, s) => acc + s.duration, 0);
  const noteMap = new Map<number, { title: string; minutes: number; sessions: number }>();

  for (const s of focusStats) {
    const existing = noteMap.get(s.noteId!) || { title: `Note #${s.noteId}`, minutes: 0, sessions: 0 };
    noteMap.set(s.noteId!, {
      ...existing,
      minutes: existing.minutes + s.duration,
      sessions: existing.sessions + 1,
    });
  }

  return Array.from(noteMap.entries())
    .sort(([, a], [, b]) => b.minutes - a.minutes)
    .slice(0, limit)
    .map(([noteId, data]) => ({
      noteId,
      noteTitle: data.title,
      minutes: Math.round(data.minutes / 60),
      sessions: data.sessions,
      percentage: Math.round((data.minutes / totalTime) * 100),
    }));
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PomodoroStats() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "notes">("overview");

  const { stats: allStats } = usePomodoroStats(userId);

  const totals = useMemo(() => {
    const all = allStats;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const yearMs = 365 * dayMs;
    const monthMs = 30 * dayMs;
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
    const monthMinutes = Math.round(
      all.filter((s) => s.phase === "focus" && s.ts >= now - monthMs).reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    const yearMinutes = Math.round(
      all.filter((s) => s.phase === "focus" && s.ts >= now - yearMs).reduce((acc, s) => acc + s.duration, 0) / 60,
    );
    return { totalCompleted, totalMinutes, todayCompleted, weekCompleted, yearCompleted, dayMinutes, weekMinutes, monthMinutes, yearMinutes };
  }, [allStats]);

  const streak = useMemo(() => calculateStreak(allStats), [allStats]);
  const weeklyTrend = useMemo(() => getWeeklyTrend(allStats), [allStats]);
  const topNotes = useMemo(() => getTopNotes(allStats, 5), [allStats]);

  const maxWeeklyMinutes = Math.max(...weeklyTrend.map((d) => d.minutes), 1);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "trends" as const, label: "Trends", icon: TrendingUp },
    { id: "notes" as const, label: "Notes", icon: CalendarDays },
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
        <div className="absolute right-0 z-50 mt-2 w-[min(24rem,_calc(100vw-1rem))] max-h-[calc(100vh-4rem)] origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl sm:w-[26rem]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pomodoro Analytics</p>
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

          {/* Tabs */}
          <div className="flex border-b border-border/50 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto sm:max-h-[28rem]">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="p-4 space-y-4">
                {/* Streak Banner */}
                {streak > 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 p-3">
                    <Flame className="h-6 w-6 text-orange-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {streak} Day{streak > 1 ? "s" : ""} Streak!
                      </p>
                      <p className="text-[10px] text-muted-foreground">Keep it going — consistency is key</p>
                    </div>
                    <Trophy className="h-5 w-5 text-yellow-500 shrink-0" />
                  </div>
                )}

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-[10px] text-muted-foreground">Today</p>
                    <p className="text-lg font-bold">{totals.todayCompleted}</p>
                    <p className="text-[10px] text-muted-foreground">sessions</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <p className="text-[10px] text-muted-foreground">Today</p>
                    <p className="text-lg font-bold">{totals.dayMinutes}m</p>
                    <p className="text-[10px] text-muted-foreground">focus time</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                    <CalendarDays className="h-4 w-4 mx-auto mb-1 text-violet-500" />
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                    <p className="text-lg font-bold">{totals.weekCompleted}</p>
                    <p className="text-[10px] text-muted-foreground">sessions</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-center">
                    <Target className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                    <p className="text-lg font-bold">{totals.weekMinutes}m</p>
                    <p className="text-[10px] text-muted-foreground">focus time</p>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-3">
                  {[
                    { label: "Daily Goal", value: totals.dayMinutes, target: 240, color: "from-violet-500 to-fuchsia-500" },
                    { label: "Weekly Goal", value: totals.weekMinutes, target: 1680, color: "from-emerald-500 to-teal-500" },
                    { label: "Monthly Goal", value: totals.monthMinutes, target: 7200, color: "from-indigo-500 to-violet-500" },
                    { label: "Yearly Goal", value: totals.yearMinutes, target: 87600, color: "from-sky-500 to-blue-500" },
                  ].map((bar) => {
                    const pct = Math.min(100, (bar.value / bar.target) * 100);
                    return (
                      <div key={bar.label} className="rounded-xl border border-border/60 bg-background/60 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium">{bar.label}</span>
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {Math.round(pct)}%
                          </Badge>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${bar.color} transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{bar.value} min</span>
                          <span>of {bar.target} min</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total Summary */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">All-time</span>
                  </div>
                  <div className="text-xs font-semibold">
                    {totals.totalCompleted} sessions • {totals.totalMinutes} min
                  </div>
                </div>
              </div>
            )}

            {/* Trends Tab */}
            {activeTab === "trends" && (
              <div className="p-4 space-y-4">
                {/* Weekly Chart */}
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Last 7 Days
                  </h3>
                  <div className="flex items-end justify-between gap-2 h-32">
                    {weeklyTrend.map((day, idx) => {
                      const height = maxWeeklyMinutes > 0 ? (day.minutes / maxWeeklyMinutes) * 100 : 0;
                      const isToday = idx === 6;
                      return (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground">{day.minutes}m</span>
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                isToday
                                  ? "bg-gradient-to-t from-primary to-primary/60"
                                  : "bg-muted/60 hover:bg-muted/80"
                              }`}
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                            {day.day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily Breakdown */}
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Session Count
                  </h3>
                  <div className="space-y-2">
                    {[...weeklyTrend].reverse().map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{day.day}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/80">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-all duration-500"
                              style={{ width: `${maxWeeklyMinutes > 0 ? (day.sessions / Math.max(...weeklyTrend.map((d) => d.sessions), 1)) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-medium">{day.sessions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {streak > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 p-3">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                        Current Streak: {streak} day{streak > 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {streak >= 7 ? "🔥 You're on fire! Keep it up!" : streak >= 3 ? "Great job! Almost at a week!" : "Start your streak today!"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div className="p-4 space-y-3">
                {topNotes.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Top Focus Notes
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {topNotes.length} notes
                      </Badge>
                    </div>
                    {topNotes.map((note, idx) => (
                      <div
                        key={note.noteId}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3 hover:border-primary/30 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          idx === 0 ? "bg-yellow-500/20 text-yellow-600" :
                          idx === 1 ? "bg-gray-400/20 text-gray-600" :
                          idx === 2 ? "bg-orange-600/20 text-orange-600" :
                          "bg-muted/50 text-muted-foreground"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{note.noteTitle}</p>
                          <p className="text-[10px] text-muted-foreground">{note.sessions} sessions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{note.minutes}m</p>
                          <p className="text-[10px] text-muted-foreground">{note.percentage}%</p>
                        </div>
                      </div>
                    ))}

                    {/* Distribution Bar */}
                    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Time Distribution
                      </h4>
                      <div className="flex h-3 w-full overflow-hidden rounded-full">
                        {topNotes.map((note, idx) => (
                          <div
                            key={note.noteId}
                            className="transition-all duration-500"
                            style={{
                              width: `${note.percentage}%`,
                              backgroundColor: [
                                "#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"
                              ][idx % 5],
                            }}
                            title={`${note.noteTitle}: ${note.percentage}%`}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {topNotes.map((note, idx) => (
                          <div key={note.noteId} className="flex items-center gap-1 text-[10px]">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: [
                                  "#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"
                                ][idx % 5],
                              }}
                            />
                            <span className="text-muted-foreground truncate max-w-[80px]">{note.noteTitle}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">No notes tracked yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Complete pomodoros with notes to see insights</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
