# Nuru AI Academy — Setup Guide
### Next.js 15 + Supabase (Auth + Postgres + RLS) + Vercel + Cloudflare

This is the real stack for this project — simpler than a separate NestJS
backend, because Supabase gives you Postgres, authentication, and row-level
security (RLS) as one managed service. Everything in this guide has been
built and verified against a real (locally emulated) Postgres instance
before being handed to you — not just written from memory. Where that
process caught real bugs, they're called out below so you don't hit them
again.

---

## What's already wired up in the delivered code

- **`supabase/schema.sql`** — the full database schema: tracks, modules,
  lessons, quizzes, questions, enrollments, quiz attempts, achievements,
  study log, player stats, AI chat history. Every table has RLS enabled and
  a policy. Verified against a real Postgres 16 instance with an emulated
  `auth` schema — see "Testing your RLS policies locally" below.
- **A real anti-cheat design for quizzes, actually wired into the UI.**
  Clients never receive the `correct` answer or `explain` text for a
  question until after they submit. `QuizRunner` fetches questions through
  `get_quiz_questions()` (answer-free columns only) and grades through
  `submit_quiz_attempt()` (a `security definer` function that checks
  answers server-side, records the attempt, updates XP/enrollment, and only
  then returns a review with explanations). Earlier drafts of this app had
  these functions built and tested but never called from the frontend —
  that gap is closed now.
- **A fixed privilege-escalation bug**: the `profiles` table's update policy
  let a signed-in user set their own `role` to `admin` directly (RLS checks
  which *row* you can touch, not which *columns*). A trigger now reverts
  `role`/`email` on any update that isn't from the service role — verified
  against a real Postgres instance with the actual attack query.
- **Real per-user data**, not shared placeholder numbers. `HydrateFromServer`
  loads your actual XP/coins/gems/level/progress/streak from Supabase on
  load; completing a lesson or passing a Mission Quest calls the real RPCs
  above instead of only updating local browser state. Reloading, or signing
  in on another device, now shows your real progress.
- **A real leaderboard** — queries `player_stats` ordered by XP, instead of
  a hardcoded fake rivals list.
- **A public landing page** — signed-out visitors hitting `/` see a real
  marketing page (tracks, pricing, a sign-in CTA) instead of being bounced
  straight to `/login` with zero context.
- **Real server-side admin gating** (`src/app/admin/layout.tsx`) — checks
  the actual `profiles.role` column, not a client-side toggle. See
  "Promoting a real admin account" below.
- **Rate limiting on `/api/chat`** — a sliding-window check against the
  existing `ai_chats` table (15 messages / 5 minutes per user by default).
- **`src/lib/supabase/client.ts` / `server.ts` / `admin.ts`** — the three
  Supabase client variants you need (browser, server-with-user-session,
  and service-role-for-admin-scripts-only).
- **`src/middleware.ts`** — refreshes the auth session on every request and
  redirects signed-out visitors to `/login`, except for `/login`,
  `/auth/callback`, `/` (handles its own signed-out state), and everything
  under `/api/` (API routes return their own JSON error responses instead
  of an HTML redirect — see "Gotchas" below for why this needs to be
  explicit).
- **`src/app/login`** — Google OAuth + passwordless magic-link sign-in,
  matching your architecture's auth provider list.
- **`src/app/auth/callback/route.ts`** — exchanges the OAuth/magic-link code
  for a real session.
- **`scripts/seed.ts`** — populates Supabase with the real 25-day curriculum
  and the real Week 1 quiz banks directly from `curriculum.ts`, so you never
  retype content into the database by hand. Idempotent — safe to re-run.

**Also new in this pass:**
- **Real onboarding.** New signups land on `/onboarding` (redirected there
  from `/auth/callback` only if they have zero enrollments — returning
  users skip straight past it), pick a track, and call `enroll_in_track()`
  — a real enrollment row, not an implicit one created by accident on
  first lesson.
