import { FileCode2, Sparkles } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { kits } from "@/kits";
import type { KitId } from "@/kits/types";
import { getCurrentUser, listProjects } from "@/server/projects/service";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

async function ProjectList() {
  await connection(); // always fresh: render per request
  const user = await getCurrentUser();
  const projects = await listProjects(user.id);

  if (projects.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        No projects yet. Create one above and describe the site you want.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/project/${p.id}`}
            className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="font-medium">{p.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileCode2 className="size-3.5" />
              {kits[p.kit as KitId]?.label ?? p.kit} · {p._count.files} files
            </span>
            <span className="text-xs text-muted-foreground">Updated {dateFormat.format(p.updatedAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          AgentWebBuilder
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Build a website by chatting with Claude</h1>
          <p className="text-muted-foreground">
            Create a project, describe the site you want, and watch it appear in the live preview.
          </p>
        </section>

        <NewProjectForm />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your projects</h2>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading projects…</p>}>
            <ProjectList />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
