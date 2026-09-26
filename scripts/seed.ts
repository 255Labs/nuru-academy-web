/**
 * One-time (or re-run-safe) seed script. Populates Supabase's public schema
 * from the same curriculum.ts that powers the frontend, so the real 25-day
 * curriculum and the real Week 1 quiz banks end up in your database without
 * retyping anything.
 *
 * Usage:
 *   cp .env.local.example .env.local   # fill in the real values first
 *   npm run seed
 *
 * Safe to re-run — every insert is an upsert keyed on a stable id, so
 * running this again after editing curriculum.ts updates existing rows
 * rather than duplicating them.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { TRACKS } from "../src/data/curriculum";
import type { CourseModule, Lesson, MissionQuiz } from "../src/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n" +
      "Copy .env.local.example to .env.local and fill in real values first."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function moduleId(trackId: string, mod: CourseModule) {
  return `${trackId}:${mod.id}`;
}

async function seedQuiz(modId: string, quiz: MissionQuiz) {
  const { data: quizRow, error: quizErr } = await supabase
    .from("quizzes")
    .upsert(
      {
        module_id: modId,
        title: quiz.title,
        subtitle: quiz.subtitle,
        minutes: quiz.minutes,
        passing_pct: quiz.passingPct,
        is_placeholder: !!quiz.placeholder,
      },
      { onConflict: "module_id" }
    )
    .select("id")
    .single();

  if (quizErr || !quizRow) {
    throw new Error(`Failed to upsert quiz for ${modId}: ${quizErr?.message}`);
  }

  // Replace all questions for this quiz (simplest correct approach for a
  // reseed — avoids trying to diff individual question edits).
  await supabase.from("questions").delete().eq("quiz_id", quizRow.id);

  const rows = quiz.questions.map((q, i) => ({
    quiz_id: quizRow.id,
    sort_position: i + 1,
    type: q.type,
    question_text: q.q,
    options: q.options ?? null,
    correct: q.type === "mcq" ? q.correct : q.type === "tf" ? q.correct : q.accept,
    explain: q.explain,
  }));

  const { error: qErr } = await supabase.from("questions").insert(rows);
  if (qErr) throw new Error(`Failed to insert questions for ${modId}: ${qErr.message}`);
}

async function seedLesson(modId: string, lesson: Lesson) {
  const { error } = await supabase.from("lessons").upsert(
    {
      module_id: modId,
      day: lesson.day,
      title: lesson.title,
      objective: lesson.objective,
      block1_topic: lesson.block1.topic,
      block1_points: lesson.block1.points,
      block2_topic: lesson.block2.topic,
      block2_points: lesson.block2.points,
      demo: lesson.demo ?? null,
      homework: lesson.homework ?? null,
    },
    { onConflict: "module_id,day" }
  );
  if (error) throw new Error(`Failed to upsert lesson day ${lesson.day} of ${modId}: ${error.message}`);
}

async function main() {
  console.log(`Seeding ${TRACKS.length} tracks into ${url}...\n`);

  for (const track of TRACKS) {
    console.log(`→ Track: ${track.name} (${track.id})`);
    const { error: trackErr } = await supabase.from("tracks").upsert({
      id: track.id,
      name: track.name,
      subtitle: track.subtitle,
      tagline: track.tagline,
      price_tzs: parseInt(track.priceTZS.replace(/,/g, ""), 10),
      passing_pct: track.passingPct,
      tone_hex: track.tone,
      tone_deep_hex: track.toneDeep,
      enrolled_by_default: track.enrolled,
      requires: track.requires ?? null,
      sort_order: TRACKS.indexOf(track),
    });
    if (trackErr) throw new Error(`Failed to upsert track ${track.id}: ${trackErr.message}`);

    for (const mod of track.modules) {
      const modId = moduleId(track.id, mod);
      console.log(`  → Week ${mod.week}: ${mod.name}`);

      const { error: modErr } = await supabase.from("modules").upsert({
        id: modId,
        track_id: track.id,
        week: mod.week,
        name: mod.name,
        tagline: mod.tagline,
        sort_order: mod.week,
      });
      if (modErr) throw new Error(`Failed to upsert module ${modId}: ${modErr.message}`);

      for (const lesson of mod.lessons) {
        await seedLesson(modId, lesson);
      }
      console.log(`    ${mod.lessons.length} lessons seeded`);

      if (mod.quiz) {
        await seedQuiz(modId, mod.quiz);
        console.log(`    Mission Quest seeded (${mod.quiz.questions.length} questions)`);
      }
    }
  }

  console.log("\nDone. Verify in the Supabase Table Editor, or:");
  console.log("  select count(*) from lessons;  -- expect 75");
  console.log("  select count(*) from questions; -- expect a few dozen (Week 1 x3 + placeholders)");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
