import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const TRACK_LABELS: Record<string, { name: string; color: string; subtitle: string }> = {
  beginner:     { name: "AI for Everyone",     color: "#6B4EFF", subtitle: "Beginner Track" },
  intermediate: { name: "LLMs Under the Hood", color: "#059669", subtitle: "Intermediate Track" },
  expert:       { name: "The Model Landscape", color: "#D97706", subtitle: "Expert Track" },
};

/**
 * Generates a certificate as an SVG (converted to a data URL),
 * stores it in Supabase Storage, updates the certificate record,
 * and emails it to the learner.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, track_id } = await req.json();
  if (!user_id || !track_id) return NextResponse.json({ error: "user_id and track_id required" }, { status: 400 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Get learner info
  const { data: learner } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", user_id)
    .single();

  if (!learner) return NextResponse.json({ error: "Learner not found" }, { status: 404 });

  const track = TRACK_LABELS[track_id] ?? { name: track_id, color: "#6B4EFF", subtitle: "Track" };
  const issueDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const verifyToken = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

  // ── Generate SVG certificate ──────────────────────────────────────────────
  const svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="850" viewBox="0 0 1200 850" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FAFAFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F0EBFF;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${track.color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${track.color}88;stop-opacity:1" />
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="${track.color}" opacity="0.08"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="850" fill="url(#bg)"/>
  <rect width="1200" height="850" fill="url(#dots)"/>

  <!-- Border -->
  <rect x="20" y="20" width="1160" height="810" rx="24" ry="24"
    fill="none" stroke="${track.color}" stroke-width="3" opacity="0.4"/>
  <rect x="28" y="28" width="1144" height="794" rx="20" ry="20"
    fill="none" stroke="${track.color}" stroke-width="1" opacity="0.2"/>

  <!-- Top accent bar -->
  <rect x="20" y="20" width="1160" height="8" rx="4" fill="url(#accent)"/>

  <!-- Corner ornaments -->
  <circle cx="60" cy="60" r="20" fill="none" stroke="${track.color}" stroke-width="1.5" opacity="0.3"/>
  <circle cx="1140" cy="60" r="20" fill="none" stroke="${track.color}" stroke-width="1.5" opacity="0.3"/>
  <circle cx="60" cy="790" r="20" fill="none" stroke="${track.color}" stroke-width="1.5" opacity="0.3"/>
  <circle cx="1140" cy="790" r="20" fill="none" stroke="${track.color}" stroke-width="1.5" opacity="0.3"/>

  <!-- Academy name -->
  <text x="600" y="110" text-anchor="middle"
    font-family="'Georgia', serif" font-size="16" font-weight="bold"
    letter-spacing="8" fill="${track.color}" opacity="0.8">NURU AI ACADEMY</text>

  <!-- Star decorations -->
  <text x="380" y="114" text-anchor="middle" font-size="14" fill="${track.color}" opacity="0.5">✦</text>
  <text x="820" y="114" text-anchor="middle" font-size="14" fill="${track.color}" opacity="0.5">✦</text>

  <!-- Certificate title -->
  <text x="600" y="185" text-anchor="middle"
    font-family="'Georgia', serif" font-size="52" font-weight="bold"
    fill="#1A1A2E">Certificate of Completion</text>

  <!-- Subtitle -->
  <text x="600" y="225" text-anchor="middle"
    font-family="'Georgia', serif" font-size="18" fill="#666" font-style="italic">
    This is to proudly certify that
  </text>

  <!-- Divider line -->
  <line x1="300" y1="245" x2="900" y2="245" stroke="${track.color}" stroke-width="1" opacity="0.3"/>

  <!-- Learner name -->
  <text x="600" y="330" text-anchor="middle"
    font-family="'Georgia', serif" font-size="64" font-weight="bold"
    fill="${track.color}">${learner.display_name}</text>

  <!-- Bottom of name line -->
  <rect x="200" y="348" width="800" height="2" rx="1" fill="url(#accent)" opacity="0.4"/>

  <!-- Completion text -->
  <text x="600" y="400" text-anchor="middle"
    font-family="'Georgia', serif" font-size="18" fill="#666" font-style="italic">
    has successfully completed the
  </text>

  <!-- Track name -->
  <text x="600" y="458" text-anchor="middle"
    font-family="'Georgia', serif" font-size="40" font-weight="bold"
    fill="#1A1A2E">${track.name}</text>

  <!-- Track subtitle -->
  <text x="600" y="500" text-anchor="middle"
    font-family="'Georgia', serif" font-size="18" fill="${track.color}" font-weight="bold"
    letter-spacing="3">${track.subtitle.toUpperCase()}</text>

  <!-- Achievement description -->
  <text x="600" y="548" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="14" fill="#888"
    letter-spacing="1">
    demonstrating proficiency in artificial intelligence and practical AI skills
  </text>

  <!-- Separator -->
  <line x1="400" y1="590" x2="800" y2="590" stroke="#ddd" stroke-width="1"/>

  <!-- Date and verification -->
  <text x="320" y="640" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="13" fill="#888">Issued on</text>
  <text x="320" y="662" text-anchor="middle"
    font-family="'Georgia', serif" font-size="16" font-weight="bold" fill="#444">${issueDate}</text>
  <line x1="220" y1="678" x2="420" y2="678" stroke="#ddd" stroke-width="1"/>

  <!-- Signature area -->
  <text x="600" y="640" text-anchor="middle"
    font-family="'Georgia', serif" font-size="20" font-style="italic" fill="#444">Nuru AI Academy</text>
  <text x="600" y="662" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="12" fill="#888" letter-spacing="2">DIRECTOR OF LEARNING</text>
  <line x1="480" y1="678" x2="720" y2="678" stroke="#ddd" stroke-width="1"/>

  <!-- Verification -->
  <text x="900" y="640" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="11" fill="#aaa">Verify at</text>
  <text x="900" y="658" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="11" fill="${track.color}">nuruai.academy/verify/${verifyToken}</text>
  <line x1="780" y1="678" x2="1020" y2="678" stroke="#ddd" stroke-width="1"/>

  <!-- Seal circle -->
  <circle cx="600" cy="760" r="45" fill="${track.color}" opacity="0.08"/>
  <circle cx="600" cy="760" r="40" fill="none" stroke="${track.color}" stroke-width="2" opacity="0.4"/>
  <text x="600" y="752" text-anchor="middle" font-size="22">🎓</text>
  <text x="600" y="776" text-anchor="middle"
    font-family="'Arial', sans-serif" font-size="9" font-weight="bold"
    fill="${track.color}" letter-spacing="2">VERIFIED</text>

  <!-- Diagonal watermark — traceable if screenshot shared -->
  <defs>
    <pattern id="wm" x="0" y="0" width="300" height="120" patternUnits="userSpaceOnUse"
      patternTransform="rotate(-35)">
      <text x="0" y="60" font-family="monospace" font-size="11" font-weight="600"
        fill="${track.color}" opacity="0.06" letter-spacing="2">
        ${learner.display_name} · ${verifyToken.slice(0,12)}
      </text>
    </pattern>
  </defs>
  <rect width="1200" height="850" fill="url(#wm)" />

  <!-- Bottom token -->
  <text x="600" y="820" text-anchor="middle"
    font-family="'Arial Narrow', monospace" font-size="10" fill="#ccc" letter-spacing="1">
    Token: ${verifyToken}
  </text>
</svg>`;

  // ── Upload SVG to Supabase Storage ────────────────────────────────────────
  const fileName = `${user_id}-${track_id}-${Date.now()}.svg`;
  const svgBuffer = Buffer.from(svgCert, "utf-8");

  const { error: uploadError } = await admin.storage
    .from("certificates")
    .upload(fileName, svgBuffer, {
      contentType: "image/svg+xml",
      upsert: true,
    });

  let certUrl: string | null = null;
  if (!uploadError) {
    const { data: { publicUrl } } = admin.storage
      .from("certificates")
      .getPublicUrl(fileName);
    certUrl = publicUrl;
  }

  // ── Upsert certificate record in DB ───────────────────────────────────────
  const { data: certRecord, error: certError } = await admin
    .from("certificates")
    .upsert({
      user_id,
      track_id,
      display_name: learner.display_name,
      certificate_url: certUrl,
      verify_token: verifyToken,
      issued_at: new Date().toISOString(),
    }, { onConflict: "user_id,track_id" })
    .select("id, verify_token")
    .single();

  if (certError) return NextResponse.json({ error: certError.message }, { status: 500 });

  // ── Send certificate email ─────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY && learner.email) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Nuru AI Academy <hello@nuruai.academy>",
        to: learner.email,
        subject: `🎓 Your ${track.name} Certificate — Nuru AI Academy`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F8F6FF;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F6FF;padding:40px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(107,78,255,0.10);">
      <tr>
        <td style="background:linear-gradient(135deg,${track.color},${track.color}99);padding:32px 40px 28px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">🎓</div>
          <div style="color:#fff;font-size:22px;font-weight:700;">Congratulations, ${learner.display_name}!</div>
          <div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:4px;">You've earned your certificate</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px;">
          <p style="color:#5A5268;font-size:15px;line-height:1.6;margin:0 0 20px;">
            You have successfully completed <strong>${track.name}</strong> at Nuru AI Academy.
            This certificate is a verified record of your achievement.
          </p>

          <div style="background:#F3F0FF;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
            <div style="font-size:13px;font-weight:700;color:${track.color};text-transform:uppercase;letter-spacing:4px;margin-bottom:8px;">
              ${track.subtitle}
            </div>
            <div style="font-size:24px;font-weight:800;color:#1A1A2E;">${track.name}</div>
            <div style="font-size:13px;color:#888;margin-top:6px;">Issued ${issueDate}</div>
          </div>

          ${certUrl ? `
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>
              <td style="background:linear-gradient(135deg,${track.color},${track.color}99);border-radius:12px;text-align:center;">
                <a href="${certUrl}" style="display:inline-block;padding:14px 36px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">
                  View & Download Certificate →
                </a>
              </td>
            </tr>
          </table>` : ""}

          <div style="background:#F9F9F9;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;color:#888;font-size:12px;">
              🔗 Verify this certificate at:<br/>
              <a href="https://nuru-academy-web.vercel.app/verify/${certRecord?.verify_token}"
                style="color:${track.color};font-weight:600;word-break:break-all;">
                nuru-academy-web.vercel.app/verify/${certRecord?.verify_token}
              </a>
            </p>
          </div>

          <p style="color:#5A5268;font-size:14px;line-height:1.6;margin:0;">
            Share your achievement on LinkedIn, WhatsApp, or anywhere you like.
            Your certificate is publicly verifiable — anyone can confirm it's real.
          </p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #EDE8FF;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#8A8298;font-size:12px;">
            Nuru AI Academy · Dar es Salaam, Tanzania ·
            <a href="mailto:hello@nuruai.academy" style="color:${track.color};">hello@nuruai.academy</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
      });
    } catch (emailErr) {
      console.error("Certificate email failed:", emailErr);
      // Don't fail the whole request if email fails
    }
  }

  return NextResponse.json({
    success: true,
    certId: certRecord?.id,
    certUrl,
    verifyToken: certRecord?.verify_token,
    emailSent: !!process.env.RESEND_API_KEY && !!learner.email,
  });
}
