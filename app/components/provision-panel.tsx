"use client";

import { useEffect, useState } from "react";
import type { DeployTarget } from "@/lib/types";
import { Card, CardHeader } from "./ui";

interface ProvisionPanelProps {
  projectId: string;
  projectType: DeployTarget;
}

export default function ProvisionPanel({ projectId, projectType }: ProvisionPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/provision`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setEnabled(Boolean(data.enabled));
          setError(null);
        } else {
          setError(data.error ?? "Failed to load provisioning settings.");
        }
      } catch {
        if (!cancelled) setError("Failed to reach the Launchpad server.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/provision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update provisioning settings.");
        return;
      }
      setEnabled(next);
      setNotice(
        next
          ? "Provisioning from code enabled. Edit wrangler.toml (or .launchpad/env-values.enc) and push to main to provision resources."
          : "Provisioning from code disabled. The provision step and script were removed from the repo."
      );
    } catch {
      setError("Network error while updating provisioning settings.");
    } finally {
      setBusy(false);
    }
  }

  if (projectType !== "worker") {
    return (
      <Card>
        <CardHeader title="Provisioning from code" />
        <div className="card-bd">
          <p className="pmute">
            Provisioning from pushed code is not supported for Pages projects.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Provisioning from code"
        action={
          <span className={`pill${enabled ? " ok" : " flat"}`}>
            <span className="dot" />
            {enabled ? "Enabled" : "Disabled"}
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

      <div style={{ padding: "16px 18px" }}>
        {!loaded ? (
          <p className="pmute">Loading…</p>
        ) : (
          <>
            <p className="pmute" style={{ marginBottom: 14, lineHeight: 1.55 }}>
              Provision resources by editing files and pushing, without using Launchpad. KV, D1
              and R2 bindings without IDs are created automatically on{" "}
              <code style={{ fontFamily: "var(--font-mono)", color: "var(--np-teal-700)" }}>
                wrangler deploy
              </code>
              . AI Search instances and Turnstile widgets are created by a provision step before
              deploy.
            </p>

            <button
              type="button"
              onClick={() => toggle(!enabled)}
              disabled={busy}
              className={`btn${enabled ? " danger" : " primary"}`}
            >
              {busy ? "…" : enabled ? "Disable provisioning" : "Enable provisioning"}
            </button>
          </>
        )}
      </div>

      <div className="codebox" style={{ margin: "0 18px 18px" }}>
        <span className="c">[[kv_namespaces]]</span> binding = &quot;CACHE&quot;{" "}
        <span className="dim"># no id → created on push</span>
      </div>
    </Card>
  );
}