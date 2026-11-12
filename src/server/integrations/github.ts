import "server-only";

/**
 * Minimal GitHub REST client for publishing: create a repo, push all files as
 * one commit, and turn on GitHub Pages. Uses the user's fine-grained token.
 */
const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "agentwebbuilder",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GitHubError(res.status, data.message ?? `GitHub API error ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Explains common token problems in plain words. */
export function explainGitHubError(err: unknown): string {
  if (!(err instanceof GitHubError)) return err instanceof Error ? err.message : String(err);
  if (err.status === 401) return "GitHub rejected the token. It may be expired or revoked. Reconnect GitHub with a new token.";
  if (err.status === 403 || err.status === 404) {
    return `GitHub refused the request (${err.message}). Check the token has "All repositories" access with Administration, Contents, Pages and Workflows set to "Read and write".`;
  }
  if (err.status === 422) return `GitHub couldn't do that: ${err.message}`;
  return `GitHub error ${err.status}: ${err.message}`;
}

export async function getGitHubUser(token: string) {
  return gh<{ login: string }>(token, "GET", "/user");
}

/** Creates the repo if needed (with an initial commit so it has a main branch). */
export async function ensureRepo(token: string, owner: string, name: string, isPrivate: boolean) {
  try {
    return await gh<{ full_name: string; html_url: string; default_branch: string; private: boolean }>(
      token,
      "GET",
      `/repos/${owner}/${name}`,
    );
  } catch (err) {
    if (!(err instanceof GitHubError) || err.status !== 404) throw err;
  }
  return gh<{ full_name: string; html_url: string; default_branch: string; private: boolean }>(token, "POST", "/user/repos", {
    name,
    private: isPrivate,
    auto_init: true,
    description: "Website built with AgentWebBuilder",
  });
}

/** Replaces the branch contents with exactly these files, as a single commit. */
export async function pushFiles(
  token: string,
  repo: string,
  branch: string,
  files: Record<string, string>,
  message: string,
) {
  const ref = await gh<{ object: { sha: string } }>(token, "GET", `/repos/${repo}/git/ref/heads/${branch}`);

  // Create blobs a few at a time.
  const entries = Object.entries(files);
  const tree: { path: string; mode: "100644"; type: "blob"; sha: string }[] = [];
  for (let i = 0; i < entries.length; i += 8) {
    const batch = await Promise.all(
      entries.slice(i, i + 8).map(async ([path, content]) => {
        const blob = await gh<{ sha: string }>(token, "POST", `/repos/${repo}/git/blobs`, { content, encoding: "utf-8" });
        return { path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
      }),
    );
    tree.push(...batch);
  }

  // No base_tree: files that no longer exist in the project are removed from the repo.
  const newTree = await gh<{ sha: string }>(token, "POST", `/repos/${repo}/git/trees`, { tree });
  const commit = await gh<{ sha: string; html_url: string }>(token, "POST", `/repos/${repo}/git/commits`, {
    message,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });
  await gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
  return commit;
}

/**
 * Turns on GitHub Pages: from the branch root for static sites, or via a
 * GitHub Actions workflow (which we commit) for React builds.
 */
export async function enablePages(token: string, repo: string, branch: string, mode: "branch" | "workflow") {
  const body = mode === "workflow" ? { build_type: "workflow" } : { build_type: "legacy", source: { branch, path: "/" } };
  try {
    await gh(token, "POST", `/repos/${repo}/pages`, body);
  } catch (err) {
    if (!(err instanceof GitHubError) || err.status !== 409) throw err;
    await gh(token, "PUT", `/repos/${repo}/pages`, body); // already enabled: update the source
  }
  const pages = await gh<{ html_url: string }>(token, "GET", `/repos/${repo}/pages`);
  return pages.html_url;
}

/** GitHub Actions workflow that builds a Vite project and deploys it to Pages. */
export function pagesWorkflow(basePath: string) {
  return `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx vite build --base=${basePath}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}
