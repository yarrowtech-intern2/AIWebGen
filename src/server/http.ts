import "server-only";
import type { z } from "zod";
import { getCurrentUser, getProject } from "@/server/projects/service";

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

/** Loads the project for the current user, or throws a 404. */
export async function requireProject(projectId: string) {
  const user = await getCurrentUser();
  const project = await getProject(user.id, projectId);
  if (!project) throw new HttpError(404, "Project not found");
  return { user, project };
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
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
