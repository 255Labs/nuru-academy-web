"use client";

import { useEffect, useState } from "react";
import { Loader2, Award, Download, Share2, ExternalLink, CheckCircle } from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

interface Certificate {
  id: string;
  track_id: string;
  issued_at: string;
  display_name: string;
  verify_token: string;
  certificate_url: string | null;
}

const TRACK_LABELS: Record<string, { name: string; color: string }> = {
  beginner:     { name: "AI for Everyone",        color: "#6B4EFF" },
  intermediate: { name: "LLMs Under the Hood",    color: "#059669" },
  expert:       { name: "The Model Landscape",    color: "#D97706" },
};

export default function CertificatesPage() {
  const t = useT();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("certificates")
      .select("*")
      .order("issued_at", { ascending: false })
      .then(({ data }) => {
        setCerts(data ?? []);
        setLoading(false);
      });
  }, []);

  async function copyVerifyLink(token: string, certId: string) {
    const url = `${window.location.origin}/verify/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function downloadCert(cert: Certificate) {
    if (cert.certificate_url) {
      window.open(cert.certificate_url, "_blank");
    } else {
      // Generate a simple printable page
      const win = window.open("", "_blank");
      if (!win) return;
      const trackMeta = TRACK_LABELS[cert.track_id];
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Certificate — ${trackMeta?.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Inter, sans-serif; background: #f8f7ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .cert { width: 800px; background: white; border: 3px solid ${trackMeta?.color ?? "#6B4EFF"}; border-radius: 24px; padding: 60px; text-align: center; }
            .badge { font-size: 64px; margin-bottom: 24px; }
            .academy { font-size: 13px; font-weight: 700; letter-spacing: 3px; color: #888; text-transform: uppercase; margin-bottom: 32px; }
            .title { font-size: 42px; font-weight: 900; color: #1a1a2e; margin-bottom: 8px; }
            .subtitle { font-size: 16px; color: #666; margin-bottom: 32px; }
            .name { font-size: 28px; font-weight: 700; color: ${trackMeta?.color ?? "#6B4EFF"}; margin-bottom: 8px; }
            .course { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 32px; }
            .date { font-size: 13px; color: #888; margin-bottom: 24px; }
            .token { font-size: 11px; color: #bbb; font-family: monospace; }
            .divider { width: 80px; height: 3px; background: ${trackMeta?.color ?? "#6B4EFF"}; margin: 24px auto; border-radius: 9999px; }
          </style>
        </head>
        <body>
          <div class="cert">
            <div class="badge">🎓</div>
            <div class="academy">Nuru AI Academy</div>
            <div class="title">Certificate of Completion</div>
            <div class="subtitle">This certifies that</div>
            <div class="name">${cert.display_name}</div>
            <div class="subtitle">has successfully completed</div>
            <div class="course">${trackMeta?.name ?? cert.track_id}</div>
            <div class="divider"></div>
            <div class="date">Issued on ${new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            <div class="token">Verify at: ${window.location.origin}/verify/${cert.verify_token}</div>
          </div>
        </body>
        </html>
      `);
      win.document.close();
      win.print();
    }
  }

  return (
    <Shell>
      <TopBar title={t("cert.title")} subtitle="Proof of your learning journey — shareable and verifiable." />

      {loading ? (
        <div className="flex items-center gap-2 text-nuru-muted text-sm py-12 justify-center">
          <Loader2 size={16} className="animate-spin" /> {t("general.loading")}
        </div>
      ) : certs.length === 0 ? (
        <div className="text-center py-16">
          <Award size={48} className="text-nuru-muted mx-auto mb-4 opacity-40" />
          <p className="text-nuru-muted text-sm">{t("cert.none")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certs.map((cert) => {
            const meta = TRACK_LABELS[cert.track_id];
            return (
              <div
                key={cert.id}
                className="bg-nuru-card rounded-2xl overflow-hidden shadow-card border border-nuru-line"
              >
                {/* Certificate preview header */}
                <div
                  className="px-6 py-8 text-white text-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${meta?.color ?? "#6B4EFF"}, ${meta?.color ?? "#6B4EFF"}99)` }}
                >
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "12px 12px" }}
                  />
                  <Award size={40} className="mx-auto mb-2 relative" />
                  <div className="font-display font-bold text-xl relative">{meta?.name ?? cert.track_id}</div>
                  <div className="text-sm opacity-80 mt-1 relative">Certificate of Completion</div>
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="font-bold text-nuru-ink text-[17px] mb-0.5">{cert.display_name}</div>
                  <div className="text-xs text-nuru-muted">
                    {t("cert.issued", { date: new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) })}
                  </div>

                  <div className="flex items-center gap-1.5 mt-4 mb-4 p-2.5 bg-nuru-lav rounded-xl">
                    <CheckCircle size={13} className="text-nuru-purple shrink-0" />
                    <span className="text-[11px] font-semibold text-nuru-purple truncate">
                      {`${window?.location?.origin ?? "https://nuruai.academy"}/verify/${cert.verify_token}`}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadCert(cert)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-nuru-purple text-white text-sm font-bold hover:bg-nuru-purpleDeep transition-colors"
                    >
                      <Download size={14} /> {t("cert.download")}
                    </button>
                    <button
                      onClick={() => copyVerifyLink(cert.verify_token, cert.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-nuru-line text-sm font-bold text-nuru-ink2 hover:bg-nuru-lav transition-colors"
                    >
                      {copiedId === cert.id ? (
                        <><CheckCircle size={14} className="text-nuru-green" /> Copied!</>
                      ) : (
                        <><Share2 size={14} /> {t("cert.share")}</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
