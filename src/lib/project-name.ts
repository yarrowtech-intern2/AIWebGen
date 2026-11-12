/**
 * Picks a short project name from the user's first prompt, e.g.
 * "A landing page for Mishti Corner, a sweet shop" -> "Mishti Corner".
 */
export function deriveProjectName(prompt: string): string {
  const text = prompt.replace(/\s+/g, " ").trim();

  const quoted = text.match(/["'“‘]([^"'”’]{2,50})["'”’]/);
  if (quoted) return quoted[1].trim();

  const named = text.match(/\b(?:called|named|for)\s+((?:[A-Z][\w&'’-]*)(?:\s+[A-Z][\w&'’-]*){0,3})/);
  if (named) return named[1];

  const words = text.split(" ").slice(0, 6).join(" ").replace(/[.,;:!?]+$/, "");
  const name = words.charAt(0).toUpperCase() + words.slice(1);
  return name.slice(0, 60) || "Untitled site";
}
