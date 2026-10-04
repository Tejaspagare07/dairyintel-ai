const mongoose = require("mongoose");
const MilkRecord = require("../models/MilkRecord");
const User = require("../models/User");
const Animal = require("../models/Animal");
const Alert = require("../models/Alert");
const MilkTest = require("../models/MilkTest");

// --- small helpers ---
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

// decide Good / Average / Poor from fat & snf
const deriveQuality = (fat, snf) => {
  if (fat == null || snf == null) return "Unknown";
  if (fat >= 3.5 && snf >= 8.5) return "Good";
  if (fat < 3.0 || snf < 8.0) return "Poor";
  return "Average";
};

// helper to sum a field with a filter
const sumQuantity = async (match) => {
  const [row] = await MilkRecord.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return row ? +row.total.toFixed(1) : 0;
};

// helper to average fat & snf with a filter
const mean = (rows, k) => {
  const v = rows.map((r) => r[k]).filter((x) => typeof x === "number");
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : 0;
};
const avgFatSnf = async (match) => {
  const rows = await MilkRecord.find(match).select("fat snf").sort({ collectionDate: -1 }).limit(5000).lean();
  return { avgFat: mean(rows, "fat"), avgSnf: mean(rows, "snf") };
};

// GET /api/dashboard/admin   (admin only)
exports.adminSummary = async (req, res) => {
  try {
    const totalMilkToday = await sumQuantity({ collectionDate: { $gte: startOfToday() } });
    const totalMilkMonth = await sumQuantity({ collectionDate: { $gte: startOfMonth() } });
    const { avgFat, avgSnf } = await avgFatSnf({}); // all records

    const totalUsers = await User.countDocuments({ role: "user" });
    const totalAnimals = await Animal.countDocuments();
    const alertCount = await Alert.countDocuments({ resolved: false });
    const diseaseRiskCount = await Alert.countDocuments({ resolved: false, type: "disease_risk" });

    // ---- milk-check (ML) overview, last 7 days ----
    const since = new Date(Date.now() - 7 * 864e5);
    const recent = await MilkTest.find({ testedAt: { $gte: since } }).select("quality.grade").lean();
    const grades = { Good: 0, Average: 0, Poor: 0 };
    recent.forEach((t) => { const g = t.quality?.grade; if (g in grades) grades[g] += 1; });
    const riskTests = await MilkTest.find({ "disease.status": "High Risk", testedAt: { $gte: since } })
      .sort({ testedAt: -1 }).limit(8).populate("animalId", "animalId name").populate("userId", "name village");
    const farmsAtRisk = new Set(riskTests.map((t) => String(t.userId?._id))).size;
    const pendingUsers = await User.countDocuments({ role: "user", status: "pending" });

    // farmers + their latest milk-check grade
    const farmers = await User.find({ role: "user" }).select("name email village status emailVerified createdAt").sort({ createdAt: -1 }).limit(12).lean();
    await Promise.all(farmers.map(async (f) => {
      const t = await MilkTest.findOne({ userId: f._id }).sort({ testedAt: -1 }).select("quality.grade disease.status testedAt").lean();
      f.lastTest = t ? { grade: t.quality?.grade, status: t.disease?.status, at: t.testedAt } : null;
    }));

    res.json({
      grades7d: grades,
      tests7d: grades.Good + grades.Average + grades.Poor,
      highRiskTests: riskTests,
      farmsAtRisk,
      pendingUsers,
      farmers,
      totalMilkToday,
      totalMilkMonth,
      totalUsers,
      totalAnimals,
      avgFat,
      avgSnf,
      qualityStatus: deriveQuality(avgFat, avgSnf),
      alertCount,
      diseaseRiskCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/dashboard/user   (logged-in farmer)
exports.userSummary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const animals = await Animal.find({ ownerId: userId });
    const totalMilkToday = await sumQuantity({ userId, collectionDate: { $gte: startOfToday() } });
    const totalMilkMonth = await sumQuantity({ userId, collectionDate: { $gte: startOfMonth() } });
    const { avgFat, avgSnf } = await avgFatSnf({ userId });
    const alerts = await Alert.find({ userId, resolved: false }).sort({ createdAt: -1 });

    res.json({
      animals,
      totalMilkToday,
      totalMilkMonth,
      avgFat,
      avgSnf,
      qualityStatus: deriveQuality(avgFat, avgSnf),
      alerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};