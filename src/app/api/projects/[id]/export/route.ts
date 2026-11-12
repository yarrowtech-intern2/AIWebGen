import { errorResponse, requireProject } from "@/server/http";
import { buildZip, slugify } from "@/server/projects/export";
import { listFiles } from "@/server/projects/service";

/** Downloads the project as a ZIP. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  try {
    const { id } = await ctx.params;
    const { project } = await requireProject(id);
    const files = Object.fromEntries((await listFiles(id)).map((f) => [f.path, f.content]));
    const zip = await buildZip(project, files);
    return new Response(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slugify(project.name)}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
