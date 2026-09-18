"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toggleMobileNav } from "./nav-state";

function SegIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21l-5.2-5.2" />
      <circle cx="10.5" cy="10.5" r="7.5" />
    </svg>
  );
}

type Crumb = { label: string; href?: string };

function buildCrumbs(pathname: string): Crumb[] {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return [{ label: "Launch" }];
  if (segs[0] === "projects") {
    const crumbs: Crumb[] = [{ label: "Projects", href: "/projects" }];
    let i = 1;
    while (i < segs.length) {
      const s = segs[i];
      if (i === 1) {
        crumbs.push({ label: s, href: `/projects/${s}` });
      } else if (s === "preview" && segs[i + 1]) {
        crumbs.push({ label: "Preview", href: `/projects/${segs[1]}/preview/${segs[i + 1]}` });
        i += 1;
      } else if (s === "live-logs") {
        crumbs.push({ label: "Live logs", href: `/projects/${segs[1]}/live-logs` });
      } else if (s === "members") {
        crumbs.push({ label: "Members", href: `/projects/${segs[1]}/members` });
      } else {
        crumbs.push({ label: s, href: `/projects/${segs[1]}/${s}` });
      }
      i += 1;
    }
    return crumbs;
  }
  if (segs[0] === "templates") return [{ label: "Templates", href: "/templates" }];
  if (segs[0] === "settings") return [{ label: "Settings", href: "/settings" }];
  if (segs[0] === "invite") return [{ label: "Invite" }];
  return [{ label: segs[0] }];
}

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login" || pathname.startsWith("/invite")) return null;

  const crumbs = buildCrumbs(pathname);

  return (
    <header className="topbar">
      <div className="tb-left">
        <button
          type="button"
          className="burger"
          aria-label="Open menu"
          onClick={toggleMobileNav}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <nav className="crumbs">
          {crumbs.map((crumb, idx) => (
            <span key={idx} className="crumbs-i" style={{ display: "contents" }}>
              {idx > 0 && <span className="crumb-sep">/</span>}
              {crumb.href && idx < crumbs.length - 1 ? (
                <Link href={crumb.href} className="crumb-root">
                  {crumb.label}
                </Link>
              ) : (
                <span className={idx === crumbs.length - 1 ? "crumb-now" : "crumb-root"}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <button
        type="button"
        className="tb-search"
        onClick={() => router.push("/projects")}
        title="Search projects"
      >
        <SegIcon />
        <span className="ph">Search projects…</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="tb-right">
        <span className="env-pill">
          <span className="lbl">env</span>
          launchpad
        </span>
        <span className="live-pill">
          <span className="status-dot ok" />
          LIVE
        </span>
        <span className="avatar" title="Signed in">
          N
        </span>
      </div>
    </header>
  );
}