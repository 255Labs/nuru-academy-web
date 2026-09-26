# Removing Supabase Branding from Auth Emails

This guide explains exactly what to do so that every auth email
(magic links, sign-up confirmation, password reset, email change)
arrives from **hello@nuruai.academy** with Nuru branding — no
mention of Supabase anywhere.

---

## Why Supabase branding shows up

By default, Supabase:

1. Sends emails from `noreply@mail.supabase.io`
2. Uses its own HTML templates that say "Supabase" in the body
3. Shows "Supabase" as the sender name in your inbox

These are three separate things to fix.

---

## Step 1 — Verify your sending domain in Resend

This makes emails arrive from `@nuruai.academy` instead of
`@mail.supabase.io`.

1. Go to **resend.com → Domains → Add Domain**
2. Type `nuruai.academy`
3. Resend gives you DNS records (usually 3–4 TXT/MX entries)
4. Add all of them to your domain registrar (GoDaddy, Namecheap, etc.)
5. Wait for the green "Verified" status — can take up to 48 hours

Until this is done, emails will still come from Supabase's domain.
You can proceed with Steps 2 and 3 now and come back to test after verification.

---

## Step 2 — Connect Resend as Supabase's SMTP server

This routes all Supabase auth emails through Resend (and therefore
through your verified domain) instead of Supabase's own mailer.

1. Open **Supabase Dashboard → your project**
2. Go to **Authentication → Settings** (left sidebar)
3. Scroll down to **SMTP Settings**
4. Toggle **Enable Custom SMTP** ON
5. Fill in:

   | Field           | Value                              |
   |-----------------|------------------------------------|
   | Host            | `smtp.resend.com`                  |
   | Port            | `465`                              |
   | Username        | `resend`                           |
   | Password        | your `RESEND_API_KEY` from .env    |
   | Sender Name     | `Nuru AI Academy`                  |
   | Sender Email    | `hello@nuruai.academy`             |

6. Click **Save**

> **What this does:** Instead of Supabase's own email servers sending
> the auth email, Supabase now hands the email off to Resend via SMTP.
> Resend sends it from your verified domain. The user sees
> "From: Nuru AI Academy <hello@nuruai.academy>" — no Supabase.

---

## Step 3 — Replace Supabase's HTML email templates

This removes Supabase branding from the email body content.

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. You will see four tabs: Confirm signup, Magic Link, Change Email, Reset Password
3. For each tab, replace the entire content with the HTML file listed:

   | Supabase tab        | HTML file to paste                              |
   |---------------------|-------------------------------------------------|
   | Magic Link          | `supabase/email-templates/magic-link.html`      |
   | Confirm signup      | `supabase/email-templates/confirm-signup.html`  |
   | Reset Password      | `supabase/email-templates/reset-password.html`  |
   | Change Email        | `supabase/email-templates/change-email.html`    |

4. Do NOT change `{{ .ConfirmationURL }}` — that is Supabase's
   placeholder that gets replaced with the real link when sending

5. Click **Save** on each tab

> **What this does:** Supabase Auth generates the secure token and
> the confirmation URL, but the HTML it wraps around that URL is
> now entirely yours — Nuru branding, purple colour scheme, no
> mention of Supabase anywhere in the body.

---

## What each placeholder means

Supabase uses Go template syntax inside email bodies:

| Placeholder            | What it becomes                              |
|------------------------|----------------------------------------------|
| `{{ .ConfirmationURL }}`| The full magic link / confirmation URL      |
| `{{ .Token }}`         | Just the 6-digit OTP (if using OTP mode)    |
| `{{ .SiteURL }}`       | Your site URL from Auth settings            |

Keep `{{ .ConfirmationURL }}` exactly as-is in every template — that
is the secure link Supabase generated. We are only changing the HTML
wrapper around it.

---

## Step 4 — Set your site URL

Make sure Supabase knows your production domain so links redirect correctly.

1. **Supabase Dashboard → Authentication → Settings**
2. Set **Site URL** to `https://yourdomain.com`
3. Add to **Redirect URLs**: `https://yourdomain.com/**`

---

## What the result looks like

After completing all steps:

- **From:** `Nuru AI Academy <hello@nuruai.academy>`
- **Subject:** Controlled by Supabase (e.g. "Confirm Your Email")
- **Body:** Your branded template — purple gradient header, Nuru
  logo, no mention of Supabase
- **Link:** Still a secure Supabase-generated URL (that's fine —
  users never see the URL internals, only the domain in the button)

---

## Why this is the right security posture

Exposing your infrastructure provider (Supabase) in emails is a
security risk for two reasons:

1. **Social engineering:** An attacker who knows you use Supabase
   can craft convincing phishing emails that mimic Supabase's real
   branding, making users think they came from you
2. **Information disclosure:** Your tech stack is proprietary
   information — keeping it off outbound communication is standard
   practice for production applications

This setup gives you the best of both worlds: Supabase's battle-tested
auth security (token generation, expiry, one-time use) with your own
branded presentation on top.

