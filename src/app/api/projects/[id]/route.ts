import { z } from "zod";
import { db } from "@/server/db";
import { errorResponse, HttpError, readJson, requireProject } from "@/server/http";
import { deleteProject } from "@/server/projects/service";

const Rename = z.object({ name: z.string().trim().min(1).max(80) });

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    await requireProject(id);
    const { name } = await readJson(req, Rename);
    await db.project.update({ where: { id }, data: { name } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { id } = await ctx.params;
    const { user } = await requireProject(id);
    if (!(await deleteProject(user.id, id))) throw new HttpError(404, "Project not found");
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
