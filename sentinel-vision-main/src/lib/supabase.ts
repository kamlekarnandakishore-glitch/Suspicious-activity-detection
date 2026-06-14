import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BackendEvent } from "@/lib/api";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!)
  : null;

export type { BackendEvent };
