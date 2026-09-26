# Nuru AI Academy — Complete Deployment & Admin Guide

Everything you need to take this from the ZIP file to a live, production platform.
Estimated total time: **2–3 hours** for a clean first deploy.

---

## What You Will Have When Done

- Live Next.js app on Vercel with a custom domain
- Postgres database on Supabase with all 30 tables, RLS, and seed data
- Google OAuth + magic-link sign-in
- ClickPesa mobile money payments (M-Pesa, Tigo, Airtel, HaloPesa)
- Nuru AI tutor powered by Anthropic Claude
- Email receipts and streak reminders via Resend
- USSD competition gateway on *278#
- Protected video streaming for mentorship content
- Admin control panel at /admin

---

## Part 1 — Prerequisites

Get accounts on these services before starting. All have free tiers sufficient for launch.

| Service | What it does | Sign up at |
|---|---|---|
| Supabase | Database + auth | supabase.com |
| Vercel | Hosting | vercel.com |
| Anthropic | Nuru AI tutor | console.anthropic.com |
| Resend | Email receipts | resend.com |
| ClickPesa | Mobile money payments | clickpesa.com |
| Google Cloud | Google sign-in (optional) | console.cloud.google.com |
| Cloudflare | DNS + WAF (optional but recommended) | cloudflare.com |

---

## Part 2 — Supabase Setup

### Step 1: Create your project

1. Go to **supabase.com/dashboard** → click **New project**
2. Fill in:
   - **Name**: Nuru AI Academy (or anything)
   - **Database password**: generate a strong one and save it
   - **Region**: `eu-central-1` (Frankfurt) is closest to Tanzania with good latency
3. Click **Create new project** and wait ~2 minutes for provisioning

### Step 2: Run the database schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase/schema.sql` from the project ZIP
4. Select all the text, paste it into the SQL editor, click **Run**
5. You should see a stream of `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION` — no red errors

Verify it worked:
```sql
select count(*) from information_schema.tables
where table_schema = 'public';
-- Should be 30 or more
```

### Step 3: Create the private video storage bucket

1. In Supabase left sidebar → **Storage**
2. Click **New bucket**
3. Name: `lesson-videos`
4. Toggle **Public bucket** to **OFF** (this is critical — must be private)
5. Click **Save**

### Step 4: Get your API keys

1. In Supabase left sidebar → **Settings** → **API Keys**
2. Copy these — you'll need them in the next section:

```
Project URL:        https://xxxxxxxxxxxx.supabase.co
Publishable key:    sb_publishable_xxxx...
Secret key:         sb_secret_xxxx...
JWT Secret:         Settings → API → JWT Secret (scroll down on same page)
```

The publishable key is safe to expose in the browser. The secret key and JWT secret are never public.

---

## Part 3 — Get All Your Keys

Complete this before moving to deployment. You need:

### Anthropic (Nuru AI)
1. Go to **console.anthropic.com**
2. **API Keys** → **Create Key**
3. Copy the `sk-ant-...` key

### Resend (Email)
1. Go to **resend.com** → sign up
2. **API Keys** → **Create API Key**
3. Copy the `re_...` key
4. While here: go to **Domains** and add your sending domain (e.g. `nuruai.academy`)
   - Add the DNS records Resend gives you to your DNS provider
   - Verify the domain before launch

### ClickPesa (Payments)
1. Go to **clickpesa.com**, register as a merchant and complete KYC
2. **Merchant Dashboard → Settings → Developers → Applications**
3. Create an **API Application**
4. Copy:
   - **Client ID**
   - **API Key** (generate one)
   - **Checksum Key** (separate from API Key)
5. Under **Webhooks** in the application settings, you'll add your Vercel URL later

### Google OAuth (Optional — skip if magic-link only is fine)
1. Go to **console.cloud.google.com**
2. Create a new project or use an existing one
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Leave **Authorised redirect URIs** blank for now — you'll add the Supabase callback URL in Step 5
6. Copy **Client ID** and **Client Secret**

