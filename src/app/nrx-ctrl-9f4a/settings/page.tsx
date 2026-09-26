"use client";

import { PageHeader, Card } from "@/components/admin/ui";
import { ShieldCheck, Database, Mail, Globe } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Platform configuration and integrations" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Security" subtitle="Admin access and authentication">
          <div className="space-y-3 text-sm text-white/40">
            <div className="flex items-start gap-3">
              <ShieldCheck size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
              <div>
                <div className="text-white/60 font-medium">Admin PIN</div>
                <div className="text-xs mt-0.5">Set via <code className="bg-white/[0.06] px-1 rounded">ADMIN_PIN</code> environment variable in Vercel. Change and redeploy to rotate.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
              <div>
                <div className="text-white/60 font-medium">Admin role</div>
                <div className="text-xs mt-0.5">Grant via Supabase SQL: <code className="bg-white/[0.06] px-1 rounded text-[10px]">update profiles set role=&apos;admin&apos; where email=&apos;you@email.com&apos;</code></div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Email" subtitle="Resend integration">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Mail size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
              <div>
                <div className="text-white/60 font-medium">Resend API Key</div>
                <div className="text-white/30 text-xs mt-0.5">Set via <code className="bg-white/[0.06] px-1 rounded">RESEND_API_KEY</code> in Vercel</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
              <div>
                <div className="text-white/60 font-medium">Sender domain</div>
                <div className="text-white/30 text-xs mt-0.5">hello@nuruai.academy — verify in Resend dashboard and set SMTP in Supabase Auth settings</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Database" subtitle="Supabase project">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Database size={15} className="text-[#6B4EFF] mt-0.5 shrink-0" />
              <div>
                <div className="text-white/60 font-medium">Project URL</div>
                <div className="text-white/30 text-xs font-mono mt-0.5">vlohliabtgxlztwtbmrn.supabase.co</div>
              </div>
            </div>
            <a href="https://supabase.com/dashboard/project/vlohliabtgxlztwtbmrn" target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 text-xs text-[#6B4EFF] hover:underline">
              Open Supabase Dashboard →
            </a>
          </div>
        </Card>

        <Card title="Quick links">
          <div className="space-y-2">
            {[
              { label: "Vercel deployment", href: "https://vercel.com" },
              { label: "Resend email logs", href: "https://resend.com" },
              { label: "Supabase SQL Editor", href: "https://supabase.com/dashboard/project/vlohliabtgxlztwtbmrn/sql" },
              { label: "Supabase Storage", href: "https://supabase.com/dashboard/project/vlohliabtgxlztwtbmrn/storage/buckets" },
              { label: "Content Management", href: "/nrx-ctrl-9f4a/cms" },
            ].map(({ label, href }) => (
              <a key={href} href={href} target={href.startsWith("http") ? "_blank" : undefined}
                rel="noopener"
                className="flex items-center justify-between py-2 px-3 rounded-lg border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.02] transition-all group">
                <span className="text-xs text-white/40 group-hover:text-white/70 transition-colors">{label}</span>
                <span className="text-white/15 group-hover:text-white/40 text-xs">→</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
