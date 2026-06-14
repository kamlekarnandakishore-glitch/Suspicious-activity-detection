import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchEvents } from "@/lib/api";
import { eventToUiAlert, isSuspiciousActivity } from "@/lib/alerts";
import { useNotifications } from "@/contexts/NotificationsContext";
import { subscribeToEventInserts } from "@/lib/events-realtime";
import { supabaseConfigured, type BackendEvent } from "@/lib/supabase";

function eventKey(e: BackendEvent): string {
  return String(
    e.id ??
      `${e.timestamp ?? ""}|${e.activity_type ?? ""}|${e.camera_id ?? ""}|${e.confidence ?? ""}`
  );
}

function notifyUser(alert: ReturnType<typeof eventToUiAlert>, push: (a: typeof alert) => void) {
  push(alert);

  const conf =
    alert.confidence !== undefined ? ` • ${(alert.confidence * 100).toFixed(0)}%` : "";

  toast.error(`🚨 ${alert.type}`, {
    description: `${alert.camera}${conf}`,
    duration: 8000,
    action: {
      label: "View",
      onClick: () => {
        window.location.href = "/alerts";
      },
    },
  });

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    document.hidden
  ) {
    new Notification(`Alert: ${alert.type}`, {
      body: `${alert.camera} — ${alert.time}`,
      tag: alert.id,
    });
  }
}

function handleNewEvent(
  row: BackendEvent,
  seen: Set<string>,
  push: (a: ReturnType<typeof eventToUiAlert>) => void
) {
  const key = eventKey(row);
  if (seen.has(key)) return;
  seen.add(key);

  if (!isSuspiciousActivity(row.activity_type ?? "")) return;

  const alert = eventToUiAlert(row, 0);
  notifyUser(alert, push);
}

/** Single app-level realtime listener (toasts + shared Supabase channel). */
export function useRealtimeNotifications() {
  const { pushNotification } = useNotifications();
  const queryClient = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());
  const pushRef = useRef(pushNotification);
  pushRef.current = pushNotification;

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const events = await fetchEvents();
        events.forEach((e) => seenRef.current.add(eventKey(e)));
      } catch {
        /* backend may be offline */
      }
    };

    bootstrap();

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    const unsubscribeRealtime = subscribeToEventInserts((row) => {
      if (cancelled) return;
      handleNewEvent(row, seenRef.current, (a) => pushRef.current(a));
    }, queryClient);

    const pollMs = supabaseConfigured ? 5000 : 2000;
    const pollId = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const events = await fetchEvents();
        queryClient.setQueryData(["events"], events);
        for (const e of events) {
          handleNewEvent(e, seenRef.current, (a) => pushRef.current(a));
        }
      } catch {
        /* ignore */
      }
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      unsubscribeRealtime();
    };
  }, [queryClient]);
}
