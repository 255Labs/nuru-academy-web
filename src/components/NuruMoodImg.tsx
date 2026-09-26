import Image from "next/image";

export type NuruMood = "happy" | "thinking" | "excited" | "helping" | "blinking" | "winking" | "sad" | "surprised";

const SRC: Record<NuruMood, string> = {
  happy: "/illustrations/nuru-mood-happy.png",
  thinking: "/illustrations/nuru-mood-thinking.png",
  excited: "/illustrations/nuru-mood-excited.png",
  helping: "/illustrations/nuru-mood-helping.png",
  blinking: "/illustrations/nuru-mood-blinking.png",
  winking: "/illustrations/nuru-mood-winking.png",
  sad: "/illustrations/nuru-mood-sad.png",
  surprised: "/illustrations/nuru-mood-surprised.png",
};

/**
 * The real illustrated Nuru mood portraits (extracted from the reference
 * character sheet), distinct from the animated SVG Nuru used elsewhere
 * (src/components/Nuru.tsx). Used at moments with real emotional weight —
 * a quiz result, a chat avatar — where a specific expression reads more
 * clearly than the generic mascot.
 */
export function NuruMoodImg({ mood, size = 48, className = "" }: { mood: NuruMood; size?: number; className?: string }) {
  return (
    <Image
      src={SRC[mood]}
      alt=""
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
