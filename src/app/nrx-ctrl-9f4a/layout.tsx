import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → send to main login
  if (!user) redirect("/login?next=/nrx-ctrl-9f4a");

  // Logged in but not an admin → back to home
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, email")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/?denied=1");

  return (
    <AdminShell
      adminName={profile?.display_name ?? profile?.email ?? "Admin"}
      adminEmail={profile?.email ?? ""}
    >
      {children}
    </AdminShell>
  );
}
