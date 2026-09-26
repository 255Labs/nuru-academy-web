/**
 * useGeoLanguage
 *
 * Detects the user's country via the browser Geolocation API (with permission),
 * maps it to the closest supported language, and applies it to the app.
 *
 * Also exports a standalone `detectGeoLanguage()` for use outside React.
 *
 * Country → language mapping covers all 54 African countries plus major
 * diaspora countries. Falls back to "en" for anything unmapped.
 *
 * Reverse-geocoding: OpenStreetMap Nominatim (free, no API key, rate-limited
 * to 1 req/s — fine for a one-time call on load).
 */

import { useEffect, useRef } from "react";
import { useGameStore, type DisplayLang } from "@/lib/store";

// ── Country code → DisplayLang ──────────────────────────────────────────────
// ISO 3166-1 alpha-2 codes.
const COUNTRY_LANG: Record<string, DisplayLang> = {
  // Swahili belt — Tanzania, Kenya (bilingual sw/en), Uganda, Rwanda, DRC, Burundi, Comoros
  TZ: "sw", KE: "sw", UG: "sw", RW: "sw", CD: "sw", BI: "sw", KM: "sw",

  // Amharic — Ethiopia, Eritrea
  ET: "am", ER: "am",

  // Hausa — Northern Nigeria, Niger, Chad, Ghana (northern), Cameroon (north)
  // (Nigeria also has Yoruba — we use most-spoken; user can always override)
  NG: "ha", NE: "ha", TD: "ha",

  // Yoruba — south-western Nigeria, Benin, Togo
  BJ: "yo", TG: "yo",

  // Zulu / isiZulu — South Africa, Lesotho, Eswatini, Zimbabwe
  ZA: "zu", LS: "zu", SZ: "zu", ZW: "zu",

  // French-speaking Africa
  SN: "fr", ML: "fr", CI: "fr", BF: "fr", GN: "fr", MG: "fr",
  CM: "fr", GA: "fr", CG: "fr", MR: "fr", DJ: "fr", CF: "fr",
  GQ: "fr", GW: "fr", SC: "fr", MU: "fr",

  // English-first for everything else (including North Africa, West Africa anglophone, etc.)
};

// ── Nominatim reverse-geocode ───────────────────────────────────────────────
interface NominatimResult {
  address: { country_code?: string; country?: string; city?: string; state?: string };
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ countryCode: string; country: string; city: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "NuruAIAcademy/1.0" },
    });
    if (!res.ok) return null;
    const data: NominatimResult = await res.json();
    return {
      countryCode: (data.address.country_code ?? "").toUpperCase(),
      country:     data.address.country ?? "",
      city:        data.address.city ?? data.address.state ?? "",
    };
  } catch {
    return null;
  }
}

// ── Map country code to language ────────────────────────────────────────────
export function countryToLang(countryCode: string): DisplayLang {
  return COUNTRY_LANG[countryCode] ?? "en";
}

// ── Full detection pipeline ─────────────────────────────────────────────────
export interface GeoResult {
  lang: DisplayLang;
  countryCode: string;
  country: string;
  city: string;
}

export async function detectGeoLanguage(): Promise<GeoResult | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (!geo) { resolve(null); return; }
        resolve({
          lang: countryToLang(geo.countryCode),
          countryCode: geo.countryCode,
          country: geo.country,
          city: geo.city,
        });
      },
      () => resolve(null),   // denied or unavailable
      { timeout: 8000, maximumAge: 60 * 60 * 1000 } // 1-hour cache
    );
  });
}

// ── React hook ───────────────────────────────────────────────────────────────
/**
 * Call once near the top of the app (e.g. Shell or layout client wrapper).
 * Silently requests location, maps it to a language, and updates the store.
 * Does nothing if the user has already set a language manually (i.e. if
 * displayLang is anything other than the default "en" it was likely user-set
 * so we skip override — unless `force` is true).
 */
export function useGeoLanguage(options: { force?: boolean } = {}) {
  const displayLang   = useGameStore((s) => s.profile.displayLang);
  const updateProfile = useGameStore((s) => s.updateProfile);
  const hasRun        = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Don't override if user already changed their language away from default
    if (!options.force && displayLang !== "en") return;

    detectGeoLanguage().then((result) => {
      if (!result) return;
      // Apply language
      updateProfile({ displayLang: result.lang });
      // Also pre-fill city/country in profile if not already set
      updateProfile({
        country: result.country || undefined,
        city:    result.city    || undefined,
      } as Parameters<typeof updateProfile>[0]);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
