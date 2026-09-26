# Nuru AI Academy — Web

Gamified learning hub for the AI Masterclass. Purple 3D-robot design, real
25-day×3-track curriculum, real Mission Quest quizzes with server-side
grading, and real authentication — built on Next.js 15 (App Router),
React 19, TypeScript, Tailwind CSS, Zustand, and Supabase (Postgres + Auth +
Row Level Security).

**Start here → `PRODUCT_SETUP.md`** for the full step-by-step setup
(Supabase project creation, running the schema, auth providers, seeding the
curriculum, deploying to Vercel, and configuring Cloudflare in front of it).
This README is just the fast local-dev path once that's done once.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in real Supabase + Anthropic keys
npm run dev
```

Without `.env.local` filled in, every route will 500 — that's expected; see
`PRODUCT_SETUP.md` Phase 1 to create a Supabase project and run
`supabase/schema.sql` first.

Once configured, visit `http://localhost:3000` → you'll be redirected to
`/login` → sign in with a magic link or Google → land on the dashboard.

## What's real vs. still-mocked

**Real, wired to actual infrastructure:**
- Authentication (Supabase Auth — Google OAuth + email magic links), with
  session-refresh middleware protecting every route except `/login` and
  `/auth/callback`.
- The full database schema (`supabase/schema.sql`) — tracks, modules,
  lessons, quizzes, questions, enrollments, quiz attempts, achievements,
  player stats, AI chat history — every table RLS-enabled, tested against a
  real Postgres instance before shipping (see `supabase/local_test_rls.sql`).
- Server-side quiz grading (`submit_quiz_attempt()`) — clients never receive
  answer keys before submitting; grading, XP, and enrollment progress all
  happen atomically in a single Postgres function.
- The AI Study Buddy (`src/app/api/chat/route.ts`) — proxied through a
  Next.js Route Handler so the Anthropic API key never reaches the browser,
  and requires a signed-in session.
- All 25 lesson days × 3 tracks and the real Week 1 quiz banks (verbatim
  from the original quiz materials) — seedable into Supabase via
  `npm run seed`.
- **Lessons are actually playable** — `LevelPlayer` is a multi-step flow
  (objective → content → timed forced-answer comprehension check → content
  → check → recap → completion), not a scrollable notes page. Real elapsed
  time feeds `complete_lesson()`, not a hardcoded value.
- **Real onboarding** — new signups choose a track at `/onboarding` and get
  a real enrollment row via `enroll_in_track()`, before touching any
  content.
- **Real admin roster** — `admin_list_learners()`/`admin_list_enrollments()`
  self-check the caller's role and return real cohort data, not a mock
  array.
- **Real per-user progress** — dashboard/courses/missions load and persist
  actual Supabase data (`HydrateFromServer`, the RPC calls in
  `QuizRunner.tsx`/`courses/page.tsx`), not shared placeholder numbers.
- **A fixed privilege-escalation bug** — `profiles.role` can no longer be
  self-promoted by a normal user (verified against a real Postgres attack
  query — see `supabase/local_test_rls.sql`).
- Light/dark theme, a Settings page with profile editing, and a real
  server-side-gated Admin panel.

**Not yet built:**
- Payments — pricing displays everywhere, no checkout exists yet. See
  `PRODUCT_SETUP.md` → "Adding payments" for the concrete next step.
- Guilds, Arena (live duels), Shop — UI shells with a "coming soon" panel.
- Certificates, email notifications.
- The 3D robot is currently 2D illustrated artwork (`public/nuru/`), not a
  Three.js/R3F model.
- Rank-change indicators on the leaderboard (needs a periodic snapshot
  table that doesn't exist yet — removed rather than faked).

## Project structure

```
src/
  app/                Next.js App Router pages
  app/api/chat/        Secured Anthropic proxy route
  app/login/           Auth UI (magic link + Google)
  app/auth/callback/   OAuth/magic-link code exchange
  components/          Shared UI components
  data/curriculum.ts   The real AI Masterclass content
  lib/supabase/        client.ts / server.ts / admin.ts / types.ts
  lib/store.ts          Zustand — UI + not-yet-migrated gameplay state
  middleware.ts         Session refresh + route protection
supabase/
  schema.sql            Full schema + RLS policies + grading functions
  local_test_harness.sql / local_test_rls.sql   Optional local RLS testing
scripts/seed.ts         Populates Supabase from curriculum.ts
```

## Restoring Google Fonts

This starter ships with system-font fallbacks so it builds in
network-restricted environments. On your machine, restore the intended
Baloo 2 + Inter pairing — see the commented-out block at the top of
`src/app/layout.tsx` for the exact snippet to uncomment.
