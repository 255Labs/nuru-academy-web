import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/session-taken", "/verify", "/onboarding"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user, session } } = await supabase.auth.getUser().then(async (u) => {
    if (u.data.user) {
      const s = await supabase.auth.getSession();
      return { data: { user: u.data.user, session: s.data.session } };
    }
    return { data: { user: null, session: null } };
  });

  const pathname  = request.nextUrl.pathname;
  const isPublic  = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isApi     = pathname.startsWith("/api/");
  const isRoot    = pathname === "/";
  const isAdmin   = pathname.startsWith("/nrx-ctrl-9f4a");
  const isStatic  = pathname.startsWith("/_next") || pathname.includes(".");

  // Not logged in — redirect to login
  if (!user && !isPublic && !isApi && !isRoot && !isStatic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── Session lock check ────────────────────────────────────────────────────
  // For logged-in users on non-public, non-static routes, validate that
  // their current session token matches what's stored in the DB.
  // If it doesn't match, someone else has logged in — kick this user out.
  if (user && session && !isPublic && !isApi && !isRoot && !isStatic) {
    try {
      // Extract jti from JWT payload
      const payloadB64 = session.access_token.split(".")[1];
      let sessionToken = session.access_token;
      try {
        const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());
        sessionToken = payload.jti ?? session.access_token;
      } catch { /* use full token */ }

      const { data: isValid } = await supabase.rpc("validate_session", {
        p_session_token: sessionToken,
      });

      // Session is invalid (another device logged in) — kick to session-taken page
      if (isValid === false) {
        // Sign them out locally
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/session-taken";
        return NextResponse.redirect(url);
      }
    } catch {
      // If session table doesn't exist yet (schema not run), allow through
      // This prevents a chicken-and-egg problem during initial setup
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|nuru/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
