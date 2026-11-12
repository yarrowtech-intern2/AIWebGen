import { isTurnRunning } from "@/server/ai/active-turns";
import { errorResponse, HttpError, requireProject } from "@/server/http";
import { restoreVersion } from "@/server/projects/service";

export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/versions/[versionId]/restore">) {
  try {
    const { id, versionId } = await ctx.params;
    await requireProject(id);
    if (isTurnRunning(id)) throw new HttpError(409, "Claude is working on this project. Stop it before restoring.");
    const version = await restoreVersion(id, versionId);
    if (!version) throw new HttpError(404, "Version not found");
    return Response.json({ ok: true, number: version.number });
  } catch (err) {
    return errorResponse(err);
  }
}
