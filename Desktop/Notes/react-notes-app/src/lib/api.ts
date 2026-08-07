const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    // send the stored JWT as a Bearer token
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ---- Notes ----

export async function fetchNotes() {
  const res = await fetch(`${API_URL}/api/notes`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch notes");
  return res.json();
}

export async function createNote(note: {
  text: string;
  color: string;
  priority?: string;
  dueDate?: string;
  pinned?: boolean;
}) {
  const res = await fetch(`${API_URL}/api/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error("Failed to create note");
  return res.json();
}

export async function updateNote(
  id: number,
  updates: {
    text?: string;
    priority?: string | null;
    dueDate?: string | null;
    pinned?: boolean;
  },
) {
  const res = await fetch(`${API_URL}/api/notes/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update note");
  return res.json();
}

export async function deleteNoteApi(id: number) {
  const res = await fetch(`${API_URL}/api/notes/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete note");
  return res.json();
}

// ---- Pomodoro Sessions ----

export async function fetchSessions() {
  const res = await fetch(`${API_URL}/api/sessions`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function fetchStats(tzOffset: number) {
  const res = await fetch(`${API_URL}/api/stats?tzOffset=${tzOffset}`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function updateSettings(settings: { pomodoroGoal: number }) {
  const res = await fetch(`${API_URL}/api/settings`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function logSessionApi(
  duration: number,
  noteId?: number,
  noteTitle?: string,
  completed?: boolean,
  createdAt?: string,
) {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ duration, noteId, noteTitle, completed, createdAt }),
  });
  if (!res.ok) throw new Error("Failed to log session");
  return res.json();
}

export async function batchLogSessions(sessions: PomodoroSessionBatch[]) {
  const res = await fetch(`${API_URL}/api/sessions/batch`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ sessions }),
  });
  if (!res.ok) throw new Error("Failed to batch log sessions");
  return res.json();
}

// Shape of a single session in a batch upsert payload
interface PomodoroSessionBatch {
  duration: number;
  noteId?: number | null;
  noteTitle?: string | null;
  completed?: boolean;
  createdAt?: string;
}
