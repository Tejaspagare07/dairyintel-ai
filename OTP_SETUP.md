# OTP email setup — free for life

The OTP system (signup, login, password reset) is fully built. This guide turns on
**real email delivery** using **Gmail**, which is **free for life** (about 500 emails a
day, no credit card). For a college project or a small app that is effectively unlimited.

There are three ways to run it. Pick one.

---

## Option A — Gmail (recommended, free for life)

You need a Google account. A brand-new throwaway Gmail (e.g. `dairyintel.otp@gmail.com`)
is perfectly fine and keeps it separate from your personal mail.

### Step 1 — turn on 2-Step Verification
1. Go to **https://myaccount.google.com/security**
2. Under **"How you sign in to Google"**, open **2-Step Verification** and turn it on
   (follow the prompts — you'll confirm with your phone once).

> App Passwords only exist **after** 2-Step Verification is on.

### Step 2 — create an App Password
1. Go to **https://myaccount.google.com/apppasswords**
   (or Google Account → Security → 2-Step Verification → **App passwords**).
2. Type a name like `DairyIntel` and click **Create**.
3. Google shows a **16-character password** like `abcd efgh ijkl mnop`.
   Copy it. **Remove the spaces** → `abcdefghijklmnop`.

> This is NOT your normal Gmail password. It only works for sending mail from this app,
> and you can delete it anytime from that same page.

### Step 3 — put it in `backend/.env`
```env
EMAIL_USER=dairyintel.otp@gmail.com
EMAIL_PASS=abcdefghijklmnop
MAIL_FROM="DairyIntel AI <dairyintel.otp@gmail.com>"
```

### Step 4 — restart the backend and test
```bash
cd backend
node scripts/test-email.js          # sends a real code to yourself
```
Set who it goes to first, e.g. `TEST_TO=you@gmail.com node scripts/test-email.js`.

You should see `mode: gmail`, `delivered: true`, and the email in your inbox. Now sign
up in the app and the 6-digit code arrives by email. Done — and free, forever.

**On startup** the server prints `[mailer] Gmail ready ...` if the password is correct,
or a clear error (and falls back to dev mode) if it isn't — so you'll know immediately.

---

## Option B — any other SMTP provider

If you'd rather use Brevo / Zoho / SendGrid / Mailgun / Amazon SES, set these in `.env`
instead (leave the Gmail ones blank):
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-smtp-login
SMTP_PASS=your-smtp-key
MAIL_FROM="DairyIntel AI <no-reply@yourdomain.com>"
```

---

## Option C — Ethereal test inbox (free, zero setup, not real delivery)

For demos or to see the email template without any account:
```env
EMAIL_PROVIDER=ethereal
```
Nothing reaches a real inbox. Instead, every send returns a **preview URL** — the app
shows an "Open the email to read your code →" link, and the URL is printed in the server
console. Perfect for showing the flow working. Switch to Option A for real users.

---

## How the OTP system behaves (already built)

- 6-digit codes, valid for `OTP_TTL_MIN` minutes (default 10).
- Codes are **never stored in plain text** — only a bcrypt hash is saved.
- **5** wrong attempts, then the code is locked and a new one must be requested.
- **Resend** unlocks after 30 seconds; auth routes are rate-limited.
- No email configured → **dev mode**: the code is printed in the console and shown on the
  page, so you can always test end-to-end even before setting up Gmail.
- `NODE_ENV=production` hides dev codes completely (unless you set `ALLOW_DEV_OTP=true`
  for a demo server).

## Why not SMS?
SMS one-time codes are **not** free for life anywhere reliable — Twilio, MSG91, etc. all
charge per message and need a paid balance. Email OTP via Gmail gives you the same
security for free, forever. If you ever want SMS too, add a sender in
`backend/utils/mailer.js` next to `sendOtpEmail` (e.g. Twilio/MSG91) and call it from
`backend/utils/otp.js` — the rest of the flow already supports it.
