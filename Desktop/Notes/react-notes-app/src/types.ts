export interface NoteItem {
  /** Unique identifier — timestamp in ms */
  readonly id: number;
  /** The note's text content */
  readonly text: string;
  /** ISO 8601 creation date */
  readonly createdAt: string;
}

export type NotesState = readonly NoteItem[];

export interface AppStats {
  readonly totalNotes: number;
  readonly visibleNotes: number;
  readonly characterCount: number;
}

export type ThemeMode = "light" | "dark";
