"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TemplateInfo } from "@/lib/types";
import { CATEGORIES, templateStack } from "@/lib/template-meta";

interface TemplatesBrowserProps {
  templates: TemplateInfo[];
}

const platformLabel = (t: TemplateInfo) => {
  if (t.provider === "aws" && t.type === "amplify") return "AWS Amplify (Coming Soon)";
  if (t.provider === "aws") return "AWS Lambda";
  return t.type === "pages" ? "Cloudflare Pages" : "Cloudflare Workers";
};

const isAmplify = (t: TemplateInfo) => t.provider === "aws" && t.type === "amplify";

export default function TemplatesBrowser({ templates }: TemplatesBrowserProps) {
  const [selected, setSelected] = useState<TemplateInfo | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="tpl-grid">
        {templates.map((t) => (
          <div key={t.id} className={`card tpl-card${isAmplify(t) ? " op-ghost" : ""}`}>
            <div className="tpl-top">
              <h3>{t.name}</h3>
              <span className="plat-chip">{platformLabel(t)}</span>
            </div>
            <p className="tpl-desc">{t.description}</p>
            <div className="tag-row">
              {t.source === "c3" && <span className="tag c3">create-cloudflare</span>}
              {isAmplify(t) && <span className="tag soon">coming soon</span>}
              <span className="tag">
                {CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category}
              </span>
              <span className="tag">{templateStack(t)}</span>
              {t.buildCommand && <span className="tag">build</span>}
            </div>
            <button
              type="button"
              onClick={() => setSelected(t)}
              disabled={isAmplify(t)}
              className={`btn outline${isAmplify(t) ? " is-disabled" : ""}`}
              style={{ width: "100%", marginTop: 16 }}
            >
              {isAmplify(t) ? "Coming Soon" : "View details"}
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="modal show"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} details`}
        >
          <div className="backdrop" />
          <div
            className="dialog lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dlg-head">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{selected.name}</h3>
                  <span className="plat-chip">{platformLabel(selected)}</span>
                </div>
                <p>{selected.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="dlg-x"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="dlg-body">
              <div className="tag-row" style={{ marginBottom: 16 }}>
                <span className="tag">
                  {CATEGORIES.find((c) => c.id === selected.category)?.label ?? selected.category}
                </span>
                <span className="tag">Stack: {templateStack(selected)}</span>
                <span className={`tag${selected.source === "c3" ? " c3" : ""}`}>
                  {selected.source === "c3" ? "create-cloudflare (live)" : "Built-in"}
                </span>
                {selected.requiresRoute && <span className="tag soon">Requires custom route</span>}
              </div>

              <div
                className="codebox"
                style={{ padding: "4px 0" }}
              >
                <div className="kv-row" style={{ padding: "10px 12px" }}>
                  <span className="k">Platform</span>
                  <span className="v" style={{ whiteSpace: "normal" }}>
                    {platformLabel(selected)}
                  </span>
                </div>
                <div className="kv-row" style={{ padding: "10px 12px" }}>
                  <span className="k">Source</span>
                  <span className="v" style={{ whiteSpace: "normal" }}>
                    {selected.source === "c3" ? "create-cloudflare (live)" : "Built-in"}
                  </span>
                </div>
                <div className="kv-row" style={{ padding: "10px 12px" }}>
                  <span className="k">Runtime</span>
                  <span className="v" style={{ whiteSpace: "normal" }}>
                    {templateStack(selected)}
                  </span>
                </div>
                {selected.deploy?.setup && (
                  <div className="kv-row" style={{ padding: "10px 12px" }}>
                    <span className="k">Setup</span>
                    <span className="v" title={selected.deploy.setup}>
                      {selected.deploy.setup}
                    </span>
                  </div>
                )}
                {selected.buildCommand && (
                  <div className="kv-row" style={{ padding: "10px 12px" }}>
                    <span className="k">Build</span>
                    <span className="v" title={selected.buildCommand}>
                      {selected.buildCommand}
                    </span>
                  </div>
                )}
                <div className="kv-row" style={{ padding: "10px 12px" }}>
                  <span className="k">Deploy</span>
                  <span
                    className="v"
                    title={selected.deploy?.command ?? selected.deployCommand}
                  >
                    {selected.deploy?.command ?? selected.deployCommand}
                  </span>
                </div>
              </div>

              {selected.c3 && (
                <div style={{ marginTop: 16 }}>
                  <span className="card-tt" style={{ display: "block", marginBottom: 7, fontSize: 12 }}>
                    create-cloudflare command
                  </span>
                  <code className="codebox">
                    npm create cloudflare@latest -- {selected.c3.args.join(" ")}
                  </code>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <span className="card-tt" style={{ display: "block", marginBottom: 7, fontSize: 12 }}>
                  Files in template ({selected.files.length})
                </span>
                <ul className="grid gap-x-6 gap-y-1" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-3)" }}>
                  {selected.files.map((f) => (
                    <li key={f} className="truncate" style={{ paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--text-4)" }}>›</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="dlg-foot">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn ghost"
              >
                Close
              </button>
              <Link
                href={`/?template=${selected.id}`}
                onClick={() => setSelected(null)}
                className="btn primary"
                style={{ flex: 1 }}
              >
                Use this template →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}