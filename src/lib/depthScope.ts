import { TRACKS } from "@/data/curriculum";

/**
 * Builds the depth-scoping clause from the student's REAL enrollment
 * progress — not a claim, an actual query result, mapped to a module
 * index the exact same way ContinueLearning.tsx already computes it, so
 * the "current module" Nuru reasons about here matches what the student
 * actually sees on their dashboard.
 *
 * The instruction is deliberately soft-and-honest, not a hard content
 * filter: Nuru can still answer general "what is AI" style questions
 * freely (that's foundational, not a spoiler), but for the *specific*
 * named topics of modules the student hasn't reached yet, it should
 * decline the deep-dive and encourage them to keep progressing instead
 * of teaching ahead of the curriculum.
 */
export function buildDepthScope(trackId: string, progress: number): string {
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return "";

  if (track.modules.length === 0) return "";
  const firstModLen = track.modules[0]?.lessons?.length ?? 0;
  const moduleIdx = Math.min(
    track.modules.length - 1,
    firstModLen > 0 ? Math.floor(progress / (firstModLen + 1)) : 0
  );

  const covered = track.modules.slice(0, moduleIdx + 1).map((m) => `Week ${m.week}: ${m.name} — ${m.tagline}`);
  const notYetReached = track.modules.slice(moduleIdx + 1).map((m) => `Week ${m.week}: ${m.name}`);

  if (notYetReached.length === 0) {
    return `The student is on the ${track.name} track and has reached every module in it, so there's nothing ahead to hold back.`;
  }

  return (
    `The student is enrolled in the ${track.name} track. They have covered:\n${covered.join("\n")}\n\n` +
    `They have NOT yet reached:\n${notYetReached.join("\n")}\n\n` +
    "General foundational questions (e.g. \"what is AI\", \"what is a prompt\") are always fine to answer plainly " +
    "regardless of progress — that's not spoiling anything. But if they ask for a deep, specific explanation of a " +
    "topic that belongs to a week they haven't reached yet, don't teach it in full now — instead say (in your own " +
    "words) that it's coming up in their course soon and you don't want to get ahead of it, then offer to help with " +
    "something from where they currently are instead. This is about pacing, not secrecy — be warm about it, not robotic."
  );
}
