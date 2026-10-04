// ---------------------------------------------------------------------------
// Email sender for OTP codes.
//
// Three ways to deliver, picked automatically from .env:
//
//   1) GMAIL  (recommended - FREE FOR LIFE, ~500 emails/day, no card)
//        EMAIL_USER = your.address@gmail.com
//        EMAIL_PASS = 16-char Gmail App Password  (NOT your normal password)
//      -> see OTP_SETUP.md for the 2-minute setup.
//
//   2) ANY SMTP PROVIDER (Brevo, Zoho, SendGrid, Mailgun, Amazon SES...)
//        SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
//
//   3) ETHEREAL (free TEST inbox - proves the pipeline with zero setup)
//        EMAIL_PROVIDER = ethereal
//      Nothing is delivered to a real inbox; instead every email gets a public
//      "preview URL" you can open to see exactly what the user would receive.
//      Great for demos and for checking the template. Not for real users.
//
// If none of these is configured, the app runs in DEV-OTP mode: the code is
// printed in the server console and (in non-production) returned in the API
// response so you can still test the full flow.
// ---------------------------------------------------------------------------
const nodemailer = require("nodemailer");

let transporter = null;
let mode = "dev";              // 'gmail' | 'smtp' | 'ethereal' | 'dev'
let ready = false;
let initPromise = null;

function pickMode() {
  const p = String(process.env.EMAIL_PROVIDER || "").toLowerCase();
  if (p === "ethereal") return "ethereal";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return "gmail";
  return "dev";
}

function fromAddress() {
  return (
    process.env.MAIL_FROM ||
    `"DairyIntel AI" <${process.env.EMAIL_USER || process.env.SMTP_USER || "no-reply@dairyintel.ai"}>`
  );
}

/** Build (and verify) the transporter once. Safe to call many times. */
async function initMailer() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    mode = pickMode();
    try {
      if (mode === "gmail") {
        transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
      } else if (mode === "smtp") {
        const port = Number(process.env.SMTP_PORT || 587);
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: port === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
      } else if (mode === "ethereal") {
        const acc = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: acc.user, pass: acc.pass },
        });
      }
      if (transporter) {
        await transporter.verify();   // fails fast on bad credentials
        ready = true;
      }
    } catch (e) {
      console.error(`[mailer] ${mode} setup failed: ${e.message}\n[mailer] -> falling back to DEV-OTP mode (code shown in console).`);
      transporter = null;
      ready = false;
      mode = "dev";
    }
    logStatus();
    return { mode, ready };
  })();
  return initPromise;
}

function logStatus() {
  if (mode === "gmail") console.log(`[mailer] Gmail ready - OTP emails will be sent from ${process.env.EMAIL_USER}`);
  else if (mode === "smtp") console.log(`[mailer] SMTP ready (${process.env.SMTP_HOST}) - OTP emails will be sent`);
  else if (mode === "ethereal") console.log("[mailer] Ethereal TEST inbox ready - emails are not real; open the preview URL printed on each send");
  else console.log("[mailer] No email configured - running in DEV-OTP mode (code shown in console/response). See OTP_SETUP.md to enable real emails.");
}

const SUBJECT = {
  signup: "Verify your DairyIntel AI account",
  login: "Your DairyIntel AI login code",
  reset: "Your DairyIntel AI password reset code",
};

function template(otp, purpose, ttl) {
  const line = {
    signup: "Use this code to verify your email and finish creating your account:",
    login: "Use this code to finish logging in:",
    reset: "Use this code to reset your password:",
  }[purpose] || "Your one-time verification code is:";
  const text = `DairyIntel AI\n\n${line}\n\n${otp}\n\nThis code expires in ${ttl} minutes. If you didn't request it, you can safely ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#eef3ee;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border:1px solid #dce4da;border-radius:16px;overflow:hidden">
      <tr><td style="background:#16794a;padding:18px 24px">
        <span style="color:#fff;font-size:18px;font-weight:700">🐄 DairyIntel AI</span>
      </td></tr>
      <tr><td style="padding:26px 24px 8px">
        <p style="margin:0 0 6px;color:#16241c;font-size:15px">${line}</p>
        <div style="margin:16px 0;text-align:center">
          <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;color:#16241c;background:#f3f8f4;border:1px dashed #b9ccbf;border-radius:12px;padding:14px 18px">${otp}</span>
        </div>
        <p style="margin:8px 0 0;color:#5e6f64;font-size:13px">This code expires in <b>${ttl} minutes</b>.</p>
        <p style="margin:6px 0 0;color:#5e6f64;font-size:13px">If you didn't request this, you can safely ignore this email - your account stays secure.</p>
      </td></tr>
      <tr><td style="padding:16px 24px 22px;border-top:1px solid #eef2ef">
        <p style="margin:0;color:#8a978d;font-size:11px">Sent by DairyIntel AI - milk quality grading &amp; herd health screening.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  return { text, html };
}

/**
 * Send an OTP email.
 * @returns {Promise<{delivered:boolean, previewUrl:(string|null)}>}
 */
async function sendOtpEmail(to, otp, purpose = "login", ttl = 10) {
  await initMailer();
  if (!transporter || !to) return { delivered: false, previewUrl: null };
  const { text, html } = template(otp, purpose, ttl);
  const info = await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: SUBJECT[purpose] || SUBJECT.login,
    text,
    html,
  });
  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) || null : null;
  if (previewUrl) console.log(`[mailer] Ethereal preview for ${to}: ${previewUrl}`);
  return { delivered: true, previewUrl };
}

module.exports = {
  sendOtpEmail,
  initMailer,
  mailerReady: () => ready,
  mailerMode: () => mode,
};
