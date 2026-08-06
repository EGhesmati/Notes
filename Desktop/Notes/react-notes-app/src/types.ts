export type Priority = "low" | "medium" | "high";

export interface NoteItem {
  readonly id: number;
  text: string;
  readonly createdAt: string;
  readonly color: string;
  priority?: Priority;
  dueDate?: string;
  pinned?: boolean;
}

export type NotesState = readonly NoteItem[];

export const NOTE_COLORS = [
  "border-l-rose-400",
  "border-l-amber-400",
  "border-l-emerald-400",
  "border-l-sky-400",
  "border-l-violet-400",
  "border-l-pink-400",
  "border-l-teal-400",
  "border-l-orange-400",
  "border-l-cyan-400",
  "border-l-fuchsia-400",
  "border-l-lime-400",
  "border-l-indigo-400",
] as const;

export const PRIORITY_BADGE: Record<Priority, { label: string; className: string }> = {
  low:    { label: "Low",    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  high:   { label: "High",   className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

export interface AppStats {
  readonly totalNotes: number;
  readonly visibleNotes: number;
  readonly characterCount: number;
}

export type ThemeMode = "light" | "dark";
