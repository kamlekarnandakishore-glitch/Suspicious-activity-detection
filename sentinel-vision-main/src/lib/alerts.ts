import type { BackendEvent } from "./api";

export type Severity = "high" | "medium" | "low";

export interface UiAlert {
  id: string;
  type: string;
  camera: string;
  time: string;
  timestamp: string;
  severity: Severity;
  confidence?: number;
  imageUrl?: string | null;
  description: string;
  reviewed: boolean;
  rawDate: Date;
}

export function isAlertRecent(alert: UiAlert, seconds: number = 15): boolean {
  const diff = (Date.now() - alert.rawDate.getTime()) / 1000;
  return diff >= 0 && diff < seconds;
}

export function activityToSeverity(activity: string): Severity {
  const a = activity.toLowerCase();
  if (
    a.includes("violence") ||
    a.includes("fight") ||
    a.includes("weapon") ||
    a.includes("trespass") ||
    a.includes("restricted") ||
    a === "knife" ||
    a === "gun"
  ) {
    return "high";
  }
  if (a.includes("loiter") || a.includes("abnormal") || a.includes("running")) {
    return "medium";
  }
  return "low";
}

export function formatTimeAgo(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatClock(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function eventToUiAlert(e: BackendEvent, index: number): UiAlert {
  const type = e.activity_type ?? "Unknown";
  const conf = typeof e.confidence === "number" ? e.confidence : undefined;

  // Use backend severity if available, otherwise calculate from activity type
  let severity: Severity = activityToSeverity(type);
  if (e.severity) {
    const s = e.severity.toLowerCase();
    if (s === "high" || s === "medium" || s === "low") {
      severity = s as Severity;
    }
  }

  const camera = e.camera_id ?? "CAM_01";

  return {
    id: String(e.id ?? `${e.timestamp ?? "t"}-${type}-${index}`),
    type,
    camera,
    time: formatTimeAgo(e.timestamp),
    timestamp: formatTimestamp(e.timestamp),
    severity,
    confidence: conf,
    imageUrl: e.image_url,
    reviewed: false,
    rawDate: e.timestamp ? new Date(e.timestamp) : new Date(),
    description: `Detected ${type} on ${camera}${
      conf !== undefined ? ` with AI confidence ${(conf * 100).toFixed(1)}%.` : "."
    }`,
  };
}

export function isSuspiciousActivity(type: string): boolean {
  const t = type.toLowerCase();
  if (t === "normal" || t === "nonviolence" || t.startsWith("collecting")) {
    return false;
  }
  return true;
}

export const severityStyles: Record<Severity, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-primary/10 text-primary border-primary/30",
};
