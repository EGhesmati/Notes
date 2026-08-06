import { useState, useEffect, useCallback } from "react";
import { fetchNotes, createNote as apiCreate, updateNote as apiUpdate, deleteNoteApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { NoteItem } from "@/types";

interface RawNote {
  id: number;
  text: string;
  created_at: string;
  color: string;
  priority: string | null;
  due_date: string | null;
  pinned: number;
}

function lsKey(userId: number) {
  return `notes-${userId}`;
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

export function useUserNotes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notes, setNotes] = useState<NoteItem[]>(() => loadLocal(userId));
  const [lastUserId, setLastUserId] = useState(userId);
  const [loading, setLoading] = useState(true);

  // clear notes if user changed (e.g. logout → different login)
  useEffect(() => {
    if (userId !== lastUserId) {
      setNotes(loadLocal(userId));
      setLastUserId(userId);
      setLoading(true);
    }
  }, [userId, lastUserId]);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchNotes()
      .then((data: RawNote[]) => {
        const mapped = data.map((n: RawNote) => ({
          id: n.id,
          text: n.text,
          createdAt: n.created_at,
          color: n.color,
          priority: (n.priority as NoteItem["priority"]) || undefined,
          dueDate: n.due_date || undefined,
          pinned: n.pinned === 1,
        }));
        setNotes(mapped);
        saveLocal(userId, mapped);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false); // keep local data
      });
  }, [userId]);

  const addNote = useCallback(async (note: { text: string; color: string; priority?: string; dueDate?: string; pinned?: boolean }) => {
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
      };
      setNotes((prev) => {
        const next = [...prev, item];
        saveLocal(userId, next);
        return next;
      });
    }
  }, [userId]);

  const editNote = useCallback(async (id: number, updates: { text?: string; priority?: string | null; dueDate?: string | null; pinned?: boolean }) => {
    try {
      await apiUpdate(id, updates);
    } catch {
      // ignore API error
    }
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === id ? { ...n, ...updates, priority: (updates.priority as NoteItem["priority"]) || undefined, dueDate: updates.dueDate ?? undefined } : n,
      );
      saveLocal(userId, next);
      return next;
    });
  }, [userId]);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await deleteNoteApi(id);
    } catch {
      // ignore
    }
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveLocal(userId, next);
      return next;
    });
  }, [userId]);

  return { notes, setNotes: addNote, editNote, deleteNote, loading } as const;
}
