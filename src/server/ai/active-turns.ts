import "server-only";

/**
 * One running agent turn per project, so a second message can't race the first
 * and the Stop button can find the turn to cancel. In-memory: fine for a single
 * Node process; a multi-instance deployment needs a shared store (e.g. Redis).
 */
const globalForTurns = globalThis as unknown as { activeTurns?: Map<string, AbortController> };
const activeTurns = (globalForTurns.activeTurns ??= new Map());

export function startTurn(projectId: string): AbortController | null {
  if (activeTurns.has(projectId)) return null;
  const controller = new AbortController();
  activeTurns.set(projectId, controller);
  return controller;
}

export function endTurn(projectId: string, controller: AbortController) {
  if (activeTurns.get(projectId) === controller) activeTurns.delete(projectId);
}

export function stopTurn(projectId: string): boolean {
  const controller = activeTurns.get(projectId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function isTurnRunning(projectId: string) {
  return activeTurns.has(projectId);
}
