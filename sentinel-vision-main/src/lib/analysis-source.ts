import { API_BASE } from "@/lib/api-base";
import { appendAuthQuery, authHeaders, handleUnauthorized } from "@/lib/auth";

export interface AnalysisSourceStatus {
  mode: "webcam" | "file";
  revision: number;
  webcam_available: boolean;
  capture_open: boolean;
  file_name: string | null;
  has_file: boolean;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const auth = authHeaders();
  if (auth.Authorization) headers.set("Authorization", auth.Authorization as string);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  return res;
}

export async function fetchAnalysisStatus(): Promise<AnalysisSourceStatus> {
  const res = await apiFetch(`${API_BASE}/analysis/status`);
  if (!res.ok) throw new Error("Failed to load analysis source status");
  return res.json();
}

export async function setAnalysisSource(source: "webcam" | "file"): Promise<AnalysisSourceStatus> {
  const res = await apiFetch(`${API_BASE}/analysis/source`, {
    method: "POST",
    body: JSON.stringify({ source }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body && typeof body.error === "string" ? body.error : null) || "Failed to switch source");
  }
  return body as AnalysisSourceStatus;
}

export async function uploadAnalysisVideo(file: File): Promise<AnalysisSourceStatus> {
  const form = new FormData();
  form.append("video", file);
  const res = await apiFetch(`${API_BASE}/analysis/upload`, {
    method: "POST",
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body && typeof body.error === "string" ? body.error : null) || "Upload failed");
  }
  return body as AnalysisSourceStatus;
}

export function videoFeedUrlWithRevision(revision: number): string {
  const base = appendAuthQuery(`${API_BASE}/video_feed`);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${revision}`;
}
