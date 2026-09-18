"use client";

import { useEffect, useState } from "react";
import type { ProjectStatusResult } from "@/lib/types";
import { getStatusMeta } from "./status-meta";

interface StatusBadgeProps {
  projectId: string;
}

export default function StatusBadge({ projectId }: StatusBadgeProps) {
  const [status, setStatus] = useState<ProjectStatusResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/status`);
        if (res.ok && !cancelled) {
          setStatus((await res.json()) as ProjectStatusResult);
        }
      } catch {
        // keep last known status; server may be restarting
      }
    };

    void tick();
    const interval = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  const badge = getStatusMeta(status?.status);

  return (
    <span className={badge.className} title={status?.error}>
      <span className="dot" />
      {badge.label}
    </span>
  );
}
