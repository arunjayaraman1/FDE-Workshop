"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface InviteAcceptFormProps {
  token: string;
}

type InviteState = "pending" | "accepted" | "expired";

export default function InviteAcceptForm({ token }: InviteAcceptFormProps) {
  const [projectName, setProjectName] = useState<string | null>(null);
  const [role, setRole] = useState<string>("member");
  const [state, setState] = useState<InviteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "This invite link is invalid.");
          return;
        }
        setProjectName(data.projectName);
        setRole(data.role);
        setState(data.state);
      })
      .catch(() => setError("Failed to load the invite."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, username, githubUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to accept the invite.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Is the Launchpad server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="pmute">Loading invite…</p>;
  }

  if (error && !projectName) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="alert-error">{error}</div>
        <Link href="/login" className="link">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (state && state !== "pending" && !done) {
    return (
      <div className="callout warn" style={{ marginTop: 0 }}>
        <span className="icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </span>
        <span>
          This invite has already been {state === "accepted" ? "used" : "expired"}.
        </span>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="alert-ok">
          You&apos;ve joined <span style={{ fontWeight: 600 }}>{projectName}</span> as a {role}.
        </div>
        <p className="pmute">
          Sign in with the Launchpad password and the username you chose to access the project.
        </p>
        <Link href="/login" className="btn primary lg" style={{ justifyContent: "center" }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleAccept}>
      <div className="callout info" style={{ marginTop: 0, marginBottom: 18, textAlign: "left" }}>
        <span className="icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
            <path d="M9 21v-4h6v4" />
            <path d="M9 11h6" />
          </svg>
        </span>
        <span>
          You&apos;ve been invited to{" "}
          <span style={{ fontWeight: 700 }}>{projectName}</span> as a{" "}
          <span style={{ fontWeight: 700, color: "var(--np-teal-700)" }}>{role}</span>.
        </span>
      </div>

      <div className="field">
        <label>Choose a username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. jane-doe"
          autoComplete="username"
          autoFocus
          className="input"
        />
        <span className="help">Lowercase letters, numbers, dots, dashes or underscores.</span>
      </div>

      <div className="field">
        <label>GitHub username (optional)</label>
        <input
          value={githubUsername}
          onChange={(e) => setGithubUsername(e.target.value)}
          placeholder="Your GitHub handle"
          autoComplete="off"
          className="input"
        />
        <span className="help">
          Adding this invites you as a collaborator on the project&apos;s GitHub repo.
        </span>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <button type="submit" disabled={submitting} className="btn primary lg" style={{ width: "100%", justifyContent: "center" }}>
        {submitting ? "Joining…" : "Accept invite"}
      </button>
    </form>
  );
}