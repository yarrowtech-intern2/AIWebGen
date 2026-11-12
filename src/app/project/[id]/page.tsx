import { Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Builder, type BuilderMessage } from "@/components/builder/builder";
import { isTurnRunning } from "@/server/ai/active-turns";
import { requirePageUser } from "@/server/auth/session";
import { getIntegrationStatuses } from "@/server/integrations/store";
import { createPreviewToken } from "@/server/projects/preview-token";
import type { StoredAssistantMeta } from "@/server/projects/service";
import { getProject, listFiles, listMessages } from "@/server/projects/service";

async function BuilderLoader({ params }: { params: PageProps<"/project/[id]">["params"] }) {
  const { id } = await params;
  const user = await requirePageUser();
  const project = await getProject(user.id, id);
  if (!project) notFound();

  const [files, messages, integrations] = await Promise.all([listFiles(id), listMessages(id), getIntegrationStatuses(user.id)]);
  const initialMessages: BuilderMessage[] = messages.map((m) => {
    const meta = m.raw ? (JSON.parse(m.raw) as StoredAssistantMeta) : {};
    return {
      id: m.id,
      role: m.role as BuilderMessage["role"],
      text: m.content,
      changedFiles: meta.changedFiles ?? [],
      activity: [],
      error: meta.error,
      versionNumber: meta.versionNumber,
    };
  });

  return (
    <Builder
      project={{
        id: project.id,
        name: project.name,
        kit: project.kit,
        githubToolsEnabled: project.githubToolsEnabled,
        published: {
          target: project.publishTarget as "github-pages" | "vercel" | null,
          githubRepo: project.githubRepo,
          url: project.publishedUrl,
        },
      }}
      initialIntegrations={integrations}
      userEmail={user.email}
      initialFiles={Object.fromEntries(files.map((f) => [f.path, f.content]))}
      initialMessages={initialMessages}
      initialPreviewToken={createPreviewToken(project.id)}
      busyOnLoad={isTurnRunning(id)}
    />
  );
}

export default function ProjectPage(props: PageProps<"/project/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading project…
        </div>
      }
    >
      <BuilderLoader params={props.params} />
    </Suspense>
  );
}
