import { useState, useEffect, useCallback } from "react";
import { fetchNotes, createNote as apiCreate, updateNote as apiUpdate, deleteNoteApi } from "@/lib/api";
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

const LS_KEY = "notes";

function loadLocal(): NoteItem[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(notes: NoteItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(notes));
}

export function useUserNotes() {
  const [notes, setNotes] = useState<NoteItem[]>(loadLocal);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        saveLocal(mapped);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false); // keep local data
      });
  }, []);

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
        saveLocal(next);
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
        saveLocal(next);
        return next;
      });
    }
  }, []);

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
      saveLocal(next);
      return next;
    });
  }, []);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await deleteNoteApi(id);
    } catch {
      // ignore
    }
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveLocal(next);
      return next;
    });
  }, []);

  return { notes, setNotes: addNote, editNote, deleteNote, loading } as const;
}
