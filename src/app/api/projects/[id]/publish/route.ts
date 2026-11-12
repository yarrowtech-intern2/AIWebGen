import { z } from "zod";
import { isTurnRunning } from "@/server/ai/active-turns";
import { errorResponse, HttpError, readJson, requireProject } from "@/server/http";
import { publishProject, PublishError } from "@/server/integrations/publish";

const Publish = z.object({
  target: z.enum(["github-pages", "vercel"]),
  repoName: z.string().trim().max(100).optional(),
  isPrivate: z.boolean().optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/publish">) {
  try {
    const { id } = await ctx.params;
    const { user, project } = await requireProject(id);
    const input = await readJson(req, Publish);
    if (isTurnRunning(id)) throw new HttpError(409, "Claude is still working on this project. Publish when it's done.");
    try {
      return Response.json(await publishProject(user.id, project, input.target, input));
    } catch (err) {
      if (err instanceof PublishError) {
        return Response.json({ error: err.message, needsConnection: err.needsConnection }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
