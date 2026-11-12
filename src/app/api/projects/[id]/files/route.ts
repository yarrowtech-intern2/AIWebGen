import { z } from "zod";
import { ToolInputError } from "@/server/ai/tools";
import { errorResponse, HttpError, readJson, requireProject } from "@/server/http";
import { createPreviewToken } from "@/server/projects/preview-token";
import { listFiles, saveFile } from "@/server/projects/service";

const SaveFile = z.object({ path: z.string().min(1), content: z.string() });

/** Files plus a fresh preview token (the builder refreshes it with every file reload). */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/files">) {
  try {
    const { id } = await ctx.params;
    await requireProject(id);
    return Response.json({ files: await listFiles(id), previewToken: createPreviewToken(id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Manual save from the code editor. */
export async function PUT(req: Request, ctx: RouteContext<"/api/projects/[id]/files">) {
  try {
    const { id } = await ctx.params;
    const { project } = await requireProject(id);
    const { path, content } = await readJson(req, SaveFile);
    try {
      const saved = await saveFile(project, path, content);
      return Response.json({ path: saved });
    } catch (err) {
      if (err instanceof ToolInputError) throw new HttpError(400, err.message);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
