import { useState, useEffect, useCallback } from "react";
import { fetchNotes, fetchTrashedNotes, createNote as apiCreate, updateNote as apiUpdate, deleteNoteApi, restoreNoteApi, deleteNotePermanentApi, reorderNotes } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { NoteItem } from "@/types";

interface RawNote {
  id: number;
  text: string;
  created_at: string;
  color: string;
  priority: string | null;
  due_date: string | null;
  // server returns pinned as a boolean (true/false); coerce with !! when reading
  pinned: boolean | number | null;
  tags?: string[];
  deleted_at?: string | null;
}

function lsKey(userId: number) {
  return `notes-${userId}`;
}

function trashKey(userId: number) {
  return `trashed-${userId}`;
}

function loadLocal(userId: number | null): NoteItem[] {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(lsKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(userId: number | null, notes: NoteItem[]) {
  if (!userId) return;
  localStorage.setItem(lsKey(userId), JSON.stringify(notes));
}

function loadTrash(userId: number | null): NoteItem[] {
  if (!userId) return [];
  try {
    return JSON.parse(localStorage.getItem(trashKey(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveTrash(userId: number | null, notes: NoteItem[]) {
  if (!userId) return;
  localStorage.setItem(trashKey(userId), JSON.stringify(notes));
}

function mapRaw(n: RawNote): NoteItem {
  return {
    id: n.id,
    text: n.text,
    createdAt: n.created_at,
    color: n.color,
    priority: (n.priority as NoteItem["priority"]) || undefined,
    dueDate: n.due_date || undefined,
    pinned: !!n.pinned,
    tags: Array.isArray(n.tags) ? n.tags : [],
    deletedAt: n.deleted_at || undefined,
  };
}

export function useUserNotes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notes, setNotes] = useState<NoteItem[]>(() => loadLocal(userId));
  const [trash, setTrash] = useState<NoteItem[]>(() => loadTrash(userId));
  const [lastUserId, setLastUserId] = useState(userId);
  const [loading, setLoading] = useState(true);

  // clear notes if user changed (e.g. logout → different login)
  useEffect(() => {
    if (userId !== lastUserId) {
      setNotes(loadLocal(userId));
      setTrash(loadTrash(userId));
      setLastUserId(userId);
      setLoading(true);
    }
  }, [userId, lastUserId]);

  const fetchAndApply = useCallback(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchNotes()
      .then((data: RawNote[]) => {
        const mapped = data.map(mapRaw);
        setNotes(mapped);
        saveLocal(userId, mapped);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false); // keep local data on transient failure
      });
    fetchTrashedNotes()
      .then((data: RawNote[]) => {
        const mapped = data.map(mapRaw);
        setTrash(mapped);
        saveTrash(userId, mapped);
      })
      .catch(() => {
        // keep local trash on transient failure
      });
  }, [userId]);

  useEffect(() => {
    fetchAndApply();
  }, [fetchAndApply]);

  // recover from transient network failures: re-fetch when the tab regains focus
  useEffect(() => {
    const onFocus = () => fetchAndApply();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchAndApply]);

  const addNote = useCallback(async (note: { text: string; color: string; priority?: string; dueDate?: string; pinned?: boolean; tags?: string[] }) => {
    try {
      const n = await apiCreate(note);
      const item: NoteItem = {
        id: n.id,
        text: n.text,
        createdAt: n.created_at,
        color: n.color,
        priority: (n.priority as NoteItem["priority"]) || undefined,
        dueDate: n.due_date || undefined,
        pinned: n.pinned === 1,
        tags: Array.isArray(n.tags) ? n.tags : note.tags ?? [],
      };
      setNotes((prev) => {
        const next = [...prev, item];
        saveLocal(userId, next);
        return next;
      });
    } catch {
      // offline: save locally
      const item: NoteItem = {
        id: Date.now(),
        text: note.text,
        createdAt: new Date().toISOString(),
        color: note.color,
        priority: note.priority as NoteItem["priority"],
        dueDate: note.dueDate,
        pinned: note.pinned,
        tags: note.tags ?? [],
      };
      setNotes((prev) => {
        const next = [...prev, item];
        saveLocal(userId, next);
        return next;
      });
    }
  }, [userId]);

  const editNote = useCallback(async (id: number, updates: { text?: string; priority?: string | null; dueDate?: string | null; pinned?: boolean; tags?: string[] }) => {
    try {
      await apiUpdate(id, updates);
    } catch {
      // ignore API error
    }
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              ...updates,
              priority: (updates.priority as NoteItem["priority"]) || undefined,
              dueDate: updates.dueDate ?? undefined,
              tags: updates.tags ?? n.tags,
            }
          : n,
      );
      saveLocal(userId, next);
      return next;
    });
  }, [userId]);

  // Soft-delete: remove from the active list and add to the local trash.
  const deleteNote = useCallback(async (id: number) => {
    try {
      await deleteNoteApi(id);
    } catch {
      // ignore
    }
    setNotes((prev) => {
      const removed = prev.filter((n) => n.id === id);
      const next = prev.filter((n) => n.id !== id);
      saveLocal(userId, next);
      if (removed.length > 0) {
        setTrash((t) => {
          const trashed = [{ ...removed[0], deletedAt: new Date().toISOString() }, ...t.filter((x) => x.id !== id)];
          saveTrash(userId, trashed);
          return trashed;
        });
      }
      return next;
    });
  }, [userId]);

  // Restore a trashed note back to the active list.
  const restoreNote = useCallback(async (id: number) => {
    try {
      await restoreNoteApi(id);
    } catch {
      // ignore
    }
    setTrash((t) => {
      const restores = t.filter((n) => n.id === id);
      const next = t.filter((n) => n.id !== id);
      saveTrash(userId, next);
      if (restores.length > 0) {
        setNotes((prev) => {
          const updated = [{ ...restores[0], deletedAt: undefined }, ...prev];
          saveLocal(userId, updated);
          return updated;
        });
      }
      return next;
    });
  }, [userId]);

  // Permanently delete a trashed note (no restore possible).
  const deleteNotePermanent = useCallback(async (id: number) => {
    try {
      await deleteNotePermanentApi(id);
    } catch {
      // ignore
    }
    setTrash((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveTrash(userId, next);
      return next;
    });
  }, [userId]);

  const reorder = useCallback(
    async (orderedIds: number[]) => {
      // optimistic local reorder for instant UI feedback
      setNotes((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]));
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((n): n is NoteItem => !!n);
        // include any notes not in the list (shouldn't happen in practice)
        const extras = prev.filter((n) => !orderedIds.includes(n.id));
        const finalList = [...next, ...extras];
        void saveLocal(userId, finalList);
        return finalList;
      });
      try {
        await reorderNotes(orderedIds);
      } catch {
        // best-effort; re-fetch on next focus will reconcile
      }
    },
    [userId],
  );

  return { notes, trash, setNotes: addNote, editNote, deleteNote, restoreNote, deleteNotePermanent, reorder, loading } as const;
}
