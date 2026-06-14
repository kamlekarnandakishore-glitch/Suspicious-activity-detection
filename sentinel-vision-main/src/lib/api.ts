import { API_BASE } from "@/lib/api-base";
import { appendAuthQuery, authHeaders, handleUnauthorized } from "@/lib/auth";

export { API_BASE };

export interface BackendEvent {
  id?: string | number;
  person_id?: string;
  activity_type: string;
  confidence?: number;
  image_url?: string | null;
  camera_id?: string;
  timestamp?: string;
  severity?: string;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const auth = authHeaders();
  if (auth.Authorization) headers.set("Authorization", auth.Authorization as string);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired — please sign in again");
  }
  return res;
}

export async function loginAdmin(email: string, password: string): Promise<{ token: string; user: { email: string; role: string } }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body && typeof body.error === "string" ? body.error : null) || "Login failed");
  }
  return body;
}

export async function fetchCurrentAdmin(): Promise<{ email: string; role: string }> {
  const res = await apiFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "healthy";
  } catch {
    return false;
  }
}

export async function fetchEvents(): Promise<BackendEvent[]> {
  const res = await apiFetch(`${API_BASE}/events`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Failed to fetch events (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function videoFeedUrl(): string {
  return appendAuthQuery(`${API_BASE}/video_feed`);
}

export function alertImageUrl(filename?: string | null): string | null {
  if (!filename || filename === "—") return null;
  return appendAuthQuery(`${API_BASE}/alerts/${encodeURIComponent(filename)}`);
}

export interface SecurityContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  notify_email?: boolean;
  notify_sms?: boolean;
  active?: boolean;
  created_at?: string;
}

export interface AlertDispatch {
  id: string;
  event_id?: number | null;
  contact_id?: string | null;
  contact_name?: string | null;
  channel: string;
  status: string;
  detail?: string | null;
  sent_at?: string;
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function fetchSecurityContacts(): Promise<SecurityContact[]> {
  const res = await apiFetch(`${API_BASE}/security/contacts`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(
      await readApiError(res, `Failed to load security contacts (${res.status})`)
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function addSecurityContact(contact: {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  notify_email?: boolean;
  notify_sms?: boolean;
}): Promise<SecurityContact> {
  const res = await apiFetch(`${API_BASE}/security/contacts`, {
    method: "POST",
    body: JSON.stringify(contact),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add contact");
  }
  return res.json();
}

export async function deleteSecurityContact(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/security/contacts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete contact");
}

export async function fetchAlertDispatches(): Promise<AlertDispatch[]> {
  const res = await apiFetch(`${API_BASE}/security/dispatches`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(
      await readApiError(res, `Failed to load dispatch log (${res.status})`)
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sendTestSecurityAlert(): Promise<{ message?: string; results?: unknown[] }> {
  const res = await apiFetch(`${API_BASE}/security/test-alert`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body && typeof body.error === "string" ? body.error : null) || "Test alert failed"
    );
  }
  return body;
}
