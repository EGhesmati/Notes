import { Card, CardContent } from "@/components/ui/card";

/**
 * Skeleton placeholder shown while the NotesGrid is lazy-loading.
 * Renders a grid of pulsing placeholder cards matching the real layout.
 */
export function NotesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          className="flex flex-col border-border bg-card backdrop-blur-xl"
        >
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-8 w-8 self-end animate-pulse rounded-full bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
