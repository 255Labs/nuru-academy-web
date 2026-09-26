"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";

export function NuruProCard() {
  const t = useT();
  return (
    <Link href="/settings"
      className="block relative rounded-2xl overflow-hidden p-4 text-white group"
      style={{
        background: "linear-gradient(135deg, #6B4EFF 0%, #3E2A9E 50%, #1A0A3C 100%)",
      }}>
      {/* Shimmer overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />

      {/* Gold orb */}
      <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 blur-xl pointer-events-none"
        style={{ background: "#F5B942" }} />

      {/* Stars decoration */}
      <div className="absolute top-2 right-3 text-nuru-gold/40 text-[10px] select-none pointer-events-none">✦ ✦</div>

      <div className="relative z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={14} className="text-nuru-gold" />
          <span className="font-bold text-[13px]">Nuru Pro</span>
        </div>
        <p className="text-white/70 text-[11px] leading-relaxed mb-2.5">{t("general.pro_sub")}</p>
        <div className="flex items-center gap-1 bg-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition-colors w-fit">
          {t("general.upgrade")} <ArrowRight size={11} />
        </div>
      </div>
    </Link>
  );
}
