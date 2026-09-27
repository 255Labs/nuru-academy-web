/**
 * i18n.ts — Nuru AI Academy
 * Central translation dictionary. All UI strings live here.
 * Usage: import { t } from "@/lib/i18n"; then: t("run", lang)
 *
 * Supported locales: "en" | "sw"
 */

export type Locale = "en" | "sw";

const translations = {
  // ── CodeConsoleGame ────────────────────────────────────────────────────
  scriptComment:          { en: "# Write your commands below", sw: "# Andika amri zako hapa chini" },
  readyToBegin:           { en: "Ready. Press Run to begin.", sw: "Tayari. Bonyeza Endesha kuanza." },
  readyToBeginPrompt:     { en: "> Ready. Press Run to begin.", sw: "> Tayari. Bonyeza Endesha kuanza." },
  runningCode:            { en: "> Running your code...", sw: "> Inaendesha msimbo wako..." },
  characterSubtitle:      { en: "Your AI Guide", sw: "Mshauri Wako wa AI" },
  statLevel:              { en: "LEVEL", sw: "NGAZI" },
  statEnergy:             { en: "ENERGY", sw: "NISHATI" },
  missionObjective:       { en: "Mission objective", sw: "Lengo la Ujumbe" },
  missionDesc:            { en: "Defeat the Shadow Bots by using the right commands.", sw: "Shinda Shadow Bots kwa kutumia amri sahihi." },
  taskDefeatAll:          { en: "Defeat all enemies", sw: "Shinda maadui wote" },
  taskCollectGem:         { en: "Collect the code gem", sw: "Kusanya jiwe la msimbo" },
  controlsGuide:          { en: "Controls guide", sw: "Mwongozo wa Amri" },
  nuruDialogue:           { en: "Shadow Bots are blocking the path! Use your commands to defeat them and collect the Code Gem.", sw: "Shadow Bots wanazuia njia! Tumia amri zako kuwapokonya na kukusanya Jiwe la Msimbo." },
  commandConsole:         { en: "Command console", sw: "Konsoli ya Amri" },
  btnRun:                 { en: "Run", sw: "Endesha" },
  btnReset:               { en: "Reset", sw: "Upya" },
  outputLabel:            { en: "Output", sw: "Matokeo" },
  visualExecution:        { en: "Visual execution", sw: "Utekelezaji wa Kuona" },
  stepLabel:              { en: "Step", sw: "Hatua" },
  tasksLabel:             { en: "Tasks", sw: "Kazi" },
  taskDefeatBots:         { en: "Defeat all Shadow Bots", sw: "Shinda Shadow Bots wote" },
  taskCollectGemFull:     { en: "Collect the Code Gem", sw: "Kusanya Jiwe la Msimbo" },
  worldStory:             { en: "World story", sw: "Hadithi ya Ulimwengu" },
  worldLore:              { en: "The Baobab Forest was once a place of wisdom and balance. But the Shadow Bots corrupted its logic. Help restore the path of knowledge.", sw: "Msitu wa Mbuyu ulikuwa mahali pa hekima na usawa. Lakini Shadow Bots walidhofisha mantiki yake. Saidia kurejesha njia ya maarifa." },
  chapterComplete:        { en: "Chapter complete!", sw: "Sura imekamilika!" },
  chapterCompleteSubtext: { en: "All Shadow Bots defeated, Code Gem collected.", sw: "Shadow Bots wote washindwa, Jiwe la Msimbo limekusanywa." },
  streakLabel:            { en: "day streak", sw: "msururu wa siku" },
  xpLabel:                { en: "lesson XP", sw: "XP ya somo" },
  levelProgress:          { en: "Level progress", sw: "Maendeleo ya ngazi" },

  // ── BossBattleCard ────────────────────────────────────────────────────
  missionBoss:            { en: "Mission Boss", sw: "Bosi wa Ujumbe" },
  weekLabel:              { en: "Week", sw: "Wiki" },
  moduleChallengeFallback:{ en: "Module Challenge", sw: "Changamoto ya Moduli" },
  bossBattleDesc:         { en: "Clear it to keep your streak bonus and unlock next week.", sw: "Ikamilishe ili kudumisha bonasi yako ya msururu na kufungua wiki ijayo." },
  btnFightNow:            { en: "Fight now", sw: "Pigana sasa" },

  // ── FlyingFocus ───────────────────────────────────────────────────────
  dismissHint:            { en: "Dismiss hint", sw: "Ondoa kidokezo" },

  // ── codeConsoleEngine narration strings ──────────────────────────────
  gameReady:              { en: "Ready. Press Run to begin.", sw: "Tayari. Bonyeza Endesha kuanza." },
  unknownCmd:             { en: (raw: string) => `Unknown command: "${raw}" — skipped.`,
                            sw: (raw: string) => `Amri isiyojulikana: "${raw}" — imeachwa.` },
  moveBlocked:            { en: (dir: string) => `Nuru tries to move ${dir} — a spike blocks the way!`,
                            sw: (dir: string) => `Nuru anajaribu kwenda ${dirSw(dir)} — mchokozi unazuia njia!` },
  moveEnemy:              { en: (dir: string) => `Nuru tries to move ${dir} — a Shadow Bot blocks the path.`,
                            sw: (dir: string) => `Nuru anajaribu kwenda ${dirSw(dir)} — Shadow Bot inazuia njia.` },
  moveDone:               { en: (dir: string) => `Nuru moves ${dir}.`,
                            sw: (dir: string) => `Nuru anasogea ${dirSw(dir)}.` },
  attackDefeated:         { en: (remaining: number) => `Nuru attacks! Shadow Bot defeated! ${remaining} Shadow Bot${remaining === 1 ? "" : "s"} remaining...`,
                            sw: (remaining: number) => `Nuru anashambulia! Shadow Bot imeshindwa! ${remaining} Shadow Bot ${remaining === 1 ? "iliyobaki" : "zilizobaki"}...` },
  attackStillAlive:       { en: "Nuru attacks! It is still standing.", sw: "Nuru anashambulia! Bado imesimama." },
  attackNothing:          { en: "Nuru attacks — but there is nothing there.", sw: "Nuru anashambulia — lakini hakuna kitu hapo." },
  gemCollected:           { en: "Code Gem collected! Nuru glows with knowledge!", sw: "Jiwe la Msimbo limekusanywa! Nuru anang'aa kwa maarifa!" },
  nothingToCollect:       { en: "Nothing to collect here.", sw: "Hakuna kitu cha kukusanya hapa." },

  // ── Quiz / Timer ─────────────────────────────────────────────────────
  questionOf:             { en: (n: number, t: number) => `Question ${n} / ${t}`, sw: (n: number, t: number) => `Swali ${n} / ${t}` },
  timerSec:               { en: "sec", sw: "sek" },
  correct:                { en: "Correct! Well done.", sw: "Sahihi! Umefanya vizuri." },
  timeUp:                 { en: "Time's up! You must restart this question.", sw: "Muda umeisha! Lazima uanze tena swali hili." },
  wrongAnswer:            { en: "Wrong answer. You must restart this question.", sw: "Jibu lisilo sahihi. Lazima uanze tena swali hili." },
  btnTryAgain:            { en: "Try Again", sw: "Jaribu Tena" },
  answerPlaceholder:      { en: "Type your answer...", sw: "Andika jibu lako..." },
  btnSubmit:              { en: "Submit", sw: "Wasilisha" },
  trueLabel:              { en: "True", sw: "Kweli" },
  falseLabel:             { en: "False", sw: "Uongo" },
} as const;

