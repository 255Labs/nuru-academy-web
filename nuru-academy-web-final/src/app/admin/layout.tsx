import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Real server-side gate for everything under /admin, using the actual
 * `profiles.role` column — not the client-side Zustand toggle in Settings,
 * which is a UI preview only and proves nothing about a real account.
 *
 * `profiles.role` cannot be self-escalated by a normal signed-in user (see
 * the protect_profile_privileged_columns trigger in schema.sql, verified
 * against a real Postgres instance), so this check is meaningful. To make
 * a real account an admin, run this in the Supabase SQL Editor (which
 * bypasses the trigger, same as any service-role write):
 *
 *   update public.profiles set role = 'admin' where email = 'you@example.com';
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") redirect("/?admin_denied=1");

  return (
    <div>
      {/* Admin top bar with CMS link */}
      <div className="bg-nuru-purple/5 border-b border-nuru-purple/10 px-6 py-2 flex items-center gap-4 text-xs">
        <span className="font-bold text-nuru-purple">⚙ Admin</span>
        <a href="/admin" className="text-nuru-ink2 hover:text-nuru-purple font-semibold">Dashboard</a>
        <a href="/admin/cms" className="text-nuru-ink2 hover:text-nuru-purple font-semibold">Content Management</a>
      </div>
      {children}
    </div>
  );
}
