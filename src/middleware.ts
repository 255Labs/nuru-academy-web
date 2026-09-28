import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/session-taken", "/verify", "/onboarding"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // ── Always refresh the Supabase session cookie (required by @supabase/ssr) ──
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

  // Refresh session — required so Supabase rotates the token if needed.
  // We use getUser() (not getSession()) because it verifies the JWT server-side.
  const { data: { user } } = await supabase.auth.getUser();

  const isPublic  = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isApi     = pathname.startsWith("/api/");
  const isRoot    = pathname === "/";
  const isAdmin   = pathname.startsWith("/nrx-ctrl-9f4a");
  const isStatic  = pathname.startsWith("/_next") || pathname.includes(".");

  // Admin routes: skip regular auth (admin has its own PIN auth)
  if (isAdmin) return response;

  // Not logged in — redirect to login (but never loop on public/root/static/api)
  if (!user && !isPublic && !isApi && !isRoot && !isStatic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|nuru/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