/** Translate a direction word to Swahili */
function dirSw(dir: string): string {
  const map: Record<string, string> = {
    up: "juu", down: "chini", left: "kushoto", right: "kulia",
  };
  return map[dir] ?? dir;
}

export type TranslationKey = keyof typeof translations;

/** Main translation function */
export function t(key: TranslationKey, locale: Locale = "en"): string {
  const entry = translations[key];
  if (!entry) return key;
  const val = entry[locale] ?? entry["en"];
  return typeof val === "string" ? val : key;
}

/**
 * For keys whose value is a function (dynamic narration), use tFn.
 * Example: tFn("unknownCmd", "sw")("bad_cmd")
 */
export function tFn<T extends (...args: never[]) => string>(
  key: TranslationKey,
  locale: Locale = "en"
): T {
  const entry = translations[key];
  const val = (entry as Record<string, unknown>)[locale] ?? (entry as Record<string, unknown>)["en"];
  if (typeof val === "function") return val as T;
  return (() => String(val)) as unknown as T;
}

/** React hook — returns a bound t() for the current locale */
export function useTranslation(locale: Locale) {
  return {
    t: (key: TranslationKey) => t(key, locale),
    tFn: <T extends (...args: never[]) => string>(key: TranslationKey) => tFn<T>(key, locale),
    locale,
  };
}