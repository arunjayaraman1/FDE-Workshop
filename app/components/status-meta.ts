import type { ProjectStatus } from "@/lib/types";

export interface StatusMeta {
  label: string;
  className: string;
  dotClass: string;
  pulse?: boolean;
}

const META: Record<string, StatusMeta> = {
  queued: {
    label: "Queued",
    className: "pill warn",
    dotClass: "warn",
  },
  running: {
    label: "Deploying",
    className: "pill info pulse",
    dotClass: "info",
    pulse: true,
  },
  success: {
    label: "Deployed",
    className: "pill ok",
    dotClass: "ok",
  },
  failure: {
    label: "Failed",
    className: "pill err",
    dotClass: "err",
  },
  cancelled: {
    label: "Cancelled",
    className: "pill flat",
    dotClass: "flat",
  },
  "no-runs": {
    label: "No deploys yet",
    className: "pill flat",
    dotClass: "flat",
  },
  unknown: {
    label: "Unknown",
    className: "pill flat",
    dotClass: "flat",
  },
};

export function getStatusMeta(status: ProjectStatus | string | undefined): StatusMeta {
  return META[status ?? "unknown"] ?? META.unknown;
}