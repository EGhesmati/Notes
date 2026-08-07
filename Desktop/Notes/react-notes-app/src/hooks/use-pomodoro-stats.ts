import { fetchSessions, logSessionApi, batchLogSessions } from "@/lib/api";

interface PomodoroSession {
  date: string;
  duration: number;
  completed: boolean;
  noteId?: number;
  noteTitle?: string;
}

// Shape of rows returned by GET /api/sessions
interface RawSession {
  created_at: string;
  duration: number;
  completed: number;
  note_id: number | null;
  note_title: string | null;
}

export function sessionsKey(userId: number) {
  return `pomodoro_sessions_${userId}`;
}

// Per-user migration flag: prevents re-importing sessions already on the server
function migrationFlagKey(userId: number) {
  return `pomodoro_migrated_${userId}`;
}

// Per-user "dirty" flag: set when a session is saved to localStorage because
// the API was unreachable, so getStats() knows to retry the upload.
function dirtyFlagKey(userId: number) {
  return `pomodoro_dirty_${userId}`;
}

export function loadSessions(userId: number): PomodoroSession[] {
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

// --- Local-only helpers (used for guest mode and offline fallback) ---

export function getTodaySessionCountLocal(userId: number): number {
  return loadSessions(userId).filter((s) => {
    const d = new Date(s.date);
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }).length;
}

// Fetch today's completed-session count from the server (authenticated) or
// localStorage (guest / offline fallback).
//
// This function is intentionally READ-ONLY with respect to localStorage.
// It must NOT call saveSessions() because: when logSession() fails to reach
// the server, it saves the session to localStorage and sets a "dirty" flag so
// that getStats() can retry the upload later. If this function overwrote
// localStorage with server data (which may not yet include the dirty session),
// the dirty session would be permanently lost before getStats() gets a chance
// to sync it — causing statistics to reset to zero.
//
// Local storage caching of server data is handled exclusively by getStats(),
// which runs the dirty-sync step BEFORE the server fetch, preserving any
// pending local sessions.
export async function getTodaySessionCount(userId: number): Promise<number> {
  if (!userId) {
    return getTodaySessionCountLocal(0);
  }
  try {
    const apiSessions = await fetchSessions();
    const now = new Date();
    const todayKey = getDayKey(now);
    return apiSessions.filter(
      (s: RawSession) => getDayKey(new Date(s.created_at)) === todayKey,
    ).length;
  } catch {
    return getTodaySessionCountLocal(userId);
  }
}

export async function logSession(
  userId: number,
  durationMin: number,
  completed: boolean,
  noteId?: number,
  noteTitle?: string,
) {
  // Capture the timestamp once so the client and server agree on the same
  // created_at — this is what the server uses for duplicate detection.
  const createdAt = new Date().toISOString();
  const session: PomodoroSession = {
    date: createdAt,
    duration: durationMin,
    completed,
    noteId,
    noteTitle,
  };

  // If authenticated, try API first. On failure, fall back to localStorage.
  if (userId) {
    try {
      await logSessionApi(durationMin, noteId, noteTitle, completed, createdAt);
      // Update local cache immediately so UI reflects change while backend is authoritative
      const sessions = loadSessions(userId);
      sessions.unshift(session);
      saveSessions(userId, sessions);
      // All local sessions are confirmed on the server — clear the dirty flag
      localStorage.removeItem(dirtyFlagKey(userId));
      window.dispatchEvent(new CustomEvent("pomodoro-updated"));
      return;
    } catch {
      // API failed — fall back to saving locally so user doesn't lose data.
      // Mark as dirty so getStats() will retry the upload next time.
      localStorage.setItem(dirtyFlagKey(userId), "true");
    }
  }

  // Guest or API failed: save locally
  const sessions = loadSessions(userId);
  sessions.unshift(session);
  saveSessions(userId, sessions);
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

// Map raw API session rows to the internal PomodoroSession format.
function mapApiSession(s: RawSession): PomodoroSession {
  return {
    date: s.created_at,
    duration: s.duration,
    completed: !!s.completed,
    noteId: s.note_id ?? undefined,
    noteTitle: s.note_title ?? undefined,
  };
}

export async function getStats(userId: number): Promise<PomodoroStats> {
  let sessions: PomodoroSession[];

  if (userId) {
    // --- 1. One-time migration: upload pre-existing local sessions ---
    // On the first login after the sync fix, any statistics previously stored
    // in localStorage (under either the authenticated key or the guest key 0)
    // are uploaded to the server. The batch endpoint deduplicates by created_at,
    // so re-uploading is safe.
    const migrationDone = localStorage.getItem(migrationFlagKey(userId)) === "true";
    if (!migrationDone) {
      const local = loadSessions(userId);
      const guestLocal = loadSessions(0); // guest-mode sessions
      const allLocal = [...local, ...guestLocal];

      if (allLocal.length > 0) {
        try {
          const payload = allLocal.map((s) => ({
            duration: s.duration,
            noteId: s.noteId ?? null,
            noteTitle: s.noteTitle ?? null,
            completed: !!s.completed,
            createdAt: s.date,
          }));
          await batchLogSessions(payload);
          // Migration succeeded — prevent duplicate imports next time
          localStorage.setItem(migrationFlagKey(userId), "true");
          // Clear migrated local data so the server becomes the single source of truth
          saveSessions(userId, []);
          localStorage.setItem(sessionsKey(0), "[]");
        } catch {
          // Migration failed — keep local data; will retry on the next getStats() call
        }
      } else {
        localStorage.setItem(migrationFlagKey(userId), "true");
      }
    }

    // --- 2. Sync dirty local sessions (offline fallback recovery) ---
    // If logSession() fell back to localStorage because the API was down, those
    // sessions need to be uploaded now. The dirty flag tracks this state.
    const isDirty = localStorage.getItem(dirtyFlagKey(userId)) === "true";
    if (isDirty) {
      const local = loadSessions(userId);
      if (local.length > 0) {
        try {
          const payload = local.map((s) => ({
            duration: s.duration,
            noteId: s.noteId ?? null,
            noteTitle: s.noteTitle ?? null,
            completed: !!s.completed,
            createdAt: s.date,
          }));
          await batchLogSessions(payload);
          localStorage.removeItem(dirtyFlagKey(userId));
        } catch {
          // Still unreachable — fall back to local cache below
        }
      }
    }

    // --- 3. Fetch authoritative data from the server ---
    try {
      const apiSessions = await fetchSessions();
      const serverSessions: PomodoroSession[] = apiSessions.map(mapApiSession);
      // If the dirty sync above failed, local sessions still contain data
      // not yet on the server. Merge to avoid data loss — keep all server
      // sessions plus any local ones that aren't duplicates (by date).
      if (localStorage.getItem(dirtyFlagKey(userId)) === "true") {
        const local = loadSessions(userId);
        const serverDates = new Set(serverSessions.map((s) => s.date));
        sessions = [...serverSessions, ...local.filter((s) => !serverDates.has(s.date))];
      } else {
        sessions = serverSessions;
      }
      // Cache to localStorage for offline use and sibling components
      saveSessions(userId, sessions);
    } catch {
      // Network or server unavailable — fall back to local cache
      sessions = loadSessions(userId);
    }
  } else {
    // Guest mode — local-only
    sessions = loadSessions(userId);
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
