import { useState, useEffect, useCallback, useMemo } from "react";

export type Phase = "focus" | "short-break" | "long-break";

export interface PomoStat {
  ts: number;
  duration: number; // seconds
  phase: Phase;
  noteId?: number | null;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function statsKey(userId: number): string {
  return `pomodoro_stats_${userId}`;
}

export function loadStats(userId: number): PomoStat[] {
  try {
    const raw = localStorage.getItem(statsKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as PomoStat[];
  } catch {
    return [];
  }
}

export function saveStats(userId: number, stats: PomoStat[]): void {
  try {
    localStorage.setItem(statsKey(userId), JSON.stringify(stats));
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key: statsKey(userId), newValue: JSON.stringify(stats) }),
      );
    } catch {
      // dispatch not supported (e.g. some test environments) — local write already done
    }
  } catch {
    // localStorage full or disabled — ignore, stats stay in-memory only
  }
}

// prevents two consumers (App shell + stats popover) from double-POSTing the
// same queued items to Neon at the same time.
let _syncingUserId: number | null = null;

/** Push locally-queued pomodoro stats to the backend (Neon) and drop the ones that succeed. */
export async function syncStats(userId: number): Promise<void> {
  if (_syncingUserId === userId) return;
  _syncingUserId = userId;
  try {
    const token = localStorage.getItem("token");
    if (!token) return; // no auth, can't sync
    const queued = loadStats(userId);
    if (queued.length === 0) return;
    const remaining: PomoStat[] = [];
    for (const item of queued) {
      try {
        const res = await fetch(`${API_URL}/api/pomodoros`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ts: item.ts,
            duration: item.duration,
            phase: item.phase,
            noteId: item.noteId ?? null,
          }),
        });
        if (!res.ok) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    saveStats(userId, remaining);
  } finally {
    _syncingUserId = null;
  }
}

/** Record a single completed pomodoro to local storage and attempt a background sync. */
export function recordCompletion(
  userId: number,
  phase: Phase,
  duration: number,
  noteId?: number | null,
): void {
  if (phase !== "focus") return;
  const stats = loadStats(userId);
  stats.push({ ts: Date.now(), duration, phase, noteId: noteId ?? null });
  saveStats(userId, stats);
  void syncStats(userId);
}

/** Fetch the synced pomodoro records from the server. */
async function fetchServerStats(): Promise<PomoStat[] | null> {
  const token = localStorage.getItem("token");
  if (!token) return null; // not logged in
  try {
    const res = await fetch(`${API_URL}/api/pomodoros`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null; // transient failure — caller keeps previous data
    return (await res.json()) as PomoStat[];
  } catch {
    return null;
  }
}

/**
 * Reactive accessor for the complete pomodoro dataset — locally queued records
 * merged with the server-synced records. Updates live when any same-tab consumer
 * writes to the localStorage queue or the window regains focus.
 */
export function usePomodoroStats(
  userId: number,
): { stats: PomoStat[]; reload: () => void; loaded: boolean } {
  const [local, setLocal] = useState<PomoStat[]>(() => loadStats(userId));
  const [server, setServer] = useState<PomoStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    setLocal(loadStats(userId));
  }, [userId]);

  const refreshServer = useCallback(async () => {
    if (!userId) {
      setServer([]);
      setLoaded(true);
      return;
    }
    try {
      await syncStats(userId); // push local queue → Neon
      const data = await fetchServerStats(); // pull everything back
      if (data) setServer(data); // keep previous server data on transient failure
    } catch {
      // best-effort — keep previous server data, will retry on focus
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  // reactive local queue + background server refresh on every local change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const onStorage = (e: StorageEvent) => {
      if (e.key === statsKey(userId)) {
        reload();
        void refreshServer();
      }
    };
    window.addEventListener("storage", onStorage);
    void refreshServer(); // initial fetch
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, reload, refreshServer]);

  // recover from transient network failures: re-sync + re-fetch when the tab
  // regains focus. This is why a refresh "magically" fixes missing data.
  useEffect(() => {
    const onFocus = () => void refreshServer();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshServer]);

  const stats = useMemo(() => {
    // merge server + local, de-duplicating by timestamp so a record that has
    // been pushed to the server (and dropped from local) is still visible.
    const byTs = new Map<number, PomoStat>();
    for (const s of server) byTs.set(s.ts, s);
    for (const s of local) {
      if (!byTs.has(s.ts)) byTs.set(s.ts, s);
    }
    return [...byTs.values()];
  }, [server, local]);

  return { stats, reload, loaded };
}

/** Total focus seconds spent per note id. */
export function timePerNoteMap(stats: PomoStat[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const s of stats) {
    if (s.phase !== "focus") continue;
    const nid = s.noteId;
    if (!nid) continue;
    map.set(nid, (map.get(nid) ?? 0) + s.duration);
  }
  return map;
}

/** Format a number of seconds into a compact duration string like "25m" / "1h 30m". */
export function formatDuration(seconds: number): string {
  const totalMins = Math.round(seconds / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
