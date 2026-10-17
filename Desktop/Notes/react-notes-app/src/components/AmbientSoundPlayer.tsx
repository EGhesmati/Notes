import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Headphones, Volume2, VolumeX, Play, Pause, Waves, CloudRain, Wind, Sparkles, Flame, Check } from "lucide-react";
import { ambientSound, AMBIENT_SOUND_OPTIONS, type AmbientSoundType } from "@/lib/ambient-sound";
import { motion, AnimatePresence } from "framer-motion";

const SOUND_ICONS: Record<AmbientSoundType, React.ReactNode> = {
  none: <VolumeX className="h-4 w-4" />,
  brown: <Waves className="h-4 w-4" />,
  rain: <CloudRain className="h-4 w-4" />,
  white: <Wind className="h-4 w-4" />,
  drone: <Sparkles className="h-4 w-4" />,
  campfire: <Flame className="h-4 w-4" />,
};

export function AmbientSoundPlayer() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(() => ambientSound.getConfig());
  const [isPlaying, setIsPlaying] = useState(() => ambientSound.getIsPlaying());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Keep state synced
  const handleSelectSound = (type: AmbientSoundType) => {
    ambientSound.setSoundType(type);
    setConfig(ambientSound.getConfig());
    setIsPlaying(ambientSound.getIsPlaying());
  };

  const handleVolumeChange = (v: number) => {
    ambientSound.setVolume(v);
    setConfig(ambientSound.getConfig());
  };

  const handleTimerOnlyToggle = () => {
    const next = !config.timerOnly;
    ambientSound.setTimerOnly(next);
    setConfig(ambientSound.getConfig());
    setIsPlaying(ambientSound.getIsPlaying());
  };

  const handleTogglePlay = () => {
    ambientSound.togglePlay();
    setConfig(ambientSound.getConfig());
    setIsPlaying(ambientSound.getIsPlaying());
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative h-8 w-8 rounded-full transition-all ${
          isPlaying
            ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Ambient Sound (Rain, White Noise, Focus Drone)"
      >
        {isPlaying ? (
          <span className="flex items-center justify-center">
            <Volume2 className="h-[17px] w-[17px] animate-pulse" />
          </span>
        ) : (
          <Headphones className="h-[17px] w-[17px]" />
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-border/80 bg-card p-4 shadow-xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Headphones className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Ambient Sound</span>
              </div>
              <button
                type="button"
                onClick={handleTogglePlay}
                className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all ${
                  isPlaying
                    ? "bg-sky-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isPlaying ? "Pause" : "Play"}
              </button>
            </div>

            {/* Sound options */}
            <div className="py-2.5 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Atmosphere
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {AMBIENT_SOUND_OPTIONS.map((opt) => {
                  const isSelected = config.type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectSound(opt.id)}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-all ${
                        isSelected
                          ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <span className="shrink-0">{SOUND_ICONS[opt.id]}</span>
                      <span className="truncate">{opt.label.split(" ")[0]}</span>
                      {isSelected && <Check className="ml-auto h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume control */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Volume</span>
                <span className="font-mono text-[11px] text-foreground/80">
                  {Math.round(config.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={config.volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Timer Sync Option */}
            <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Play only during focus timer
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={config.timerOnly}
                onClick={handleTimerOnlyToggle}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  config.timerOnly ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                    config.timerOnly ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
