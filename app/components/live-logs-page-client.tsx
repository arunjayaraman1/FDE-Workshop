"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/format";

interface LiveLogsPageClientProps {
  projectId: string;
  projectName: string;
}

interface TailLogEntry {
  level?: string;
  message: unknown[];
  timestamp?: number;
}

interface TailException {
  name: string;
  message: unknown;
  timestamp?: number;
  stack?: string;
}

interface TailEvent {
  request?: { method?: string; url?: string };
  cron?: string;
}

interface TailEventMessage {
  outcome: string;
  eventTimestamp?: number;
  logs?: TailLogEntry[];
  exceptions?: TailException[];
  event?: TailEvent | null;
}

interface RenderedEntry {
  id: number;
  at: string;
  outcome: string;
  method?: string;
  url?: string;
  logs: Array<{ level: string; text: string }>;
  errors: Array<{ name: string; message: string; stack?: string }>;
}

const MAX_ENTRIES = 500;
let entrySeq = 0;

function stringifyMessage(msg: unknown): string {
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

const OUTCOME_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "rgba(12,138,92,0.25)", fg: "#7fdab4" },
  error: { bg: "rgba(179,38,30,0.3)", fg: "#f09b93" },
  canceled: { bg: "rgba(8,189,184,0.16)", fg: "#7fb5ae" },
  exceededCpu: { bg: "rgba(179,38,30,0.3)", fg: "#f09b93" },
  unknown: { bg: "rgba(150,107,3,0.25)", fg: "#e8c478" },
};

const LEVEL_STYLE: Record<string, string> = {
  log: "#a8d8d1",
  info: "#7fd3ed",
  debug: "#5c8b85",
  warn: "#e8c478",
  error: "#f09b93",
};

const METHOD_STYLE: Record<string, string> = {
  GET: "#7fdab4",
  HEAD: "#7fb5ae",
  POST: "#e8c478",
  PUT: "#7fd3ed",
  PATCH: "#7fd3ed",
  DELETE: "#f09b93",
  OPTIONS: "#7fb5ae",
};

// Static branch list – in a real scenario you could fetch from GitHub API
const BRANCHES = ["main", "dev", "staging", "feature/preview", "fix/hotfix"];

