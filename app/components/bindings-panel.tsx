"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Binding, BindingResource, BindingType } from "@/lib/types";
import { SkeletonList } from "./skeleton";
import { Card, CardHeader, IconBox, IconRefresh } from "./ui";

interface BindingsPanelProps {
  projectId: string;
}

const TYPE_OPTIONS: Array<{ value: BindingType; label: string }> = [
  { value: "kv", label: "KV" },
  { value: "d1", label: "D1" },
  { value: "r2", label: "R2" },
  { value: "turnstile", label: "Turnstile" },
  { value: "ai_search", label: "AI Search" },
];

const TYPE_HINTS: Record<BindingType, string> = {
  kv: "Workers KV namespace",
  d1: "D1 SQL database",
  r2: "R2 bucket",
  turnstile: "CAPTCHA widget",
  ai_search: "Searchable instance",
};

const TYPE_BADGE: Record<BindingType, string> = {
  kv: "pill info",
  d1: "pill ok",
  r2: "pill purple",
  turnstile: "pill warn",
  ai_search: "pill flat",
};

const RESOURCE_NOUN: Record<BindingType, string> = {
  kv: "namespace",
  d1: "database",
  r2: "bucket",
  turnstile: "widget",
  ai_search: "instance",
};

export default function BindingsPanel({ projectId }: BindingsPanelProps) {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [resources, setResources] = useState<BindingResource[]>([]);
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<BindingType>("kv");
  const [name, setName] = useState("");
  const [useExisting, setUseExisting] = useState(false);
  const [resourceName, setResourceName] = useState("");
  const [existingName, setExistingName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/bindings`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setBindings(data.bindings ?? []);
        setResources(data.resources ?? []);
        setConfigPath(data.configPath ?? null);
        setError(null);
      } else {
        setError(data.error ?? "Failed to load bindings.");
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

  const typeResources = useMemo(
    () => resources.filter((r) => r.type === type),
    [resources, type]
  );

  function switchType(next: BindingType) {
    setType(next);
    setExistingName("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bindings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          resource: useExisting ? existingName : resourceName,
          domain: type === "turnstile" && !useExisting ? domain : undefined,
          existing: useExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add binding.");
        return;
      }
      setName("");
      setResourceName("");
      setExistingName("");
      setDomain("");
      setUseExisting(false);
      setNotice(data.warning ?? "Binding added. A redeploy has been triggered in the repo.");
      await load();
    } catch {
      setError("Network error while adding binding.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(binding: Binding) {
    setDeleting(binding.name);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bindings/${binding.name}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to remove binding.");
        return;
      }
      setNotice("Binding removed. A redeploy has been triggered in the repo.");
      await load();
    } catch {
      setError("Network error while removing binding.");
    } finally {
      setDeleting(null);
    }
  }

  const addDisabled =
    saving || !name.trim() || (useExisting ? !existingName : !resourceName.trim());

  return (
    <Card>
      <CardHeader
        icon={<IconBox className="icon" />}
        title="Cloudflare bindings"
        count={loaded ? bindings.length : undefined}
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

      {notice && (
        <div className="alert-ok" style={{ margin: "0 18px", marginTop: 14 }}>
          {notice}
        </div>
      )}

      <div style={{ padding: "16px 18px" }}>
        {!loaded ? (
          <SkeletonList rows={2} />
        ) : configPath === null ? (
          <p className="pmute" style={{ padding: "8px 0" }}>
            No wrangler config file found in this repo — bindings aren&apos;t supported for this
            project type.
          </p>
        ) : bindings.length === 0 ? (
          <p className="pmute" style={{ padding: "8px 0" }}>
            No bindings configured yet.
          </p>
        ) : (
          <div>
            {bindings.map((b) => (
              <div key={b.name} className="binding-row">
                <span className="b-ico">
                  <IconBox />
                </span>
                <div className="min-w-0" style={{ flex: 1 }}>
                  <div className="b-t">{b.name}</div>
                  <div className="b-s truncate">{b.resource}</div>
                </div>
                <span className={`pill ${TYPE_BADGE[b.type]}`}>{b.type}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(b)}
                  disabled={deleting === b.name}
                  className="btn ghost sm danger-hover"
                >
                  {deleting === b.name ? "…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {configPath !== null && (
        <form
          onSubmit={handleAdd}
          style={{
            borderTop: "1px solid var(--np-line)",
            padding: "16px 18px 18px",
          }}
        >
          <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="bing-type">Type</label>
              <select
                id="bing-type"
                className="input"
                value={type}
                onChange={(e) => switchType(e.target.value as BindingType)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — {TYPE_HINTS[t.value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="bing-name">Binding name</label>
              <input
                id="bing-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="MY_BUCKET"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="bing-resource">Resource</label>
              {useExisting ? (
                <select
                  id="bing-resource"
                  className="input"
                  value={existingName}
                  onChange={(e) => setExistingName(e.target.value)}
                >
                  <option value="">Select…</option>
                  {typeResources.map((r) => (
                    <option
                      key={`${r.type}-${r.id ?? r.name}`}
                      value={r.type === "turnstile" || r.type === "ai_search" ? (r.id ?? r.name) : r.name}
                    >
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="bing-resource"
                  className="input"
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  placeholder={
                    type === "r2"
                      ? "my-bucket-name"
                      : type === "turnstile"
                        ? "my-widget-name"
                        : type === "ai_search"
                          ? "my-search-index"
                          : "my-resource"
                  }
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              )}
            </div>
          </div>

          {type === "turnstile" && !useExisting && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="bing-domain">Domain (optional)</label>
              <input
                id="bing-domain"
                className="input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="help">
                Defaults to the project&apos;s live URL host. Preview branches get their own
                per-branch widget automatically.
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <label className="check">
              <input
                type="checkbox"
                checked={useExisting}
                onChange={(e) => setUseExisting(e.target.checked)}
              />
              Use an existing {RESOURCE_NOUN[type]}
            </label>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {type === "d1" && (
                <span className="pmute">New databases use the default region.</span>
              )}
              <button type="submit" disabled={addDisabled} className="btn primary">
                {saving ? "Adding…" : "Add binding"}
              </button>
            </span>
          </div>
        </form>
      )}

      <div className="note" style={{ margin: "0 18px 18px" }}>
        KV/D1/R2/AI Search bindings are written to{" "}
        <code>{configPath ?? "wrangler config"}</code> in the repo and applied by the next
        deploy. Turnstile widgets are delivered as env vars (<code>*_SITE_KEY</code> /{" "}
        <code>*_SECRET_KEY</code>) and preview branches receive their own widget. Removing a
        Turnstile widget or AI Search instance also removes the underlying account resource.
      </div>

      <div className="note" style={{ margin: "0 18px 18px" }}>
        You can also provision from pushed code: add a KV/D1/R2 binding without an ID to{" "}
        <code>wrangler.toml</code> and push — it is created automatically on deploy. AI Search
        and Turnstile are provisioned by the &quot;Provision resources&quot; step when{" "}
        <code>provisioning from code</code> is enabled.
      </div>
    </Card>
  );
}