- **Real admin roster.** `admin_list_learners()` / `admin_list_enrollments()`
  are `security definer` functions that check the caller's own
  `profiles.role` before returning anything — safe to grant broadly to
  `authenticated` since a non-admin calling them gets an error, not data.
  The admin page now queries these instead of a hardcoded array.
- **Lessons are actually playable now**, not a scrollable content page with
  a "mark complete" button. `LevelPlayer` (replacing `LessonDetailModal`)
  is a real multi-step flow: objective → Block 1 → a timed, forced-answer
  comprehension check generated from Block 1's own "big idea" point (see
  the comment in `LevelPlayer.tsx` for why this is legitimate and not
  fabricated content) → Block 2 → another check → demo/homework recap →
  completion. The 45-second per-check countdown auto-reveals the answer on
  timeout rather than trapping the user, but the **Next** button stays
  disabled until an answer is picked — you cannot skip a check by waiting.
  Real elapsed time (not a hardcoded 30 minutes) now feeds
  `complete_lesson()`, which was updated to accept it.
- **A neutral design pass.** The entire app's background/card/border tokens
  were re-based from a lavender-tinted canvas to a neutral one (see
  `globals.css`) — purple is now reserved for actual accents (buttons,
  active nav, the hero card) rather than washing every surface. Card
  shadows went from a colored glow to standard neutral elevation. The
  playful display font was removed from ~20 card headers/labels across the
  app and kept only on true brand/hero/stat moments (page titles, the
  brand mark, big numeric stats).

**Still genuinely open — a "0→100" product, not just plumbing, needs:**
- **Payments.** Track pricing is displayed (landing page, admin panel,
  onboarding) but there's no checkout — every enrolled track is free to
  start right now. Deliberately not stubbed with fake Stripe wiring this
  pass — untestable without real Stripe keys, and half-built payment code
  is worse than none. See "Adding payments" below for the concrete next
  step once you have real keys.
- **Certificates, email notifications, Guilds/Arena/Shop** — intentionally
  out of scope for the core loop; see the Growth-phase section below.
- **Rank-change indicators on the leaderboard** were removed rather than
  faked — they need a periodic snapshot table to compare against, which
  doesn't exist yet.
- **Quick-check answers aren't persisted anywhere** — by design, they're a
  pacing/comprehension nudge inside the Level Player, not a graded record.
  If you want per-lesson analytics on which comprehension checks students
  struggle with, that needs a new table + RPC, following the same pattern
  as `submit_quiz_attempt()`.

---

## ClickPesa payments — built and tested this pass

