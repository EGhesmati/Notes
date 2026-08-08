import { AppIcon } from "@/components/AppIcon";

/**
 * Full-page loading screen shown once when the app first hydrates.
 * Matches the app's header design for a seamless transition.
 */
export function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-4">
        <AppIcon className="h-12 w-12 animate-bounce" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading your notes...
        </p>
      </div>
    </div>
  );
}
