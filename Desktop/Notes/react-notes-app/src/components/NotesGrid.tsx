import { memo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X, Calendar, Pin } from "lucide-react";
import { PRIORITY_BADGE } from "@/types";
import type { NotesState, Priority } from "@/types";
import { TimeChips } from "@/components/TimeChips";

interface NotesGridProps {
  readonly notes: NotesState;
  readonly onDelete: (id: number) => void;
  readonly onEdit: (
    id: number,
    text: string,
    priority?: Priority,
    dueDate?: string,
    dueTime?: string,
  ) => void;
  readonly onTogglePin: (id: number) => void;
}

const PRIORITY_OPTIONS: Priority[] = ["low", "medium", "high"];

function formatDue(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  let badge: { label: string; color: string } | null = null;
  if (diffDays < 0) {
    badge = { label: `Overdue ${Math.abs(diffDays)}d`, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" };
  } else if (diffDays === 0) {
    badge = { label: "Today", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  } else if (diffDays === 1) {
    badge = { label: "Tomorrow", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  } else if (diffDays <= 3) {
    badge = { label: `In ${diffDays}d`, color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" };
  }

  return { dateLabel: `${date} ${time}`, badge };
}

function fromISO(iso?: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const NotesGrid = memo(function NotesGrid({
  notes,
  onDelete,
  onEdit,
  onTogglePin,
}: NotesGridProps) {
  if (notes.length === 0) {
    return (
      <p className="py-16 text-center text-sm italic text-muted-foreground">
        No matching notes.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((item) => (
        <NoteCard
          key={item.id}
          item={item}
          onDelete={onDelete}
          onEdit={onEdit}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  );
});

const NoteCard = memo(function NoteCard({
  item,
  onDelete,
  onEdit,
  onTogglePin,
}: {
  readonly item: NotesState[number];
  readonly onDelete: (id: number) => void;
  readonly onEdit: (
    id: number,
    text: string,
    priority?: Priority,
    dueDate?: string,
    dueTime?: string,
  ) => void;
  readonly onTogglePin: (id: number) => void;
}) {
  const defaultDates = fromISO(item.dueDate);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editPriority, setEditPriority] = useState<Priority | undefined>(item.priority);
  const [editDueDate, setEditDueDate] = useState(defaultDates.date);
  const [editDueTime, setEditDueTime] = useState(defaultDates.time);

  const startEdit = useCallback(() => {
    setEditText(item.text);
    setEditPriority(item.priority);
    const d = fromISO(item.dueDate);
    setEditDueDate(d.date);
    setEditDueTime(d.time);
    setEditing(true);
  }, [item.text, item.priority, item.dueDate]);

  const cancelEdit = useCallback(() => setEditing(false), []);

  const saveEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    onEdit(item.id, trimmed, editPriority, editDueDate, editDueTime);
    setEditing(false);
  }, [editText, editPriority, editDueDate, editDueTime, item.id, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
      if (e.key === "Escape") cancelEdit();
    },
    [saveEdit, cancelEdit],
  );

  const badge = item.priority ? PRIORITY_BADGE[item.priority] : null;
  const due = formatDue(item.dueDate);

  return (
    <Card
      className={`group relative flex flex-col border-l-4 ${item.color} bg-card shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      {item.pinned && (
        <Pin className="absolute right-2 top-2 h-3.5 w-3.5 rotate-45 fill-primary/30 text-primary" />
      )}
      <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
        {editing ? (
          <div className="flex flex-col gap-3">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="min-h-[60px] border-border bg-background text-sm"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {PRIORITY_OPTIONS.map((p) => {
                const sel = editPriority === p;
                const b = PRIORITY_BADGE[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority((prev) => (prev === p ? undefined : p))}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      sel
                        ? `${b.className} ring-2 ring-offset-1 ring-offset-card`
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
              <span className="ml-1 text-[11px] text-muted-foreground">Due</span>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="h-7 w-30 rounded-md border border-border bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <TimeChips value={editDueTime} onChange={setEditDueTime} />
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={saveEdit} disabled={!editText.trim()} className="h-7 w-7 text-emerald-500 hover:text-emerald-600">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-center gap-2">
                {badge && (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-foreground break-words">
                {item.text}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-muted-foreground/60">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                {due && (
                  <>
                    {due.badge && (
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${due.badge.color}`}>
                        {due.badge.label}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {due.dateLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
              <Button variant="ghost" size="icon" onClick={() => onTogglePin(item.id)} className={`h-9 w-9 md:h-8 md:w-8 ${item.pinned ? "text-primary" : "text-muted-foreground"} hover:text-foreground`} title={item.pinned ? "Unpin" : "Pin"}>
                <Pin className={`h-4 w-4 ${item.pinned ? "fill-primary/20" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={startEdit} className="h-9 w-9 md:h-8 md:w-8 text-muted-foreground hover:text-foreground" title="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="h-9 w-9 md:h-8 md:w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default NotesGrid;
