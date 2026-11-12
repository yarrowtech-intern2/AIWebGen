import { z } from "zod";
import { kits } from "@/kits";
import { errorResponse, readJson, requireUser } from "@/server/http";
import { createProject, listProjects } from "@/server/projects/service";

const CreateProject = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  kit: z.enum(Object.keys(kits) as [string, ...string[]]),
});

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ projects: await listProjects(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = await readJson(req, CreateProject);
    const project = await createProject(user.id, input);
    return Response.json({ id: project.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
