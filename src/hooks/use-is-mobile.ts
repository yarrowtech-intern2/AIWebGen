"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)"; // below Tailwind's `md`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True on phone-sized screens. Renders the desktop layout on the server. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
