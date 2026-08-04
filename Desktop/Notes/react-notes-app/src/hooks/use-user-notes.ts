import { useLocalStorage } from "@/hooks/use-local-storage";
import type { NoteItem } from "@/types";

export function useUserNotes() {
  return useLocalStorage<NoteItem[]>("notes", []);
}
