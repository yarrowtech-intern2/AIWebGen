import { errorResponse, requireProject } from "@/server/http";
import { listVersions } from "@/server/projects/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/versions">) {
  try {
    const { id } = await ctx.params;
    const { project } = await requireProject(id);
    return Response.json({ versions: await listVersions(id), currentVersionId: project.currentVersionId });
  } catch (err) {
    return errorResponse(err);
  }
}
