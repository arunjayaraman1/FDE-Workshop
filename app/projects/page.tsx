import { listProjects } from "@/lib/store";
import { deriveLiveUrl } from "@/lib/cf";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { filterAccessibleProjects } from "@/lib/membership";
import Link from "next/link";
import ProjectsTable, { type TableProject } from "../components/projects-table";
import { PageHead } from "../components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const projects = (
    await filterAccessibleProjects(user, await listProjects())
  ).map<TableProject>((p) => ({
    ...p,
    liveUrl: deriveLiveUrl(p),
  }));

  return (
    <div>
      <PageHead
        eyebrow="Workspace"
        title="Projects"
        desc="Apps launched through this Launchpad, with their latest deploy status."
        actions={
          <Link href="/" className="btn primary">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New launch
          </Link>
        }
      />
      <ProjectsTable projects={projects} />
    </div>
  );
}