Tracks now unlock two genuine ways: earning it (passing the prerequisite
track's Emberfall) or paying for it directly via ClickPesa mobile money
(M-Pesa, Tigo Pesa, Airtel Money, HaloPesa). Both are real data checks —
see `isTrackUnlocked()` in `src/lib/store.ts`.

**A serious bug was found and fixed while building this — read this part
even if you skip the rest.** Postgres grants `EXECUTE` on every new
function to `PUBLIC` by default (unlike tables, which grant nothing by
default). This project had been relying on "no `grant` statement = no
access" for two internal-only functions, which is **wrong**:
`grade_single_answer()` (the anti-cheat grading helper) was directly
callable by any signed-in client via a raw RPC request, handing back the
real answer key for any question, completely bypassing the write-once
lock in `battle_answer()` and the batch grading in `submit_quiz_attempt()`
— verified against a real Postgres instance, then fixed with an explicit
`revoke all on function ... from public`, then reverified that the
legitimate call paths still work correctly. `confirm_track_purchase()` had
the same gap and got both the revoke and an internal `auth.role() =
'service_role'` check, matching the pattern already used in
`protect_profile_privileged_columns()`. Both are now permanent regression
tests in `local_test_rls.sql` (Tests 13–14) so this can't silently
reappear if a future "internal helper" function forgets the revoke.

**What's real and tested:**
- The checksum algorithm (`src/lib/clickpesa.ts`) — canonicalize (sort
  keys recursively), compact-JSON, HMAC-SHA256, hex digest — verified
  byte-for-byte against ClickPesa's own published example payload before
  any of the rest of this was built.
- `track_purchases` table + `initiate_track_purchase()` /
  `confirm_track_purchase()` functions — tested against real Postgres,
  including that a normal user genuinely cannot call
  `confirm_track_purchase()` directly (see above).
- `/api/payments/initiate` — authenticated Route Handler that creates a
  real pending order (real price from `public.tracks`, never trusted from
  the client) and sends an actual USSD-PUSH prompt via ClickPesa.
- `/api/payments/webhook` — public endpoint ClickPesa calls directly;
  trust comes entirely from the checksum (constant-time compared, not
  `===`), never from the URL being secret.
- `PurchaseTrackModal` — phone number entry, initiates the payment, polls
  `track_purchases` (RLS-scoped to the caller) for the real webhook-
  confirmed outcome, re-hydrates the whole store on success so
  `purchasedTracks` reflects the unlock immediately.

**What genuinely can't be tested without your real ClickPesa credentials**
— same honest limitation as Supabase/Anthropic before you had real keys:
the actual live HTTPS calls to `api.clickpesa.com` (token generation, the
real USSD-PUSH prompt landing on a real phone). Everything up to that
boundary — the database layer, the checksum math, the route logic — is
verified; the live call itself needs your real `CLICKPESA_CLIENT_ID` /
`CLICKPESA_API_KEY` / `CLICKPESA_CHECKSUM_KEY` to exercise end to end.

### Setup

1. Register at [clickpesa.com](https://clickpesa.com), complete KYC, and
   create an **API** application in **Merchant Dashboard → Settings →
   Developers** (see `docs.clickpesa.com/application/api-application-setup`).
2. Copy the **Client ID** and generate an **API Key** — paste both into
   `.env.local` as `CLICKPESA_CLIENT_ID` / `CLICKPESA_API_KEY`.
3. Under the same application, find the **Checksum Key** (separate from
   the API Key) and set `CLICKPESA_CHECKSUM_KEY`.
4. Under **Application Webhooks**, add your deployed URL for both
   `PAYMENT RECEIVED` and `PAYMENT FAILED`:
   `https://yourdomain.com/api/payments/webhook`
5. Run the updated `schema.sql` in Supabase's SQL Editor (adds
   `track_purchases` + the two payment functions + the two security
   revokes) — safe to re-run, everything uses `create or replace`.
6. Test with a small real amount before trusting it with real customers —
   there is no ClickPesa sandbox/test-mode credential path documented, so
   your first real test **is** a real transaction.

---

## Promoting a real admin account

`/admin` is now gated server-side against `profiles.role`, and a normal
signed-in user cannot set this themselves (the privilege-escalation fix
above prevents it). To make a real account an admin, run this in the
Supabase **SQL Editor** (which writes as a trusted role and bypasses the
same trigger that blocks a normal user's own request):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

---

## Prerequisites

| Tool | Why |
|---|---|
| Node.js 20 LTS+ | Runs the Next.js app and the seed script |
| A free Supabase account | supabase.com — Postgres + Auth + RLS in one project |
| A Vercel account | Hosting for the Next.js app |
| A Cloudflare account (free tier is fine) | DNS, WAF, bot protection |
| A Google Cloud project (only if you want Google sign-in) | OAuth client credentials |

---

## Phase 0 — Run the app locally (without Supabase configured yet)

```bash
npm install
```

At this point, `npm run dev` will start but **every route will 500** — the
middleware calls `createServerClient(...)` with your Supabase URL/key, and
without them configured it throws immediately with a clear error pointing
you at the Supabase dashboard. That's expected; don't debug it, just
continue to Phase 1.

---

## Phase 1 — Create your Supabase project and run the schema

1. Go to `https://supabase.com/dashboard` → **New project**. Pick a region
   close to your users (for Tanzania, `eu-central-1` or similar EU regions
   typically have the lowest latency among Supabase's current options —
   check the live list in the project creation screen).
2. Wait for provisioning (~2 minutes).
3. Open **SQL Editor** in the left sidebar → **New query**.
4. Paste the entire contents of `supabase/schema.sql` and run it.
   You should see a stream of `CREATE TABLE` / `CREATE POLICY` /
   `CREATE FUNCTION` results with no errors.
5. Open **Table Editor** and confirm you see: `profiles`, `player_stats`,
   `tracks`, `modules`, `lessons`, `quizzes`, `questions`, `enrollments`,
   `quiz_attempts`, `achievements`, `user_achievements`, `ai_chats`,
   `study_log`.

### Testing your RLS policies locally before deploying them

Every time you modify `schema.sql`, it's worth re-verifying the RLS
behavior before pasting it into production. This repo ships the exact
harness used to validate the shipped schema:

```bash
createdb nuru_test
psql -d nuru_test -c "create extension if not exists pgcrypto;"
psql -d nuru_test -f supabase/local_test_harness.sql   # emulates auth.users + auth.uid()
psql -d nuru_test -f supabase/schema.sql
psql -d nuru_test -f supabase/local_test_rls.sql       # runs the actual checks
```

Read the output — each check states what it expects (e.g. "expect only her
own row"). This local harness is what caught two real issues while building
this guide (see "Gotchas" below), so it's worth keeping around rather than
trusting the SQL editor's silence as proof of correctness — Postgres will
happily accept syntactically valid SQL that grants either more or less
access than you intended.

---

## Phase 2 — Configure authentication

### Email magic links (on by default)
Supabase Auth ships with email OTP/magic-link sign-in enabled out of the
box. No setup needed — `signInWithOtp()` in `src/app/login/LoginForm.tsx`
already uses it. In **Authentication → URL Configuration**, add your local
dev URL and your future production URL to **Redirect URLs**:

```
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

### Google OAuth
1. In the [Google Cloud Console](https://console.cloud.google.com), create
   an OAuth 2.0 Client ID (**APIs & Services → Credentials**).
2. Application type: **Web application**.
3. Authorized redirect URI — use the one Supabase gives you at
   **Authentication → Providers → Google** in your Supabase dashboard
   (looks like `https://<project-ref>.supabase.co/auth/v1/callback`).
4. Copy the generated **Client ID** and **Client Secret** into Supabase's
   Google provider settings and toggle it on.
5. No code changes needed — `signInWithOAuth({ provider: "google" })` in
   `LoginForm.tsx` already calls this.

### Environment variables

```bash
cp .env.local.example .env.local
```

Fill in from **Settings → API Keys** in your Supabase dashboard (the
**Publishable and secret API keys** tab — if your project only shows a
**Legacy API Keys** tab with `anon`/`service_role`, those work identically,
just paste them into the same variable names below):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key, sb_publishable_...>
SUPABASE_SECRET_KEY=<secret key, sb_secret_...>   # secret — seed script + admin routes only
ANTHROPIC_API_KEY=sk-ant-...                       # secret — src/app/api/chat/route.ts only
```

The publishable key is meant to be public — RLS is what actually protects
your data, not keeping that key secret. The secret key is the opposite:
treat it like a root password. It bypasses RLS entirely.

Now:

```bash
npm run dev
```

Visit `http://localhost:3000` — you should be redirected to `/login`. Sign
in with the magic link (check your email) or Google. You'll land back on
the dashboard, still reading Zustand mock data for now (see the end of this
guide for wiring that up).

---

## Phase 3 — Seed the real curriculum

```bash
npm run seed
```

This reads `src/data/curriculum.ts` — the same file the frontend imports —
and populates `tracks`, `modules`, `lessons`, `quizzes`, and `questions` in
Supabase. It's an upsert, so editing curriculum content and re-running
`npm run seed` updates existing rows rather than duplicating them.

Verify in the Supabase **Table Editor**, or via SQL Editor:

```sql
select count(*) from lessons;   -- expect 75 (25 days × 3 tracks)
select count(*) from questions; -- expect several dozen
```

---

## Phase 4 — Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo. Vercel auto-detects
   Next.js — no config needed.
3. Add environment variables (same four from `.env.local`, plus any
   Turnstile keys if you set those up) under **Settings → Environment
   Variables**. Set them for both **Production** and **Preview**.
4. Deploy. Add your custom domain under **Settings → Domains** — Vercel will
   give you a CNAME (or A record for an apex domain) to create.

---

## Phase 5 — Cloudflare (DNS, WAF, bot protection)

Your architecture diagram puts Cloudflare in front of the Next.js frontend.
Here's how to do that **correctly** — this is the part most guides get
subtly wrong, so read carefully:

### DNS mode: proxied (orange cloud) is fine, with two settings you must get right

1. Add your domain to Cloudflare, point the DNS record at Vercel exactly as
   Vercel's dashboard instructs, and leave the record **Proxied** (orange
   cloud) if you want Cloudflare's WAF and bot protection in front of it.
2. Go to **SSL/TLS** → set the mode to **Full (strict)**. Do **not** use
   "Flexible" — that mode terminates TLS at Cloudflare's edge and then
   speaks plain HTTP to Vercel, which conflicts with Vercel's own automatic
   HTTPS redirect and can cause a redirect loop.
3. Go to **Caching → Cache Rules** and add a rule to **bypass cache** for
   your app's dynamic paths — at minimum `/api/*`, `/auth/*`, `/login`, and
   realistically the rest of the app too, since nearly every page here reads
   a live session cookie. Only `/_next/static/*` and files under `/nuru/*`
   (the mascot art) should be cached aggressively at Cloudflare's edge; let
   everything else pass through to Vercel's own caching (which already
   respects the `Cache-Control` headers Next.js sets per-route).

   **Why this matters:** Cloudflare's "Cache Everything" default (if you
   ever enable it) will cache a signed-in user's HTML and serve it back to
   the next visitor — a real data leak, not just a stale-content bug.

