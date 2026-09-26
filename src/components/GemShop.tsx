/**
 * ============================================================================
 * NURU GEM SHOP — UI COMPONENT
 * ============================================================================
 *
 * STATUS: COMMENTED OUT / FOUNDATION ONLY
 * To activate:
 *   1. Run supabase/gems.sql in Supabase SQL Editor
 *   2. Uncomment gems.ts and useGemShop.ts
 *   3. Uncomment this component
 *   4. Add a "Shop" route in src/app/shop/page.tsx and sidebar nav
 *
 * ============================================================================
 */

/*
"use client";

import { useState } from "react";
import { Gem, ShoppingCart, CheckCircle, Lock, Zap, Heart, Map, Layers, Star } from "lucide-react";
import { useGameStore } from "@/lib/store";
import { useGemShop } from "@/lib/useGemShop";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { Nuru } from "@/components/Nuru";
import {
  GEM_SHOP_ITEMS,
  CATEGORY_LABEL,
  CATEGORY_ICON,
  RARITY_COLOR,
  RARITY_LABEL,
  type GemItemCategory,
  type GemItem,
} from "@/lib/gems";

const TABS: { id: GemItemCategory | "all"; label: string; icon: string }[] = [
  { id: "all",     label: "All Items",       icon: "✨" },
  { id: "skin",    label: "Skins",           icon: "🤖" },
  { id: "map",     label: "Maps",            icon: "🗺️" },
  { id: "level",   label: "Bonus Levels",    icon: "🎯" },
  { id: "life",    label: "Extra Lives",     icon: "❤️" },
  { id: "booster", label: "XP Boosters",    icon: "⚡" },
];

export default function GemShopPage() {
  const gems   = useGameStore((s) => s.gems);
  const level  = useGameStore((s) => s.level);
  const shop   = useGemShop();
  const [tab,     setTab]     = useState<GemItemCategory | "all">("all");
  const [preview, setPreview] = useState<GemItem | null>(null);
  const [flash,   setFlash]   = useState<{ msg: string; ok: boolean } | null>(null);

  const displayed = tab === "all"
    ? GEM_SHOP_ITEMS
    : GEM_SHOP_ITEMS.filter((i) => i.category === tab);

  async function handlePurchase(item: GemItem) {
    const result = await shop.purchase(item.id);
    setFlash({ msg: result.message, ok: result.success });
    setTimeout(() => setFlash(null), 3000);
    if (result.success) setPreview(null);
  }

  async function handleEquip(item: GemItem) {
    await shop.equip(item.id);
    setFlash({ msg: `${item.name} equipped!`, ok: true });
    setTimeout(() => setFlash(null), 2000);
  }

  return (
    <Shell>
      <TopBar />
      <div className="max-w-5xl mx-auto space-y-6">

        // ── Header ──────────────────────────────────────────────────────────
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-extrabold text-2xl text-nuru-ink flex items-center gap-2">
              <Gem size={22} className="text-nuru-purple" /> Gem Shop
            </h1>
            <p className="text-sm text-nuru-muted mt-0.5">
              Spend your gems on skins, maps, lives and more
            </p>
          </div>
          <div className="flex items-center gap-4">
            // Active booster
            {shop.activeBooster && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <Zap size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-amber-700">
                  {shop.activeBooster.multiplier}× XP active
                </span>
              </div>
            )}
            // Lives counter
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <Heart size={14} className="text-red-400" fill="currentColor" />
              <span className="text-xs font-bold text-red-600">{shop.lives} lives</span>
            </div>
            // Gem balance
            <div className="flex items-center gap-1.5 bg-nuru-lav border border-nuru-purple/20 rounded-xl px-4 py-2">
              <Gem size={16} className="text-nuru-purple" />
              <span className="font-bold text-nuru-purple">{gems.toLocaleString()} gems</span>
            </div>
          </div>
        </div>

        // ── Tabs ─────────────────────────────────────────────────────────────
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-nuru-purple text-white"
                  : "bg-nuru-lav text-nuru-ink2 hover:bg-nuru-purple/10"
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        // ── Item Grid ─────────────────────────────────────────────────────────
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayed.map((item) => {
            const owned    = shop.owns(item.id);
            const equipped = shop.isEquipped(item.id);
            const canAfford = gems >= item.gemCost;

            return (
              <button key={item.id} onClick={() => setPreview(item)}
                className={`relative bg-nuru-card rounded-2xl border-2 p-4 text-left transition-all hover:shadow-pop hover:-translate-y-0.5 ${
                  equipped ? "border-nuru-purple" : "border-nuru-line hover:border-nuru-purple/40"
                }`}>

                // Rarity stripe
                <div className="absolute top-0 left-4 right-4 h-0.5 rounded-full"
                  style={{ background: RARITY_COLOR[item.rarity] }} />

                // Preview placeholder (replace with <img> when assets ready)
                <div className="w-full h-24 rounded-xl mb-3 flex items-center justify-center text-4xl"
                  style={{ background: `${RARITY_COLOR[item.rarity]}15` }}>
                  {CATEGORY_ICON[item.category]}
                </div>

                // Rarity badge
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: RARITY_COLOR[item.rarity] }}>
                  {RARITY_LABEL[item.rarity]}
                </div>

                <div className="font-bold text-nuru-ink text-sm mb-0.5 line-clamp-1">{item.name}</div>
                <div className="text-nuru-muted text-xs line-clamp-2 mb-3">{item.description}</div>

                // Price / owned state
                {equipped ? (
                  <div className="flex items-center gap-1 text-nuru-purple text-xs font-bold">
                    <CheckCircle size={12} /> Equipped
                  </div>
                ) : owned ? (
                  <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                    <CheckCircle size={12} /> Owned
                  </div>
                ) : (
                  <div className={`flex items-center gap-1 text-sm font-bold ${canAfford ? "text-nuru-purple" : "text-nuru-muted"}`}>
                    <Gem size={12} /> {item.gemCost}
                    {!canAfford && <Lock size={10} className="ml-1" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      // ── Item Preview Modal ─────────────────────────────────────────────────
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setPreview(null)}>
          <div className="bg-nuru-card rounded-3xl border border-nuru-line shadow-pop w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}>

            // Preview image placeholder
            <div className="w-full h-40 rounded-2xl flex items-center justify-center text-7xl mb-4"
              style={{ background: `${RARITY_COLOR[preview.rarity]}12` }}>
              {CATEGORY_ICON[preview.category]}
            </div>

            <div className="text-[11px] font-bold uppercase tracking-wider mb-1"
              style={{ color: RARITY_COLOR[preview.rarity] }}>
              {RARITY_LABEL[preview.rarity]} · {CATEGORY_LABEL[preview.category]}
            </div>

            <h2 className="font-display font-extrabold text-xl text-nuru-ink mb-1">{preview.name}</h2>
            <p className="text-sm text-nuru-muted mb-4">{preview.description}</p>

            {preview.effect && (
              <div className="bg-nuru-lav rounded-xl p-3 mb-4 text-xs text-nuru-ink2">
                {preview.effect.type === "add_life"    && `Grants ${preview.effect.value} life${preview.effect.value > 1 ? "s" : ""}`}
                {preview.effect.type === "xp_boost"    && `${preview.effect.value}× XP for ${preview.effect.durationHours} hours`}
                {preview.effect.type === "unlock_level" && "Unlocks a bonus practice level"}
              </div>
            )}

            <div className="flex gap-2">
              {shop.owns(preview.id) ? (
                preview.equippable ? (
                  <button onClick={() => handleEquip(preview)}
                    className="flex-1 py-3 rounded-xl bg-nuru-purple text-white font-bold text-sm">
                    {shop.isEquipped(preview.id) ? "Unequip" : "Equip"}
                  </button>
                ) : (
                  <div className="flex-1 py-3 rounded-xl bg-green-50 text-green-700 font-bold text-sm text-center">
                    ✓ Owned
                  </div>
                )
              ) : (
                <button
                  onClick={() => handlePurchase(preview)}
                  disabled={gems < preview.gemCost || shop.purchasing === preview.id}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all bg-nuru-purple text-white hover:bg-nuru-purpleDeep">
                  <Gem size={14} /> Buy for {preview.gemCost} gems
                </button>
              )}
              <button onClick={() => setPreview(null)}
                className="px-4 py-3 rounded-xl bg-nuru-lav text-nuru-ink2 font-semibold text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      // ── Flash toast ────────────────────────────────────────────────────────
      {flash && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl ${
          flash.ok
            ? "bg-green-600 text-white"
            : "bg-red-500 text-white"
        }`}>
          {flash.ok ? <CheckCircle size={15} /> : <Lock size={15} />}
          {flash.msg}
        </div>
      )}
    </Shell>
  );
}
*/

// ─── Module placeholder ───────────────────────────────────────────────────────
export {};
