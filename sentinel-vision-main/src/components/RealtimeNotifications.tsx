import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

/** Mount once at app root to enable live alert toasts + notification feed updates. */
export function RealtimeNotifications() {
  useRealtimeNotifications();
  return null;
}
