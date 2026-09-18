"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

interface BulkDeleteProjectsModalProps {
  projects: Project[];
  onClose: () => void;
  onCompleted: () => void;
}

interface BulkResult {
  deleted: number;
  failed: Array<{ name: string; error: string }>;
  warnings: string[];
}

export default function BulkDeleteProjectsModal({
  projects,
  onClose,
  onCompleted,
}: BulkDeleteProjectsModalProps) {
  const [deleteRepo, setDeleteRepo] = useState(true);
  const [deleteCloudflare, setDeleteCloudflare] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const count = projects.length;
  const confirmed = confirm.trim() === String(count);
  const busy = deleting || !confirmed;
  const hasAws = projects.some((p) => p.provider === "aws");
  const allAws = count > 0 && projects.every((p) => p.provider === "aws");
  const cloudLabel = allAws
    ? "Delete the AWS projects"
    : hasAws
      ? "Delete the Cloudflare and AWS projects"
      : "Delete the Cloudflare projects";

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: projects.map((p) => p.id),
          deleteRepo,
          deleteCloudflare,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete projects.");
        setDeleting(false);
        return;
      }
      setResult({
        deleted: data.deleted ?? 0,
        failed: data.failed ?? [],
        warnings: data.warnings ?? [],
      });
      setDeleting(false);
    } catch {
      setError("Network error while deleting.");
      setDeleting(false);
    }
  }

  return (
    <div className="modal show" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="dialog">
        <div className="dlg-head">
          <div>
            <h3>
              Delete {count} project{count === 1 ? "" : "s"}?
            </h3>
            <p>
              This removes the projects from Launchpad and deletes the resources you select below.
              This cannot be undone.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="dlg-x">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="dlg-body">
          <div
            style={{
              maxHeight: 150,
              overflowY: "auto",
              border: "1px solid var(--np-line)",
              borderRadius: 11,
              padding: "8px 12px",
              marginBottom: 14,
            }}
          >
            {projects.map((p) => (
              <div key={p.id} className="goto-row" style={{ padding: "5px 0" }}>
                <span className="url-cell" style={{ color: "var(--text-2)" }}>
                  {p.name}
                </span>
                <span className="pmute" style={{ fontFamily: "var(--font-mono)", flex: 1 }}>
                  {p.owner}/{p.repo}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label
              className="check"
              style={{
                border: "1px solid var(--np-line)",
                borderRadius: 11,
                padding: "12px 14px",
                width: "100%",
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                checked={deleteRepo}
                onChange={(e) => setDeleteRepo(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>Delete the GitHub repos</span>
            </label>
            <label
              className="check"
              style={{
                border: "1px solid var(--np-line)",
                borderRadius: 11,
                padding: "12px 14px",
                width: "100%",
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                checked={deleteCloudflare}
                onChange={(e) => setDeleteCloudflare(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>{cloudLabel}</span>
            </label>
          </div>

          <div className="field">
            <label>
              Type <span className="url-cell" style={{ display: "inline" }}>{count}</span> to confirm
            </label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.deleted > 0 && (
                <div className="alert-ok">
                  Deleted {result.deleted} project{result.deleted === 1 ? "" : "s"}.
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="alert-error">
                  {result.failed.map((f) => (
                    <p key={f.name}>
                      <span className="url-cell" style={{ display: "inline" }}>{f.name}</span>: {f.error}
                    </p>
                  ))}
                </div>
              )}
              {result.warnings.length > 0 && (
                <p className="pmute" style={{ fontSize: 12 }}>
                  {result.warnings.join(" ")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="dlg-foot">
          {result ? (
            <button type="button" onClick={onCompleted} className="btn primary">
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={deleting} className="btn ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="btn danger"
              >
                {deleting ? "Deleting…" : `Delete ${count}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}