# Nuru AI Academy — Database Migrations

Each file is a self-contained, idempotent SQL migration.
Run them **in numeric order**. All use `IF NOT EXISTS` and `CREATE OR REPLACE`
so re-running is safe — it will never duplicate data or break existing tables.

## Files

| File | What it creates | Depends on |
|------|----------------|------------|
| `000_safe_drop_functions.sql` | Drops all public functions (safe for re-deploy) | — |
| `001_core_auth.sql` | `profiles`, `player_stats`, privilege guard trigger | — |
| `002_curriculum.sql` | `tracks`, `modules`, `lessons`, `quizzes`, `questions`, answer-safe view | 001 |
| `003_progress.sql` | `enrollments`, `quiz_attempts`, `study_log` | 001, 002 |
| `004_achievements.sql` | `achievements`, `user_achievements` | 001 |
| `005_ai_chat_and_quiz_engine.sql` | `ai_chats`, anti-cheat `submit_quiz_attempt()` function | 001–004 |
| `006_arena_and_payments.sql` | `battle_sessions`, `battle_answers`, `track_purchases`, `complete_lesson()` | 001–003 |
| `007_user_trigger_and_duels.sql` | `handle_new_user` trigger, `duel_rooms`, `duel_participants`, `duel_answers`, `duel_queue` | 001, 002 |
| `008_mentorship_certs_ussd_map.sql` | `learner_profiles`, `mentor_profiles`, `mentorship_sessions`, `certificates`, `ussd_*`, `map_*` | 001–003 |
| `009_payments_video_onboarding.sql` | `lesson_videos`, `webhook_events`, onboarding fields, payment functions | 001, 002, 008 |
| `010_competitions.sql` | `competition_answers`, real-time competition functions | 001 |
| `011_gamification.sql` | `daily_quest_completions`, streak/XP/reward functions | 001, 003, 004 |
| `012_admin_functions.sql` | Admin CRUD functions for learners, certs, events | all previous |
| `013_cms.sql` | `daily_challenges`, `lesson_images`, `certificate_templates`, CMS CRUD functions | 001, 002 |
| `014_seed_curriculum.sql` | Seed data — tracks, modules, lessons, quizzes (run once) | 002, 013 |
| `015_storage_buckets.sql` | Storage buckets: `lesson-videos`, `lesson-images`, `certificates` + RLS policies | 001 |
| `016_session_locking.sql` | `user_sessions`, `upsert_session()`, `validate_session()`, `admin_force_logout()` | 001 |

## How to run

### Option A — Manually in Supabase SQL Editor
Paste and run each file in order (000 → 016).

### Option B — From your terminal (psql)
```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
bash supabase/run-all-migrations.sh
```

### Option C — GitHub Actions (automatic on every push to main)
Add these secrets to your GitHub repo (**Settings → Secrets → Actions**):

| Secret | Where to get it |
|--------|----------------|
| `SUPABASE_DB_URL` | Supabase → Settings → Database → Connection string (URI mode) |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | vercel.com → Settings → General → Your ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |

Once secrets are set, every `git push origin main` will:
1. Run all migrations against Supabase
2. Deploy the app to Vercel

## Adding a new migration
1. Create `017_your_feature.sql` in this folder
2. Use `IF NOT EXISTS` and `CREATE OR REPLACE` throughout
3. List its dependencies in a comment at the top
4. Push to main — CI picks it up automatically
