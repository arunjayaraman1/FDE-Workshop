"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, ProjectStatusResult } from "@/lib/types";
import { getStatusMeta } from "./status-meta";
import DeleteProjectModal from "./delete-project-modal";
import BulkDeleteProjectsModal from "./bulk-delete-projects-modal";
import LogsModal from "./logs-modal";

export interface TableProject extends Project {
  liveUrl: string | null;
}

type Filter = "all" | "running" | "success" | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Deploying" },
  { key: "success", label: "Deployed" },
  { key: "failed", label: "Failed" },
];

function groupOf(status: string | undefined): Filter {
  if (status === "running" || status === "queued") return "running";
  if (status === "success") return "success";
  if (status === "failure" || status === "cancelled") return "failed";
  return "all";
}

function ExternalIcon() {
  return (
    <svg
      className="ml-0.5"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

interface ProjectsTableProps {
  projects: TableProject[];
}

export default function ProjectsTable({ projects }: ProjectsTableProps) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, ProjectStatusResult>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<TableProject | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [logsFor, setLogsFor] = useState<{ project: TableProject; runId: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/projects/statuses", { cache: "no-store" });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { statuses: Record<string, ProjectStatusResult> };
          setStatuses(data.statuses);
        }
      } catch {
        // keep last known statuses
      }
    };

    void tick();
    const interval = setInterval(tick, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: projects.length, running: 0, success: 0, failed: 0 };
    for (const p of projects) {
      const g = groupOf(statuses[p.id]?.status);
      if (g !== "all") c[g] += 1;
    }
    return c;
  }, [projects, statuses]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      return groupOf(statuses[p.id]?.status) === filter;
    });
  }, [projects, statuses, filter, query]);

  const visibleIds = useMemo(() => new Set(visible.map((p) => p.id)), [visible]);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const someVisibleSelected = visible.some((p) => selected.has(p.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkProjects = useMemo(() => projects.filter((p) => selected.has(p.id)), [projects, selected]);

  return (
    <div>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`chip${filter === f.key ? " on" : ""}`}
          >
            {f.label}
            <span className="n">{counts[f.key]}</span>
          </button>
        ))}
        <div className="search">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
          />
          <span className="kbd badge-mini">⌘K</span>
        </div>
      </div>

      <div className={`bulkbar${selected.size > 0 ? " show" : ""}`}>
        <span className="cnt">
          <b>{selected.size}</b> selected
        </span>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="btn ghost sm"
        >
          Clear selection
        </button>
        <span className="grow" />
        <button
          type="button"
          onClick={() => setBulkDeleting(true)}
          className="btn danger sm"
        >
          Delete selected
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          {projects.length === 0 ? (
            <>
              No projects yet.{" "}
              <Link href="/" className="link">
                Launch your first app
              </Link>
              .
            </>
          ) : (
            "No projects match your filters."
          )}
        </div>
      ) : (
        <div className="tblwrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible projects"
                      className="cb"
                    />
                  </th>
                  <th>Project</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>URL</th>
                  <th>Repository</th>
                  <th>Launched</th>
                  <th className="!text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const status = statuses[p.id];
                  const meta = getStatusMeta(status?.status);
                  return (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="cb"
                        />
                      </td>
                      <td>
                        <div className="prow">
                          <span className={`pdot ${meta.dotClass}`} />
                          <Link href={`/projects/${p.id}`} className="pname">
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td>
                        <div className="prow">
                          <span className="pmute">{p.templateName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={meta.className} title={status?.error}>
                          <span className="dot" />
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const url = status?.liveUrl ?? p.liveUrl;
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="url-cell inline-flex items-center"
                            >
                              Visit
                              <ExternalIcon />
                            </a>
                          ) : (
                            <span className="text-[var(--text-4)]">—</span>
                          );
                        })()}
                      </td>
                      <td>
                        <a
                          href={p.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="url-cell"
                        >
                          {p.owner}/{p.repo}
                        </a>
                      </td>
                      <td className="rel">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="row-act">
                          {status?.latest && (
                            <button
                              type="button"
                              onClick={() => setLogsFor({ project: p, runId: status.latest!.runId })}
                              className="btn ghost sm"
                            >
                              Logs
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleting(p)}
                            className="btn ghost sm danger-hover"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleting && (
        <DeleteProjectModal
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(deleting.id);
              return next;
            });
            setDeleting(null);
          }}
        />
      )}

      {bulkDeleting && (
        <BulkDeleteProjectsModal
          projects={bulkProjects}
          onClose={() => setBulkDeleting(false)}
          onCompleted={() => {
            setBulkDeleting(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      {logsFor && (
        <LogsModal
          projectId={logsFor.project.id}
          runId={logsFor.runId}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
}