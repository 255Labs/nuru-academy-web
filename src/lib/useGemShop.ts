/**
 * ============================================================================
 * NURU GEM SHOP — REACT HOOK
 * ============================================================================
 *
 * STATUS: COMMENTED OUT / FOUNDATION ONLY
 * Uncomment when activating the gem shop. Requires:
 *   1. supabase/gems.sql to have been run in Supabase
 *   2. gems.ts exports to be uncommented
 *   3. This hook imported into the GemShop component
 *
 * ============================================================================
 */

/*
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGameStore } from "@/lib/store";
import {
  GEM_SHOP_ITEMS,
  type GemItem,
  type OwnedItem,
  getItemById,
} from "@/lib/gems";

export interface GemShopState {
  items: GemItem[];
  inventory: OwnedItem[];
  equippedSkin: string | null;
  equippedMap: string | null;
  activeBooster: { itemId: string; multiplier: number; expiresAt: string } | null;
  lives: number;
  loading: boolean;
  purchasing: string | null; // itemId currently being purchased
  error: string | null;
  purchase: (itemId: string) => Promise<{ success: boolean; message: string }>;
  equip: (itemId: string) => Promise<void>;
  useLife: () => Promise<boolean>;
  owns: (itemId: string) => boolean;
  isEquipped: (itemId: string) => boolean;
  xpMultiplier: () => number;
}

export function useGemShop(): GemShopState {
  const gems    = useGameStore((s) => s.gems);
  const addGems = useGameStore((s) => s.addGems);
  const addXP   = useGameStore((s) => s.addXP);

  const [inventory,      setInventory]      = useState<OwnedItem[]>([]);
  const [equippedSkin,   setEquippedSkin]   = useState<string | null>(null);
  const [equippedMap,    setEquippedMap]    = useState<string | null>(null);
  const [activeBooster,  setActiveBooster]  = useState<GemShopState["activeBooster"]>(null);
  const [lives,          setLives]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [purchasing,     setPurchasing]     = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);

  // ── Load inventory from DB ─────────────────────────────────────────────────
  const loadInventory = useCallback(async () => {
    setLoading(true);
    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: rows } = await s
      .from("gem_inventory")
      .select("*")
      .eq("user_id", user.id);

    const inv: OwnedItem[] = (rows ?? []).map((r) => ({
      itemId:      r.item_id,
      quantity:    r.quantity,
      equippedAt:  r.equipped_at,
      purchasedAt: r.created_at,
    }));

    setInventory(inv);

    // Derive equipped state
    const skin = inv.find((i) => i.equippedAt && getItemById(i.itemId)?.category === "skin");
    const map  = inv.find((i) => i.equippedAt && getItemById(i.itemId)?.category === "map");
    setEquippedSkin(skin?.itemId ?? null);
    setEquippedMap(map?.itemId ?? null);

    // Derive lives
    const lifeItems = inv.filter((i) => getItemById(i.itemId)?.category === "life");
    setLives(lifeItems.reduce((a, i) => a + i.quantity, 0));

    // Derive active booster
    const { data: boosterRows } = await s
      .from("gem_boosters")
      .select("*")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1);

    if (boosterRows && boosterRows.length > 0) {
      const b = boosterRows[0];
      setActiveBooster({ itemId: b.item_id, multiplier: b.multiplier, expiresAt: b.expires_at });
    } else {
      setActiveBooster(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchase = useCallback(async (itemId: string): Promise<{ success: boolean; message: string }> => {
    const item = getItemById(itemId);
    if (!item) return { success: false, message: "Item not found" };
    if (gems < item.gemCost) return { success: false, message: `Not enough gems — need ${item.gemCost} 💎` };

    // Check maxOwnable
    if (item.maxOwnable !== null) {
      const owned = inventory.find((i) => i.itemId === itemId);
      if (owned && owned.quantity >= item.maxOwnable) {
        return { success: false, message: "You already own this item" };
      }
    }

    setPurchasing(itemId);
    setError(null);

    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) { setPurchasing(null); return { success: false, message: "Not signed in" }; }

    // Deduct gems and record purchase via DB RPC (atomic)
    const { error: purchaseError } = await s.rpc("gem_purchase_item", {
      p_item_id:   itemId,
      p_gem_cost:  item.gemCost,
      p_category:  item.category,
      p_effect:    item.effect ? JSON.stringify(item.effect) : null,
    });

    if (purchaseError) {
      setPurchasing(null);
      setError(purchaseError.message);
      return { success: false, message: purchaseError.message };
    }

    // Update local gem count
    addGems(-item.gemCost);

    // Handle consumable effects immediately in local state
    if (item.effect) {
      if (item.effect.type === "add_life") {
        setLives((l) => l + item.effect!.value);
      }
      if (item.effect.type === "xp_boost") {
        const expiresAt = new Date(Date.now() + item.effect.durationHours! * 60 * 60 * 1000).toISOString();
        setActiveBooster({ itemId, multiplier: item.effect.value, expiresAt });
      }
    }

    await loadInventory();
    setPurchasing(null);
    return { success: true, message: `${item.name} purchased!` };
  }, [gems, inventory, addGems, loadInventory]);

  // ── Equip ──────────────────────────────────────────────────────────────────
  const equip = useCallback(async (itemId: string) => {
    const item = getItemById(itemId);
    if (!item?.equippable) return;

    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return;

    // Unequip all items in same category, then equip this one
    await s.rpc("gem_equip_item", { p_item_id: itemId, p_category: item.category });

    if (item.category === "skin") setEquippedSkin(itemId);
    if (item.category === "map")  setEquippedMap(itemId);
  }, []);

  // ── Use life ───────────────────────────────────────────────────────────────
  const useLife = useCallback(async (): Promise<boolean> => {
    if (lives <= 0) return false;
    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return false;

    await s.rpc("gem_use_life", { p_user_id: user.id });
    setLives((l) => Math.max(0, l - 1));
    return true;
  }, [lives]);

  // ── Derived helpers ────────────────────────────────────────────────────────
  const owns = useCallback((itemId: string) => {
    const owned = inventory.find((i) => i.itemId === itemId);
    return owned ? owned.quantity > 0 : false;
  }, [inventory]);

  const isEquipped = useCallback((itemId: string) => {
    return equippedSkin === itemId || equippedMap === itemId;
  }, [equippedSkin, equippedMap]);

  const xpMultiplier = useCallback(() => {
    if (!activeBooster) return 1;
    if (new Date(activeBooster.expiresAt) < new Date()) return 1;
    return activeBooster.multiplier;
  }, [activeBooster]);

  return {
    items: GEM_SHOP_ITEMS,
    inventory,
    equippedSkin,
    equippedMap,
    activeBooster,
    lives,
    loading,
    purchasing,
    error,
    purchase,
    equip,
    useLife,
    owns,
    isEquipped,
    xpMultiplier,
  };
}
*/

// ─── Module placeholder ───────────────────────────────────────────────────────
export {};
