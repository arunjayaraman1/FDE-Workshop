"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeployTarget } from "@/lib/types";
import { SkeletonList } from "./skeleton";
import { Card, CardHeader } from "./ui";

interface PreviewDeployment {
  branch: string;
  previewName: string;
  url: string | null;
  running: boolean;
  sha: string;
  createdOn: string | null;
  modifiedOn: string | null;
}

interface PreviewInfo {
  enabled: boolean;
  previews: PreviewDeployment[];
  warning: string | null;
}

interface PreviewPanelProps {
  projectId: string;
  projectName: string;
  projectType: DeployTarget;
}

export default function PreviewPanel({ projectId, projectName, projectType }: PreviewPanelProps) {
  const [info, setInfo] = useState<PreviewInfo>({ enabled: false, previews: [], warning: null });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback((data: PreviewInfo) => {
    setInfo({
      enabled: data.enabled ?? false,
      previews: data.previews ?? [],
      warning: data.warning ?? null,
    });
    setError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        apply(data);
      } else {
        setError(data.error ?? "Failed to load preview settings.");
      }
    } catch {
      setError("Failed to reach the Launchpad server.");
    } finally {
      setLoaded(true);
    }
  }, [projectId, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update preview settings.");
        return;
      }
      setNotice(
        next
          ? "Preview deployments enabled. Push to any branch to spin up a preview worker."
          : "Preview deployments disabled. Teardown runs for existing previews on their next branch event."
      );
      await load();
    } catch {
      setError("Network error while updating preview settings.");
    } finally {
      setBusy(false);
    }
  }

  if (projectType !== "worker") {
    return (
      <Card>
        <CardHeader title="Preview deployments" />
        <div className="card-bd">
          <p className="pmute">
            Per-branch preview deployments are not yet supported for Pages projects.
          </p>
        </div>
      </Card>
    );
  }

  const runningCount = info.previews.filter((p) => p.running).length;

  return (
    <Card>
      <CardHeader
        title="Preview deployments"
        count={info.previews.length}
        action={
          <span className={`pill${info.enabled ? " ok" : " flat"}`}>
            <span className="dot" />
            {info.enabled ? "Enabled" : "Disabled"}
          </span>
        }
      />

      {error && (
        <div className="alert-error" style={{ margin: "0 18px", marginTop: 14 }}>
          {error}
        </div>
      )}

      {notice && (
        <div className="alert-ok" style={{ margin: "0 18px", marginTop: 14 }}>
          {notice}
        </div>
      )}

      {info.warning && (
        <div className="alert-error" style={{ margin: "0 18px", marginTop: 14 }}>
          {info.warning}
        </div>
      )}

      <div style={{ padding: "16px 18px" }}>
        {!loaded ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            {info.previews.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div
                  className="pmute"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span>
                    {runningCount} of {info.previews.length} branches deployed
                  </span>
                  <span>Click a branch for details</span>
                </div>
                <div>
                  {info.previews.map((p) => (
                    <div key={p.branch} className="pl-row">
                      <Link
                        href={`/projects/${projectId}/preview/${encodeURIComponent(p.branch)}`}
                        className="pl-br"
                      >
                        <span className={`dot${p.running ? "" : " off"}`} />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 600,
                            color: "var(--text)",
                          }}
                        >
                          {p.branch}
                        </span>
                      </Link>
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="pl-url"
                        >
                          {p.url.replace(/^https:\/\//, "")}
                        </a>
                      ) : (
                        <span className="pmute" style={{ fontSize: 11 }}>
                          {p.running ? "deploying…" : "not deployed"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="pmute" style={{ marginBottom: 14 }}>
                {info.enabled
                  ? "No branches with previews yet. Push to any branch (other than main) to deploy one."
                  : "Preview deployments are off. Enable them to get a preview worker for every branch."}
              </p>
            )}

            <button
              type="button"
              onClick={() => toggle(!info.enabled)}
              disabled={busy}
              className={`btn${info.enabled ? " danger" : " primary"}`}
            >
              {busy ? "…" : info.enabled ? "Disable previews" : "Enable previews"}
            </button>
          </>
        )}
      </div>

      <div className="note" style={{ margin: "0 18px 18px" }}>
        Each branch gets its own worker{" "}
        <code>{projectName}-&#123;branch&#125;</code>, with separate KV/D1/R2 resources and the
        same environment variables as this project. Workers are torn down when the branch is
        deleted or its PR closes.
      </div>
    </Card>
  );
}