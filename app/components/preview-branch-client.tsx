"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime, formatRelative, shortSha } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  CopyButton,
  IconArrowLeft,
  IconExternal,
  IconGitHub,
  IconTerminal,
} from "./ui";
import { SkeletonList } from "./skeleton";

interface PreviewDeployRun {
  runId: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PreviewBranchDetail {
  branch: string;
  previewName: string;
  url: string | null;
  running: boolean;
  worker: { createdOn: string | null; modifiedOn: string | null } | null;
  deploy: PreviewDeployRun | null;
  git: {
    name: string;
    sha: string;
    message: string;
    authorName: string | null;
    authorDate: string | null;
    htmlUrl: string;
    protected: boolean;
  } | null;
  resources: Array<{ type: string; name: string; id: string }>;
  secrets: string[];
  warnings: string[];
}

const RESOURCE_STYLE: Record<string, string> = {
  kv: "pill info",
  d1: "pill ok",
  r2: "pill purple",
  turnstile: "pill warn",
  ai_search: "pill flat",
};

const RESOURCE_LABEL: Record<string, string> = {
  kv: "KV namespace",
  d1: "D1 database",
  r2: "R2 bucket",
  turnstile: "Turnstile widget",
  ai_search: "AI Search instance",
};

function deployState(run: PreviewDeployRun | null): { label: string; cls: string } {
  if (!run) return { label: "No runs yet", cls: "pill flat" };
  const c = run.conclusion;
  const s = run.status;
  if (c === "success") return { label: "Success", cls: "pill ok" };
  if (c === "failure" || c === "timed_out" || c === "startup_failure")
    return { label: "Failed", cls: "pill err" };
  if (c === "cancelled") return { label: "Cancelled", cls: "pill warn" };
  if (s === "in_progress" || s === "queued" || s === "pending" || s === "requested" || s === "waiting")
    return { label: s.replace(/_/g, " "), cls: "pill info pulse" };
  if (c) return { label: c.replace(/_/g, " "), cls: "pill flat" };
  return { label: s.replace(/_/g, " "), cls: "pill flat" };
}

interface PreviewBranchClientProps {
  projectId: string;
  branch: string;
}

export default function PreviewBranchClient({ projectId, branch }: PreviewBranchClientProps) {
  const [detail, setDetail] = useState<PreviewBranchDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/preview/${encodeURIComponent(branch)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setDetail(data);
          setError(null);
        } else {
          setError(data.error ?? "Failed to load preview branch details.");
        }
      } catch {
        if (!cancelled) setError("Failed to reach the Launchpad server.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, branch]);

  const deploy = detail ? deployState(detail.deploy) : null;

  return (
    <div
      className="fixed inset-y-0 right-0 left-0 top-16 z-20 flex flex-col lg:top-0 lg:left-[var(--sidebar-w,16rem)]"
      style={{ background: "#042422" }}
    >
      <div
        className="flex items-center justify-between border-b px-6 py-3.5"
        style={{ borderColor: "rgba(8,189,184,0.18)", background: "#06302e" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-2 text-sm transition-colors hover:brightness-125"
            style={{ color: "#7fb5ae" }}
          >
            <IconArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <span className="h-5 w-px" style={{ background: "rgba(8,189,184,0.18)" }} />
          <div className="flex items-center gap-2.5" style={{ color: "#7fb5ae" }}>
            <IconTerminal className="h-4 w-4" />
            <span className="text-sm font-semibold" style={{ color: "#d7f0ec" }}>Preview Branch</span>
            <span
              className="rounded-md border px-2 py-0.5 font-mono text-[11px]"
              style={{ borderColor: "rgba(8,189,184,0.35)", background: "rgba(8,189,184,0.1)", color: "#7fdad7" }}
            >
              {branch}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: "#042422" }}>
        <div className="mx-auto max-w-3xl px-6 py-6">
          {error && (
            <div className="callout warn" style={{ marginTop: 0, marginBottom: 16 }}>
              <span className="icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </span>
              <span>{error}</span>
            </div>
          )}

          {!loaded ? (
            <Card>
              <CardHeader title={branch} />
              <div className="card-bd">
                <SkeletonList rows={4} />
              </div>
            </Card>
          ) : detail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card>
                <div className="card-bd pb-4" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 10 }}>
                    <span
                      className="pdot"
                      style={{
                        width: 11,
                        height: 11,
                        background: detail.running ? "#1faf74" : "var(--text-4)",
                        boxShadow: detail.running ? "0 0 8px rgba(31,175,116,0.7)" : "none",
                        borderRadius: 99,
                        flexShrink: 0,
                      }}
                    />
                    <h1 className="url-cell" style={{ fontSize: 17, fontWeight: 700 }}>
                      {detail.branch}
                    </h1>
                    <Badge className={detail.running ? "pill ok" : "pill flat"}>
                      {detail.running ? "Live" : "Not deployed"}
                    </Badge>
                  </div>
                  {detail.url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <a
                        href={detail.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn primary sm"
                      >
                        <IconExternal className="h-3.5 w-3.5" />
                        Open preview
                      </a>
                      <CopyButton text={detail.url} label="Copy URL" />
                    </div>
                  )}
                </div>
                <div style={{ borderTop: "1px solid var(--np-line)", padding: "14px 18px" }}>
                  <p className="url-cell">{detail.previewName}</p>
                  {!detail.running && (
                    <p className="pmute" style={{ marginTop: 8 }}>
                      No preview deployed for this branch yet. Push a commit to{" "}
                      <code className="url-cell" style={{ display: "inline" }}>{detail.branch}</code>{" "}
                      to spin one up.
                    </p>
                  )}
                </div>
              </Card>

              <div style={{ display: "grid", gap: 16 }} className="md:grid-cols-2">
                <Card>
                  <CardHeader title="Worker" />
                  <div style={{ padding: "6px 18px" }}>
                    <div className="kv-row">
                      <span className="k">Status</span>
                      <span style={{ flex: 1 }}>{detail.running ? "Running" : "Not deployed"}</span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Created</span>
                      <span style={{ flex: 1, textAlign: "right" }}>
                        {detail.worker
                          ? `${formatRelative(detail.worker.createdOn)} · ${formatDateTime(detail.worker.createdOn)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Last modified</span>
                      <span style={{ flex: 1, textAlign: "right" }}>
                        {detail.worker
                          ? `${formatRelative(detail.worker.modifiedOn)} · ${formatDateTime(detail.worker.modifiedOn)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Deploy" />
                  <div style={{ padding: "6px 18px" }}>
                    <div className="kv-row">
                      <span className="k">Latest run</span>
                      <span style={{ flex: 1, textAlign: "right" }}>
                        {deploy && <Badge className={deploy.cls}>{deploy.label}</Badge>}
                        {!deploy && "—"}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Updated</span>
                      <span style={{ flex: 1, textAlign: "right" }}>
                        {detail.deploy ? formatRelative(detail.deploy.updatedAt) : "—"}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Run</span>
                      <span style={{ flex: 1, textAlign: "right" }}>
                        {detail.deploy ? (
                          <a
                            href={detail.deploy.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="link"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            #{detail.deploy.runId}
                            <IconGitHub className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Resources" count={detail.resources.length} />
                  <div className="card-bd">
                    {detail.resources.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {detail.resources.map((r) => (
                          <span
                            key={`${r.type}:${r.id}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              borderRadius: 8,
                              padding: "4px 10px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              background: "var(--surface-2)",
                              border: "1px solid var(--np-line)",
                              color: "var(--text-2)",
                            }}
                          >
                            {r.name}
                            <span style={{ fontSize: 10, opacity: 0.7 }}>
                              {RESOURCE_LABEL[r.type] ?? r.type}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="pmute">
                        No per-branch KV, D1, R2, AI Search, or Turnstile resources provisioned.
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Environment" count={detail.secrets.length} />
                  <div className="card-bd">
                    {detail.secrets.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {detail.secrets.map((s) => (
                          <span key={s} className="kv-chip">
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="pmute">
                        No secrets set on this preview worker. It uses the same environment
                        variables as this project.
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Branch"
                  action={detail.git && (
                    <a
                      href={detail.git.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <IconGitHub className="h-3.5 w-3.5" />
                      Latest commit
                    </a>
                  )}
                />
                <div className="card-bd">
                  {detail.git ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <p className="url-cell" style={{ color: "var(--text)", fontSize: 13 }}>
                        <span className="kv-chip" style={{ marginRight: 8 }}>
                          {shortSha(detail.git.sha)}
                        </span>
                        {detail.git.message.split("\n")[0]}
                      </p>
                      <p className="pmute">
                        {detail.git.authorName ?? "Unknown author"} ·{" "}
                        {formatRelative(detail.git.authorDate)} ·{" "}
                        {formatDateTime(detail.git.authorDate)}
                      </p>
                    </div>
                  ) : (
                    <p className="pmute">Branch info unavailable.</p>
                  )}
                </div>
              </Card>

              {detail.warnings.length > 0 && (
                <div className="callout warn" style={{ marginTop: 0 }}>
                  <span className="icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  </span>
                  <span>{detail.warnings.join(" ")}</span>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader title={branch} />
              <p className="pmute" style={{ padding: "0 18px 18px" }}>No details available.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}