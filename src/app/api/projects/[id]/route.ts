import { z } from "zod";
import { stopTurn } from "@/server/ai/active-turns";
import { db } from "@/server/db";
import { errorResponse, HttpError, readJson, requireProject } from "@/server/http";
import { deleteProject, renameProject } from "@/server/projects/service";

const Update = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80).optional(),
    githubToolsEnabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.githubToolsEnabled !== undefined, "Nothing to update");

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    await requireProject(id);
    const input = await readJson(req, Update);
    if (input.name !== undefined) await renameProject(id, input.name);
    if (input.githubToolsEnabled !== undefined) {
      await db.project.update({ where: { id }, data: { githubToolsEnabled: input.githubToolsEnabled } });
    }
    return Response.json({ ok: true, ...input });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    const { user } = await requireProject(id);
    stopTurn(id);
    if (!(await deleteProject(user.id, id))) throw new HttpError(404, "Project not found");
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
