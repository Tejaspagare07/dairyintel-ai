require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = "dairyintel.ai@gmail.com";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash("Admin@123", 10);
  await User.create({ name: "Super Admin", email, passwordHash, role: "admin", emailVerified: true, status: "active" });

  console.log("✅ Admin created →  email: dairyintel.ai@gmail.com   password: Admin@123");
  process.exit(0);
})();