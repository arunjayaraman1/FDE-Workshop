"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { formatRelative, formatDateTime } from "@/lib/format";
import { SkeletonList } from "./skeleton";
import { Card, CardHeader, IconActivity, IconRefresh } from "./ui";

interface ActivityPanelProps {
  projectName: string;
}

const ACTION_META: Record<AuditEntry["action"], { label: string; icon: string; dot: string }> = {
  login: { label: "Signed in", icon: "●", dot: "flat" },
  logout: { label: "Signed out", icon: "●", dot: "flat" },
  launch: { label: "Project launched", icon: "▲", dot: "ok" },
  launch_failed: { label: "Launch failed", icon: "▲", dot: "err" },
  redeploy: { label: "Re-deploy triggered", icon: "↻", dot: "info" },
  delete: { label: "Project deleted", icon: "✕", dot: "err" },
  env_set: { label: "Env variable set", icon: "＋", dot: "warn" },
  env_delete: { label: "Env variable removed", icon: "−", dot: "warn" },
  binding_add: { label: "Binding added", icon: "＋", dot: "purple" },
  binding_remove: { label: "Binding removed", icon: "−", dot: "purple" },
  preview_enable: { label: "Previews enabled", icon: "◈", dot: "ok" },
  preview_disable: { label: "Previews disabled", icon: "◇", dot: "ok" },
  provision_enable: { label: "Provisioning enabled", icon: "◈", dot: "info" },
  provision_disable: { label: "Provisioning disabled", icon: "◇", dot: "info" },
  config_applied: { label: "Launch config applied", icon: "◈", dot: "ok" },
  invite_create: { label: "Invite created", icon: "＋", dot: "info" },
  invite_revoke: { label: "Invite revoked", icon: "−", dot: "warn" },
  invite_accept: { label: "Invite accepted", icon: "✓", dot: "ok" },
  member_add: { label: "Member added", icon: "＋", dot: "ok" },
  member_remove: { label: "Member removed", icon: "−", dot: "err" },
  member_role_change: { label: "Member role changed", icon: "◈", dot: "info" },
  collaborator_add: { label: "GitHub collaborator added", icon: "◈", dot: "purple" },
  collaborator_remove: { label: "GitHub collaborator removed", icon: "◇", dot: "purple" },
  site_access_enable: { label: "Site access enabled", icon: "🔒", dot: "ok" },
  site_access_disable: { label: "Site access disabled", icon: "🔓", dot: "flat" },
  site_access_rotate: { label: "Site access key rotated", icon: "⟳", dot: "warn" },
};

const DOT_COLOR: Record<string, string> = {
  ok: "#1faf74",
  info: "#0ea5e9",
  warn: "#d99a06",
  err: "#ef4444",
  purple: "#8a63d2",
  flat: "var(--text-4)",
};

export default function ActivityPanel({ projectName }: ActivityPanelProps) {
  const [audits, setAudits] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/audit?project=${encodeURIComponent(projectName)}&limit=20`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setAudits(data.audits ?? []);
        setError(null);
      } else {
        setError(data.error ?? "Failed to load activity.");
      }
    } catch {
      setError("Failed to reach the Launchpad server.");
    }
  }, [projectName]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        icon={<IconActivity className="icon" />}
        title="Activity"
        count={audits ? audits.length : undefined}
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn ghost sm"
          >
            <IconRefresh />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="alert-error" style={{ margin: "0 18px", marginTop: 14 }}>
          {error}
        </div>
      )}

      <div style={{ padding: "8px 18px 18px" }}>
        {audits === null ? (
          <SkeletonList rows={4} />
        ) : audits.length === 0 ? (
          <p className="pmute" style={{ padding: "8px 0" }}>
            No activity recorded yet. Deploys, env changes, bindings, and preview toggles will show
            up here.
          </p>
        ) : (
          <ul className="tl-mini">
            {audits.map((a, i) => {
              const meta = ACTION_META[a.action] ?? {
                label: a.action,
                icon: "●",
                dot: "flat",
              };
              return (
                <li key={i} className={`tl-row ${meta.dot}`}>
                  <span className="tl-dot" style={{ background: DOT_COLOR[meta.dot] }} />
                  <div className="tl-main">
                    <div className="tl-t">
                      {meta.icon}
                      {meta.label}
                    </div>
                    <div className="tl-s">
                      {a.actor}
                      {a.detail ? ` — ${a.detail}` : ""}
                    </div>
                  </div>
                  <time
                    className="tl-when"
                    title={formatDateTime(a.at)}
                    dateTime={a.at}
                  >
                    {formatRelative(a.at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}