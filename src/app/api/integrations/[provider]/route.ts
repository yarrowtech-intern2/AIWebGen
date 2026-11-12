import { z } from "zod";
import { errorResponse, HttpError, readJson, requireUser } from "@/server/http";
import { explainGitHubError, getGitHubUser } from "@/server/integrations/github";
import {
  getIntegrationStatuses,
  type IntegrationProvider,
  removeIntegration,
  saveIntegration,
} from "@/server/integrations/store";
import { explainVercelError, getVercelUser } from "@/server/integrations/vercel";

const PROVIDERS = ["github", "vercel"] as const;
const Connect = z.object({ token: z.string().trim().min(20, "That doesn't look like a token").max(500) });

function parseProvider(value: string): IntegrationProvider {
  if (!(PROVIDERS as readonly string[]).includes(value)) throw new HttpError(404, "Unknown integration");
  return value as IntegrationProvider;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/integrations/[provider]">) {
  try {
    const provider = parseProvider((await ctx.params).provider);
    const user = await requireUser();
    return Response.json((await getIntegrationStatuses(user.id))[provider]);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Connect: validates the token against the provider, then stores it encrypted. */
export async function PUT(req: Request, ctx: RouteContext<"/api/integrations/[provider]">) {
  try {
    const provider = parseProvider((await ctx.params).provider);
    const user = await requireUser();
    const { token } = await readJson(req, Connect);
    let accountName: string;
    try {
      accountName = provider === "github" ? (await getGitHubUser(token)).login : (await getVercelUser(token)).username;
    } catch (err) {
      throw new HttpError(400, provider === "github" ? explainGitHubError(err) : explainVercelError(err));
    }
    await saveIntegration(user.id, provider, token, accountName);
    return Response.json({ connected: true, accountName });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/integrations/[provider]">) {
  try {
    const provider = parseProvider((await ctx.params).provider);
    const user = await requireUser();
    await removeIntegration(user.id, provider);
    return Response.json({ connected: false });
  } catch (err) {
    return errorResponse(err);
  }
}
