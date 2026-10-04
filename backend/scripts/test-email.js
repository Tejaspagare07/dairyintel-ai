// Prove the OTP email pipeline works - no real credentials needed.
//
//   node scripts/test-email.js            # uses whatever .env you have (or Ethereal)
//   EMAIL_PROVIDER=ethereal node scripts/test-email.js
//
// With Ethereal it prints a public PREVIEW URL - open it to see the exact email a
// user would receive. With real Gmail/SMTP creds it sends a real message to TEST_TO.
require("dotenv").config();
if (!process.env.EMAIL_PROVIDER && !process.env.EMAIL_USER && !process.env.SMTP_HOST) {
  process.env.EMAIL_PROVIDER = "ethereal"; // default this test to the free test inbox
}
const { sendOtpEmail, mailerMode } = require("../utils/mailer");

(async () => {
  const to = process.env.TEST_TO || "farmer@example.com";
  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.log(`Sending a sample "signup" OTP (${code}) to ${to} ...`);
  try {
    const r = await sendOtpEmail(to, code, "signup", 10);
    console.log("mode:", mailerMode());
    console.log("delivered:", r.delivered);
    if (r.previewUrl) console.log("PREVIEW URL (open in a browser):", r.previewUrl);
    else if (r.delivered) console.log("A real email was sent to", to);
    else console.log("Not delivered - no email configured (dev-OTP mode). The code would be shown in the app.");
    process.exit(0);
  } catch (e) {
    console.error("Send failed:", e.message);
    process.exit(1);
  }
})();
