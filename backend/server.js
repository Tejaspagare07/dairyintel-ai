require("dotenv").config();
console.log("MONGO_URI =", process.env.MONGO_URI);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const sanitizeBody = require("./middleware/sanitize");
const connectDB = require("./config/db");

const app = express();

if (process.env.NODE_ENV !== "test") connectDB();

// --- Security headers ---
app.use(helmet());

// --- Request logging (dev-friendly) ---
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// --- CORS: allow localhost in dev + your deployed frontend ---
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  ...String(process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()), // comma-separate several
].filter(Boolean);
app.set("trust proxy", 1); // correct client IPs for rate limiting behind Render/Railway/Nginx

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser tools (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
}));

// --- Body parsing with size cap (prevents huge-payload abuse) ---
app.use(express.json({ limit: "100kb" }));

// --- Block NoSQL operator injection in request bodies (Express-5-safe) ---
app.use(sanitizeBody);

// --- Rate limit auth endpoints (brute-force protection) ---
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many code requests. Please wait a few minutes." } });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                  // 30 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// --- Health check (for uptime monitors / hosting) ---
app.get("/", (req, res) => res.send("DairyIntel AI API is running ✅"));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// --- Routes ---
app.use(["/api/auth/resend-otp", "/api/auth/forgot-password"], otpLimiter);
app.use("/api/auth", authLimiter, require("./routes/authRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/animals", require("./routes/animalRoutes"));
app.use("/api/milk", require("./routes/milkRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/companies", require("./routes/companyRoutes"));
app.use("/api/predict", require("./routes/predictRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/samples", require("./routes/sampleRoutes"));
app.use("/api/tests", require("./routes/testRoutes"));   // milk check = quality + disease (ML)

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// --- Central error handler (never leak internals to the client) ---
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  res.status(err.status || 500).json({ message: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  // Initialise the email transporter (verifies credentials / sets up Ethereal)
  // before we start accepting requests, so the first OTP send is already routed.
  require("./utils/mailer").initMailer().finally(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  });
}
module.exports = app;