export default function LiveLogsPageClient({ projectId, projectName }: LiveLogsPageClientProps) {
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [entries, setEntries] = useState<RenderedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && autoScroll) el.scrollTop = el.scrollHeight;
  }, [entries, connected, autoScroll]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(false);
    setConnected(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setEntries([]);
    setAutoScroll(true);

    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);

    let res: Response;
    try {
      res = await fetch(`/api/projects/${projectId}/logs/live`, { signal: controller.signal });
    } catch {
      setStreaming(false);
      setConnected(false);
      setError("Failed to start the live log stream.");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStreaming(false);
      setConnected(false);
      setError(data?.error ?? `Live logs returned HTTP ${res.status}.`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      setStreaming(false);
      setError("Live logs are not supported by this browser.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    const handleBlock = (block: string) => {
      const dataLines = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (block.startsWith("event: connected")) setConnected(true);
      if (block.startsWith("event: end")) { stop(); return; }
      for (const raw of dataLines) {
        if (!raw) continue;
        let msg: TailEventMessage;
        try {
          msg = JSON.parse(raw) as TailEventMessage;
        } catch {
          continue;
        }
        const at = msg.eventTimestamp ? new Date(msg.eventTimestamp).toLocaleTimeString() : "";
        const request = msg.event?.request;
        const logs = (msg.logs ?? []).map((l) => ({
          level: l.level ?? "log",
          text: (l.message ?? []).map(stringifyMessage).join(" "),
        }));
        const errors = (msg.exceptions ?? []).map((e) => ({
          name: e.name,
          message: stringifyMessage(e.message),
          stack: e.stack,
        }));
        const entry: RenderedEntry = {
          id: entrySeq++,
          at,
          outcome: msg.outcome,
          method: request?.method,
          url: request?.url ? describeUrl(request.url) : undefined,
          logs,
          errors,
        };
        setEntries((prev) => [...prev.slice(-(MAX_ENTRIES - 1)), entry]);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleBlock(block);
        }
      }
    } catch {
      // Aborted or stream error
    } finally {
      if (controllerRef.current === controller) {
        setStreaming(false);
        setConnected(false);
      }
    }
  }, [projectId, stop]);

  useEffect(() => {
    return () => { controllerRef.current?.abort(); };
  }, []);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
    if (atBottom !== autoScroll) setAutoScroll(atBottom);
  }

  async function handleCopyEntry(entry: RenderedEntry) {
    const lines = [
      `${entry.at} ${entry.method ?? ""} ${entry.url ?? ""} [${entry.outcome}]`,
      ...entry.logs.map((l) => `[${l.level}] ${l.text}`),
      ...entry.errors.map((e) => `${e.name}: ${e.message}`),
    ];
    await copyToClipboard(lines.join("\n"));
  }

  return (
    <div
      className="fixed inset-y-0 right-0 left-0 top-16 lg:top-0 lg:left-[var(--sidebar-w,16rem)] z-20 flex flex-col"
      style={{ background: "#042422" }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between border-b px-6 py-3.5"
        style={{ borderColor: "rgba(8,189,184,0.18)", background: "#06302e" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-2 text-sm transition-colors hover:brightness-125"
            style={{ color: "#7fb5ae" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to project
          </Link>
          <span className="h-5 w-px" style={{ background: "rgba(8,189,184,0.18)" }} />
          <div className="flex items-center gap-2.5">
            <svg className="h-4 w-4" style={{ color: "#7fb5ae" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l6-5-6-5" /><path d="M12 19h8" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: "#d7f0ec" }}>Live Logs</span>
            <span
              className="rounded-md border px-2 py-0.5 font-mono text-[11px]"
              style={{ borderColor: "rgba(8,189,184,0.35)", background: "rgba(8,189,184,0.1)", color: "#7fdad7" }}
            >
              {projectName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {streaming && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "animate-pulse" : ""}`}
                style={{
                  background: connected ? "#63c9a4" : "#5c8b85",
                  boxShadow: connected ? "0 0 7px rgba(99,201,164,0.7)" : "none",
                }}
              />
              <span style={{ color: connected ? "#7fdab4" : "#7fb5ae" }}>
                {connected ? "LISTENING" : "CONNECTING…"}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5" style={{ color: "#5c8b85" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
            <select
              id="live-logs-branch-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={streaming}
              className="rounded-lg border px-3 py-1.5 font-mono text-xs outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: "rgba(8,189,184,0.25)",
                background: "#06302e",
                color: "#a8d8d1",
              }}
            >
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {streaming ? (
            <button
              type="button"
              id="live-logs-stop-btn"
              onClick={stop}
              className="btn danger"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              id="live-logs-connect-btn"
              onClick={() => void start()}
              className="btn primary"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="mx-6 mt-4 rounded-lg border px-4 py-3 font-mono text-xs"
          style={{
            borderColor: "rgba(150,107,3,0.4)",
            background: "rgba(150,107,3,0.12)",
            color: "#e8c478",
          }}
        >
          {error}
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-5 font-mono text-xs leading-relaxed"
        style={{ background: "#042422" }}
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg className="h-8 w-8" style={{ color: "#3e6b64" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l6-5-6-5" /><path d="M12 19h8" />
            </svg>
            <p style={{ color: "#5c8b85" }}>
              {streaming
                ? "Waiting for requests… send a request to your worker and it will appear here."
                : `Select a branch and click Connect to start streaming live logs from ${projectName}.`}
            </p>
          </div>
        ) : (
          entries.map((e) => {
            const os = OUTCOME_STYLE[e.outcome] ?? OUTCOME_STYLE.unknown;
            return (
              <div
                key={e.id}
                className="group mb-4 border-b pb-3 last:border-0 last:pb-0"
                style={{ borderColor: "rgba(8,189,184,0.12)" }}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span style={{ color: "#5c8b85" }}>{e.at}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: os.bg, color: os.fg }}
                  >
                    {e.outcome}
                  </span>
                  {e.method && (
                    <span className="font-bold" style={{ color: METHOD_STYLE[e.method] ?? "#a8d8d1" }}>
                      {e.method}
                    </span>
                  )}
                  {e.url && (
                    <span style={{ color: "#a8d8d1" }}>{e.url}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopyEntry(e)}
                    className="ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] transition-colors group-hover:inline-flex"
                    style={{ borderColor: "rgba(8,189,184,0.25)", color: "#7fb5ae" }}
                  >
                    Copy
                  </button>
                </div>
                {e.logs.length > 0 &&
                  e.logs.map((l, i) => (
                    <div key={i} className="mt-1 pl-2">
                      <span className="font-semibold" style={{ color: LEVEL_STYLE[l.level] ?? "#a8d8d1" }}>
                        [{l.level}]
                      </span>{" "}
                      <span style={{ color: "#a8d8d1" }}>{l.text}</span>
                    </div>
                  ))}
                {e.errors.map((err, i) => (
                  <div key={i} className="mt-1 whitespace-pre-wrap pl-2" style={{ color: "#f09b93" }}>
                    {err.name}: {err.message}
                    {err.stack && (
                      <span className="block" style={{ color: "rgba(240,155,147,0.6)" }}>{err.stack}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div
        className="flex items-center justify-between border-t px-6 py-2.5"
        style={{ borderColor: "rgba(8,189,184,0.18)", background: "#06302e" }}
      >
        <div className="flex items-center gap-4 text-xs" style={{ color: "#5c8b85" }}>
          <div className="flex items-center gap-2">
            <span>Events</span>
            <span
              className="rounded border px-2 py-0.5 font-mono"
              style={{ borderColor: "rgba(8,189,184,0.25)", background: "#06302e", color: "#a8d8d1" }}
            >
              {entries.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Branch</span>
            <span
              className="rounded border px-2 py-0.5 font-mono"
              style={{ borderColor: "rgba(8,189,184,0.25)", background: "#06302e", color: "#a8d8d1" }}
            >
              {streaming ? selectedBranch : "—"}
            </span>
          </div>
          <span style={{ color: "#3e6b64" }}>Ephemeral · may be sampled under high traffic</span>
        </div>

        <div className="flex items-center gap-3">
          {!autoScroll && entries.length > 0 && (
            <button
              type="button"
              onClick={() => setAutoScroll(true)}
              className="btn outline sm"
            >
              Resume scroll ↓
            </button>
          )}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setEntries([])}
              className="btn ghost sm"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}