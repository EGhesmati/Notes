import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronDown, StickyNote, X } from "lucide-react";

interface NoteSelectProps {
  notes: { id: number; text: string }[];
  value: number | null;
  onChange: (id: number | null, title: string) => void;
}

export function NoteSelect({ notes, value, onChange }: NoteSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = notes.find((n) => n.id === value);

  const select = useCallback(
    (n: { id: number; text: string }) => {
      onChange(n.id, n.text.slice(0, 40));
      setOpen(false);
    },
    [onChange],
  );

  const clear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null, "");
    },
    [onChange],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition-all ${
          selected
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border bg-card/80 text-muted-foreground hover:border-muted-foreground/30"
        }`}
      >
        <StickyNote className="h-3 w-3 shrink-0" />
        <span className="flex-1 truncate text-left">
          {selected ? selected.text.slice(0, 40) : "No note linked"}
        </span>
        {selected ? (
          <X className="h-3 w-3 shrink-0 text-muted-foreground hover:text-foreground" onClick={clear} />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-lg border border-border bg-card/95 p-1 shadow-xl backdrop-blur-xl">
          {notes.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No notes yet</p>
          ) : (
            notes.slice(0, 20).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => select(n)}
                className={`w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
                  n.id === value
                    ? "bg-primary/20 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {n.text.slice(0, 60)}
                {n.text.length > 60 ? "…" : ""}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