4. Cloudflare becomes the first hop for every request, which means Vercel
   sees Cloudflare's IP as the connecting client unless you configure IP
   forwarding. Cloudflare sets `CF-Connecting-IP` automatically; Vercel
   reads it automatically for its own analytics, but if you add your own
   rate-limiting or logging based on `request.ip` in a Route Handler, use
   the `CF-Connecting-IP` header, not the raw connection IP.

### Bot protection with Cloudflare Turnstile

Turnstile is Cloudflare's CAPTCHA replacement — worth adding to `/login`
once you have real traffic, to slow down automated account creation.

1. **Cloudflare dashboard → Turnstile → Add site**, get a site key + secret
   key.
2. Add to your env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
   `TURNSTILE_SECRET_KEY` (already present in `.env.local.example`).
3. Render the widget in `LoginForm.tsx` via Cloudflare's script
   (`https://challenges.cloudflare.com/turnstile/v0/api.js`), and verify the
   token server-side (in `/auth/callback` or a dedicated verification route)
   by POSTing it to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
   with your secret key before allowing the sign-in to proceed.

This isn't wired into the shipped code — add it once you have a real
Cloudflare site key to test against; a Turnstile widget can't be usefully
stubbed without one.

---

## Rate limiting Ask Nuru

Implemented — `/api/chat` now checks a sliding window (default: 15 messages
per 5 minutes per user) against the existing `ai_chats` table before calling
Anthropic, returning a `429` with a clear message once over the limit. See
the `RATE_LIMIT_WINDOW_MINUTES`/`RATE_LIMIT_MAX_MESSAGES` constants at the
top of `src/app/api/chat/route.ts` to tune it.

