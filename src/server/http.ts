import "server-only";
import type { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { getProject } from "@/server/projects/service";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** The logged-in user, or a 401. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Please log in.");
  return user;
}

/** Loads the project for the logged-in user, or throws 401/404. */
export async function requireProject(projectId: string) {
  const user = await requireUser();
  const project = await getProject(user.id, projectId);
  if (!project) throw new HttpError(404, "Project not found");
  return { user, project };
}

/**
 * Parses and validates a JSON body. Requiring the JSON content type also blocks
 * cross-site HTML form posts (which can't send it without a CORS preflight).
 */
export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  return parsed.data;
}
