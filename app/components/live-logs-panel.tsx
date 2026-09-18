"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/format";
import { Card, CardHeader, IconTerminal } from "./ui";

interface LiveLogsPanelProps {
  projectId: string;
  projectType: "worker" | "pages";
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

const MAX_ENTRIES = 200;

const OUTCOME_STYLE: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "rgba(12,138,92,0.25)", fg: "#7fdab4" },
  error: { bg: "rgba(179,38,30,0.3)", fg: "#f09b93" },
  canceled: { bg: "rgba(8,189,184,0.16)", fg: "#7fb5ae" },
  exceededCpu: { bg: "rgba(179,38,30,0.3)", fg: "#f09b93" },
  unknown: { bg: "rgba(150,107,3,0.25)", fg: "#e8c478" },
};

const LEVEL_LVL: Record<string, string> = {
  info: "info",
  warn: "warn",
  error: "err",
  ok: "ok",
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
    const path = u.pathname === "/" ? "/" : u.pathname;
    return `${u.host}${path}${u.search}`;
  } catch {
    return url;
  }
}

let entrySeq = 0;

export default function LiveLogsPanel({ projectId, projectType }: LiveLogsPanelProps) {
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [entries, setEntries] = useState<RenderedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && autoScroll) {
      el.scrollTop = el.scrollHeight;
    }
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

    setStreaming(true);

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
      if (block.startsWith("event: connected")) {
        setConnected(true);
      }
      if (block.startsWith("event: end")) {
        stop();
        return;
      }
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
      // aborted or stream error
    } finally {
      if (controllerRef.current === controller) {
        setStreaming(false);
        setConnected(false);
      }
    }
  }, [projectId, stop]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
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

  if (projectType !== "worker") {
    return (
      <Card>
        <CardHeader icon={<IconTerminal className="icon" />} title="Live logs" />
        <p className="pmute" style={{ padding: "0 18px 18px" }}>
          Live logs are not yet supported for Pages projects.
        </p>
      </Card>
    );
  }

  return (
    <div className="wb">
      <div className="wb-bar">
        <div className="wb-tabs">
          <button type="button" className="wb-tab on">
            <span className="live-dot" />
            live tail
          </button>
          {streaming && (
            <span style={{ color: connected ? "#63c9a4" : "#7fb5ae", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {connected ? "LISTENING" : "CONNECTING"}
            </span>
          )}
        </div>

        <div className="wb-live">
          {entries.length > 0 && (
            <span style={{ color: "#5c8b85", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              {entries.length} {entries.length === 1 ? "event" : "events"}
            </span>
          )}
          {streaming ? (
            <button type="button" onClick={stop} className="btn danger">
              Stop tail
            </button>
          ) : (
            <button type="button" onClick={() => void start()} className="btn primary">
              Tail live
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: 12,
            border: "1px solid rgba(150,107,3,0.35)",
            background: "rgba(150,107,3,0.12)",
            padding: "8px 12px",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: "#e8c478",
          }}
        >
          {error}
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="wb-body wblog"
        style={{ height: 320 }}
      >
        {entries.length === 0 ? (
          <p style={{ color: "#5c8b85", padding: "8px 0" }}>
            {streaming
              ? "Waiting for requests… send a request to your worker and it will appear here."
              : "Start a live tail to see requests hitting this worker in near real-time."}
          </p>
        ) : (
          entries.map((e) => {
            const os = OUTCOME_STYLE[e.outcome] ?? OUTCOME_STYLE.unknown;
            return (
              <div
                key={e.id}
                style={{
                  marginBottom: 12,
                  borderBottom: "1px solid rgba(8,189,184,0.12)",
                  paddingBottom: 8,
                }}
              >
                <div className="logline">
                  <span className="ts">{e.at}</span>
                  <span
                    className="lvl"
                    style={{ background: os.bg, color: os.fg, width: "auto", padding: "1px 8px" }}
                  >
                    {e.outcome}
                  </span>
                  {e.method && (
                    <span
                      style={{
                        color: METHOD_STYLE[e.method] ?? "#a8d8d1",
                        fontWeight: 600,
                        alignSelf: "center",
                      }}
                    >
                      {e.method}
                    </span>
                  )}
                  {e.url && (
                    <span style={{ color: "#a8d8d1", alignSelf: "center" }}>{e.url}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopyEntry(e)}
                    className="btn ghost sm"
                    style={{ marginLeft: "auto" }}
                  >
                    Copy
                  </button>
                </div>
                {e.logs.length > 0 &&
                  e.logs.map((l, i) => (
                    <div key={i} className="logline">
                      <span className="ts" />
                      <span className={`lvl${LEVEL_LVL[l.level] ? ` ${LEVEL_LVL[l.level]}` : ""}`}>
                        {l.level}
                      </span>
                      <span className="msg">{l.text}</span>
                    </div>
                  ))}
                {e.errors.map((err, i) => (
                  <div key={i} className="logline">
                    <span className="ts" />
                    <span className="lvl err">{err.name}</span>
                    <span className="msg" style={{ color: "#f09b93", whiteSpace: "pre-wrap" }}>
                      {err.message}
                      {err.stack ? `\n${err.stack}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div className="wb-cta">
        {entries.length > 0 && (
          <button type="button" onClick={() => setEntries([])} className="btn ghost sm">
            Clear
          </button>
        )}
        {!autoScroll && entries.length > 0 && (
          <button type="button" onClick={() => setAutoScroll(true)} className="btn outline sm">
            Resume autoscroll ↓
          </button>
        )}
        <span className="text">Ephemeral · may be sampled under high traffic</span>
        {streaming && (
          <span className="text" style={{ marginLeft: "auto" }}>
            {connected ? "streaming" : "connecting…"}
          </span>
        )}
      </div>
    </div>
  );
}