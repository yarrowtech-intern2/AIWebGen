import { stopTurn } from "@/server/ai/active-turns";
import { errorResponse, requireProject } from "@/server/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/chat/stop">) {
  try {
    const { id } = await ctx.params;
    await requireProject(id);
    return Response.json({ stopped: stopTurn(id) });
  } catch (err) {
    return errorResponse(err);
  }
}
