"use client";

import { Box, Circle } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { LASER_FOCUS_ATTR } from "./laser-background";

type BotStyle = "led" | "classic";
type Engine = { unmount(): void };

// ---- remembered style (per browser), as a tiny external store ----
const STYLE_KEY = "awb.botStyle";
const STYLE_EVENT = "awb:bot-style";

function readStyle(): BotStyle {
  try {
    return localStorage.getItem(STYLE_KEY) === "classic" ? "classic" : "led";
  } catch {
    return "led";
  }
}
function writeStyle(style: BotStyle) {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
  window.dispatchEvent(new Event(STYLE_EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(STYLE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(STYLE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const STYLES: { id: BotStyle; label: string; icon: typeof Box }[] = [
  { id: "led", label: "3D", icon: Box },
  { id: "classic", label: "Classic", icon: Circle },
];

/**
 * The CEO Agent home bot in two interchangeable styles: the 3D LED-dome
 * (three.js, default) and the classic 2D orb (canvas). Without WebGL the
 * classic orb is used and the switch is hidden.
 */
export function HomeBot({ className }: { className?: string }) {
  // null on the server: the bot is client-only, so nothing renders until hydration.
  const chosen = useSyncExternalStore(subscribe, readStyle, () => null);
  const [webgl, setWebgl] = useState(true);
  const style: BotStyle | null = chosen && (webgl ? chosen : "classic");
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = slot.current;
    if (!el || !style) return;
    let engine: Engine | null = null;
    let cancelled = false;

    (async () => {
      if (style === "led") {
        const { default: LedBot } = await import("./engines/led-bot.js");
        if (cancelled) return;
        if (!LedBot.isSupported()) {
          setWebgl(false); // re-runs this effect with the classic orb
          return;
        }
        LedBot.mount(el, {
          speech: {
            tips: ["Psst… I come in two styles. Tap here to switch!", "Prefer a softer look? Tap here for my classic style."],
            onTipClick: () => writeStyle("classic"),
          },
        });
        engine = LedBot;
      } else {
        const { default: GeometricBot } = await import("./engines/geometric-bot.js");
        if (cancelled) return;
        GeometricBot.mount(el);
        engine = GeometricBot;
      }
    })();

    return () => {
      cancelled = true;
      engine?.unmount();
    };
  }, [style]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div {...{ [LASER_FOCUS_ATTR]: "" }} className="home-bot-slot">
        {/* Keyed so each engine gets a fresh node; the engines own its contents. */}
        <div key={style ?? "none"} ref={slot} className="absolute inset-0" />
      </div>

      {style && webgl && (
        <div
          role="radiogroup"
          aria-label="Bot style"
          className="glass-surface relative z-10 flex rounded-full p-0.5 text-xs font-semibold"
        >
          {STYLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={style === id}
              onClick={() => writeStyle(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                style === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
