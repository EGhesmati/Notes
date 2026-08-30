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

export async function fetchTrashedNotes() {
  const res = await fetch(`${API_URL}/api/notes/trash`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch trashed notes");
  return res.json();
}

export async function restoreNoteApi(id: number) {
  const res = await fetch(`${API_URL}/api/notes/${id}/restore`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to restore note");
  return res.json();
}

export async function deleteNotePermanentApi(id: number) {
  const res = await fetch(`${API_URL}/api/notes/${id}/permanent`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to permanently delete note");
  return res.json();
}

export async function reorderNotes(order: number[]) {
  const res = await fetch(`${API_URL}/api/notes/reorder`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error("Failed to reorder notes");
  return res.json();
}

// ---- Account / auth profile changes ----

export async function changePassword(currentPasscode: string, newPasscode: string) {
  const res = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ currentPasscode, newPasscode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to change passcode");
  }
  return res.json();
}

export async function changeUsername(newName: string, currentPasscode: string) {
  const res = await fetch(`${API_URL}/api/auth/change-username`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ newName, currentPasscode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to change username");
  }
  return res.json();
}