This is coarse (a Postgres count query per request, not a proper token
bucket) but genuinely stops an unmetered LLM proxy from becoming an open
path to a large API bill. If usage grows enough that the count query itself
becomes a bottleneck, move to Vercel's Edge Middleware rate limiting or a
Redis-backed sliding window instead.

---

## Security checklist

- [ ] `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` are only ever read
      from server-side code (`src/lib/supabase/admin.ts`,
      `src/app/api/chat/route.ts`) — never `NEXT_PUBLIC_*`
- [ ] Every new table you add gets `alter table ... enable row level
      security;` **and** at least one policy, **and** an explicit `grant`
      — RLS alone doesn't help if you also forget the table-level grant (see
      Gotcha #4 below), and a missing policy on an RLS-enabled table simply
      denies everyone, which is safe-but-broken and easy to debug; a missing
      RLS enable on a new table is the dangerous one — it defaults to fully
      public if the role has a grant.
- [ ] Any table with a "does this look sensitive" column (email, real name,
      free-text bio) is NOT broadly selectable — split public game-state
      fields into a separate table the way `player_stats` is split from
      `profiles` here.
- [ ] Quiz answers (`questions.correct`, `questions.explain`) are never
      granted to `anon`/`authenticated` directly — only reachable via the
      two `security definer` functions.
