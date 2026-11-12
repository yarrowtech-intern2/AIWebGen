import { reactViteKit } from "./react-vite";
import { staticKit } from "./static";
import type { KitId, SiteKit } from "./types";

export const kits: Record<KitId, SiteKit> = {
  static: staticKit,
  "react-vite": reactViteKit,
};

export function getKit(id: string): SiteKit {
  const kit = kits[id as KitId];
  if (!kit) throw new Error(`Unknown kit "${id}". Available: ${Object.keys(kits).join(", ")}`);
  return kit;
}

export type { KitId, SiteKit };
