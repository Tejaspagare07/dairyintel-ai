const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { issueOtp, checkOtp, clearOtp, secondsUntilResend } = require("../utils/otp");

// Flow
//   signup:  POST /register            -> OTP emailed -> POST /verify-otp {purpose:"signup"} -> token
//   login:   POST /login (password ok) -> OTP emailed -> POST /verify-otp {purpose:"login"}  -> token
//   reset:   POST /forgot-password     -> OTP emailed -> POST /reset-password {otp, password}
//   any:     POST /resend-otp {identifier, purpose}  (30 s cooldown)

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status });

const findByIdentifier = (identifier) => {
  const id = String(identifier || "").trim();
  return User.findOne({ $or: [{ email: id.toLowerCase() }, { mobile: id }] });
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const requireApproval = () => process.env.REQUIRE_ADMIN_APPROVAL === "true";

// POST /api/auth/register  { name, email, mobile, password, village }
exports.register = async (req, res) => {
  try {
    const { name, email, mobile, password, village } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
    if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.emailVerified) return res.status(409).json({ message: "Email already registered. Please log in." });

    const passwordHash = await bcrypt.hash(password, 10);
    if (user) {
      // unverified earlier attempt -> refresh details and send a new code
      Object.assign(user, { name, mobile, village, passwordHash });
    } else {
      user = new User({
        name, email, mobile, village, passwordHash,
        role: "user", // SECURITY: public sign-ups are always farmers
        status: requireApproval() ? "pending" : "active",
      });
    }
    const wait = user.isNew ? 0 : secondsUntilResend(user);
    if (wait > 0) {
      await user.save();
      return res.status(429).json({ message: `Please wait ${wait}s before requesting another code.`, resendInSec: wait });
    }
    const otp = await issueOtp(user, "signup");
    res.status(201).json({ ...otp, identifier: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login  { identifier, password, role }
exports.login = async (req, res) => {
  try {
    const { identifier, password, role } = req.body;
    if (!identifier || !password) return res.status(400).json({ message: "Please enter your credentials" });

    const user = await findByIdentifier(identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });   // generic — no enumeration
    }
    if (role && role !== user.role) {
      return res.status(403).json({ message: `This is not a${role === "admin" ? "n admin" : " farmer"} account` });
    }
    if (user.status === "blocked") return res.status(403).json({ message: "This account is blocked. Contact your collection centre." });

    // ✅ Verified email -> log in directly with the password. NO code each time.
    if (user.emailVerified) {
      if (user.status === "pending") {
        return res.status(403).json({ message: "Your account is waiting for approval by the collection centre.", pending: true });
      }
      user.lastLoginAt = new Date();
      await user.save();
      return res.json({ token: signToken(user), user: publicUser(user) });
    }

    // Email never verified (an unfinished sign-up) -> confirm it ONCE with a code.
    const wait = secondsUntilResend(user);
    if (wait > 0 && user.otpPurpose === "signup" && user.otpExpires > new Date()) {
      return res.json({ otpRequired: true, purpose: "signup", identifier: user.email, resendInSec: wait, reused: true,
                        message: "A code was just sent. Use that code or wait to resend." });
    }
    const otp = await issueOtp(user, "signup");
    res.json({ ...otp, identifier: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/verify-otp  { identifier, otp, purpose: "signup" | "login" | "reset" }
exports.verifyOtp = async (req, res) => {
  try {
    const { identifier, otp, purpose = "login" } = req.body;
    const user = await findByIdentifier(identifier);
    if (!user) return res.status(400).json({ message: "Invalid or expired code" });

    const check = await checkOtp(user, otp, purpose);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    // reset: only confirm the code - it is consumed in /reset-password
    if (purpose === "reset") return res.json({ message: "Code verified" });

    clearOtp(user);
    if (purpose === "signup") user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    if (user.status === "pending") {
      return res.status(403).json({ message: "Email verified. Your account is waiting for approval by the collection centre.", pending: true });
    }
    if (user.status === "blocked") return res.status(403).json({ message: "This account is blocked." });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/resend-otp  { identifier, purpose }
exports.resendOtp = async (req, res) => {
  try {
    const { identifier, purpose = "login" } = req.body;
    const user = await findByIdentifier(identifier);
    // same response whether or not the account exists (no account enumeration)
    if (!user || user.otpPurpose !== purpose) return res.json({ message: "If the account exists, a new code was sent.", resendInSec: 30 });
    const wait = secondsUntilResend(user);
    if (wait > 0) return res.status(429).json({ message: `Please wait ${wait}s before resending.`, resendInSec: wait });
    const otp = await issueOtp(user, purpose);
    res.json({ ...otp, identifier: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash -otpHash");
  res.json({ user });
};

// POST /api/auth/forgot-password  { identifier }
// POST /api/auth/forgot-password  { identifier }
exports.forgotPassword = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: "Enter your email or mobile" });

    // SECURITY: same 200 response & shape whether or not the account exists.
    const RESET_MSG = "If an account exists with those details, a reset code has been sent.";
    const generic = { otpRequired: true, purpose: "reset", identifier: String(identifier).trim(),
                      channel: "email", expiresInMin: 10, resendInSec: 30, message: RESET_MSG };

    const user = await findByIdentifier(identifier);
    if (!user) return res.json(generic);                       // unknown -> silently send nothing

    const wait = secondsUntilResend(user);
    if (wait > 0) return res.json({ ...generic, resendInSec: wait });  // don't leak via a 429 either

    const otp = await issueOtp(user, "reset");
    res.json({ ...generic, identifier: user.email, resendInSec: otp.resendInSec ?? 30,
               expiresInMin: otp.expiresInMin ?? 10, ...(otp.devOtp ? { devOtp: otp.devOtp } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/reset-password  { identifier, otp, password }
exports.resetPassword = async (req, res) => {
  try {
    const { identifier, otp, password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const user = await findByIdentifier(identifier);
    if (!user) return res.status(400).json({ message: "Invalid or expired code" });
    const check = await checkOtp(user, otp, "reset");
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.emailVerified = true; // they proved they own the inbox
    clearOtp(user);
    await user.save();
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
