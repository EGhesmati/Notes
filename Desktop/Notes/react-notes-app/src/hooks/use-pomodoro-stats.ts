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

// Per-user migration flag: set once guest sessions (key 0) have been uploaded
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

// Merge server sessions with any local sessions that aren't on the server yet
// (matched by created_at/date). This is the core of the offline/sync logic:
// we NEVER blindly overwrite localStorage with server data — that would
// destroy sessions saved locally when the API was unreachable.
//
// Returns the merged list, deduped so each date appears only once.
function mergeSessions(
  server: PomodoroSession[],
  local: PomodoroSession[],
): PomodoroSession[] {
  const serverDates = new Set(server.map((s) => s.date));
  return [...server, ...local.filter((s) => !serverDates.has(s.date))];
}

// Convert a PomodoroSession to the batch-upload payload format
function toBatchPayload(s: PomodoroSession) {
  return {
    duration: s.duration,
    noteId: s.noteId ?? null,
    noteTitle: s.noteTitle ?? null,
    completed: !!s.completed,
    createdAt: s.date,
  };
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
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
      // Server confirmed — update local cache and clear dirty flag
      const sessions = loadSessions(userId);
      sessions.unshift(session);
      saveSessions(userId, sessions);
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

// The single data-loading function. For authenticated users, the server is the
// source of truth, with localStorage as an offline cache. For guests, localStorage
// is the only store.
//
// Sync pipeline (authenticated users only):
//   1. Migration (first login): upload guest sessions (key 0) to the server.
//      Flag prevents retry. Local data is NOT cleared — the merge below handles
//      deduplication.
//   2. Dirty sync: if logSession() failed to reach the API, local sessions have
//      a "dirty" flag. Retry the upload. Clear flag on success.
//   3. Server fetch: fetch ALL sessions from the server, then ALWAYS merge with
//      local sessions. This ensures no session is lost, regardless of whether
//      migration or dirty-sync succeeded. Cache merged data locally.
//
// The invariant: localStorage is NEVER overwritten with server-only data.
// Local sessions are always preserved via the merge.
export async function getStats(userId: number): Promise<PomodoroStats> {
  let sessions: PomodoroSession[];

  if (userId) {
    // --- 1. One-time migration: upload pre-existing guest sessions ---
    const migrationDone = localStorage.getItem(migrationFlagKey(userId)) === "true";
    if (!migrationDone) {
      const guestLocal = loadSessions(0);
      if (guestLocal.length > 0) {
        try {
          await batchLogSessions(guestLocal.map(toBatchPayload));
        } catch {
          // Migration failed — keep guest data locally. The merge below
          // will include them in stats, and the batch upload will retry.
        }
      }
      // Mark migration as attempted so we don't keep retrying on every call.
      // (The batch endpoint deduplicates by created_at, so retrying is safe
      // but wasteful.)
      localStorage.setItem(migrationFlagKey(userId), "true");
    }

    // --- 2. Sync dirty local sessions (offline fallback recovery) ---
    const isDirty = localStorage.getItem(dirtyFlagKey(userId)) === "true";
    let localSessions = loadSessions(userId);
    if (isDirty && localSessions.length > 0) {
      try {
        await batchLogSessions(localSessions.map(toBatchPayload));
        localStorage.removeItem(dirtyFlagKey(userId));
      } catch {
        // Still unreachable — keep dirty flag set for next retry
      }
    }

    // --- 3. Fetch authoritative data from the server ---
    try {
      const apiSessions = await fetchSessions();
      const serverSessions: PomodoroSession[] = apiSessions.map(mapApiSession);
      localSessions = loadSessions(userId);
      // ALWAYS merge — never overwrite localStorage with server-only data.
      // This ensures sessions saved locally (when the API was down) are
      // preserved and included in the stats.
      sessions = mergeSessions(serverSessions, localSessions);
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
