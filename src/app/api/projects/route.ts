import { z } from "zod";
import { kits } from "@/kits";
import { deriveProjectName } from "@/lib/project-name";
import { errorResponse, readJson, requireUser } from "@/server/http";
import { createProject, listProjects } from "@/server/projects/service";

const CreateProject = z.object({
  name: z.string().trim().max(80).optional(),
  /** The first chat message; used to name the project when no name is given. */
  prompt: z.string().trim().max(10_000).optional(),
  kit: z.enum(Object.keys(kits) as [string, ...string[]]),
  template: z.string().max(60).optional(),
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
    const name = input.name || (input.prompt ? deriveProjectName(input.prompt) : "Untitled site");
    const project = await createProject(user.id, { name, kit: input.kit, template: input.template });
    return Response.json({ id: project.id, name }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
