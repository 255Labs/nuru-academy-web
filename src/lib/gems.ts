/**
 * ============================================================================
 * NURU GEM SHOP — FOUNDATION
 * ============================================================================
 *
 * STATUS: COMMENTED OUT / FOUNDATION ONLY
 * This entire module is built and ready but not yet wired into the UI.
 * To activate: uncomment the exports, add the DB tables (supabase/gems.sql),
 * and import GemShop into the routes you want it on.
 *
 * WHAT GEMS ARE
 * Gems are a premium token earned through:
 *   - Completing tracks (large grants)
 *   - Daily login streaks (bonus gems)
 *   - Competition wins (top prizes)
 *   - Direct purchase (future monetisation via ClickPesa)
 *
 * WHAT GEMS BUY
 *   - Character skins    (cosmetic — changes Nuru robot appearance)
 *   - Map themes         (cosmetic — changes Arena/World background)
 *   - Bonus levels       (functional — unlocks extra practice levels)
 *   - Extra lives        (functional — revives a failed Mission Quest)
 *   - XP booster packs  (functional — 2× XP for 24 hours)
 *
 * ARCHITECTURE
 *   gems.ts          — item catalogue, types, purchase logic (this file)
 *   gems.sql         — DB tables (gem_shop_items, gem_purchases, gem_inventory)
 *   useGemShop.ts    — React hook (load inventory, purchase, equip)
 *   GemShop.tsx      — UI component (shop grid, purchase modal, inventory)
 *
 * ============================================================================
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/*
export type GemItemCategory =
  | "skin"       // Changes Nuru robot appearance
  | "map"        // Changes Arena/World background theme
  | "level"      // Unlocks a bonus practice level
  | "life"       // Grants one Mission Quest retry
  | "booster";   // Temporary XP multiplier

export type GemItemRarity = "common" | "rare" | "epic" | "legendary";

export interface GemItem {
  id: string;
  category: GemItemCategory;
  name: string;
  description: string;
  gemCost: number;
  rarity: GemItemRarity;
  previewAsset: string;        // path to preview image (public/gem-shop/...)
  equippable: boolean;         // false for consumables (lives, boosters)
  maxOwnable: number | null;   // null = unlimited; 1 = can only own one
  effect?: {
    // For consumables — what happens when used
    type: "add_life" | "xp_boost" | "unlock_level";
    value: number;             // lives to add, boost multiplier, level id
    durationHours?: number;    // for boosters
  };
}

export interface OwnedItem {
  itemId: string;
  quantity: number;
  equippedAt: string | null;   // ISO timestamp if currently equipped
  purchasedAt: string;
}

// ─── Item Catalogue ───────────────────────────────────────────────────────────

export const GEM_SHOP_ITEMS: GemItem[] = [

  // ── Character skins ────────────────────────────────────────────────────────
  {
    id: "skin_gold_nuru",
    category: "skin",
    name: "Golden Nuru",
    description: "Nuru goes full bling — gold chassis, glowing eyes.",
    gemCost: 150,
    rarity: "rare",
    previewAsset: "/gem-shop/skins/gold-nuru.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "skin_galaxy_nuru",
    category: "skin",
    name: "Galaxy Nuru",
    description: "Deep space edition — stars swirl across Nuru's body.",
    gemCost: 300,
    rarity: "epic",
    previewAsset: "/gem-shop/skins/galaxy-nuru.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "skin_savannah_nuru",
    category: "skin",
    name: "Savannah Nuru",
    description: "Earth tones, Maasai-inspired patterns. Africa edition.",
    gemCost: 200,
    rarity: "rare",
    previewAsset: "/gem-shop/skins/savannah-nuru.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "skin_legend_nuru",
    category: "skin",
    name: "Legendary Nuru",
    description: "Only for the top 1% of learners. Purple flame aura.",
    gemCost: 750,
    rarity: "legendary",
    previewAsset: "/gem-shop/skins/legend-nuru.png",
    equippable: true,
    maxOwnable: 1,
  },

  // ── Map themes ─────────────────────────────────────────────────────────────
  {
    id: "map_silicon_savannah",
    category: "map",
    name: "Silicon Savannah",
    description: "Nairobi-inspired tech cityscape. Neon meets acacia trees.",
    gemCost: 100,
    rarity: "common",
    previewAsset: "/gem-shop/maps/silicon-savannah.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "map_swahili_coast",
    category: "map",
    name: "Swahili Coast",
    description: "Ocean breeze and dhow sails. Zanzibar vibes in the Arena.",
    gemCost: 100,
    rarity: "common",
    previewAsset: "/gem-shop/maps/swahili-coast.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "map_great_rift",
    category: "map",
    name: "Great Rift Highlands",
    description: "Volcanic ridges and crater lakes. East Africa from above.",
    gemCost: 175,
    rarity: "rare",
    previewAsset: "/gem-shop/maps/great-rift.png",
    equippable: true,
    maxOwnable: 1,
  },
  {
    id: "map_future_africa",
    category: "map",
    name: "Future Africa 2075",
    description: "Afrofuturist skyline. Where you are going.",
    gemCost: 350,
    rarity: "epic",
    previewAsset: "/gem-shop/maps/future-africa.png",
    equippable: true,
    maxOwnable: 1,
  },

  // ── Bonus levels ───────────────────────────────────────────────────────────
  {
    id: "level_prompt_master",
    category: "level",
    name: "Prompt Master Gauntlet",
    description: "10 advanced prompting challenges. Unlock after Week 1.",
    gemCost: 80,
    rarity: "common",
    previewAsset: "/gem-shop/levels/prompt-master.png",
    equippable: false,
    maxOwnable: 1,
    effect: { type: "unlock_level", value: 1 },
  },
  {
    id: "level_ai_business",
    category: "level",
    name: "AI for Business Bootcamp",
    description: "Real-world Tanzanian business scenarios. Apply what you learn.",
    gemCost: 120,
    rarity: "rare",
    previewAsset: "/gem-shop/levels/ai-business.png",
    equippable: false,
    maxOwnable: 1,
    effect: { type: "unlock_level", value: 2 },
  },

  // ── Extra lives ────────────────────────────────────────────────────────────
  {
    id: "life_single",
    category: "life",
    name: "Extra Life",
    description: "One retry on a failed Mission Quest. No XP penalty.",
    gemCost: 20,
    rarity: "common",
    previewAsset: "/gem-shop/lives/extra-life.png",
    equippable: false,
    maxOwnable: null, // unlimited — buy as many as you want
    effect: { type: "add_life", value: 1 },
  },
  {
    id: "life_pack_5",
    category: "life",
    name: "Life Pack × 5",
    description: "Five retries. Good value if you are in a tough module.",
    gemCost: 85,
    rarity: "common",
    previewAsset: "/gem-shop/lives/life-pack.png",
    equippable: false,
    maxOwnable: null,
    effect: { type: "add_life", value: 5 },
  },

  // ── XP Boosters ───────────────────────────────────────────────────────────
  {
    id: "booster_2x_24h",
    category: "booster",
    name: "2× XP Booster",
    description: "Double XP on every lesson, quiz and challenge for 24 hours.",
    gemCost: 60,
    rarity: "common",
    previewAsset: "/gem-shop/boosters/2x-boost.png",
    equippable: false,
    maxOwnable: null,
    effect: { type: "xp_boost", value: 2, durationHours: 24 },
  },
  {
    id: "booster_3x_6h",
    category: "booster",
    name: "3× XP Sprint",
    description: "Triple XP for 6 hours. Best used before a study marathon.",
    gemCost: 90,
    rarity: "rare",
    previewAsset: "/gem-shop/boosters/3x-boost.png",
    equippable: false,
    maxOwnable: null,
    effect: { type: "xp_boost", value: 3, durationHours: 6 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getItemById(id: string): GemItem | undefined {
  return GEM_SHOP_ITEMS.find((item) => item.id === id);
}

export function getItemsByCategory(category: GemItemCategory): GemItem[] {
  return GEM_SHOP_ITEMS.filter((item) => item.category === category);
}

export const RARITY_COLOR: Record<GemItemRarity, string> = {
  common:    "#6B7280",
  rare:      "#3B82F6",
  epic:      "#8B5CF6",
  legendary: "#F59E0B",
};

export const RARITY_LABEL: Record<GemItemRarity, string> = {
  common:    "Common",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
};

export const CATEGORY_LABEL: Record<GemItemCategory, string> = {
  skin:     "Character Skins",
  map:      "Map Themes",
  level:    "Bonus Levels",
  life:     "Extra Lives",
  booster:  "XP Boosters",
};

export const CATEGORY_ICON: Record<GemItemCategory, string> = {
  skin:    "🤖",
  map:     "🗺️",
  level:   "🎯",
  life:    "❤️",
  booster: "⚡",
};

// ─── Gem grant rules (how learners earn gems) ─────────────────────────────────
// Wire these into the relevant completion handlers when activating.

export const GEM_GRANTS = {
  complete_track_beginner:     50,   // finish the Beginner track
  complete_track_intermediate: 100,  // finish the Intermediate track
  complete_track_expert:       200,  // finish the Expert track
  daily_login_streak_7:        25,   // 7-day login streak bonus
  daily_login_streak_30:       100,  // 30-day login streak bonus
  competition_first_place:     150,  // win a competition
  competition_second_place:    75,
  competition_third_place:     40,
  perfect_quiz_score:          10,   // 100% on a Mission Quest
  referral_signup:             20,   // a friend signs up using your referral link
} as const;

*/

// ─── Module placeholder (keeps TypeScript happy while commented out) ──────────
// Remove this export when activating the module above.
export {};
