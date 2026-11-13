"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

type LaserHandle = {
  setTheme(theme: "light" | "dark"): void;
  syncSphere(): void;
  destroy(): void;
};

/** Selector for the element the strands converge on (the home bot). */
export const LASER_FOCUS_ATTR = "data-laser-focus";

/**
 * The CEO Agent "energy strands" — a full-viewport WebGL layer behind the page.
 * three.js is only loaded on the client, on pages that render this.
 */
export function LaserBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<LaserHandle | null>(null);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
    handle.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    void import("./engines/laser-flow.js").then(({ LaserFlow }) => {
      if (cancelled) return;
      handle.current = LaserFlow.mount(el, {
        theme: themeRef.current,
        focus: () => document.querySelector(`[${LASER_FOCUS_ATTR}]`),
      }) as LaserHandle | null;
    });
    return () => {
      cancelled = true;
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  return <div ref={ref} className="laser-flow-layer" aria-hidden="true" />;
}
