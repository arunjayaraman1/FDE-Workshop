"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setShake(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setShake(true);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error. Is the Launchpad server running?");
      setShake(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="lp-eyebrow">Secure sign-in</div>
      <h2>Welcome back</h2>
      <p className="sub">Sign in with your workspace credentials to keep deploying.</p>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={handleLogin} className={shake ? "shake" : undefined}>
        <div className="field">
          <label htmlFor="lp-user">Username</label>
          <input
            id="lp-user"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username (from an invite)"
            autoComplete="username"
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="lp-pass">Password</label>
          <input
            id="lp-pass"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Launchpad password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="in-row">
          <label className="check">
            <input type="checkbox" defaultChecked />
            Keep me signed in
          </label>
          <a className="link" href="#" onClick={(e) => e.preventDefault()}>
            Forgot password?
          </a>
        </div>
        <button type="submit" disabled={submitting} className="btn primary lg" style={{ width: "100%" }}>
          {submitting ? "Signing in…" : "Sign in to Launchpad"}
        </button>
      </form>
    </>
  );
}