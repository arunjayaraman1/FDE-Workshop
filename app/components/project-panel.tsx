"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DeployRun, Project, ProjectRole, ProjectStatusResult } from "@/lib/types";
import { getStatusMeta } from "./status-meta";
import { formatRelative, formatDateTime, shortSha } from "@/lib/format";
import {
  Card,
  CardHeader,
  CopyButton,
  EmptyState,
  IconBox,
  IconClock,
  IconExternal,
  IconGitHub,
  IconMore,
  IconRefresh,
  IconRocket,
  IconTrash,
} from "./ui";
import LogsModal from "./logs-modal";
import DeleteProjectModal from "./delete-project-modal";
import EnvPanel from "./env-panel";
import BindingsPanel from "./bindings-panel";
import PreviewPanel from "./preview-panel";
import ProvisionPanel from "./provision-panel";
import ActivityPanel from "./activity-panel";
import MembersPanel from "./members-panel";
import AccessPanel from "./access-panel";

interface ProjectTemplateInfo {
  name: string;
  source: string;
  stack: string;
  buildCommand: string;
  setup: string;
  deployCommand: string;
  requiresRoute: boolean;
  fileCount: number;
}

interface ProjectPanelProps {
  project: Project;
  template: ProjectTemplateInfo;
  liveUrl: string | null;
  initialStatus: ProjectStatusResult | null;
  initialError: string | null;
  role: ProjectRole;
}

function runMeta(run: DeployRun) {
  if (run.status === "queued") return getStatusMeta("queued");
  if (run.status === "in_progress") return getStatusMeta("running");
  if (run.status === "completed") {
    if (run.conclusion === "success") return getStatusMeta("success");
    if (run.conclusion === "failure") return getStatusMeta("failure");
    if (run.conclusion === "cancelled") return getStatusMeta("cancelled");
  }
  return getStatusMeta("unknown");
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function Meta({ label, value, copy }: { label: string; value: ReactNode; copy?: string }) {
  return (
    <span className="meta-i">
      <span className="k">{label}</span>
      <span className="val">{value}</span>
      {copy && <CopyButton text={copy} iconOnly />}
    </span>
  );
}

function OverflowMenu({
  onViewRepo,
  onDelete,
}: {
  onViewRepo: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="goto-cell" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={open}
        className="kebab"
      >
        <IconMore />
      </button>
      <div className={`menu${open ? " open" : ""}`}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onViewRepo();
          }}
          className="menu-item"
        >
          <IconExternal />
          View repo
        </button>
        <div className="menu-sep" />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="menu-item danger"
        >
          <IconTrash />
          Delete project
        </button>
      </div>
    </div>
  );
}

// ── Tab types ────────────────────────────────────────────────────────────────
type TabId = "overview" | "deploys" | "env" | "bindings" | "members" | "access" | "activity";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "deploys", label: "Deploy History" },
  { id: "env", label: "Environment" },
  { id: "bindings", label: "Bindings" },
  { id: "members", label: "Members" },
  { id: "access", label: "Access" },
  { id: "activity", label: "Activity" },
];

// Static branch list for live logs
const BRANCHES = ["main", "dev", "staging", "feature/preview", "fix/hotfix"];

