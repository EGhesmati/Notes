export type Priority = "low" | "medium" | "high";

export interface NoteItem {
  readonly id: number;
  text: string;
  readonly createdAt: string;
  readonly color: string;
  priority?: Priority;
  dueDate?: string;
  pinned?: boolean;
  tags: string[];
  deletedAt?: string;
}

export type NotesState = readonly NoteItem[];

export interface NoteColor {
  readonly name: string;
  readonly dot: string;
  readonly tint: string;
  readonly text: string;
  readonly line: string;
}

export const NOTE_COLORS: readonly NoteColor[] = [
  { name: "rose",       dot: "bg-rose-400",       tint: "bg-rose-50 dark:bg-rose-500/10",     text: "text-rose-600 dark:text-rose-400",      line: "before:bg-rose-400" },
  { name: "amber",      dot: "bg-amber-400",      tint: "bg-amber-50 dark:bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",   line: "before:bg-amber-400" },
  { name: "emerald",    dot: "bg-emerald-400",    tint: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", line: "before:bg-emerald-400" },
  { name: "sky",        dot: "bg-sky-400",        tint: "bg-sky-50 dark:bg-sky-500/10",       text: "text-sky-600 dark:text-sky-400",      line: "before:bg-sky-400" },
  { name: "violet",     dot: "bg-violet-400",     tint: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", line: "before:bg-violet-400" },
  { name: "pink",       dot: "bg-pink-400",       tint: "bg-pink-50 dark:bg-pink-500/10",     text: "text-pink-600 dark:text-pink-400",    line: "before:bg-pink-400" },
  { name: "teal",       dot: "bg-teal-400",       tint: "bg-teal-50 dark:bg-teal-500/10",     text: "text-teal-600 dark:text-teal-400",     line: "before:bg-teal-400" },
  { name: "orange",     dot: "bg-orange-400",     tint: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", line: "before:bg-orange-400" },
  { name: "cyan",       dot: "bg-cyan-400",       tint: "bg-cyan-50 dark:bg-cyan-500/10",     text: "text-cyan-600 dark:text-cyan-400",     line: "before:bg-cyan-400" },
  { name: "fuchsia",    dot: "bg-fuchsia-400",    tint: "bg-fuchsia-50 dark:bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", line: "before:bg-fuchsia-400" },
  { name: "lime",       dot: "bg-lime-400",       tint: "bg-lime-50 dark:bg-lime-500/10",     text: "text-lime-600 dark:text-lime-500",     line: "before:bg-lime-400" },
  { name: "indigo",     dot: "bg-indigo-400",     tint: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", line: "before:bg-indigo-400" },
] as const;

const NOTE_COLOR_MAP: Record<string, NoteColor> = Object.fromEntries(
  NOTE_COLORS.map((c) => [c.name, c]),
) as Record<string, NoteColor>;

export function noteColor(color?: string): NoteColor {
  if (color && NOTE_COLOR_MAP[color]) return NOTE_COLOR_MAP[color];
  return NOTE_COLORS[7]; // orange default
}

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
