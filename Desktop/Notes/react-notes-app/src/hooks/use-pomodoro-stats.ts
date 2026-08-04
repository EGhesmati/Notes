interface PomodoroSession {
  date: string;   // ISO string
  duration: number; // minutes
  completed: boolean;
}

const STORAGE_KEY = "pomodoro_sessions";

function loadSessions(): PomodoroSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: PomodoroSession[]) {
  // keep last 90 days
  const cutoff = Date.now() - 90 * 86400000;
  const filtered = sessions.filter((s) => new Date(s.date).getTime() > cutoff);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function logSession(durationMin: number, completed: boolean) {
  const sessions = loadSessions();
  sessions.push({
    date: new Date().toISOString(),
    duration: durationMin,
    completed,
  });
  saveSessions(sessions);
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export interface PomodoroStats {
  today: { sessions: number; focusMin: number };
  week: { sessions: number; focusMin: number; streak: number };
  month: { sessions: number; focusMin: number; bestDay: { day: string; sessions: number } | null };
  dailyChart: { label: string; sessions: number; focusMin: number }[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
}

export function getStats(): PomodoroStats {
  const sessions = loadSessions();
  const now = new Date();
  const todayKey = getDayKey(now);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // today
  const todaySessions = sessions.filter((s) => getDayKey(new Date(s.date)) === todayKey);
  const todayFocus = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  // week
  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekStart);
  const weekFocus = weekSessions.reduce((sum, s) => sum + s.duration, 0);

  // month
  const monthSessions = sessions.filter((s) => new Date(s.date) >= monthStart);
  const monthFocus = monthSessions.reduce((sum, s) => sum + s.duration, 0);

  // best day (this month)
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

  // daily chart (last 7 days)
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

  // streaks
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
      if (diff === 1) {
        run++;
      } else {
        longestStreak = Math.max(longestStreak, run);
        run = 1;
      }
    } else {
      run = 1;
    }
    prev = curr;
  }
  longestStreak = Math.max(longestStreak, run);

  // completion rate
  const total = sessions.length;
  const completed = sessions.filter((s) => s.completed).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

  return {
    today: { sessions: todaySessions.length, focusMin: todayFocus },
    week: { sessions: weekSessions.length, focusMin: weekFocus, streak: currentStreak },
    month: { sessions: monthSessions.length, focusMin: monthFocus, bestDay },
    dailyChart,
    currentStreak,
    longestStreak,
    completionRate,
  };
}
