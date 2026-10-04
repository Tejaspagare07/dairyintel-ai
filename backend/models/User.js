const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    mobile: { type: String },
    passwordHash: { type: String, required: true }, // we store the hash, not the password
    role: { type: String, enum: ["admin", "user"], default: "user" },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" }, // used later

    // account state
    emailVerified: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "pending", "blocked"], default: "active" },
    village: { type: String },
    lastLoginAt: { type: Date },

    // one-time code (hashed) used for signup, login and password reset
    otpHash: { type: String },
    otpPurpose: { type: String, enum: ["signup", "login", "reset"] },
    otpExpires: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    otpSentAt: { type: Date },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

module.exports = mongoose.model("User", userSchema);
