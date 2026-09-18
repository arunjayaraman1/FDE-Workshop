"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandMark, Wordmark } from "./brand";
import { subscribeMobileNav, closeMobileNav, getMobileNavOpen } from "./nav-state";

const SIDEBAR_STORAGE_KEY = "launchpad.sidebar.collapsed";
const SIDEBAR_EXPANDED_W = "15.75rem";
const SIDEBAR_COLLAPSED_W = "4.5rem";

const collapsedListeners = new Set<() => void>();

function getCollapsedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(callback: () => void): () => void {
  collapsedListeners.add(callback);
  return () => {
    collapsedListeners.delete(callback);
  };
}

function setCollapsedPersisted(value: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage may be unavailable; collapse still works for the session.
  }
  for (const cb of collapsedListeners) cb();
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  // rocket
  launch:
    "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
  // grid
  projects: "M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z",
  // layers
  templates:
    "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  // gear
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
};

export default function SidebarClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" ? getMobileNavOpen() : false
  );
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    () => false
  );

  useEffect(() => {
    return subscribeMobileNav(() => setOpen(getMobileNavOpen()));
  }, []);

  useEffect(() => {
    closeMobileNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--sidebar-w", collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W);
    el.classList.toggle("collapsed", collapsed);
  }, [collapsed]);

  if (pathname === "/login" || pathname.startsWith("/invite")) return null;

  const navItems = [
    { href: "/", label: "Launch", icon: ICONS.launch },
    { href: "/projects", label: "Projects", icon: ICONS.projects },
    { href: "/templates", label: "Templates", icon: ICONS.templates },
    { href: "/settings", label: "Settings", icon: ICONS.settings },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const close = () => setOpen(false);

  const handleNavClick = () => {
    close();
    setCollapsedPersisted(true);
  };

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Logout is best-effort; navigate anyway.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sb-head">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <div className="sb-head-tx">
            <Wordmark className="sb-wm" />
            <span className="sb-sub">Deploy console</span>
          </div>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={handleNavClick}
              title={collapsed ? item.label : undefined}
              className={`navlink ${isActive(item.href) ? "active" : ""}`}
            >
              <span className="nav-ico">
                <NavIcon d={item.icon} />
              </span>
              <span className="nav-lbl">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sb-foot">
          <button type="button" className="sb-user" onClick={handleLogout} title="Log out">
            <span className="avatar">N</span>
            <span className="u1">Newpage</span>
            <span className="u2">Log out</span>
          </button>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsedPersisted(!collapsed)}
          >
            <svg className="icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <path d="m9 18 6-6-6-6" />
              ) : (
                <path d="m15 18-6-6 6-6" />
              )}
            </svg>
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}