- [ ] Cloudflare SSL/TLS mode is **Full (strict)**, not Flexible.
- [ ] Cloudflare cache rules bypass anything that reads a session cookie.
- [ ] `/api/chat` has a rate limit before real users touch it.

---

## Gotchas actually caught while building this

Worth knowing about, since they're the kind of thing that fails silently
rather than loudly:

1. **`position` is a reserved-adjacent SQL identifier.** Using it as a plain
   column name inside a `RETURNS TABLE(...)` function signature produces a
   syntax error in Postgres, even though it works fine as an ordinary column
   name almost everywhere else. The schema uses `sort_position` throughout
   instead of fighting quoting rules case-by-case.
2. **`middleware.ts` must live inside `src/`, not the project root, once
   you're using a `src/app` layout.** Next.js silently accepts a
   project-root `middleware.ts` in this configuration — it just never runs
   it. There's no build warning; the only symptom is that auth protection
   quietly does nothing. Verify yours is registered by checking
   `.next/server/middleware-manifest.json` after a build — it should list a
   non-empty `middleware` object, not `{}`.
3. **Middleware must not redirect `/api/*` routes to an HTML login page.**
   If your auth middleware's matcher covers API routes (a sensible default,
   so unauthenticated API calls don't slip through), explicitly exempt
   `/api/` from the redirect branch and let each route handler return its
   own JSON error — otherwise a `fetch()` call from client code receives a
   307 redirect instead of the 401 JSON your error handling expects, and the
   failure mode is confusing rather than clean.
4. **Raw `CREATE TABLE` doesn't imply any table-level grant to
   `anon`/`authenticated`**, even with RLS enabled and policies attached.
   Real Supabase projects have this pre-configured for you at the platform
   level for tables you create through their tools, but the schema here
   includes explicit `grant` statements anyway rather than depend on that —
   it means this file behaves identically whether you run it through the
   Supabase SQL Editor, the CLI, or a bare local Postgres for testing.
5. **RLS policies check which ROW you may touch, not which COLUMNS.** An
   `update` policy like `using (auth.uid() = id)` looks like it only lets
   you edit your own profile — but with no further restriction, that
   includes every column, so a plain client-side
   `update profiles set role = 'admin' where id = auth.uid()` succeeds. Any
   table with a privileged column (roles, verified flags, price overrides)
   needs an explicit trigger reverting that column outside of
   service-role writes — see `protect_profile_privileged_columns()` in
   `schema.sql`, verified against the actual attack query.
