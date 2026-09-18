import { notFound } from "next/navigation";
import { getProject } from "@/lib/store";
import { getSessionUser } from "@/lib/auth";
import { requireProjectRole } from "@/lib/membership";
import LiveLogsPageClient from "@/app/components/live-logs-page-client";

export const dynamic = "force-dynamic";

export default async function LiveLogsPage({ params }: PageProps<"/projects/[id]/live-logs">) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const user = await getSessionUser();
  if (!user) notFound();
  const access = await requireProjectRole(user, id);
  if (!access.ok) notFound();

  if (project.type !== "worker") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-8" style={{ background: "var(--surface-2)" }}>
        <div className="max-w-md text-center">
          <p className="pmute">
            Live logs are only available for Workers projects. Pages projects do not support live
            tailing yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveLogsPageClient
      projectId={project.id}
      projectName={project.name}
    />
  );
}
