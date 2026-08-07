import { fetchSessions, logSessionApi } from "@/lib/api";

interface PomodoroSession {
  date: string;
  duration: number;
  completed: boolean;
  noteId?: number;
  noteTitle?: string;
}

function sessionsKey(userId: number) {
  return `pomodoro_sessions_${userId}`;
}

function loadSessions(userId: number): PomodoroSession[] {
  try {
    const raw = localStorage.getItem(sessionsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(userId: number, sessions: PomodoroSession[]) {
  const cutoff = Date.now() - 90 * 86400000;
  const filtered = sessions.filter((s) => new Date(s.date).getTime() > cutoff);
  localStorage.setItem(sessionsKey(userId), JSON.stringify(filtered));
}

export async function logSession(
  userId: number,
  durationMin: number,
  completed: boolean,
  noteId?: number,
  noteTitle?: string,
) {
  try {
    await logSessionApi(durationMin, noteId, noteTitle);
  } catch {
    // ignore API errors
  }
  // always save locally too
  const sessions = loadSessions(userId);
  sessions.push({
    date: new Date().toISOString(),
    duration: durationMin,
    completed,
    noteId,
    noteTitle,
  });
  saveSessions(userId, sessions);
  // notify other components (e.g. DailyGoal) to refresh
  window.dispatchEvent(new CustomEvent("pomodoro-updated"));
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export interface NoteBreakdown {
  noteId: number;
  noteTitle: string;
  focusMin: number;
  sessions: number;
}

export interface PomodoroStats {
  today: { sessions: number; focusMin: number };
  week: { sessions: number; focusMin: number; streak: number };
  month: { sessions: number; focusMin: number; bestDay: { day: string; sessions: number } | null };
  dailyChart: { label: string; sessions: number; focusMin: number }[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  noteBreakdown: NoteBreakdown[];
}

export async function getStats(userId: number): Promise<PomodoroStats> {
  // Try API first
  let sessions = loadSessions(userId);
  try {
    const apiSessions = await fetchSessions();
    if (apiSessions.length > 0) {
      // Replace local with API data (more reliable)
      sessions = apiSessions.map((s: any) => ({
        date: s.created_at,
        duration: s.duration,
        completed: true,
        noteId: s.note_id ?? undefined,
        noteTitle: s.note_title ?? undefined,
      }));
      saveSessions(userId, sessions); // sync local
    }
  } catch {
    // API unavailable, use localStorage
  }
  const now = new Date();
  const todayKey = getDayKey(now);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todaySessions = sessions.filter((s) => getDayKey(new Date(s.date)) === todayKey);
  const todayFocus = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekStart);
  const weekFocus = weekSessions.reduce((sum, s) => sum + s.duration, 0);

  const monthSessions = sessions.filter((s) => new Date(s.date) >= monthStart);
  const monthFocus = monthSessions.reduce((sum, s) => sum + s.duration, 0);

  const byDay = new Map<string, number>();
  monthSessions.forEach((s) => {
    const key = getDayKey(new Date(s.date));
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });
  let bestDay: PomodoroStats["month"]["bestDay"] = null;
  byDay.forEach((count, key) => {
    if (!bestDay || count > bestDay.sessions) {
      const d = new Date(key + "T00:00:00");
      bestDay = { day: d.toLocaleDateString(undefined, { weekday: "long" }), sessions: count };
    }
  });

  const dailyChart: PomodoroStats["dailyChart"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = getDayKey(d);
    const daySessions = sessions.filter((s) => getDayKey(new Date(s.date)) === key);
    dailyChart.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      sessions: daySessions.length,
      focusMin: daySessions.reduce((sum, s) => sum + s.duration, 0),
    });
  }

  const completedDays = new Set<string>();
  sessions.filter((s) => s.completed).forEach((s) => completedDays.add(getDayKey(new Date(s.date))));

  let currentStreak = 0;
  const check = new Date(now);
  while (completedDays.has(getDayKey(check))) {
    currentStreak++;
    check.setDate(check.getDate() - 1);
  }

  let longestStreak = 0;
  const allDates = [...completedDays].sort();
  let run = 0;
  let prev: Date | null = null;
  for (const dateStr of allDates) {
    const curr = new Date(dateStr + "T00:00:00");
    if (prev) {
      const diff = (curr.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) run++;
      else { longestStreak = Math.max(longestStreak, run); run = 1; }
    } else {
      run = 1;
    }
    prev = curr;
  }
  longestStreak = Math.max(longestStreak, run);

  const total = sessions.length;
  const completed = sessions.filter((s) => s.completed).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

  const noteMap = new Map<number, NoteBreakdown>();
  sessions.forEach((s) => {
    if (!s.noteId || !s.noteTitle) return;
    const existing = noteMap.get(s.noteId);
    if (existing) {
      existing.focusMin += s.duration;
      existing.sessions += 1;
    } else {
      noteMap.set(s.noteId, {
        noteId: s.noteId,
        noteTitle: s.noteTitle,
        focusMin: s.duration,
        sessions: 1,
      });
    }
  });
  const noteBreakdown = [...noteMap.values()]
    .sort((a, b) => b.focusMin - a.focusMin)
    .slice(0, 10);

  return {
    today: { sessions: todaySessions.length, focusMin: todayFocus },
    week: { sessions: weekSessions.length, focusMin: weekFocus, streak: currentStreak },
    month: { sessions: monthSessions.length, focusMin: monthFocus, bestDay },
    dailyChart,
    currentStreak,
    longestStreak,
    completionRate,
    noteBreakdown,
  };
}