6. **Middleware can't selectively "half-protect" a single path.** Making `/`
   show a public landing page for signed-out visitors and a real dashboard
   for signed-in ones isn't a middleware change — middleware only decides
   redirect-or-not per request, so the actual page (`src/app/page.tsx`)
   needs to check auth itself and render one branch or the other. Trying to
   solve this in middleware alone (e.g. rewriting to a different route)
   adds complexity for no benefit once the page can just check
   `supabase.auth.getUser()` directly.
7. **A function's own `RETURNS TABLE` column names can shadow a table
   column inside its body.** `admin_list_learners()` returns a `role`
   column and also needs to check `profiles.role` internally — writing
   the bare `select role from public.profiles ...` inside that function
   is genuinely ambiguous to Postgres (which `role` did you mean?) and
   throws at call time, not at creation time, so it's easy to miss until
   you actually invoke it. Always qualify: `select profiles.role from
   public.profiles where profiles.id = auth.uid()`.

---

## Battle Trial — real-time Mission Quests

Mission Quests now play as a real-time battle (`src/components/BattleTrial.tsx`)
instead of a static "answer everything, then see one score" quiz screen —
a countdown per question, correct answers damage a "Doubt" enemy, wrong or
timed-out answers let it counter-hit. `MissionQuestModal` uses this in
place of the old `QuizRunner` (removed — fully superseded).

**Why this needed new backend, not just a new frontend component:** the
existing anti-cheat design (`get_quiz_questions()` /
`submit_quiz_attempt()`) grades every answer in a single batch call at the
very end — correct by design, since the answer key must never reach the
browser before submission. But dealing damage the instant you answer needs
per-question feedback *during* play. A naive "grade this one answer, tell
me if I'm right" endpoint would invite brute-forcing: call it with every
option in turn and read off which one returns `ok: true`, before ever
committing to a real answer.

**How it's actually protected** (verified against real Postgres, including
the attack itself — see `local_test_rls.sql` Tests 11–12):

- `battle_start(quiz_id)` opens a session and returns the same answer-free
  question shape as `get_quiz_questions()`.
- `battle_answer(session_id, question_id, answer)` grades one question —
  but each `(session, question)` pair is write-once. A second call for a
  question you've already answered replays your original result instead of
  grading the new guess, even if the new guess happens to be the actually
  correct one. This isn't a bolted-on rate limit; it falls directly out of
  the game design — you don't get to keep re-guessing while a real-time
  clock is running anyway.
- Both functions check `auth.uid()` against the session's owner — a signed-in
  user cannot touch another user's session, even knowing its exact ID (not
  just "can't discover it via RLS" — verified separately).
- `battle_finish(session_id)` aggregates every locked-in answer and records
  the outcome through the *exact same* pass/fail rule as
  `submit_quiz_attempt()` (both now call a shared internal
  `grade_single_answer()` helper, so the real-time and batch paths can
  never silently drift into different scores for the same answers).
- Health bars in the UI are a motivational layer riding on top of this —
  the battle always plays through every question, and pass/fail is decided
  only by the real percentage, never by whether a health bar visually hit
  zero first.

---

## The admin roster gap is now closed

The dashboard, courses, missions, and admin pages all read and write real
per-user Supabase data now:
- `src/lib/supabase/queries.ts` + `src/components/HydrateFromServer.tsx` +
  the RPC calls in `QuizRunner.tsx`/`courses/page.tsx` — dashboard/courses/
  missions.
- `admin_list_learners()` / `admin_list_enrollments()` in `schema.sql` —
  the admin roster, self-checking the caller's `profiles.role` before
  returning anything, so they're safe to grant broadly to `authenticated`.

If you add more admin-only views later, follow the same pattern: a
`security definer` function that raises if `(select profiles.role from
public.profiles where profiles.id = auth.uid()) is distinct from 'admin'`
before doing anything else — note the fully-qualified `profiles.role`, not
a bare `role`, since a function whose own return table also has a column
named `role` will otherwise hit an "ambiguous column reference" error (a
real bug caught while building `admin_list_learners()` — see local test
output in `local_test_rls.sql` Test 10).
