import { Loader2, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { ProjectCard } from "@/components/projects/project-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { kits } from "@/kits";
import type { KitId } from "@/kits/types";
import { requirePageUser } from "@/server/auth/session";
import { listProjects } from "@/server/projects/service";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

async function Dashboard() {
  const user = await requirePageUser();
  const projects = await listProjects(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          AgentWebBuilder
        </span>
        <div className="flex items-center gap-1">
          <UserMenu email={user.email} />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {user.name ? `Hi ${user.name.split(" ")[0]}, what` : "What"} are we building today?
          </h1>
          <p className="text-muted-foreground">
            Create a project, describe the site you want, and watch it appear in the live preview.
          </p>
        </section>

        <NewProjectForm />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your projects</h2>
          {projects.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No projects yet. Create one above and describe the site you want.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <ProjectCard
                    id={p.id}
                    name={p.name}
                    kitLabel={kits[p.kit as KitId]?.label ?? p.kit}
                    fileCount={p._count.files}
                    updatedLabel={dateFormat.format(p.updatedAt)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
