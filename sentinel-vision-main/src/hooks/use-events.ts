import { useQuery } from "@tanstack/react-query";
import { fetchEvents, type BackendEvent } from "@/lib/api";
import { eventToUiAlert, isSuspiciousActivity, type UiAlert } from "@/lib/alerts";
import { supabase, supabaseConfigured } from "@/lib/supabase";

async function loadEvents(): Promise<BackendEvent[]> {
  if (supabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(500);

    if (!error && data) {
      return data as BackendEvent[];
    }
  }

  return fetchEvents();
}

/** Events list (realtime updates via app-level subscription in useRealtimeNotifications). */
export function useEvents(pollMs = 3000) {
  const query = useQuery({
    queryKey: ["events"],
    queryFn: loadEvents,
    refetchInterval: pollMs,
    staleTime: 500,
    retry: 1,
  });

  const uiAlerts: UiAlert[] = (query.data ?? [])
    .filter((e) => isSuspiciousActivity(e.activity_type ?? ""))
    .map((e, i) => eventToUiAlert(e, i));

  const allUiAlerts: UiAlert[] = (query.data ?? []).map((e, i) => eventToUiAlert(e, i));

  return { ...query, uiAlerts, allUiAlerts };
}
