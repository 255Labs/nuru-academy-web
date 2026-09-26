import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.delete("admin_verified");
  return res;
}
