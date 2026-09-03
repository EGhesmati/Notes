import { useState, useCallback } from "react";
import { X, Plus } from "lucide-react";

const TAG_RE = /^[A-Za-z0-9 _-]+$/;

function TagChip({ tag, onRemove, color }: { tag: string; onRemove: (t: string) => void; color?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color ?? "bg-muted text-foreground"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {tag}
      <button
        type="button"
        onClick={() => onRemove(tag)}
        className="ml-0.5 rounded-full text-current opacity-60 transition-opacity hover:opacity-100"
        title={`Remove ${tag}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

interface TagInputProps {
  readonly value: string[];
  readonly onChange: (tags: string[]) => void;
  readonly suggestions?: string[];
  readonly placeholder?: string;
}

export function TagInput({ value, onChange, suggestions = [], placeholder = "Add tag..." }: TagInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (!tag) return;
      if (!TAG_RE.test(tag)) return;
      if (tag.length > 30) return;
      if (value.includes(tag)) return;
      onChange([...value, tag]);
    },
    [value, onChange],
  );

  const commit = useCallback(() => {
    addTag(input);
    setInput("");
  }, [addTag, input]);

  const removeTag = useCallback(
    (tag: string) => onChange(value.filter((t) => t !== tag)),
    [value, onChange],
  );

  const availableSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((tag) => (
        <TagChip key={tag} tag={tag} onRemove={removeTag} />
      ))}
      <div className="relative inline-flex items-center">
        <Plus className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground/60" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && input === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            } else if (e.key === "Escape") {
              setInput("");
              setFocused(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            if (input.trim()) commit();
            setFocused(false);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="h-6 w-24 rounded-md border border-border bg-background pl-6 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {focused && availableSuggestions.length > 0 && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
            {availableSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                  setInput("");
                }}
                className="flex w-full items-center gap-2 whitespace-nowrap rounded px-2 py-1 text-[11px] text-foreground hover:bg-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function tagColor(tag: string): string {
  const palette = [
    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
