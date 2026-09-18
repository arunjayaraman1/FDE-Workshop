"use client";

import { useCallback, useEffect, useState } from "react";
import type { EnvVar } from "@/lib/types";
import { SkeletonList } from "./skeleton";
import { Card, CardHeader, IconKey, IconRefresh } from "./ui";

interface EnvPanelProps {
  projectId: string;
}

export default function EnvPanel({ projectId }: EnvPanelProps) {
  const [env, setEnv] = useState<EnvVar[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSecret, setIsSecret] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/env`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setEnv(data.env ?? []);
        setError(null);
      } else {
        setError(data.error ?? "Failed to load env vars.");
      }
    } catch {
      setError("Failed to reach the Launchpad server.");
    } finally {
      setLoaded(true);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/env`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value, secret: isSecret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to set env var.");
        return;
      }
      setKey("");
      setValue("");
      await load();
    } catch {
      setError("Network error while saving env var.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(k: string) {
    setDeletingKey(k);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/env/${k}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete env var.");
        return;
      }
      await load();
    } catch {
      setError("Network error while deleting env var.");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<IconKey className="icon" />}
        title="Environment variables"
        count={loaded ? env.length : undefined}
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

      <div style={{ padding: "0 18px" }}>
        {!loaded ? (
          <SkeletonList rows={3} />
        ) : env.length === 0 && !error ? (
          <p className="pmute" style={{ padding: "12px 0" }}>
            No environment variables set. These are injected into the worker at runtime.
          </p>
        ) : (
          <div>
            {env.map((v) => (
              <div key={v.key} className="kv-row">
                <span className="k">{v.key}</span>
                <span
                  className={`pill${v.kind === "secret" ? " warn" : " flat"}`}
                  style={{ flexShrink: 0 }}
                >
                  {v.kind}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => handleDelete(v.key)}
                  disabled={deletingKey === v.key}
                  className="btn ghost sm danger-hover"
                >
                  {deletingKey === v.key ? "…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={handleAdd}
        style={{
          marginTop: 14,
          borderTop: "1px solid var(--np-line)",
          padding: "16px 18px 18px",
        }}
      >
        <div className="form-grid">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="env-key">Key</label>
            <input
              id="env-key"
              className="input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="MY_KEY"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="env-value">Value</label>
            <input
              id="env-value"
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="my-value"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 14,
          }}
        >
          <label className="check">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
            />
            Encrypt as a secret (not visible in the dashboard)
          </label>
          <button
            type="submit"
            disabled={saving || !key.trim() || !value.trim()}
            className="btn primary"
          >
            {saving ? "Adding…" : "Add var"}
          </button>
        </div>
      </form>
    </Card>
  );
}