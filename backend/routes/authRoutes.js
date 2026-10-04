const express = require("express");
const router = express.Router();
const { register, login, me, verifyOtp, resendOtp, forgotPassword, resetPassword } = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/register", register);          // -> sends signup OTP
router.post("/login", login);                // password check -> sends login OTP
router.post("/verify-otp", verifyOtp);       // { identifier, otp, purpose } -> token
router.post("/resend-otp", resendOtp);
router.get("/me", auth, me);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
