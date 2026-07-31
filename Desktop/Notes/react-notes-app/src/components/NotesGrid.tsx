import { memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { NotesState } from "@/types";

interface NotesGridProps {
  readonly notes: NotesState;
  readonly onDelete: (id: number) => void;
}

/**
 * Responsive grid of note cards.
 * Memoized to avoid re-renders when parent state unrelated to notes changes.
 */
const NotesGrid = memo(function NotesGrid({
  notes,
  onDelete,
}: NotesGridProps) {
  const handleDelete = useCallback(
    (id: number) => () => onDelete(id),
    [onDelete],
  );

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
        <Card
          key={item.id}
          className="group flex flex-col border-border bg-card shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-ring hover:shadow-md"
        >
          <CardContent className="flex flex-1 flex-col justify-between gap-3 p-4">
            <div>
              <p className="text-sm leading-relaxed text-foreground break-words">
                {item.text}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete(item.id)}
              className="h-8 w-8 self-end text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

export default NotesGrid;
