import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * SECRET KEY client — bypasses Row Level Security entirely. This must
 * NEVER be imported from any file that can run in the browser (no "use
 * client" file, no Client Component). It's for:
 *   - the one-time seed script (scripts/seed.ts)
 *   - genuinely admin-only server routes that intentionally need to read/
 *     write across all users' rows (e.g. a cohort export job)
 *
 * If you find yourself reaching for this inside a normal Route Handler that
 * serves a single user's request, stop — use src/lib/supabase/server.ts
 * instead and let RLS do its job. The secret key (sb_secret_...) is the one
 * credential in this whole stack that fully defeats your security model if
 * it leaks — same role a legacy service_role key played, just an opaque
 * token instead of a JWT now. Treat it accordingly.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from the browser.");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
