"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

function partOfDay() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "👋 Good morning, Sam" — uses the visitor's clock, so it renders on the client. */
export function Greeting({ name }: { name?: string | null }) {
  const salutation = useSyncExternalStore(noop, partOfDay, () => "Welcome back");
  const first = name?.trim().split(/\s+/)[0];
  return (
    <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <span aria-hidden="true">👋</span>
      {salutation}
      {first ? `, ${first}` : ""}
    </p>
  );
}
