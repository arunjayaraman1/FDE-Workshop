"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TemplateCategory, TemplateInfo, ImportAnalysis, LaunchConfig } from "@/lib/types";
import { CATEGORIES } from "@/lib/template-meta";

interface LaunchPadProps {
  templates: TemplateInfo[];
  envPatSet: boolean;
  envTokenSet: boolean;
  defaultAccountId: string;
  envAwsAccessKeySet: boolean;
  envAwsSecretKeySet: boolean;
  org?: string;
}

type Step = 1 | 2 | 3;

type LaunchEnvVarRow = { key: string; value: string; kind: "secret" | "text" };
type LaunchBindingRow = { type: "kv" | "d1" | "r2" | "ai_search"; name: string; resource: string };

const BINDING_TYPE_OPTIONS: Array<{ value: LaunchBindingRow["type"]; label: string }> = [
  { value: "kv", label: "KV" },
  { value: "d1", label: "D1" },
  { value: "r2", label: "R2" },
  { value: "ai_search", label: "AI Search" },
];

const platformLabel = (t: TemplateInfo) => {
  if (t.provider === "aws") return t.type === "amplify" ? "AWS Amplify" : "AWS Lambda";
  return t.type === "pages" ? "Cloudflare Pages" : "Cloudflare Workers";
};

const WIZ_STEPS: Array<{ no: string; t: string; h: string }> = [
  { no: "01", t: "Language", h: "Pick a stack" },
  { no: "02", t: "Template", h: "Choose a starter" },
  { no: "03", t: "Configure", h: "Deploy options" },
];

const CAT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const RocketIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.2 2.5A8 8 0 0116.5 13l.8 5.4L12 21l-5.3-2.6.8-5.4A8 8 0 019.8 4.5L12 2z" />
    <circle cx="12" cy="11" r="2.4" />
  </svg>
);

const BldgIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-4h6v4" />
    <path d="M9 11h6" />
  </svg>
);

const WarnIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const CheckIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l5 5L20 7" />
  </svg>
);

