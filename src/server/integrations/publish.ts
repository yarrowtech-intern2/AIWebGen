import "server-only";
import { db } from "@/server/db";
import { exportFiles, slugify } from "@/server/projects/export";
import { listFiles } from "@/server/projects/service";
import { enablePages, ensureRepo, explainGitHubError, pagesWorkflow, pushFiles } from "./github";
import { getIntegrationToken } from "./store";
import { deployToVercel, explainVercelError } from "./vercel";

export type PublishTarget = "github-pages" | "vercel";

export type PublishResult = { siteUrl: string; repoUrl?: string; note: string };

export class PublishError extends Error {
  constructor(
    message: string,
    public needsConnection?: "github" | "vercel",
  ) {
    super(message);
  }
}

type Project = { id: string; name: string; kit: string };

async function projectFiles(project: Project) {
  const files = Object.fromEntries((await listFiles(project.id)).map((f) => [f.path, f.content]));
  return exportFiles(project, files);
}

async function publishToGitHubPages(
  userId: string,
  project: Project,
  options: { repoName?: string; isPrivate?: boolean },
): Promise<PublishResult> {
  const github = await getIntegrationToken(userId, "github");
  if (!github) throw new PublishError("Connect your GitHub account first.", "github");

  const repoName = slugify(options.repoName || project.name);
  try {
    const repo = await ensureRepo(github.token, github.accountName, repoName, options.isPrivate ?? false);
    const files = await projectFiles(project);
    const isUserSite = repoName.toLowerCase() === `${github.accountName.toLowerCase()}.github.io`;
    if (project.kit === "react-vite") {
      files[".github/workflows/deploy-pages.yml"] = pagesWorkflow(isUserSite ? "/" : `/${repoName}/`);
    } else {
      files[".nojekyll"] = ""; // serve files as-is, no Jekyll processing
    }

    await pushFiles(github.token, repo.full_name, repo.default_branch, files, "Publish from AgentWebBuilder");
    const siteUrl = await enablePages(
      github.token,
      repo.full_name,
      repo.default_branch,
      project.kit === "react-vite" ? "workflow" : "branch",
    );

    await db.project.update({
      where: { id: project.id },
      data: { publishTarget: "github-pages", githubRepo: repo.full_name, publishedUrl: siteUrl, publishedAt: new Date() },
    });
    return {
      siteUrl,
      repoUrl: repo.html_url,
      note:
        project.kit === "react-vite"
          ? "GitHub is building your site now. It's usually live in 1–2 minutes (see the repo's Actions tab)."
          : "Your site is usually live within a minute. If you see a 404, wait a moment and refresh.",
    };
  } catch (err) {
    if (err instanceof PublishError) throw err;
    const message = explainGitHubError(err);
    if (options.isPrivate && /pages|plan|upgrade/i.test(message)) {
      throw new PublishError(`${message} GitHub Pages on private repositories needs a paid GitHub plan. Try a public repository.`);
    }
    throw new PublishError(message);
  }
}

async function publishToVercel(userId: string, project: Project): Promise<PublishResult> {
  const vercel = await getIntegrationToken(userId, "vercel");
  if (!vercel) throw new PublishError("Connect your Vercel account first.", "vercel");
  try {
    const result = await deployToVercel(vercel.token, slugify(project.name), project.kit, await projectFiles(project));
    await db.project.update({
      where: { id: project.id },
      data: { publishTarget: "vercel", publishedUrl: result.deploymentUrl, publishedAt: new Date() },
    });
    return {
      siteUrl: result.deploymentUrl,
      note:
        project.kit === "react-vite"
          ? "Vercel is building your site. It's usually ready in under a minute."
          : "Your site is deploying and is usually ready in a few seconds.",
    };
  } catch (err) {
    throw new PublishError(explainVercelError(err));
  }
}

export async function publishProject(
  userId: string,
  project: Project,
  target: PublishTarget,
  options: { repoName?: string; isPrivate?: boolean } = {},
): Promise<PublishResult> {
  return target === "vercel" ? publishToVercel(userId, project) : publishToGitHubPages(userId, project, options);
}
