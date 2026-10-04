const bcrypt = require("bcryptjs");
const User = require("../models/User");

// GET /api/users
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash -otpHash")            // never send the hash to the client
      .populate("companyId", "name")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash -otpHash").populate("companyId", "name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role, companyId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, mobile, passwordHash,
      role: role === "admin" ? "admin" : "user",
      companyId: companyId || undefined,
      emailVerified: true, status: "active",
    });

    const obj = user.toObject();
    delete obj.passwordHash;
    res.status(201).json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, email, mobile, role, companyId, password } = req.body;
    const update = { name, email, mobile, role: role === "admin" ? "admin" : role === "user" ? "user" : undefined, companyId: companyId || undefined };

    // only change the password if a new one was actually typed
    if (password) update.passwordHash = await bcrypt.hash(password, 10);

    // strip out any fields that are undefined so we don't overwrite with blanks
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash -otpHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
// PATCH /api/users/:id/status  { status: "active" | "blocked" | "pending" }
exports.setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "blocked", "pending"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (req.params.id === req.user.id) return res.status(400).json({ message: "You cannot change your own status" });
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select("-passwordHash -otpHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
