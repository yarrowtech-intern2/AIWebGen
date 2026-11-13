import { FolderOpen, Loader2 } from "lucide-react";
import { Suspense } from "react";
import { Greeting } from "@/components/home/greeting";
import { HomeBot } from "@/components/home/home-bot";
import { LaserBackground } from "@/components/home/laser-background";
import { PromptBox } from "@/components/projects/prompt-box";
import { ProjectCard } from "@/components/projects/project-card";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { kits } from "@/kits";
import type { KitId } from "@/kits/types";
import { requirePageUser } from "@/server/auth/session";
import { listProjects } from "@/server/projects/service";
import { listTemplates } from "@/server/projects/templates";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

async function Dashboard() {
  const user = await requirePageUser();
  const [projects, templates] = await Promise.all([listProjects(user.id), listTemplates()]);

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <SiteHeader>
        <ThemeToggle />
        <UserMenu email={user.email} />
      </SiteHeader>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-16 sm:px-8">
        {/* Hero: oversized title left, bot right (stacked on phones). */}
        <section className="grid items-center gap-x-10 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-12">
          <div className="relative z-10">
            <Greeting name={user.name} />
            <h1 className="text-[clamp(2.75rem,7.6vw,5.75rem)] leading-[0.98] font-bold tracking-[-0.04em] text-balance">
              What should we build today?
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
              Describe it in your own words. Claude builds it and you watch it appear live.
            </p>
          </div>
          <HomeBot className="mx-auto mt-10 [--bot-size:clamp(176px,50vw,240px)] lg:mt-0 lg:mr-6 lg:[--bot-size:clamp(250px,24vw,310px)]" />
        </section>

        <div className="mx-auto mt-6 w-full max-w-230 lg:mt-4">
          <PromptBox templates={templates} />
        </div>

        <section className="mx-auto mt-14 flex w-full max-w-230 flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FolderOpen className="size-4 text-brand" />
            Your projects
            {projects.length > 0 && (
              <span className="rounded-full bg-foreground/[0.07] px-2 py-0.5 text-xs text-muted-foreground">
                {projects.length}
              </span>
            )}
          </h2>
          {projects.length === 0 ? (
            <p className="glass-surface rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No projects yet. Describe the site you want above and it will show up here.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    <>
      <LaserBackground />
      <Suspense
        fallback={
          <div className="relative z-10 flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </>
  );
}
