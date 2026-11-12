export type KitId = "static" | "react-vite";

/**
 * A site kit bundles everything framework-specific: starter files, the rules
 * Claude follows, how the preview renders, and export instructions.
 * Adding Vue/Svelte later = adding a kit module and registering it in index.ts.
 */
export interface SiteKit {
  id: KitId;
  label: string;
  description: string;
  starterFiles: Record<string, string>;
  /** Framework rules appended to the base system prompt. */
  systemPrompt: string;
  /** Lower-case extensions (with dot) the agent may create. */
  allowedExtensions: string[];
  preview: { type: "static-server" } | { type: "sandpack"; template: string };
  exportReadme: string;
}
