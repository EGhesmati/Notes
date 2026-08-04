import { useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TimeSpinnerProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
}

export function TimeSpinner({ value, onChange }: TimeSpinnerProps) {
  let h = 12;
  let m = 0;

  if (value) {
    const parts = value.split(":");
    h = parseInt(parts[0], 10) || 12;
    m = parseInt(parts[1], 10) || 0;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  const changeHour = useCallback(
    (delta: number) => {
      const next = (((h + delta) % 24) + 24) % 24;
      onChange(`${pad(next)}:${pad(m)}`);
    },
    [h, m, onChange],
  );

  const changeMin = useCallback(
    (delta: number) => {
      const next = (((m + delta) % 60) + 60) % 60;
      onChange(`${pad(h)}:${pad(next)}`);
    },
    [h, m, onChange],
  );

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card/80">
      {/* Hours */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => changeHour(1)}
          className="flex h-3.5 w-6 items-center justify-center rounded-t text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <span className="text-[11px] font-mono font-medium tabular-nums text-foreground select-none">
          {pad(h)}
        </span>
        <button
          type="button"
          onClick={() => changeHour(-1)}
          className="flex h-3.5 w-6 items-center justify-center rounded-b text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>

      <span className="text-[11px] font-medium text-muted-foreground">:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => changeMin(5)}
          className="flex h-3.5 w-6 items-center justify-center rounded-t text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <span className="text-[11px] font-mono font-medium tabular-nums text-foreground select-none">
          {pad(m)}
        </span>
        <button
          type="button"
          onClick={() => changeMin(-5)}
          className="flex h-3.5 w-6 items-center justify-center rounded-b text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
