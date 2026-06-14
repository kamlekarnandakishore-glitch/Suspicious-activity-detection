import type { BackendEvent } from "@/lib/api";
import { isSuspiciousActivity } from "@/lib/alerts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const PIE_COLORS = [
  "hsl(0, 85%, 55%)",
  "hsl(38, 92%, 55%)",
  "hsl(192, 95%, 55%)",
  "hsl(142, 70%, 45%)",
  "hsl(280, 65%, 55%)",
  "hsl(215, 20%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(160, 60%, 45%)",
];

export interface TimeSeriesPoint {
  day?: string;
  week?: string;
  alerts: number;
  normal: number;
}

export interface PieSlice {
  name: string;
  value: number;
  color: string;
  count: number;
}

export interface CameraAlertPoint {
  camera: string;
  alerts: number;
}

export interface HourlyActivityPoint {
  time: string;
  normal: number;
  suspicious: number;
}

function parseEventTime(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatActivityLabel(type: string): string {
  const t = type.trim();
  if (!t) return "Unknown";
  if (t.length <= 24) return t;
  return `${t.slice(0, 22)}…`;
}

/** Last 7 calendar days — alerts vs normal activity counts. */
export function buildWeeklySeries(events: BackendEvent[]): TimeSeriesPoint[] {
  const today = startOfDay(new Date());
  const points: TimeSeriesPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    let alerts = 0;
    let normal = 0;

    for (const e of events) {
      const t = parseEventTime(e.timestamp);
      if (!t || !isSameDay(t, day)) continue;
      if (isSuspiciousActivity(e.activity_type ?? "")) alerts += 1;
      else normal += 1;
    }

    points.push({
      day: DAY_LABELS[day.getDay()],
      alerts,
      normal,
    });
  }

  return points;
}

/** Last 4 weeks (7-day buckets) — alerts vs normal. */
export function buildMonthlySeries(events: BackendEvent[]): TimeSeriesPoint[] {
  const today = startOfDay(new Date());
  const points: TimeSeriesPoint[] = [];

  for (let w = 3; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    let alerts = 0;
    let normal = 0;

    for (const e of events) {
      const t = parseEventTime(e.timestamp);
      if (!t) continue;
      const d = startOfDay(t);
      if (d < weekStart || d > weekEnd) continue;
      if (isSuspiciousActivity(e.activity_type ?? "")) alerts += 1;
      else normal += 1;
    }

    points.push({ week: `W${4 - w}`, alerts, normal });
  }

  return points;
}

/** Suspicious activity breakdown (percent of suspicious events). */
export function buildActivityPie(events: BackendEvent[]): PieSlice[] {
  const counts = new Map<string, number>();

  for (const e of events) {
    const type = e.activity_type ?? "Unknown";
    if (!isSuspiciousActivity(type)) continue;
    const label = formatActivityLabel(type);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      count,
      value: Math.round((count / total) * 100),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
}

/** Suspicious alert count per camera. */
export function buildCameraAlerts(events: BackendEvent[]): CameraAlertPoint[] {
  const counts = new Map<string, number>();

  for (const e of events) {
    if (!isSuspiciousActivity(e.activity_type ?? "")) continue;
    const cam = e.camera_id ?? "CAM_01";
    counts.set(cam, (counts.get(cam) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([camera, alerts]) => ({ camera, alerts }))
    .sort((a, b) => b.alerts - a.alerts);
}

/** Last 24 hours in 4-hour buckets (matches dashboard activity chart). */
export function buildHourlyActivity(events: BackendEvent[]): HourlyActivityPoint[] {
  const now = Date.now();
  const bucketMs = 4 * 60 * 60 * 1000;
  const buckets: HourlyActivityPoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const end = now - i * bucketMs;
    const start = end - bucketMs;
    const d = new Date(end);
    const label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let suspicious = 0;
    let normal = 0;

    for (const e of events) {
      const t = parseEventTime(e.timestamp);
      if (!t) continue;
      const ms = t.getTime();
      if (ms <= start || ms > end) continue;
      if (isSuspiciousActivity(e.activity_type ?? "")) suspicious += 1;
      else normal += 1;
    }

    buckets.push({ time: label, normal, suspicious });
  }

  return buckets;
}

export function analyticsSummary(events: BackendEvent[]) {
  const suspicious = events.filter((e) =>
    isSuspiciousActivity(e.activity_type ?? "")
  ).length;
  return {
    total: events.length,
    suspicious,
    normal: events.length - suspicious,
  };
}
