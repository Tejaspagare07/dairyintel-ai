// One-time-code helper shared by signup, login and password reset.
// Codes are 6 digits, stored only as a bcrypt hash, valid for OTP_TTL_MIN minutes,
// max OTP_MAX_ATTEMPTS wrong tries, and can be re-sent after OTP_RESEND_SEC seconds.
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendOtpEmail } = require("./mailer");

const OTP_TTL_MIN = Number(process.env.OTP_TTL_MIN || 10);
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SEC = 30;

const isProd = () => process.env.NODE_ENV === "production";
// Dev-mode OTP: shown in the API response + server console when email isn't configured.
// Never enabled in production unless you explicitly set ALLOW_DEV_OTP=true (e.g. a demo server).
const devOtpAllowed = () => !isProd() || process.env.ALLOW_DEV_OTP === "true";

function secondsUntilResend(user) {
  if (!user.otpSentAt) return 0;
  const left = OTP_RESEND_SEC - Math.floor((Date.now() - user.otpSentAt.getTime()) / 1000);
  return Math.max(0, left);
}

/** Creates + stores a new code on the user and tries to email it. */
async function issueOtp(user, purpose) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  user.otpHash = await bcrypt.hash(code, 10);
  user.otpPurpose = purpose;
  user.otpExpires = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000);
  user.otpAttempts = 0;
  user.otpSentAt = new Date();
  await user.save();

  let delivered = false, previewUrl = null;
  if (user.email) {
    try {
      const r = await sendOtpEmail(user.email, code, purpose, OTP_TTL_MIN);
      delivered = r.delivered;
      previewUrl = r.previewUrl;
    } catch (e) { console.error("[OTP] email send failed:", e.message); }
  }
  if (!delivered) console.log(`[OTP][dev] ${purpose} code for ${user.email}: ${code} (valid ${OTP_TTL_MIN} min)`);

  const out = {
    otpRequired: true,
    purpose,
    email: maskEmail(user.email),
    delivered,
    expiresInMin: OTP_TTL_MIN,
    resendInSec: OTP_RESEND_SEC,
  };
  // Ethereal TEST inbox: the email is "sent" but not to a real address, so expose
  // the public preview link the user can open to read the code.
  if (previewUrl) out.previewUrl = previewUrl;
  if (!delivered) {
    if (devOtpAllowed()) out.devOtp = code;
    else out.message = "Could not send the verification email. Please try again later.";
  }
  return out;
}

/** Checks a code. Returns { ok } or { ok:false, message, status }. Clears the code on success. */
async function checkOtp(user, code, purpose) {
  if (!user || !user.otpHash || user.otpPurpose !== purpose) {
    return { ok: false, status: 400, message: "No active code. Please request a new one." };
  }
  if (user.otpExpires.getTime() < Date.now()) {
    return { ok: false, status: 400, message: "This code has expired. Please request a new one." };
  }
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: "Too many wrong attempts. Please request a new code." };
  }
  const match = await bcrypt.compare(String(code || ""), user.otpHash);
  if (!match) {
    user.otpAttempts += 1;
    await user.save();
    const left = OTP_MAX_ATTEMPTS - user.otpAttempts;
    return { ok: false, status: 400, message: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Please request a new code." };
  }
  return { ok: true };
}

function clearOtp(user) {
  user.otpHash = undefined; user.otpPurpose = undefined; user.otpExpires = undefined;
  user.otpAttempts = 0; user.otpSentAt = undefined;
}

function maskEmail(email = "") {
  const [u, d] = String(email).split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.min(4, Math.max(1, u.length - 2)))}@${d}`;
}

module.exports = { issueOtp, checkOtp, clearOtp, secondsUntilResend, OTP_RESEND_SEC };
