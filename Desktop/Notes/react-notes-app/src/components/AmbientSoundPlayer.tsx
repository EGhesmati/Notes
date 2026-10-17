import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Headphones,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Waves,
  CloudRain,
  Wind,
  Sparkles,
  Flame,
  Check,
  X,
} from "lucide-react";
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

  // Prevent background scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
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

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              />

              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card p-5 shadow-2xl backdrop-blur-xl sm:w-[22rem] max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Headphones className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Ambient Sound</h2>
                      <p className="text-[11px] text-muted-foreground">Focus atmospheres & noise</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all ${
                        isPlaying
                          ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {isPlaying ? "Pause" : "Play"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Atmosphere Options */}
                <div className="py-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Select Atmosphere
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {AMBIENT_SOUND_OPTIONS.map((opt) => {
                      const isSelected = config.type === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectSound(opt.id)}
                          className={`flex items-center gap-2 rounded-xl p-3 text-left text-xs transition-all cursor-pointer min-h-[46px] ${
                            isSelected
                              ? "bg-primary/12 text-primary font-semibold ring-2 ring-primary/30"
                              : "bg-muted/40 text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                          }`}
                        >
                          <span className={`shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                            {SOUND_ICONS[opt.id]}
                          </span>
                          <span className="truncate">{opt.label.split(" ")[0]}</span>
                          {isSelected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Volume slider */}
                <div className="pt-3 border-t border-border/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground/80 flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Volume
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-foreground/80">
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
                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Timer Sync Option */}
                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">Sync with Pomodoro</p>
                    <p className="text-[11px] text-muted-foreground">Only play while focus timer runs</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.timerOnly}
                    onClick={handleTimerOnlyToggle}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      config.timerOnly ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                        config.timerOnly ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