export default function LaunchPad({
  templates,
  envPatSet,
  envTokenSet,
  defaultAccountId,
  envAwsAccessKeySet,
  envAwsSecretKeySet,
  org,
}: LaunchPadProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const deepLinkedId = searchParams.get("template");
  const deepLinked = templates.find((t) => t.id === deepLinkedId) ?? null;

  const [step, setStep] = useState<Step>(deepLinked ? 3 : 1);
  const [category, setCategory] = useState<TemplateCategory | null>(deepLinked?.category ?? null);
  const [selected, setSelected] = useState<TemplateInfo | null>(deepLinked);
  const [details, setDetails] = useState<TemplateInfo | null>(null);

  const [importMode, setImportMode] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importPat, setImportPat] = useState("");
  const [importProjectName, setImportProjectName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [importEnvValues, setImportEnvValues] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [route, setRoute] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [githubPat, setGithubPat] = useState("");
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("");

  const [launchEnvVars, setLaunchEnvVars] = useState<LaunchEnvVarRow[]>([]);
  const [launchBindings, setLaunchBindings] = useState<LaunchBindingRow[]>([]);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [provisionEnabled, setProvisionEnabled] = useState(true);

  const isAmplify = selected?.provider === "aws" && selected?.type === "amplify";

  useEffect(() => {
    if (!details) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetails(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [details]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryTemplates = category
    ? templates.filter((t) => t.category === category)
    : [];

  function resetToCategory(cat: TemplateCategory) {
    setCategory(cat);
    setSelected(null);
    setStep(2);
  }

  async function handleLaunch() {
    setError(null);

    if (!selected) {
      setError("Select a template first.");
      return;
    }
    if (!projectName.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (!envPatSet && !githubPat.trim()) {
      setError("Enter a GitHub Personal Access Token (or set GITHUB_PAT in .env).");
      return;
    }
    if (selected.provider === "aws") {
      if (!awsAccessKey.trim() && !envAwsAccessKeySet) {
        setError("Enter your AWS Access Key ID (or set it in .env).");
        return;
      }
      if (!awsSecretKey.trim() && !envAwsSecretKeySet) {
        setError("Enter your AWS Secret Access Key (or set it in .env).");
        return;
      }
    } else {
      if (!cloudflareToken.trim() && !envTokenSet) {
        setError("Enter a Cloudflare API token.");
        return;
      }
      if (!accountId.trim() && !defaultAccountId) {
        setError("Enter your Cloudflare account ID.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: {
        templateId: string;
        projectName: string;
        private: boolean;
        githubPat?: string;
        cloudflareToken?: string;
        accountId?: string;
        awsAccessKey?: string;
        awsSecretKey?: string;
        awsRegion?: string;
        config?: LaunchConfig;
      } = {
        templateId: selected.id,
        projectName: projectName.trim(),
        private: isPrivate,
      };

      if (githubPat.trim()) payload.githubPat = githubPat.trim();
      if (selected.provider === "aws") {
        if (awsAccessKey.trim()) payload.awsAccessKey = awsAccessKey.trim();
        if (awsSecretKey.trim()) payload.awsSecretKey = awsSecretKey.trim();
        if (awsRegion.trim()) payload.awsRegion = awsRegion.trim();
      } else {
        if (cloudflareToken.trim()) payload.cloudflareToken = cloudflareToken.trim();
        if (accountId.trim()) payload.accountId = accountId.trim();
        payload.config = {
          envVars: launchEnvVars
            .filter((v) => v.key.trim())
            .map((v) => ({ key: v.key.trim(), value: v.value, kind: v.kind })),
          bindings: launchBindings
            .filter((b) => b.name.trim() && b.resource.trim())
            .map((b) => ({ type: b.type, name: b.name.trim(), resource: b.resource.trim() })),
          previewEnabled,
          provisionEnabled,
        };
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to launch project.");
        setSubmitting(false);
        return;
      }
      router.push("/projects");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleAnalyze() {
    setError(null);
    if (!importUrl.trim()) {
      setError("Paste a GitHub repository URL first.");
      return;
    }
    if (!envPatSet && !importPat.trim()) {
      setError("Enter a GitHub Personal Access Token (or set GITHUB_PAT in .env).");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/import/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim(), githubPat: importPat.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed.");
        setAnalyzing(false);
        return;
      }
      setAnalysis(data.analysis);
      const evs: Record<string, string> = {};
      for (const v of data.analysis.plan?.envVars ?? []) evs[v.key] = "";
      setImportEnvValues(evs);
      setAnalyzing(false);
    } catch {
      setError("Network error. Please try again.");
      setAnalyzing(false);
    }
  }

  async function handleImportDeploy() {
    setError(null);
    if (!analysis?.plan) return;
    if (!importProjectName.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (!envPatSet && !importPat.trim()) {
      setError("Enter a GitHub Personal Access Token (or set GITHUB_PAT in .env).");
      return;
    }
    if (!cloudflareToken.trim() && !envTokenSet) {
      setError("Enter a Cloudflare API token.");
      return;
    }
    if (!accountId.trim() && !defaultAccountId) {
      setError("Enter your Cloudflare account ID.");
      return;
    }
    setImporting(true);
    try {
      const payload: {
        url: string;
        projectName: string;
        plan: ImportAnalysis["plan"];
        githubPat?: string;
        cloudflareToken?: string;
        accountId?: string;
        envValues: Record<string, string>;
      } = {
        url: importUrl.trim(),
        projectName: importProjectName.trim(),
        plan: analysis.plan,
        envValues: importEnvValues,
      };
      if (importPat.trim()) payload.githubPat = importPat.trim();
      if (cloudflareToken.trim()) payload.cloudflareToken = cloudflareToken.trim();
      if (accountId.trim()) payload.accountId = accountId.trim();
      const res = await fetch("/api/import/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Deploy failed.");
        setImporting(false);
        return;
      }
      router.push("/projects");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setImporting(false);
    }
  }

  const importBlockers = analysis?.detection?.blockers ?? [];

  const templateStack = (t: TemplateInfo) => {
    const parts = [];
    if (t.deploy?.runtime) parts.push(t.deploy.runtime);
    if (t.buildCommand) parts.push("build: " + t.buildCommand);
    return parts.join(", ") || "—";
  };

  /* ── IMPORT FLOW ────────────────────────────────────────────────── */

  if (importMode) {
    return (
      <div className="flex flex-col gap-6">
        <div className="section-title">
          <div>
            <h2>Deploy an existing project</h2>
            <p className="pmute">Paste a GitHub URL from an app you (or your AI) already built.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setImportMode(false);
              setAnalysis(null);
              setError(null);
              setStep(1);
            }}
            className="btn ghost sm"
          >
            ← Back
          </button>
        </div>

        {!analysis && (
          <div className="card form-sec">
            <div className="field">
              <label>GitHub repository URL</label>
              <input
                className="input"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className="help">
                The repo stays in place; Launchpad adds a deploy workflow and Cloudflare config to
                it.
              </span>
            </div>

            <div className="field">
              <label>GitHub Personal Access Token</label>
              <input
                type="password"
                className="input"
                value={importPat}
                onChange={(e) => setImportPat(e.target.value)}
                placeholder={envPatSet ? "Set via .env (optional here)" : "ghp_... (scopes: repo, workflow)"}
                autoComplete="off"
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn primary lg"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {analyzing ? "Analyzing..." : "Analyze and plan the deploy"}
            </button>
          </div>
        )}

        {analysis && !analysis.plan && (
          <div className="card form-sec">
            <div className="callout warn" style={{ marginTop: 0 }}>
              {WarnIcon}
              <div>
                <div className="callout-t">This one needs a hand</div>
                {analysis.guidedFix?.reason}
                {importBlockers.length > 0 && (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    Detected: {importBlockers.join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label className="pmute">Ask your AI tool to do this</label>
              <pre className="log-pre" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                {analysis.guidedFix?.instruction}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnalysis(null);
                setError(null);
              }}
              className="btn outline"
              style={{ width: "100%", justifyContent: "center" }}
            >
              Analyze a different repo
            </button>
          </div>
        )}

        {analysis && analysis.plan && (
          <div className="config-split">
            <div className="flex flex-col gap-5">
              <div className="card form-sec">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span className="pill ok">Ready to deploy</span>
                  <span className="pmute">
                    {analysis.detection.framework ?? "App"} ·{" "}
                    {analysis.plan.deployKind === "pages" ? "Cloudflare Pages" : "Cloudflare Workers"}
                  </span>
                </div>

                <h3 style={{ marginBottom: 6 }}>What Launchpad will do</h3>
                <p className="pmute" style={{ lineHeight: 1.6 }}>
                  {analysis.plan.summary}
                </p>
                {analysis.plan.notes.length > 0 && (
                  <ul
                    style={{
                      listStyle: "disc",
                      paddingLeft: 18,
                      margin: "10px 0 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {analysis.plan.notes.map((n) => (
                      <li key={n} className="pmute" style={{ fontSize: 12.5 }}>
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="kv-row">
                  <span className="k">Build command</span>
                  <span className="url-cell" style={{ flex: 1 }}>
                    {analysis.plan.buildCommand || "—"}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Deploy command</span>
                  <span className="url-cell" style={{ flex: 1 }}>
                    {analysis.plan.deployCommand}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Package manager</span>
                  <span style={{ flex: 1 }}>{analysis.plan.packageManager ?? "—"}</span>
                </div>

                <div className="field" style={{ marginTop: 18 }}>
                  <label>Project name</label>
                  <input
                    className="input"
                    value={importProjectName}
                    onChange={(e) => setImportProjectName(e.target.value)}
                    placeholder={analysis.repoTitle ?? "my-app"}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <span className="help">Used as the Cloudflare project/worker name.</span>
                </div>

                {analysis.plan.envVars.length > 0 && (
                  <div>
                    <span className="fieldset-div">Environment values</span>
                    <p className="pmute" style={{ fontSize: 11.5 }}>
                      Optional. These are stored as GitHub repo secrets and used by the deploy.
                    </p>
                    <div className="ev-rows">
                      {analysis.plan.envVars.map((v) => (
                        <div key={v.key} className="ev-row">
                          <input
                            type={v.kind === "secret" ? "password" : "text"}
                            className="input"
                            value={importEnvValues[v.key] ?? ""}
                            onChange={(e) =>
                              setImportEnvValues((prev) => ({ ...prev, [v.key]: e.target.value }))
                            }
                            placeholder={v.key}
                            autoComplete="off"
                          />
                          <span className="kv-chip">{v.kind}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div className="alert-error" style={{ marginTop: 16 }}>{error}</div>}

                <button
                  type="button"
                  onClick={handleImportDeploy}
                  disabled={importing}
                  className="btn primary lg"
                  style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
                >
                  {importing ? "Deploying..." : "Looks good, deploy →"}
                </button>
              </div>
            </div>

            <div className="sum-rail">
              <div className="summary-card">
                <h3>Repo summary</h3>
                <dl className="sumrows">
                  <div className="sum-row">
                    <dt className="k">Repo</dt>
                    <dd className="v" title={importUrl}>
                      {analysis.repoTitle}
                    </dd>
                  </div>
                  <div className="sum-row">
                    <dt className="k">Branch</dt>
                    <dd className="v">{analysis.defaultBranch}</dd>
                  </div>
                  <div className="sum-row">
                    <dt className="k">Files analyzed</dt>
                    <dd className="v">{analysis.files.length}</dd>
                  </div>
                  <div className="sum-row">
                    <dt className="k">Deploy target</dt>
                    <dd className="v">
                      {analysis.plan.deployKind === "pages"
                        ? "Cloudflare Pages"
                        : "Cloudflare Workers"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── WIZARD SHELL ───────────────────────────────────────────────── */

  const railState: Array<"on" | "done" | "off"> = [
    step === 1 ? "on" : step > 1 ? "done" : "off",
    step === 2 ? "on" : step > 2 ? "done" : "off",
    step === 3 ? "on" : "off",
  ] as const;

  return (
    <div className="wiz">
      <aside className="card wiz-rail">
        {WIZ_STEPS.map((s, i) => (
          <div key={s.no}>
            <div className={`wzn ${railState[i]}`}>
              <span className="n">{railState[i] === "done" ? "✓" : s.no}</span>
              <div className="wzn-tx">
                <div className="wzn-t">{s.t}</div>
                <div className="wzn-h">{s.h}</div>
              </div>
            </div>
            {i < WIZ_STEPS.length - 1 && (
              <div className={`wiz-line${railState[i] === "done" ? " done" : ""}`} />
            )}
          </div>
        ))}
      </aside>

      <div className="wiz-body">
        {step === 1 && (
          <section className="wstep active">
            <h2 className="step-title">
              <span className="step-no">01</span> Choose a language
            </h2>
            <p className="step-desc">
              Pick a language and framework — we&rsquo;ll scaffold the repo and deploy it for you.
            </p>

            <div
              className="import-row"
              onClick={() => {
                setImportMode(true);
                setError(null);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setImportMode(true);
                  setError(null);
                }
              }}
            >
              <div className="imp-tile">{RocketIcon}</div>
              <div className="imp-tx">
                <h4>Deploy an existing project</h4>
                <p>
                  Paste a GitHub URL from an app you (or your AI) already built. Launchpad analyzes
                  it and deploys it to Cloudflare — with nothing to configure.
                </p>
              </div>
              <span className="new-tag">New</span>
            </div>

            <div className="cat-grid" style={{ marginTop: 20 }}>
              {CATEGORIES.map((cat) => {
                const count = templates.filter((t) => t.category === cat.id).length;
                return (
                  <div key={cat.id} className="card cat-card" onClick={() => resetToCategory(cat.id)}>
                    <div className="cat-ico">{CAT_ICON}</div>
                    <h3 className="cat-name">{cat.label}</h3>
                    <p className="cat-desc">{cat.description}</p>
                    <span className="cat-count">
                      {count} template{count === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="wstep active">
            <h2 className="step-title">
              <span className="step-no">02</span> Choose a template
            </h2>
            <p className="step-desc">
              {CATEGORIES.find((c) => c.id === category)?.label} templates ready to launch.
            </p>

            <div className="tpl-grid">
              {categoryTemplates.map((t) => (
                <div
                  key={t.id}
                  className={`card tpl-card${selected?.id === t.id ? " sel" : ""}`}
                  onClick={() => {
                    setSelected(t);
                    setStep(3);
                  }}
                >
                  <span className="tpl-check">{CheckIcon}</span>
                  <div className="tpl-top">
                    <h3>{t.name}</h3>
                    <span className="plat-chip">{platformLabel(t)}</span>
                  </div>
                  <p className="tpl-desc">{t.description}</p>
                  <div className="tag-row">
                    {t.source === "c3" && <span className="tag c3">create-cloudflare</span>}
                    <span className="tag">
                      {CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category}
                    </span>
                    {t.deploy?.runtime && <span className="tag">{t.deploy.runtime}</span>}
                    {t.buildCommand && <span className="tag">build</span>}
                  </div>
                  <div className="tpl-foot">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetails(t);
                      }}
                      className="btn outline sm"
                    >
                      View details
                    </button>
                    <span className="tpl-go">Use template →</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn ghost sm"
              >
                ← Change language
              </button>
            </div>

            {details && (
              <div
                className="modal show"
                onClick={() => setDetails(null)}
                role="dialog"
                aria-modal="true"
                aria-label={`${details.name} details`}
              >
                <div className="backdrop" onClick={() => setDetails(null)} />
                <div className="dialog lg" onClick={(e) => e.stopPropagation()}>
                  <div className="dlg-head">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3>{details.name}</h3>
                        <span className="plat-chip">{platformLabel(details)}</span>
                      </div>
                      <p>{details.description}</p>
                    </div>
                    <button type="button" onClick={() => setDetails(null)} aria-label="Close" className="dlg-x">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>

                  <div className="dlg-body">
                    <div className="kv-row">
                      <span className="k">Platform</span>
                      <span className="url-cell" style={{ flex: 1 }}>
                        {platformLabel(details)}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Source</span>
                      <span style={{ flex: 1 }}>
                        {details.source === "c3" ? "create-cloudflare (live)" : "Built-in"}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Runtime</span>
                      <span className="url-cell" style={{ flex: 1 }}>
                        {templateStack(details)}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Setup</span>
                      <span className="url-cell" style={{ flex: 1 }} title={details.deploy?.setup}>
                        {details.deploy?.setup ?? (details.buildCommand || "—")}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Deploy command</span>
                      <span
                        className="url-cell"
                        style={{ flex: 1 }}
                        title={details.deploy?.command ?? details.deployCommand}
                      >
                        {details.deploy?.command ?? details.deployCommand}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Files</span>
                      <span style={{ flex: 1 }}>{details.files.length}</span>
                    </div>

                    {details.c3 && (
                      <div style={{ marginTop: 16 }}>
                        <span className="pmute" style={{ fontSize: 12, marginBottom: 6, display: "block" }}>
                          create-cloudflare command
                        </span>
                        <pre className="codebox" style={{ margin: 0 }}>
                          npm create cloudflare@latest -- {details.c3.args.join(" ")}
                        </pre>
                      </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      <span className="pmute" style={{ fontSize: 12, marginBottom: 8, display: "block" }}>
                        Files in template ({details.files.length})
                      </span>
                      <ul className="src-list">
                        {details.files.map((f) => (
                          <li key={f} className="fileline">
                            <span className="url-cell" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="dlg-foot">
                    <button type="button" onClick={() => setDetails(null)} className="btn ghost">
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(details);
                        setDetails(null);
                        setStep(3);
                      }}
                      className="btn primary"
                    >
                      Use this template →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 3 && selected && (
          <section className="wstep active">
            <h2 className="step-title">
              <span className="step-no">03</span> Deploy{" "}
              <span className="url-cell">{selected.name}</span>
            </h2>
            <p className="step-desc">Set the project name, credentials, and optional config.</p>

            <div className="config-split">
              <div className="flex flex-col gap-5">
                <div className="card form-sec">
                  {org && (
                    <div className="callout target" style={{ marginTop: 0, marginBottom: 18 }}>
                      {BldgIcon}
                      <div>
                        Target: <code>{org}</code> — the repo and its deploy secrets will be created
                        under this GitHub organization.
                      </div>
                    </div>
                  )}

                  <div className="form-grid">
                    <div className="field" style={{ gridColumn: "1/-1" }}>
                      <label>Project name</label>
                      <input
                        className="input"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="my-api"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      <span className="help">
                        Lowercase letters, numbers, hyphens. Used as the repo name and Cloudflare
                        project name.
                      </span>
                    </div>

                    {selected.requiresRoute && (
                      <div className="field" style={{ gridColumn: "1/-1" }}>
                        <label>Route</label>
                        <input
                          className="input"
                          value={route}
                          onChange={(e) => setRoute(e.target.value)}
                          placeholder="*.example.com/*"
                        />
                        <span className="help">This template is deployed to a custom domain route.</span>
                      </div>
                    )}

                    <div className="seg-wrap">
                      <span className="fieldset-div">Visibility</span>
                      <div className="seg">
                        <button
                          type="button"
                          className={isPrivate ? "on" : ""}
                          onClick={() => setIsPrivate(true)}
                        >
                          Private
                        </button>
                        <button
                          type="button"
                          className={!isPrivate ? "on" : ""}
                          onClick={() => setIsPrivate(false)}
                        >
                          Public
                        </button>
                      </div>
                    </div>

                    <div className="field" style={{ gridColumn: "1/-1" }}>
                      <label>GitHub Personal Access Token</label>
                      <input
                        type="password"
                        className="input"
                        value={githubPat}
                        onChange={(e) => setGithubPat(e.target.value)}
                        placeholder={envPatSet ? "Set via .env (optional here)" : "ghp_... (scopes: repo, workflow)"}
                        autoComplete="off"
                      />
                      <span className="help">
                        {envPatSet
                          ? "A token from .env is available; this field is optional."
                          : "Needs repo + workflow scopes. Used only to create the repo and push — never stored."}
                      </span>
                    </div>

                    {isAmplify ? (
                      <div className="callout warn" style={{ gridColumn: "1/-1" }}>
                        {WarnIcon}
                        <div>
                          <div className="callout-t">Coming soon</div>
                          AWS Amplify Gen 2 deploy requires a pre-connected Amplify Console app.
                          This template will be available once full automation is implemented.
                        </div>
                      </div>
                    ) : selected.provider === "aws" ? (
                      <>
                        <div className="field">
                          <label>AWS Access Key ID</label>
                          <input
                            type="password"
                            className="input"
                            value={awsAccessKey}
                            onChange={(e) => setAwsAccessKey(e.target.value)}
                            placeholder={envAwsAccessKeySet ? "Set via .env (optional here)" : "AKIA..."}
                            autoComplete="off"
                          />
                        </div>
                        <div className="field">
                          <label>AWS Secret Access Key</label>
                          <input
                            type="password"
                            className="input"
                            value={awsSecretKey}
                            onChange={(e) => setAwsSecretKey(e.target.value)}
                            placeholder={envAwsSecretKeySet ? "Set via .env (optional here)" : "Your AWS secret key"}
                            autoComplete="off"
                          />
                          <span className="help">Stored as GitHub repo secrets for the deploy workflow.</span>
                        </div>
                        <div className="field" style={{ gridColumn: "1/-1" }}>
                          <label>AWS Region</label>
                          <input
                            className="input"
                            value={awsRegion}
                            onChange={(e) => setAwsRegion(e.target.value)}
                            placeholder="us-east-1"
                            autoComplete="off"
                          />
                          <span className="help">Leave blank to use the configured default region.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="field" style={{ gridColumn: "1/-1" }}>
                          <label>Cloudflare API token</label>
                          <input
                            type="password"
                            className="input"
                            value={cloudflareToken}
                            onChange={(e) => setCloudflareToken(e.target.value)}
                            placeholder={envTokenSet ? "Set via .env (optional here)" : "Enter your Cloudflare API token"}
                            autoComplete="off"
                          />
                          <span className="help">
                            Stored as a GitHub repo secret for the deploy workflow.
                          </span>
                        </div>
                        <div className="field" style={{ gridColumn: "1/-1" }}>
                          <label>Cloudflare account ID</label>
                          <input
                            className="input"
                            value={accountId}
                            onChange={(e) => setAccountId(e.target.value)}
                            placeholder="Your 32-char Cloudflare account ID"
                            autoComplete="off"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {selected.provider === "cloudflare" && (
                  <div className="card form-sec">
                    <div className="section-title" style={{ marginBottom: 4 }}>
                      <div>
                        <h3 style={{ fontSize: 15 }}>Resources &amp; config</h3>
                        <p className="pmute">Optional — applied once the first deploy succeeds.</p>
                      </div>
                    </div>

                    {selected.files.some(
                      (f) => f === "wrangler.toml" || f === "wrangler.jsonc" || f === "wrangler.json"
                    ) && (
                      <div className="field">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <span className="fieldset-div" style={{ margin: 0 }}>Bindings</span>
                          <button
                            type="button"
                            onClick={() =>
                              setLaunchBindings((prev) => [
                                ...prev,
                                { type: "kv", name: "", resource: "" },
                              ])
                            }
                            className="btn outline sm"
                          >
                            + Add binding
                          </button>
                        </div>
                        {launchBindings.length === 0 ? (
                          <p className="pmute" style={{ fontSize: 12 }}>
                            Add KV, D1, R2, or AI Search bindings. The resource is created on the
                            account if it does not exist.
                          </p>
                        ) : (
                          <div className="ev-rows">
                            {launchBindings.map((b, i) => (
                              <div key={i} className="ev-row">
                                <select
                                  value={b.type}
                                  onChange={(e) =>
                                    setLaunchBindings((prev) =>
                                      prev.map((row, j) =>
                                        j === i
                                          ? { ...row, type: e.target.value as LaunchBindingRow["type"] }
                                          : row
                                      )
                                    )
                                  }
                                  className="input"
                                  style={{ flex: "0 0 118px" }}
                                >
                                  {BINDING_TYPE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={b.name}
                                  onChange={(e) =>
                                    setLaunchBindings((prev) =>
                                      prev.map((row, j) =>
                                        j === i ? { ...row, name: e.target.value } : row
                                      )
                                    )
                                  }
                                  placeholder="BINDING_NAME"
                                  className="input"
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                />
                                <input
                                  value={b.resource}
                                  onChange={(e) =>
                                    setLaunchBindings((prev) =>
                                      prev.map((row, j) =>
                                        j === i ? { ...row, resource: e.target.value } : row
                                      )
                                    )
                                  }
                                  placeholder="resource-name"
                                  className="input"
                                  autoCapitalize="none"
                                  autoCorrect="off"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLaunchBindings((prev) => prev.filter((_, j) => j !== i))
                                  }
                                  aria-label="Remove binding"
                                  className="btn ghost sm danger-hover"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="field">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span className="fieldset-div" style={{ margin: 0 }}>Environment variables</span>
                        <button
                          type="button"
                          onClick={() =>
                            setLaunchEnvVars((prev) => [
                              ...prev,
                              { key: "", value: "", kind: "secret" },
                            ])
                          }
                          className="btn outline sm"
                        >
                          + Add variable
                        </button>
                      </div>
                      {launchEnvVars.length === 0 ? (
                        <p className="pmute" style={{ fontSize: 12 }}>
                          Values are stored encrypted and applied to the project once the first
                          deploy succeeds.
                        </p>
                      ) : (
                        <div className="ev-rows">
                          {launchEnvVars.map((v, i) => (
                            <div key={i} className="ev-row">
                              <input
                                value={v.key}
                                onChange={(e) =>
                                  setLaunchEnvVars((prev) =>
                                    prev.map((row, j) =>
                                      j === i ? { ...row, key: e.target.value } : row
                                    )
                                  )
                                }
                                placeholder="KEY"
                                className="input"
                                style={{ flex: "1 1 32%" }}
                                autoCapitalize="none"
                                autoCorrect="off"
                              />
                              <select
                                value={v.kind}
                                onChange={(e) =>
                                  setLaunchEnvVars((prev) =>
                                    prev.map((row, j) =>
                                      j === i
                                        ? { ...row, kind: e.target.value as LaunchEnvVarRow["kind"] }
                                        : row
                                    )
                                  )
                                }
                                className="input"
                                style={{ flex: "0 0 96px" }}
                              >
                                <option value="secret">Secret</option>
                                <option value="text">Text</option>
                              </select>
                              <input
                                type={v.kind === "secret" ? "password" : "text"}
                                value={v.value}
                                onChange={(e) =>
                                  setLaunchEnvVars((prev) =>
                                    prev.map((row, j) =>
                                      j === i ? { ...row, value: e.target.value } : row
                                    )
                                  )
                                }
                                placeholder="value"
                                className="input"
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setLaunchEnvVars((prev) => prev.filter((_, j) => j !== i))
                                }
                                aria-label="Remove variable"
                                className="btn ghost sm danger-hover"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selected.type === "worker" && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          borderTop: "1px solid var(--np-line)",
                          paddingTop: 16,
                        }}
                      >
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={previewEnabled}
                            onChange={(e) => setPreviewEnabled(e.target.checked)}
                          />
                          Per-branch preview deployments
                        </label>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={provisionEnabled}
                            onChange={(e) => setProvisionEnabled(e.target.checked)}
                          />
                          Provisioning from pushed code
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="sum-rail">
                <div className="summary-card">
                  <h3>Selection</h3>
                  <dl className="sumrows">
                    <div className="sum-row">
                      <dt className="k">Language</dt>
                      <dd className="v">
                        {CATEGORIES.find((c) => c.id === selected.category)?.label}
                      </dd>
                    </div>
                    <div className="sum-row">
                      <dt className="k">Template</dt>
                      <dd className="v">{selected.name}</dd>
                    </div>
                    <div className="sum-row">
                      <dt className="k">Platform</dt>
                      <dd className="v">{platformLabel(selected)}</dd>
                    </div>
                    <div className="sum-row">
                      <dt className="k">Stack</dt>
                      <dd className="v">{templateStack(selected)}</dd>
                    </div>
                    <div className="sum-row">
                      <dt className="k">Visibility</dt>
                      <dd className="v">{isPrivate ? "Private repo" : "Public repo"}</dd>
                    </div>
                    <div className="sum-row">
                      <dt className="k">URL</dt>
                      <dd className="v acc" title="Assigned after deploy">
                        {selected.provider === "aws"
                          ? selected.type === "amplify"
                            ? "Amplify app URL"
                            : "API Gateway URL"
                          : selected.type === "pages"
                            ? "<name>.pages.dev"
                            : "<name>.<subdomain>.workers.dev"}
                      </dd>
                    </div>
                  </dl>

                  {error && <div className="alert-error">{error}</div>}

                  <div className="sum-card-cta">
                    <button
                      type="button"
                      onClick={handleLaunch}
                      disabled={submitting || isAmplify}
                      className="btn primary lg"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      {submitting
                        ? selected.source === "c3"
                          ? "Scaffolding with create-cloudflare, creating repo, pushing..."
                          : "Scaffolding, creating repo, pushing..."
                        : isAmplify
                          ? "Coming Soon"
                          : "Launch app"}
                    </button>
                  </div>
                  <div className="sum-card-ts">
                    <span className="status-dot ok" />
                    Auto-deploys on every push to {selected.type === "pages" ? "your branch" : "main"}.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn ghost sm"
                    style={{ flex: 1 }}
                  >
                    Change language
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn ghost sm"
                    style={{ flex: 1 }}
                  >
                    Change template
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}