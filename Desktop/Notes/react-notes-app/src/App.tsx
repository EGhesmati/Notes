import { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  StickyNote,
  Sun,
  Moon,
  Loader2,
  Heart,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useDebounce } from "@/hooks/use-debounce";
import { useUserNotes } from "@/hooks/use-user-notes";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import PomodoroStats from "@/components/PomodoroStats";
import { TimeChips } from "@/components/TimeChips";
import { useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/pages/LoginPage";
import { NOTE_COLORS, PRIORITY_BADGE } from "@/types";
import type { Priority } from "@/types";

const NotesGrid = lazy(() => import("@/components/NotesGrid"));

function toISO(date: string | undefined, time: string | undefined): string | undefined {
  if (!date) return undefined;
  const t = time || "23:59";
  return new Date(`${date}T${t}:00`).toISOString();
}

export default function App() {
  const { isLoggedIn, signOut } = useAuth();

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  return <AppShell signOut={signOut} />;
}

function AppShell({ signOut }: { signOut: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority | undefined>();
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const { notes, setNotes: addNoteApi, editNote: editNoteApi, deleteNote: deleteNoteApi } = useUserNotes();
  const [search, setSearch] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const id = setTimeout(() => setHydrated(true), 400);
    return () => clearTimeout(id);
  }, []);

  const debouncedSearch = useDebounce(search, 200);

  const addNote = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const color =
      NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    addNoteApi({
      text: trimmed,
      color,
      priority,
      dueDate: toISO(dueDate, dueTime),
    });
    setText("");
    setPriority(undefined);
    setDueDate("");
    setDueTime("");
  }, [text, priority, dueDate, dueTime, addNoteApi]);

  const editNote = useCallback(
    (id: number, newText: string, newPriority?: Priority, newDueDate?: string, newDueTime?: string) => {
      editNoteApi(id, {
        text: newText,
        priority: newPriority || null,
        dueDate: toISO(newDueDate, newDueTime) || null,
      });
    },
    [editNoteApi],
  );

  const deleteNote = useCallback(
    (id: number) => deleteNoteApi(id),
    [deleteNoteApi],
  );

  const togglePin = useCallback(
    (id: number) => {
      const note = notes.find((n) => n.id === id);
      if (note) {
        editNoteApi(id, { pinned: !note.pinned });
      }
    },
    [notes, editNoteApi],
  );

  const filtered = useMemo(() => {
    const matches = debouncedSearch
      ? notes.filter((n) =>
          n.text.toLowerCase().includes(debouncedSearch.toLowerCase()),
        )
      : notes;
    // pinned first, then by date newest first
    return [...matches].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, debouncedSearch]);

  if (!hydrated) return <AppLoadingScreen />;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Navbar — sticky, glassy */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Hello, {user?.name ?? "there"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PomodoroTimer />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-[16px] w-[16px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            <StickyNote className="mr-2 inline-block h-8 w-8 text-primary align-middle" />
            Notes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            write it down, keep it safe
          </p>
        </div>

        {/* Add note */}
        <div className="mb-2 flex gap-3">
          <Input
            placeholder="Write a note..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            className="h-12 border-border bg-card/80 backdrop-blur-xl placeholder:text-muted-foreground/60 focus-visible:ring-ring"
          />
          <Button
            onClick={addNote}
            size="lg"
            className="h-12 px-5 shadow-lg shadow-foreground/10 transition-all hover:shadow-xl hover:shadow-foreground/15 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            Add
          </Button>
        </div>
        <div className="mb-1 ml-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Priority</span>
          {(["low", "medium", "high"] as Priority[]).map((p) => {
            const sel = priority === p;
            const b = PRIORITY_BADGE[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority((prev) => (prev === p ? undefined : p))}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  sel
                    ? `${b.className} ring-2 ring-offset-1 ring-offset-background`
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {b.label}
              </button>
            );
          })}
          <span className="text-[10px] text-muted-foreground/60">|</span>
          <span className="text-[11px] font-medium text-muted-foreground">Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); if (!e.target.value) setDueTime(""); }}
            className="h-7 w-32 rounded-md border border-border bg-card/80 px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {dueDate && <TimeChips value={dueTime} onChange={setDueTime} />}
        </div>
        <p className="mb-5 ml-1 mt-1 text-xs text-muted-foreground">
          {text.length} character{text.length !== 1 && "s"}
        </p>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 border-border bg-card/80 pl-10 backdrop-blur-xl focus-visible:ring-ring"
          />
        </div>

        {/* Stats */}
        <div className="mb-6 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {notes.length} note{notes.length !== 1 && "s"}
          </Badge>
          {debouncedSearch && (
            <Badge variant="outline" className="text-xs">
              {filtered.length} match{filtered.length !== 1 && "es"}
            </Badge>
          )}

          {/* Pomodoro statistics */}
          <PomodoroStats />
        </div>

        {/* Notes grid */}
        {notes.length === 0 && !debouncedSearch ? (
          <p className="py-16 text-center text-sm italic text-muted-foreground">
            No notes yet. Add your first one!
          </p>
        ) : (
          <Suspense
            fallback={
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <NotesGrid
              notes={filtered}
              onDelete={deleteNote}
              onEdit={editNote}
              onTogglePin={togglePin}
            />
          </Suspense>
        )}
      </main>

      {/* Footer — glassy */}
      <footer className="border-t border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 py-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            made with{" "}
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />{" "}
            by ErfanGhesmati
          </p>
        </div>
      </footer>
    </div>
  );
}
