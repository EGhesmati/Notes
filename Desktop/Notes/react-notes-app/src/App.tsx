import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, StickyNote, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useDebounce } from "@/hooks/use-debounce";
import { NotesGridSkeleton } from "@/components/NotesGridSkeleton";
import type { NoteItem, NotesState } from "@/types";

const NotesGrid = lazy(() => import("@/components/NotesGrid"));

function App() {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<NotesState>([]);
  const [search, setSearch] = useState("");
  const { theme, toggle } = useTheme();

  const debouncedSearch = useDebounce(search, 200);

  const addNote = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newNote: NoteItem = {
      id: Date.now(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, newNote]);
    setText("");
  }, [text]);

  const deleteNote = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const filtered = useMemo(
    () =>
      debouncedSearch
        ? notes.filter((n) =>
            n.text.toLowerCase().includes(debouncedSearch.toLowerCase()),
          )
        : notes,
    [notes, debouncedSearch],
  );

  return (
    <div className="relative mx-auto max-w-5xl px-6 py-12 sm:py-16">
      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className="absolute right-6 top-6 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
      >
        {theme === "dark" ? (
          <Sun className="h-[18px] w-[18px]" />
        ) : (
          <Moon className="h-[18px] w-[18px]" />
        )}
      </Button>

      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          <StickyNote className="mr-2 inline-block h-8 w-8 text-primary align-middle" />
          Notes
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          jot something down
        </p>
      </div>

      {/* Add note */}
      <div className="mb-3 flex gap-3">
        <Input
          placeholder="Write a note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          className="h-12 border-border bg-card backdrop-blur-xl placeholder:text-muted-foreground/60 focus-visible:ring-ring"
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
      <p className="mb-5 ml-1 text-xs text-muted-foreground">
        {text.length} character{text.length !== 1 && "s"}
      </p>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 border-border bg-card pl-10 backdrop-blur-xl focus-visible:ring-ring"
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
      </div>

      {/* Notes grid — lazy loaded */}
      {notes.length === 0 && !debouncedSearch ? (
        <p className="py-16 text-center text-sm italic text-muted-foreground">
          No notes yet. Add your first one!
        </p>
      ) : (
        <Suspense fallback={<NotesGridSkeleton />}>
          <NotesGrid notes={filtered} onDelete={deleteNote} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
