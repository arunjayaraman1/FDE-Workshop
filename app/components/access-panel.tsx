"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectRole, SiteAccessMode } from "@/lib/types";
import { Card, CardHeader, CopyButton, IconKey } from "./ui";
import Skeleton from "./skeleton";

interface AccessPanelProps {
  projectId: string;
  projectName: string;
  canManage: boolean;
}

interface AccessState {
  mode: SiteAccessMode;
  key: string | null;
  supported: boolean;
  unsupportedReason?: string;
}

const MODES: Array<{ value: SiteAccessMode; label: string; hint: string }> = [
  { value: "public", label: "Public", hint: "Anyone with the link can open the site." },
  { value: "org", label: "Organization", hint: "A shared access key your whole org can use." },
  {
    value: "members",
    label: "Members only",
    hint: "Shared access key shown to this project's members. Rotate to revoke.",
  },
];

export default function AccessPanel({
  projectId,
  projectName,
  canManage,
}: AccessPanelProps) {
  const [saved, setSaved] = useState<AccessState | null>(null);
  const [selected, setSelected] = useState<SiteAccessMode>("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/access`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load site access settings.");
        return;
      }
      const next: AccessState = {
        mode: data.mode ?? "public",
        key: data.key ?? null,
        supported: data.supported !== false,
        unsupportedReason: data.unsupportedReason,
      };
      setSaved(next);
      setSelected(next.mode);
      setError(null);
    } catch {
      setError("Failed to reach the Launchpad server.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(nextMode: SiteAccessMode, rotate = false) {
    setSaving(true);
    setRotating(rotate);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/access`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: nextMode, rotate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update site access.");
        return;
      }
      const next: AccessState = {
        mode: data.mode ?? nextMode,
        key: data.key ?? null,
        supported: true,
      };
      setSaved(next);
      setSelected(next.mode);
      setNotice(
        rotate
          ? "A new access key was generated. It takes effect after the next deploy."
          : "Site access updated. It takes effect after the next auto-deploy (~1 minute)."
      );
    } catch {
      setError("Network error while updating site access.");
    } finally {
      setSaving(false);
      setRotating(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader icon={<IconKey className="icon" />} title="Site access" />
        <div className="card-bd">
          <Skeleton className="h-4 w-48" />
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (!saved || !saved.supported) {
    return (
      <Card>
        <CardHeader icon={<IconKey className="icon" />} title="Site access" />
        <div className="card-bd">
          <p className="pmute">
            {saved?.unsupportedReason ?? "Site access isn't supported for this template yet."}
          </p>
        </div>
      </Card>
    );
  }

  const showKey = saved.mode !== "public" && (canManage || saved.mode === "members");
  const pending = selected !== saved.mode;

  return (
    <div className="set-grid">
      {(error || notice) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div className="alert-error">{error}</div>}
          {notice && <div className="alert-ok">{notice}</div>}
        </div>
      )}

      <Card>
        <CardHeader icon={<IconKey className="icon" />} title="Site access" />
        <div className="card-bd">
          <p className="pmute" style={{ marginBottom: 14, lineHeight: 1.55 }}>
            Lock the deployed prototype with a shared access key. Visitors enter the key in the
            browser&apos;s login prompt; the deployed site handles the check, so preview branches
            are protected too. Takes effect on the next auto-deploy (~1 minute).
          </p>

          <div className="seg-rows">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={!canManage || saving}
                onClick={() => setSelected(m.value)}
                className={`seg-row${selected === m.value ? " on" : ""}`}
                style={{ textAlign: "left" }}
              >
                <span className="s-radio" />
                <span className="s-tx">
                  <span className="s-t">{m.label}</span>
                  <span className="s-d">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {showKey && (
        <Card>
          <CardHeader icon={<IconKey className="icon" />} title="Access key" />
          <div className="card-bd">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="key-chip" style={{ flex: 1, minWidth: 0 }}>
                <span className="truncate">{saved.key}</span>
              </div>
              <CopyButton text={saved.key ?? ""} />
            </div>
            <p className="pmute" style={{ marginTop: 12 }}>
              Share this key with {saved.mode === "members" ? "project members" : "your organization"}.
              {saved.mode === "members" &&
                " Removing a member doesn't revoke them automatically — rotate to revoke."}
            </p>
          </div>
        </Card>
      )}

      {!canManage && saved.mode === "org" && (
        <p className="pmute">
          This site uses an organization access key. Ask a project owner for the shared key.
        </p>
      )}

      {canManage && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pending ? (
            <button
              onClick={() => save(selected)}
              disabled={saving}
              className="btn primary"
            >
              {saving ? "Applying…" : "Apply"}
            </button>
          ) : saved.mode === "public" ? (
            <button
              onClick={() => save("org")}
              disabled={saving}
              className="btn primary"
            >
              Protect this site
            </button>
          ) : (
            <>
              <button
                onClick={() => save(saved.mode, true)}
                disabled={saving || rotating}
                className="btn outline"
              >
                {rotating ? "Rotating…" : "Rotate key"}
              </button>
              <button
                onClick={() => save("public")}
                disabled={saving}
                className="btn outline"
              >
                Make public
              </button>
            </>
          )}
        </div>
      )}
      <p className="pmute" style={{ fontSize: 11.5 }}>
        Project name shown to visitors:{" "}
        <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{projectName}</span>
      </p>
    </div>
  );
}