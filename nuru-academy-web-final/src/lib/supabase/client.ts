import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Client Component / browser usage:
 *   import { createClient } from "@/lib/supabase/client";
 *   const supabase = createClient();
 *   const { data } = await supabase.from("tracks").select("*");
 *
 * Safe to call repeatedly — createBrowserClient reuses a singleton under
 * the hood. Only the publishable key is used here; it's meant to be public
 * (RLS is what actually protects your data, not keeping this key secret).
 * The publishable key (sb_publishable_...) carries the same low privileges
 * as the legacy anon key — if your Supabase project still only shows a
 * legacy anon key, that works here too, just rename the env var to match.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
