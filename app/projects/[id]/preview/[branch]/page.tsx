import { notFound } from "next/navigation";
import { getProject } from "@/lib/store";
import { getSessionUser } from "@/lib/auth";
import { requireProjectRole } from "@/lib/membership";
import PreviewBranchClient from "@/app/components/preview-branch-client";

export const dynamic = "force-dynamic";

export default async function PreviewBranchPage({ params }: PageProps<"/projects/[id]/preview/[branch]">) {
  const { id, branch } = await params;

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
            Per-branch preview deployments are not yet supported for Pages projects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PreviewBranchClient
      projectId={project.id}
      branch={branch}
    />
  );
}
