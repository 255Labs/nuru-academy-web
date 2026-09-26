import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Server Component / Route Handler / Server Action usage:
 *   import { createClient } from "@/lib/supabase/server";
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 * Must be called fresh per-request (it reads the current request's cookies),
 * so don't hoist this into a module-level singleton the way the browser
 * client can be.
 *
 * The `setAll` catch below is intentional and documented by Supabase: it
 * only throws when called from a Server Component (which cannot set
 * cookies), and in that case the middleware (see middleware.ts) is already
 * responsible for refreshing the session — so it's safe to swallow there.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
}
