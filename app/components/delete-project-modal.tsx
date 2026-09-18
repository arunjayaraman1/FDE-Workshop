"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";

interface DeleteProjectModalProps {
  project: Project;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function DeleteProjectModal({ project, onClose, onDeleted }: DeleteProjectModalProps) {
  const router = useRouter();
  const [deleteRepo, setDeleteRepo] = useState(true);
  const [deleteCloudflare, setDeleteCloudflare] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirm.trim() === project.name;
  const busy = deleting || !confirmed;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deleteRepo, deleteCloudflare }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete project.");
        setDeleting(false);
        return;
      }
      onClose();
      if (onDeleted) onDeleted();
      else router.push("/projects");
      router.refresh();
    } catch {
      setError("Network error while deleting.");
      setDeleting(false);
    }
  }

  return (
    <div className="modal show" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="dialog sm">
        <div className="dlg-head">
          <div>
            <h3>Delete {project.name}?</h3>
            <p>
              This removes the project from Launchpad and deletes the resources you select below.
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
              <span>
                Delete the GitHub repo{" "}
                <span className="url-cell" style={{ display: "inline" }}>
                  {project.owner}/{project.repo}
                </span>
              </span>
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
              <span>
                Delete the{" "}
                {project.provider === "aws" ? (
                  project.type === "amplify" ? "AWS Amplify app" : "AWS Lambda stack"
                ) : (
                  <>
                    Cloudflare {project.type === "pages" ? "Pages" : "Workers"} project
                  </>
                )}
              </span>
            </label>
          </div>

          <div className="field">
            <label>
              Type{" "}
              <span className="url-cell" style={{ display: "inline" }}>
                {project.name}
              </span>{" "}
              to confirm
            </label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && <div className="alert-error" style={{ marginTop: 14 }}>{error}</div>}
        </div>

        <div className="dlg-foot">
          <button type="button" onClick={onClose} disabled={deleting} className="btn ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="btn danger"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}