import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/lib/store";
import { getSessionUser } from "@/lib/auth";
import { requireProjectRole } from "@/lib/membership";
import { PageHead } from "../../../components/ui";
import MembersPanel from "../../../components/members-panel";

export const dynamic = "force-dynamic";

export default async function ProjectMembersPage({
  params,
}: PageProps<"/projects/[id]/members">) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const project = await getProject(id);
  if (!project) notFound();

  const access = await requireProjectRole(user, id, "member");
  if (!access.ok) notFound();

  return (
    <div>
      <PageHead
        eyebrow={
          <span>
            <Link href="/projects" className="link">
              Projects
            </Link>{" "}
            /{" "}
            <Link href={`/projects/${project.id}`} className="link">
              {project.name}
            </Link>{" "}
            / Members
          </span>
        }
        title="Members"
        desc={
          <>
            Who can access{" "}
            <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{project.name}</span> in
            Launchpad and on GitHub.
          </>
        }
      />

      <MembersPanel
        projectId={project.id}
        projectName={project.name}
        role={access.role}
        canManage={access.role === "owner"}
      />
    </div>
  );
}