### USSD Gateway (If using *278# competitions)
1. Sign up with **Africa's Talking** (africastalking.com) or **Buni Mobile**
2. Register a USSD service code (e.g. *278#)
3. Get your **Webhook Signing Secret** from the dashboard

---

## Part 4 — Local Setup and Test

### Step 1: Install and configure

```bash
# Unzip the project
unzip nuru-academy-web-final.zip
cd nuru-academy-web-final

# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local
```

### Step 2: Fill in .env.local

Open `.env.local` and fill in every value:

```bash
# ── SUPABASE ──────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx...
SUPABASE_SECRET_KEY=sb_secret_xxxx...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-settings

# ── ANTHROPIC (Nuru AI tutor) ──────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxx...

# ── CLICKPESA (Mobile money payments) ──────────────────────────────────
CLICKPESA_CLIENT_ID=your-client-id
CLICKPESA_API_KEY=your-api-key
CLICKPESA_CHECKSUM_KEY=your-checksum-key

# ── RESEND (Email) ─────────────────────────────────────────────────────
RESEND_API_KEY=re_xxxx...

# ── SECURITY ───────────────────────────────────────────────────────────
# Generate these with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET=generate-a-random-32-byte-hex-string
USSD_GATEWAY_SECRET=your-ussd-webhook-signing-secret

# ── CLOUDFLARE TURNSTILE (optional bot protection) ─────────────────────
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

### Step 3: Seed the curriculum

```bash
npm run seed
```

This populates tracks, modules, lessons, quizzes, and questions from the curriculum file.
Should print success messages for each track. Safe to run multiple times.

Verify:
```sql
-- Run in Supabase SQL Editor
select count(*) from lessons;    -- expect 75
select count(*) from questions;  -- expect several dozen
```

### Step 4: Run locally and verify

```bash
npm run dev
```

Open **http://localhost:3000**. You should see:
- The Nuru AI Academy landing page (not signed in)
- Click sign in → enter your email → check email for magic link
- Click the link → land on onboarding → pick age tier → pick a track
- Dashboard loads with your real data

Run the security test suite to confirm all fixes are in place:
```bash
npm run verify-duel-sync  # optional — needs real Supabase URL
npx tsx scripts/security-test.ts
# Should show: 40 passed · 0 failed
```

---

## Part 5 — Configure Authentication

### Magic link (already works)
No setup needed — Supabase ships with email OTP enabled.

Add your URLs in **Supabase → Authentication → URL Configuration → Redirect URLs**:
```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

### Google OAuth (optional)
1. In your Supabase dashboard → **Authentication → Providers → Google**
2. Copy the **Callback URL** shown there (looks like `https://xxxx.supabase.co/auth/v1/callback`)
3. Go back to Google Cloud Console → your OAuth client → add that URL to **Authorised redirect URIs**
4. Paste your Google **Client ID** and **Client Secret** into Supabase and toggle Google **on**

---

## Part 6 — Deploy to Vercel

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Nuru AI Academy — initial deploy"
# Create a repo on github.com then:
git remote add origin https://github.com/your-username/nuru-academy-web.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to **vercel.com** → **New Project**
2. Import your GitHub repository
3. Vercel auto-detects Next.js — leave all settings as default
4. Before deploying, click **Environment Variables** and add every variable from `.env.local`:

| Variable | Environment |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production + Preview |
| `SUPABASE_SECRET_KEY` | Production only |
| `SUPABASE_JWT_SECRET` | Production only |
| `ANTHROPIC_API_KEY` | Production only |
| `CLICKPESA_CLIENT_ID` | Production only |
| `CLICKPESA_API_KEY` | Production only |
| `CLICKPESA_CHECKSUM_KEY` | Production only |
| `RESEND_API_KEY` | Production only |
| `CRON_SECRET` | Production only |
| `USSD_GATEWAY_SECRET` | Production only |

5. Click **Deploy**
6. Wait ~2 minutes. Visit the `.vercel.app` URL to confirm it works.

### Step 3: Add your custom domain

1. **Vercel → Project → Settings → Domains**
2. Add your domain (e.g. `nuruai.academy`)
3. Vercel shows you either a CNAME or A record to add — copy it

### Step 4: Configure ClickPesa webhook

Now that you have a real URL, go back to your ClickPesa application settings and add:
- **Webhook URL (PAYMENT RECEIVED)**: `https://yourdomain.com/api/payments/webhook`
- **Webhook URL (PAYMENT FAILED)**: `https://yourdomain.com/api/payments/webhook`

### Step 5: Configure USSD gateway

In your Africa's Talking or Buni Mobile dashboard:
- **Callback URL**: `https://yourdomain.com/api/ussd`
- The gateway will POST to this URL for every *278# session

---

## Part 7 — Cloudflare DNS Setup (Recommended)

### Step 1: Add site to Cloudflare
1. **cloudflare.com → Add a site** → enter your domain
2. Cloudflare scans your existing DNS — import the records
3. Update your domain registrar's nameservers to Cloudflare's (shown during setup)

### Step 2: Add the Vercel DNS record
1. In Cloudflare **DNS** tab → **Add record**
2. Type: `CNAME`, Name: `@` (or `www`), Target: your Vercel URL
3. Proxy status: **Proxied** (orange cloud) — this enables WAF and bot protection

### Step 3: Critical SSL setting
1. Cloudflare **SSL/TLS** → Set to **Full (strict)**
2. Do NOT use Flexible — it will cause redirect loops with Vercel

### Step 4: Cache rules
1. Cloudflare **Caching → Cache Rules → Create rule**
2. Match: `hostname equals yourdomain.com AND not starts with /_next/static`
3. Action: **Bypass cache**

This prevents Cloudflare from caching authenticated pages and serving one user's data to another.

---

## Part 8 — Promote Your Admin Account

The admin panel is locked behind a real server-side role check. No one can self-promote.
To make your account an admin:

1. Sign in to the live app with the email you want to be admin
2. Go to your Supabase project → **SQL Editor**
3. Run this (replace with your real email):

```sql
update public.profiles
set role = 'admin'
where email = 'balati@yourdomain.com';
```

4. Verify it worked:
```sql
select email, role from public.profiles where email = 'balati@yourdomain.com';
-- Should show: role = admin
```

5. Sign out and sign back in
6. Visit `https://yourdomain.com/admin` — you should be inside the admin panel

---

## Part 9 — The Admin Panel

The admin panel is at `/admin`. It has 8 tabs.

---

### Overview Tab

Your first stop. Shows:
- Total learners, total revenue, average progress, certificates issued
- Competitions, mentor applications, videos uploaded, languages in use
- Revenue bar chart broken down by track (Beginner / Intermediate / Expert)

Use this to get a quick read on platform health at any time.

---

### Learners Tab

A full table of every registered learner.

**Columns:** Name, email, active track, XP, role badge, progress bar, action buttons.

**Click any row** to open the detail panel on the right. It shows:
- XP, level, coins earned
- Age tier and language preference
- Every track they're enrolled in with node count
- Purchase history with amounts and status
- Certificates issued
- Recent study log

**Action buttons on each row:**

| Button | What it does |
|---|---|
| Shield icon | Toggle between Student ↔ Admin role |
| Person × icon | Suspend or reactivate the account |

Suspending sets `profiles.suspended = true`. The middleware will block suspended users from accessing the app (you'll need to add a check in middleware if you want hard enforcement — currently it's a DB flag only).

---

### Revenue Tab

Three cards at the top show total TZS collected per track.

The table below breaks this down by month. Columns:
- Month (YYYY-MM format)
- Track
- Revenue in TZS (successful payments only)
- Count of successful / pending / failed payments

Use this to see which months and tracks are driving revenue and where payment failures are spiking.

---

### Certificates Tab

Every certificate ever issued, across all learners.

**Columns:** Learner name, email, track completed, issue date, truncated verify token.

**Action buttons:**

| Button | What it does |
|---|---|
| Refresh icon | Re-issue: resets the verify_token to a new random value. Use if a certificate link was compromised. |
| Trash icon | Revoke: permanently deletes the certificate row. The verify URL will return "not found". |

The verify URL for any certificate is: `https://yourdomain.com/verify/[token]`

This page requires no sign-in — anyone can visit it to confirm a certificate is real.

---

### Competitions Tab

Manage USSD competitions accessible via *278# and the web at `/compete`.

**To create a new competition:**
1. Click **New Competition** (purple button, top right)
2. Fill in the form:
   - **Title**: shown in the USSD menu and web listing
   - **Description**: shown on the web listing
   - **Track**: Beginner / Intermediate / Expert (determines which quiz bank is used)
   - **Status**: Upcoming → Active → Ended (change to Active when you want entries to open)
   - **Starts at / Ends at**: date and time in local time
   - **Prize description**: e.g. "Airtime TZS 50,000 for top 3"
   - **Entry fee**: 0 for free competitions
3. Click **Save**

**To activate a competition:**
- Click the edit icon on any competition row
- Change Status to **Active**
- Save

Once active, it appears in the USSD menu when users dial *278# and on the web at `/compete`.

**To end a competition:**
- Change Status to **Ended**
- Final leaderboard remains visible on `/compete`

---

### Content Tab

Two sections: video upload and quiz status flags.

**Uploading a lesson video:**

1. Select a **Module** from the dropdown (shows: Track name · Week · Module name)
2. Select the **Lesson day** (1–5, corresponding to day within the module week)
3. Enter a **Video title** (shown to learners)
4. Click **Choose file** and select your video (MP4, WebM, or MOV, max 2 GB)
5. Click **Upload**

The video is stored in the private `lesson-videos` Supabase bucket. No public URL is ever generated. Learners stream it via a 60-second signed URL issued by `/api/video` after enrollment verification.

**What learners see:** A protected video player with no download button, no right-click, pauses when the tab is hidden. Screenshot keys trigger a pause. No native browser controls are shown.

**Note:** Uploading a new video for a module+day combination automatically deactivates the previous one.

**Quiz status flags:**

This panel shows every module's quiz status:
- 🟢 **Live** — real questions authored, fully functional
- 🟡 **Placeholder** — provisional questions, learners see a banner warning
- **No quiz** — module has no quiz yet

Currently Week 1 quizzes for all three tracks are **Live**. Weeks 2–5 are **Placeholder**. To make a quiz live: author real questions in the DB via the seed script or directly in the Supabase Table Editor, then update the `placeholder` flag in `src/data/curriculum.ts`.

---

### Mentors Tab

Manages mentor applications.

Learners apply at `/mentors` → Apply tab. Their application lands here with **Pending** status.

**Columns:** Name, email, bio preview, specialties, hourly rate, status, action buttons.

**Action buttons:**

| Button | What it does |
|---|---|
| ✓ (green) | Approve — mentor appears in the public listing at /mentors |
| ✗ (red) | Reject — mentor stays hidden from learners |

Only approved mentors are visible to learners. Approving/rejecting updates `mentor_profiles.approved` via the `admin_set_mentor_approved()` RPC.

After approval, mentors can have sessions booked by learners. Those bookings appear in `mentorship_sessions` — there is no admin UI for them yet, query the table directly in Supabase if needed.

---

### Demographics Tab

Two horizontal bar charts:

**Age Tiers** (left):
- Explorer (6–12)
- Challenger (13–17)
- Learner (18+)
- Professional
- Unknown (users who haven't set a preference yet)

**Languages** (right):
- English, Swahili, French, Amharic, Hausa, Yoruba, Zulu

These pull from `learner_profiles` via `admin_demographics()`. Useful for understanding your audience mix and deciding where to invest in content localisation.

---

## Part 10 — Day-to-Day Operations

### Checking payment issues

1. Admin panel → **Revenue** tab for aggregates
2. Admin panel → **Learners** → click a learner → see their individual purchase history
3. For raw data: Supabase SQL Editor:
```sql
select * from track_purchases
where status = 'pending'
order by created_at desc;
```

For webhook failures:
```sql
select * from webhook_events
where processed = false
order by received_at desc;
```

### Issuing a certificate manually

If a learner completed a track but the certificate wasn't auto-issued:
```sql
-- Run as the learner's user_id (get it from profiles)
select * from issue_certificate('beginner');  -- or 'intermediate', 'expert'
```

Or call the RPC from the Supabase dashboard with the learner's session. The certificate then appears in their `/certificates` page.

### Resetting a learner's streak (admin SQL)
```sql
delete from study_log where user_id = 'their-user-uuid';
```

### Viewing USSD competition entries
```sql
select
  ue.phone_number,
  ps.display_name,
  ue.score,
  ue.answers_given,
  ue.completed,
  ue.created_at
from ussd_entries ue
left join player_stats ps on ps.user_id = ue.user_id
where ue.competition_id = 'competition-uuid'
order by ue.score desc;
```

---

## Part 11 — Security Operations

### Rotating a compromised key

If any secret is ever exposed:

1. **Anthropic API key**: regenerate at console.anthropic.com → update in Vercel env vars → redeploy
2. **Supabase secret key**: Supabase dashboard → Settings → API Keys → rotate → update Vercel → redeploy
3. **ClickPesa checksum key**: regenerate in ClickPesa dashboard → update Vercel → redeploy
4. **CRON_SECRET**: generate new random value → update Vercel → the old secret stops working immediately after deploy
5. **USSD_GATEWAY_SECRET**: update in USSD gateway dashboard and Vercel simultaneously

### Suspending a bad actor

Admin panel → Learners → find the user → click the suspend button (person × icon). This sets `profiles.suspended = true` in the DB. Add a check in `middleware.ts` if you want hard session termination.

Or via SQL:
```sql
select admin_set_suspended('user-uuid'::uuid, true, 'Reason for suspension');
```

### Checking for privilege escalation attempts

```sql
-- Anyone who tried to set their own role directly (the trigger blocks it but logs nothing by default)
-- Check if any non-admin profiles have been modified recently
select id, email, role, updated_at
from profiles
where role = 'admin'
order by updated_at desc;
```

---

## Part 12 — Verification Checklist Before Going Live

Run through this before announcing to real users:

- [ ] `npx tsx scripts/security-test.ts` — shows **40 passed · 0 failed**
- [ ] `npm run build` — clean build, no TypeScript errors
- [ ] Sign in with a real email — magic link arrives within 30 seconds
- [ ] Complete onboarding — age tier picks correctly, track enrollment saves to DB
- [ ] Open `/courses` — lessons are playable, quiz grades correctly
- [ ] Make a real test payment with ClickPesa (small amount) — track unlocks after approval
- [ ] Check email — receipt arrives from your Resend domain
- [ ] Open `/admin` with a non-admin account — should redirect to `/?admin_denied=1`
- [ ] Open `/admin` with your admin account — all 8 tabs load with real data
- [ ] Upload a test video in Content tab — appears in the uploaded videos list
- [ ] Open `/verify/[a-real-token]` — certificate verification page works without sign-in
- [ ] SSL is showing padlock on your custom domain
- [ ] Cloudflare SSL/TLS is set to **Full (strict)**
- [ ] Run a security headers check at **securityheaders.com** — should show A or A+

---

## Part 13 — Environment Variable Quick Reference

Full list with where to get each value:

| Variable | Get it from | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API Keys | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys | ✅ Yes |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys | ✅ Yes |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret | ✅ Yes |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | ✅ Yes |
| `CLICKPESA_CLIENT_ID` | ClickPesa → Settings → Developers | ✅ Yes (payments) |
| `CLICKPESA_API_KEY` | ClickPesa → Settings → Developers | ✅ Yes (payments) |
| `CLICKPESA_CHECKSUM_KEY` | ClickPesa → Settings → Developers | ✅ Yes (payments) |
| `RESEND_API_KEY` | resend.com → API Keys | ✅ Yes (email) |
| `CRON_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ✅ Yes |
| `USSD_GATEWAY_SECRET` | Africa's Talking / Buni Mobile → Webhooks | If using *278# |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → Add site | Optional |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → Add site | Optional |

