import "server-only";

/**
 * Deploys files straight to Vercel (no Git needed) with the user's token.
 * Static sites are served as-is; React projects are built by Vercel with Vite.
 */
const API = "https://api.vercel.com";

export class VercelError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function vercel<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new VercelError(res.status, data.error?.message ?? `Vercel API error ${res.status}`);
  return data;
}

export function explainVercelError(err: unknown): string {
  if (!(err instanceof VercelError)) return err instanceof Error ? err.message : String(err);
  if (err.status === 401 || err.status === 403) return "Vercel rejected the token. Reconnect Vercel with a new token.";
  return `Vercel error ${err.status}: ${err.message}`;
}

export async function getVercelUser(token: string) {
  const data = await vercel<{ user: { username: string } }>(token, "GET", "/v2/user");
  return { username: data.user.username };
}

export async function deployToVercel(token: string, name: string, kit: string, files: Record<string, string>) {
  const projectSettings =
    kit === "react-vite"
      ? { framework: "vite", installCommand: "npm install", buildCommand: "npm run build", outputDirectory: "dist" }
      : { framework: null };
  const deployment = await vercel<{ id: string; url: string; readyState: string; alias?: string[] }>(
    token,
    "POST",
    "/v13/deployments?skipAutoDetectionConfirmation=1",
    {
      name,
      target: "production",
      files: Object.entries(files).map(([file, data]) => ({ file, data, encoding: "utf-8" })),
      projectSettings,
    },
  );
  // The production alias (<name>.vercel.app) is the stable URL; the deployment URL is unique per deploy.
  return { deploymentUrl: `https://${deployment.url}`, productionUrl: `https://${name}.vercel.app`, state: deployment.readyState };
}
