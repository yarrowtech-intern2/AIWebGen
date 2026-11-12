import { errorResponse, requireProject } from "@/server/http";
import { buildReactPreview } from "@/server/projects/react-preview";
import { listFiles } from "@/server/projects/service";

/** Whether the preview builds; lets the builder offer "Ask Claude to fix". Static sites always "build". */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/build">) {
  try {
    const { id } = await ctx.params;
    const { project } = await requireProject(id);
    if (project.kit !== "react-vite") return Response.json({ ok: true, errors: [] });
    const files = Object.fromEntries((await listFiles(id)).map((f) => [f.path, f.content]));
    const build = await buildReactPreview(id, files);
    return Response.json(build.ok ? { ok: true, errors: [] } : { ok: false, errors: build.errors });
  } catch (err) {
    return errorResponse(err);
  }
}
