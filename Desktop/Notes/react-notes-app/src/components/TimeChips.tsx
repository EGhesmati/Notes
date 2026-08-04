import { useCallback } from "react";

interface TimeChipsProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
}

export function TimeChips({ value, onChange }: TimeChipsProps) {
  const parts = value ? value.split(":") : ["", ""];
  const hour = parts[0] || "";
  const minute = parts[1] || "";

  const handleHour = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
      const m = minute || "00";
      onChange(raw ? `${raw}:${m}` : "");
    },
    [minute, onChange],
  );

  const handleMinute = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
      const h = hour || "12";
      onChange(raw ? `${h}:${raw}` : "");
    },
    [hour, onChange],
  );

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card/80 px-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder="HH"
        value={hour}
        onChange={handleHour}
        className="w-5 bg-transparent text-center text-[11px] font-mono tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
      />
      <span className="text-[11px] text-muted-foreground">:</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={minute}
        onChange={handleMinute}
        className="w-5 bg-transparent text-center text-[11px] font-mono tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
      />
    </div>
  );
}
