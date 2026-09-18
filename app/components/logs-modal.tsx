"use client";

import { useEffect, useState } from "react";
import type { RunLog } from "@/lib/types";

interface LogsModalProps {
  projectId: string;
  runId: number;
  onClose: () => void;
}

function stepPill(s: RunLog["steps"][number]): { label: string; className: string } {
  if (s.status === "completed" && s.conclusion === "success")
    return { label: s.conclusion ?? "completed", className: "pill ok" };
  if (s.status === "in_progress") return { label: "in progress", className: "pill info" };
  if (s.conclusion === "failure") return { label: "failed", className: "pill err" };
  return { label: s.status, className: "pill flat" };
}

export default function LogsModal({ projectId, runId, onClose }: LogsModalProps) {
  const [log, setLog] = useState<RunLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/logs?run=${runId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setLog(data as RunLog);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to fetch logs.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, runId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal show" role="dialog" aria-modal="true">
      <div className="backdrop" onClick={onClose} />
      <div className="dialog lg">
        <div className="dlg-head">
          <div>
            <h3>Deploy log — run #{runId}</h3>
            <p>Steps and output from the latest deploy of this project.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="dlg-x">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="dlg-body">
          {error && <div className="alert-error" style={{ marginBottom: 14 }}>{error}</div>}

          {log?.steps && log.steps.length > 0 && (
            <div className="tblwrap" style={{ marginBottom: 16 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th className="!text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {log.steps.map((s, i) => {
                    const p = stepPill(s);
                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{s.name}</td>
                        <td>
                          <div className="row-act" style={{ justifyContent: "flex-end" }}>
                            <span className={p.className}>{p.label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {log?.text ? (
            <pre className="log-pre" style={{ whiteSpace: "pre-wrap" }}>
              {log.text}
            </pre>
          ) : (
            !error && <p className="pmute">Loading logs…</p>
          )}
        </div>
      </div>
    </div>
  );
}