export default function ProjectPanel({
  project,
  template,
  liveUrl,
  initialStatus,
  initialError,
  role,
}: ProjectPanelProps) {
  const [status, setStatus] = useState<ProjectStatusResult | null>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState(false);
  const [logsRun, setLogsRun] = useState<number | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [liveLogsBranch, setLiveLogsBranch] = useState("main");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/status`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data as ProjectStatusResult);
        setError(null);
      } else {
        setError(data.error ?? "Failed to fetch status.");
      }
    } catch {
      setError("Failed to reach the Launchpad server.");
    }
  }, [project.id]);

  useEffect(() => {
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleRedeploy() {
    setRedeploying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/redeploy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to trigger re-deploy.");
        return;
      }
      setNotice("Re-deploy triggered — a new workflow run is starting.");
      await refresh();
    } catch {
      setError("Network error while triggering re-deploy.");
    } finally {
      setRedeploying(false);
    }
  }

  const meta = getStatusMeta(status?.status);
  const latest = status?.latest;
  const runs = status?.runs ?? [];
  const displayLiveUrl = status?.liveUrl ?? liveUrl;

  const platformLabel =
    project.provider === "aws"
      ? project.type === "amplify"
        ? "AWS Amplify"
        : "AWS Lambda"
      : project.type === "pages"
        ? "Pages"
        : "Workers";

  const routeHint =
    project.route ??
    (project.provider === "aws"
      ? project.type === "amplify"
        ? "Amplify app URL"
        : "API Gateway URL"
      : project.type === "pages"
        ? "<name>.pages.dev"
        : "<name>.workers.dev");

  const heroStatus = `rh-status ${meta.dotClass}${meta.pulse ? " pulse" : ""}`;

  const supportsLiveLogs = project.provider === "cloudflare" && project.type === "worker";

  return (
    <div>
      {/* ══════════════════════════════════════════════
          RESOURCE HEADER
      ══════════════════════════════════════════════ */}
      <div className="reshead">
        <div className="rh-in">
          {/* Breadcrumb */}
          <div className="rh-bread">
            <Link href="/projects">Projects</Link>
            <span className="sep">/</span>
            <span>{project.name}</span>
          </div>

          <div className="rh-main">
            <div className="rh-id">
              <div className="rh-av">{project.name.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="rh-title-row">
                  <h1>{project.name}</h1>
                  <span className={heroStatus}>
                    <span className="dot" />
                    {meta.label}
                  </span>
                </div>
                <div className="rh-tags">
                  <a className="chip-light" href={project.githubUrl} target="_blank" rel="noreferrer">
                    <IconGitHub />
                    {project.owner}/{project.repo}
                  </a>
                  <span className="chip-light">{platformLabel}</span>
                  <span className="chip-light">{template.name}</span>
                </div>
                <div className="rh-meta">
                  <Meta
                    label="Commit"
                    value={
                      latest ? (
                        <a
                          href={`${project.githubUrl}/commit/${latest.headSha}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortSha(latest.headSha)}
                        </a>
                      ) : (
                        "—"
                      )
                    }
                    copy={latest?.headSha ?? undefined}
                  />
                  <Meta label="Platform" value={<span className="normal-case">{platformLabel}</span>} />
                  <Meta
                    label="Route"
                    value={
                      <a
                        href={displayLiveUrl ?? undefined}
                        target={displayLiveUrl ? "_blank" : undefined}
                        rel="noreferrer"
                      >
                        {routeHint}
                      </a>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="rh-actions">
              {displayLiveUrl && (
                <a href={displayLiveUrl} target="_blank" rel="noreferrer" className="btn primary">
                  Visit
                  <IconExternal />
                </a>
              )}
              {displayLiveUrl && <CopyButton text={displayLiveUrl} iconOnly />}
              <button
                type="button"
                id="redeploy-btn"
                onClick={handleRedeploy}
                disabled={redeploying}
                className="btn outline"
              >
                <IconRefresh />
                {redeploying ? "Triggering…" : "Re-deploy"}
              </button>
              <OverflowMenu
                onViewRepo={() => window.open(project.githubUrl, "_blank", "noreferrer")}
                onDelete={() => setShowDelete(true)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="ptabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`ptab${activeTab === tab.id ? " on" : ""}`}
              >
                {tab.label}
                {tab.id === "bindings" && project.provider === "cloudflare" && <span className="cnt">CF</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          NOTICES
      ══════════════════════════════════════════════ */}
      {(error || notice) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {error && (
            <div className="alert-error" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}>{error}</span>
              <button type="button" onClick={() => setError(null)} className="btn ghost sm">
                Dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="alert-ok" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="btn ghost sm">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB CONTENT
      ══════════════════════════════════════════════ */}
      <div
        className={`pane${activeTab === "overview" ? " active" : ""}`}
        role="tabpanel"
      >
        <div className="pane-inner">
          <div className="db-col">
            {/* Stats */}
            <div className="metrics">
              <div className="metric">
                <div className="m-top">
                  <span className="m-lbl">Status</span>
                  <span className="m-badge">
                    <span className={`pdot ${meta.dotClass}`} />
                  </span>
                </div>
                <div className="m-foot">
                  <span className="m-val" style={{ fontSize: 14, fontFamily: "var(--font-sans)", letterSpacing: 0 }}>
                    {meta.label}
                  </span>
                </div>
              </div>
              <div className="metric text">
                <div className="m-top">
                  <span className="m-lbl">Latest Run</span>
                  <span className="m-badge">
                    <IconExternal />
                  </span>
                </div>
                <div className="m-foot">
                  {latest ? (
                    <a href={latest.htmlUrl} target="_blank" rel="noreferrer" className="m-val">
                      #{latest.runId}
                    </a>
                  ) : (
                    <span className="m-val">—</span>
                  )}
                </div>
              </div>
              <div className="metric text">
                <div className="m-top">
                  <span className="m-lbl">Started</span>
                  <span className="m-badge">
                    <IconClock />
                  </span>
                </div>
                <div className="m-foot">
                  <span className="m-val">{formatRelative(latest?.createdAt ?? null)}</span>
                </div>
              </div>
              <div className="metric text">
                <div className="m-top">
                  <span className="m-lbl">Duration</span>
                  <span className="m-badge">
                    <IconRefresh />
                  </span>
                </div>
                <div className="m-foot">
                  <span className="m-val">
                    {formatDuration(latest?.createdAt ?? null, latest?.updatedAt ?? null)}
                  </span>
                </div>
              </div>
              <div className="metric text">
                <div className="m-top">
                  <span className="m-lbl">Total Runs</span>
                  <span className="m-badge">
                    <IconRocket />
                  </span>
                </div>
                <div className="m-foot">
                  <span className="m-val">{status?.totalRuns ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Live URL */}
            <div className="card">
              <CardHeader icon={<IconExternal />} title="Live URL" />
              <div className="card-bd">
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {displayLiveUrl ? (
                    <>
                      <code
                        className="truncate"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          color: "var(--np-teal-700)",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {displayLiveUrl}
                      </code>
                      <CopyButton text={displayLiveUrl} iconOnly />
                      <a
                        href={displayLiveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn outline sm"
                      >
                        Open
                        <IconExternal />
                      </a>
                    </>
                  ) : (
                    <span className="pmute">Not available</span>
                  )}
                </div>
              </div>
            </div>

            {/* Template + Deploy Workflow */}
            <div className="db-col" style={{ gap: 20 }}>
              <Card>
                <CardHeader icon={<IconBox />} title="Template" />
                <div className="card-bd">
                  <dl className="dl">
                    <div className="dl-row">
                      <dt className="k">Name</dt>
                      <dd className="v">{template.name}</dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Source</dt>
                      <dd className="v capitalize">
                        {project.provider === "aws"
                          ? "AWS built-in"
                          : template.source === "c3"
                            ? "create-cloudflare (live)"
                            : "Built-in"}
                      </dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Runtime</dt>
                      <dd className="v">{template.stack}</dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Files</dt>
                      <dd className="v">{template.fileCount}</dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Requires route</dt>
                      <dd className="v">{template.requiresRoute ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                </div>
              </Card>

              <Card>
                <CardHeader icon={<IconRocket />} title="Deploy workflow" />
                <div className="card-bd">
                  <dl className="dl">
                    <div className="dl-row">
                      <dt className="k">Setup</dt>
                      <dd className="v mono" title={template.setup}>
                        {template.setup || "—"}
                      </dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Build</dt>
                      <dd className="v mono" title={template.buildCommand}>
                        {template.buildCommand || "—"}
                      </dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Deploy</dt>
                      <dd className="v mono" title={template.deployCommand}>
                        {template.deployCommand}
                      </dd>
                    </div>
                    <div className="dl-row">
                      <dt className="k">Triggered by</dt>
                      <dd className="v">push to main + workflow_dispatch</dd>
                    </div>
                  </dl>
                  <div className="note" style={{ marginTop: 14 }}>
                    {project.provider === "aws" ? (
                      <>
                        Runs in GitHub Actions using{" "}
                        <code>AWS_ACCESS_KEY_ID</code>, <code>AWS_SECRET_ACCESS_KEY</code> and{" "}
                        <code>AWS_REGION</code> secrets set at launch time (via aws-sam / amplify).
                      </>
                    ) : (
                      <>
                        Runs in GitHub Actions using{" "}
                        <code>CLOUDFLARE_API_TOKEN</code> and{" "}
                        <code>CLOUDFLARE_ACCOUNT_ID</code> secrets set at launch time.
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="aside-col">
            {/* ── Live Logs Panel ── */}
            <div className="wb">
              <div className="wb-bar">
                <div className="wb-tabs" style={{ flex: "none" }}>
                  <span className="wb-tab on">
                    <span className="live-dot" />
                    live tail
                  </span>
                </div>
                <div className="wb-live">
                  {supportsLiveLogs && (
                    <Link
                      href={`/projects/${project.id}/live-logs`}
                      id="open-live-logs-btn"
                      className="btn"
                      style={{
                        background: "rgba(8,189,184,0.16)",
                        border: "1px solid rgba(8,189,184,0.3)",
                        color: "var(--np-teal-soft)",
                      }}
                    >
                      Open
                    </Link>
                  )}
                </div>
              </div>
              <div className="wb-body" style={{ height: "auto", padding: "12px 14px" }}>
                <div
                  className="wblog"
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div className="logline">
                    <span className="lvl ok">ok</span>
                    <span className="msg">
                      {supportsLiveLogs
                        ? "Tail is offline — pick a branch and open Live Logs."
                        : "Live logs are only supported for Cloudflare Workers projects."}
                    </span>
                  </div>
                  <div className="logline">
                    <span className="lvl info">info</span>
                    <span className="msg">poll /api/projects/{project.id}/status every 6s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Deployments */}
            {project.provider === "cloudflare" && (
              <PreviewPanel
                projectId={project.id}
                projectName={project.name}
                projectType={project.type}
              />
            )}

            {/* Provisioning from code */}
            {project.provider === "cloudflare" && (
              <ProvisionPanel projectId={project.id} projectType={project.type} />
            )}

            {/* Activity */}
            <ActivityPanel projectName={project.name} />
          </div>
        </div>
      </div>

      {/* ── DEPLOY HISTORY TAB ── */}
      {activeTab === "deploys" && (
        <div
          className={`pane${activeTab === "deploys" ? " active" : ""}`}
          role="tabpanel"
        >
          <Card>
            <CardHeader
              icon={<IconClock />}
              title="Deploy history"
              count={runs.length}
              action={
                latest ? (
                  <a
                    href={latest.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link"
                  >
                    View workflow runs ↗
                  </a>
                ) : undefined
              }
            />
            {runs.length === 0 ? (
              <EmptyState
                icon={<IconRocket className="icon" />}
                title="No deploys yet"
                hint="Push to main or hit Re-deploy to trigger the first workflow run."
              />
            ) : (
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Status</th>
                      <th>Commit</th>
                      <th>Started</th>
                      <th className="!text-right">Duration</th>
                      <th className="!text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const rm = runMeta(run);
                      return (
                        <tr key={run.runId}>
                          <td>
                            <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="link">
                              #{run.runId}
                            </a>
                          </td>
                          <td>
                            <span className={rm.className} title={run.status}>
                              <span className="dot" />
                              {rm.label}
                            </span>
                          </td>
                          <td>
                            <a
                              href={`${project.githubUrl}/commit/${run.headSha}`}
                              target="_blank"
                              rel="noreferrer"
                              className="url-cell"
                            >
                              {shortSha(run.headSha)}
                            </a>
                          </td>
                          <td className="rel" title={formatDateTime(run.createdAt)}>
                            {formatRelative(run.createdAt)}
                          </td>
                          <td className="rel">
                            {formatDuration(run.createdAt, run.updatedAt)}
                          </td>
                          <td>
                            <div className="row-act">
                              <button
                                type="button"
                                onClick={() => setLogsRun(run.runId)}
                                className="btn ghost sm"
                              >
                                Logs
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── ENVIRONMENT TAB ── */}
      {activeTab === "env" && (
        <div className="pane active" role="tabpanel">
          <EnvPanel projectId={project.id} />
        </div>
      )}

      {/* ── BINDINGS TAB ── */}
      {activeTab === "bindings" && project.provider === "cloudflare" && (
        <div className="pane active" role="tabpanel">
          <BindingsPanel projectId={project.id} />
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {activeTab === "members" && (
        <div className="pane active" role="tabpanel">
          <MembersPanel
            projectId={project.id}
            projectName={project.name}
            role={role}
            canManage={role === "owner"}
          />
        </div>
      )}

      {/* ── ACCESS TAB ── */}
      {activeTab === "access" && (
        <div className="pane active" role="tabpanel">
          <AccessPanel
            projectId={project.id}
            projectName={project.name}
            canManage={role === "owner"}
          />
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {activeTab === "activity" && (
        <div className="pane active" role="tabpanel">
          <ActivityPanel projectName={project.name} />
        </div>
      )}

      {/* ── Modals ── */}
      {logsRun !== null && (
        <LogsModal
          projectId={project.id}
          runId={logsRun}
          onClose={() => setLogsRun(null)}
        />
      )}

      {showDelete && (
        <DeleteProjectModal
          project={project}
          onClose={() => setShowDelete(false)}
          onDeleted={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}