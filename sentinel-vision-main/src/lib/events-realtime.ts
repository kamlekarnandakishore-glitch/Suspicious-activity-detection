import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, supabaseConfigured, type BackendEvent } from "@/lib/supabase";

function eventKey(e: BackendEvent): string {
  return String(
    e.id ??
      `${e.timestamp ?? ""}|${e.activity_type ?? ""}|${e.camera_id ?? ""}|${e.confidence ?? ""}`
  );
}

let sharedChannel: RealtimeChannel | null = null;
let subscriberCount = 0;

type InsertHandler = (row: BackendEvent) => void;

const insertHandlers = new Set<InsertHandler>();

function ensureChannel(queryClient: QueryClient) {
  if (!supabaseConfigured || !supabase || sharedChannel) return;

  sharedChannel = supabase
    .channel("sentinel-events-shared")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "events" },
      (payload) => {
        const row = payload.new as BackendEvent;
        queryClient.setQueryData<BackendEvent[]>(["events"], (prev) => {
          const list = prev ?? [];
          const key = eventKey(row);
          if (list.some((e) => eventKey(e) === key)) return list;
          return [row, ...list];
        });
        insertHandlers.forEach((fn) => fn(row));
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "events" },
      () => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "events" },
      (payload) => {
        const removed = payload.old as BackendEvent;
        queryClient.setQueryData<BackendEvent[]>(["events"], (prev) => {
          const list = prev ?? [];
          const key = eventKey(removed);
          return list.filter((e) => eventKey(e) !== key);
        });
      }
    )
    .subscribe();
}

export function subscribeToEventInserts(handler: InsertHandler, queryClient: QueryClient) {
  if (!supabaseConfigured || !supabase) {
    return () => {};
  }

  insertHandlers.add(handler);
  subscriberCount += 1;
  ensureChannel(queryClient);

  return () => {
    insertHandlers.delete(handler);
    subscriberCount -= 1;
    if (subscriberCount <= 0 && sharedChannel && supabase) {
      supabase.removeChannel(sharedChannel);
      sharedChannel = null;
      subscriberCount = 0;
    }
  };
}
