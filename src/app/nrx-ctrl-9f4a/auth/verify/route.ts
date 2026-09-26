import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Must still be authenticated admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { pin } = await req.json();
  const adminPin = process.env.ADMIN_PIN;

  if (!adminPin || pin !== adminPin) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  // Set a session cookie — httpOnly, sameSite strict, 8 hour expiry
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_verified", "1", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/nrx-ctrl-9f4a",
  });
  return res;
}
