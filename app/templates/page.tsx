import { listTemplates } from "@/lib/templates";
import Link from "next/link";
import TemplatesBrowser from "../components/templates-browser";
import { PageHead } from "../components/ui";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  const templates = listTemplates();

  return (
    <div>
      <PageHead
        eyebrow="Library"
        title="Templates"
        desc="Every stack available on this Launchpad. Open a template to see its full details."
        actions={
          <Link href="/" className="btn primary">
            <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New launch
          </Link>
        }
      />
      <TemplatesBrowser templates={templates} />
    </div>
  );
}