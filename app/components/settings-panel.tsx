"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, ConfigStatus } from "@/lib/types";

interface SettingsPanelProps {
  initialStatus: ConfigStatus;
}

function ShieldIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default function SettingsPanel({ initialStatus }: SettingsPanelProps) {
  const [status, setStatus] = useState<ConfigStatus>(initialStatus);
  const [accountId, setAccountId] = useState(initialStatus.defaultAccountId);
  const [awsRegion, setAwsRegion] = useState(initialStatus.awsRegion || "us-east-1");
  const [patEnvVar, setPatEnvVar] = useState("GITHUB_PAT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [audits, setAudits] = useState<AuditEntry[]>([]);

  useEffect(() => {
    fetch("/api/audit?limit=50")
      .then((r) => r.json())
      .then((data) => setAudits(data.audits ?? []))
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultAccountId: accountId, patEnvVar, awsRegion }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save config.");
        return;
      }
      setStatus(data.status);
      setSaved(true);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<{ label: string; ok: boolean; hint: string }> = [
    {
      label: "Admin password",
      ok: status.adminPasswordSet,
      hint: "LAUNCHPAD_ADMIN_PASSWORD — required to sign in.",
    },
    {
      label: "GitHub PAT env",
      ok: status.patEnvSet,
      hint: `${patEnvVar} (or launchpad.json patEnvVar) — used for GitHub operations.`,
    },
    {
      label: "Cloudflare API token",
      ok: status.cloudflareTokenSet,
      hint: "CLOUDFLARE_API_TOKEN — used for deploys and env vars.",
    },
    {
      label: "Cloudflare account ID",
      ok: Boolean(status.defaultAccountId),
      hint: status.defaultAccountId || "Set below or via CLOUDFLARE_ACCOUNT_ID.",
    },
    {
      label: "AWS access key env",
      ok: status.awsAccessKeySet,
      hint: "AWS_ACCESS_KEY_ID (config) — used for AWS deploys and env vars.",
    },
    {
      label: "AWS secret key env",
      ok: status.awsSecretKeySet,
      hint: "AWS_SECRET_ACCESS_KEY (config) — used for AWS deploys and env vars.",
    },
    {
      label: "AWS default region",
      ok: Boolean(status.awsRegion),
      hint: status.awsRegion || "us-east-1 (default).",
    },
    {
      label: "Secret key",
      ok: status.secretKeySet,
      hint: "LAUNCHPAD_SECRET — encrypts persisted GitHub tokens at rest.",
    },
    {
      label: "Target GitHub org",
      ok: Boolean(status.org),
      hint: status.org || "Not set — repos are created under the token owner's account.",
    },
  ];

  return (
    <div className="set-grid">
      <div className="card">
        <div className="set-card-hd">
          <ShieldIcon />
          <div>
            <h3>Security status</h3>
            <p>Live health of the credentials Launchpad needs to do its job.</p>
          </div>
        </div>
        <div className="set-body">
          {rows.map((r) => (
            <div className="toggle-row" key={r.label}>
              <div className="min-w-0 flex-1">
                <div className="tr-name">{r.label}</div>
                <div className="tr-desc">{r.hint}</div>
              </div>
              <span className={`pill${r.ok ? " ok" : " warn"}`}>
                <span className="dot" />
                {r.ok ? "OK" : "Missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="card">
        <div className="set-card-hd">
          <GearIcon />
          <div>
            <h3>Launchpad config</h3>
            <p>Defaults used at launch time. Per-project overrides win.</p>
          </div>
        </div>
        <div className="set-body">
          <div className="field">
            <label htmlFor="cf-account">Default Cloudflare account ID</label>
            <input
              id="cf-account"
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="32-char Cloudflare account ID"
              autoComplete="off"
            />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="pat-var">GitHub PAT env var name</label>
            <input
              id="pat-var"
              className="input"
              value={patEnvVar}
              onChange={(e) => setPatEnvVar(e.target.value)}
              placeholder="GITHUB_PAT"
              autoComplete="off"
            />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="aws-region">Default AWS region</label>
            <input
              id="aws-region"
              className="input"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              placeholder="us-east-1"
              autoComplete="off"
            />
            <p className="hint">Used for AWS deployments. Overridable per project at launch.</p>
          </div>

          {error && <div className="alert-error">{error}</div>}
          {saved && <div className="alert-ok">Config saved.</div>}

          <button
            type="submit"
            disabled={saving}
            className="btn primary"
            style={{ width: "100%", marginTop: 14 }}
          >
            {saving ? "Saving…" : "Save config"}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="set-card-hd">
          <PulseIcon />
          <div>
            <h3>Recent activity</h3>
            <p>{audits.length} audit entries</p>
          </div>
        </div>
        <div className="set-body" style={{ padding: 0 }}>
          {audits.length === 0 ? (
            <p style={{ padding: "18px", fontSize: 13, color: "var(--text-3)" }}>
              No activity recorded yet.
            </p>
          ) : (
            <div className="audit-table">
              {audits.map((a, i) => (
                <div className="toggle-row" key={i} style={{ padding: "11px 18px" }}>
                  <div className="min-w-0 flex-1">
                    <div className="tr-name" style={{ fontSize: 13 }}>
                      <span>{a.actor}</span> <span style={{ color: "var(--text-3)", fontWeight: 500 }}>{a.action}</span>
                    </div>
                    <div className="tr-desc">{a.project ? `${a.project} — ` : ""}{a.detail}</div>
                  </div>
                  <span className={`pill ${a.outcome}`}>
                    <span className="dot" />
                    {a.outcome}
                  </span>
                  <span className="rel" style={{ fontSize: 11.5 }}>{new Date(a.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}