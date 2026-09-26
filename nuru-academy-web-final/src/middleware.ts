import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

/**
 * Runs on every request. Two jobs:
 *  1. Refresh the Supabase auth session cookie (access tokens are short-
 *     lived; without this, Server Components would see stale/expired
 *     sessions on the first request after expiry).
 *  2. Redirect signed-out visitors away from protected routes to /login.
 *
 * "/" is deliberately NOT in the redirect branch below — src/app/page.tsx
 * checks auth itself and renders the public marketing LandingPage for
 * signed-out visitors, or the real dashboard for signed-in users, at the
 * same URL. Redirecting "/" here would mean a stranger can never see what
 * Nuru AI Academy even is before signing up.
 *
 * This is the official Supabase-recommended pattern for the Next.js App
 * Router — see https://supabase.com/docs/guides/auth/server-side/nextjs.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
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

  // IMPORTANT: do not remove this call. It revalidates the session and is
  // what actually performs the refresh described above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const isRoot = request.nextUrl.pathname === "/";

  // API routes return their own 401 JSON (see src/app/api/chat/route.ts) —
  // redirecting them to an HTML login page would break `fetch()` callers
  // expecting JSON. "/" handles its own signed-out state (see page.tsx).
  if (!user && !isPublic && !isApiRoute && !isRoot) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static, _next/image (Next.js internals)
     *  - favicon.ico and other public assets
     *  - anything under /nuru/ (the mascot art)
     */
    "/((?!_next/static|_next/image|favicon.ico|nuru/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
