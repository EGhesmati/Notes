import { memo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X, Calendar, Pin, Timer, GripVertical } from "lucide-react";
import { PRIORITY_BADGE, noteColor } from "@/types";
import type { NotesState, Priority } from "@/types";
import { formatDuration } from "@/hooks/use-pomodoro-stats";
import { TimeChips } from "@/components/TimeChips";
import { renderMarkdown } from "@/lib/markdown";

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
  readonly onReorder: (orderedIds: number[]) => void;
  /** total focus seconds worked per note id */
  readonly timeOnNote: Map<number, number>;
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
  onReorder,
  timeOnNote,
}: NotesGridProps) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [dragEnabled, setDragEnabled] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: number) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(id));
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverId(id);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: number) => {
      e.preventDefault();
      const sourceIdRaw = e.dataTransfer.getData("text/plain") || String(dragId);
      const sourceId = Number(sourceIdRaw);
      if (!Number.isFinite(sourceId) || sourceId === targetId || dragId === null) {
        setDragId(null);
        setOverId(null);
        setDragEnabled(false);
        return;
      }
      const ids = notes.map((n) => n.id);
      const fromIdx = ids.indexOf(sourceId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) {
        setDragId(null);
        setOverId(null);
        setDragEnabled(false);
        return;
      }
      const next = [...ids];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceId);
      onReorder(next);
      setDragId(null);
      setOverId(null);
      setDragEnabled(false);
    },
    [notes, onReorder, dragId],
  );

  const clearDrag = useCallback(() => {
    setDragId(null);
    setOverId(null);
    setDragEnabled(false);
  }, []);

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
          timeOnNote={timeOnNote}
          dragEnabled={dragEnabled}
          isDragging={dragId === item.id}
          isOver={overId === item.id && dragId !== item.id}
          onDragEnabledChange={setDragEnabled}
          onDragStartItem={handleDragStart}
          onDragOverItem={handleDragOver}
          onDropItem={handleDrop}
          onDragEndItem={clearDrag}
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
  timeOnNote,
  dragEnabled,
  isDragging,
  isOver,
  onDragEnabledChange,
  onDragStartItem,
  onDragOverItem,
  onDropItem,
  onDragEndItem,
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
  readonly timeOnNote: Map<number, number>;
  readonly dragEnabled: boolean;
  readonly isDragging: boolean;
  readonly isOver: boolean;
  readonly onDragEnabledChange: (v: boolean) => void;
  readonly onDragStartItem: (e: React.DragEvent, id: number) => void;
  readonly onDragOverItem: (e: React.DragEvent, id: number) => void;
  readonly onDropItem: (e: React.DragEvent, id: number) => void;
  readonly onDragEndItem: () => void;
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
  const focusedSeconds = timeOnNote.get(item.id);
  const focusedLabel = focusedSeconds ? formatDuration(focusedSeconds) : null;
  const c = noteColor(item.color);
  const created = new Date(item.createdAt);

  return (
    <Card
      draggable={dragEnabled}
      onDragStart={(e) => onDragStartItem(e, item.id)}
      onDragOver={(e) => onDragOverItem(e, item.id)}
      onDrop={(e) => onDropItem(e, item.id)}
      onDragEnd={onDragEndItem}
      onDragLeave={() => {}}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-card/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-black/5 ${
        isDragging ? "opacity-40 scale-[0.98]" : ""
      } ${isOver ? "ring-2 ring-primary/40" : ""} ${dragEnabled ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {item.pinned && (
        <span className="absolute right-3 top-2.5 z-10 text-foreground/30 transition-colors group-hover:text-primary">
          <Pin className="h-3.5 w-3.5 rotate-45 fill-current" />
        </span>
      )}
      <CardContent className="flex flex-1 flex-col p-0">
        {editing ? (
          <div className="flex flex-col gap-3 p-4">
            <div className={`flex items-center gap-2 border-b border-border/60 pb-2`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest text-muted-foreground`}>
                Editing note
              </span>
              <span className="ml-auto inline-flex h-1 w-1 animate-pulse rounded-full bg-primary" />
            </div>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="min-h-[60px] border-border bg-background text-sm"
            />
            <p className="text-[10px] text-muted-foreground/60">
              Markdown supported: <span className="font-mono">**bold**</span>, <span className="font-mono">*italic*</span>, <span className="font-mono">`code`</span>, <span className="font-mono">## heading</span>, <span className="font-mono">- lists</span>
            </p>
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
            {/* Colored accent rule */}
            <div className={`relative flex items-center justify-between px-4 pt-3 pb-2`}>
              <span className={`absolute bottom-0 left-4 right-4 h-px ${c.tint}`} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-grab rounded px-0.5 text-muted-foreground/0 transition-colors hover:text-muted-foreground active:cursor-grabbing md:group-hover:text-muted-foreground/60"
                  title="Drag to reorder"
                  onPointerDown={() => onDragEnabledChange(true)}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="font-mono text-[10px] font-semibold text-muted-foreground/60">
                  #{item.id}
                </span>
                {badge && (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              {due?.badge && (
                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${due.badge.color}`}>
                  {due.badge.label}
                </span>
              )}
            </div>

            {/* Note body (markdown) */}
            <div className="flex flex-1 flex-col px-4 pt-1.5 pb-4">
              <div className="text-sm leading-relaxed text-foreground">
                {renderMarkdown(item.text)}
              </div>
              {(due?.dateLabel || focusedLabel) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {due?.dateLabel && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {due.dateLabel}
                    </span>
                  )}
                  {focusedLabel && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${c.text}`}>
                      <Timer className="h-3 w-3" />
                      {focusedLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer meta row */}
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
              <span className="text-[10px] text-muted-foreground/60">
                {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <Button variant="ghost" size="icon" onClick={() => onTogglePin(item.id)} className={`h-7 w-7 ${item.pinned ? "text-primary" : "text-muted-foreground"} hover:text-foreground`} title={item.pinned ? "Unpin" : "Pin"}>
                  <Pin className={`h-3.5 w-3.5 rotate-45 ${item.pinned ? "fill-current" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={startEdit} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

export default NotesGrid;
