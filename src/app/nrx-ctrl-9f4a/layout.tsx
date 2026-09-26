import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/nrx-ctrl-9f4a");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/?denied=1");

  // PIN layer
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const pinVerified = cookieHeader.includes("admin_verified=1");
  if (!pinVerified && process.env.ADMIN_PIN) redirect("/nrx-ctrl-9f4a/auth");

  return (
    <AdminShell
      adminName={profile?.display_name ?? profile?.email ?? "Admin"}
      adminEmail={profile?.email ?? ""}
    >
      {children}
    </AdminShell>
  );
}
