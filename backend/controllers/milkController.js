const mongoose = require("mongoose");
const MilkRecord = require("../models/MilkRecord");
const QualityResult = require("../models/QualityResult");
const { evaluateQuality } = require("../utils/quality");

// date helpers
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

// POST /api/milk  → submit BULK collection for this farmer's whole herd
exports.createMilk = async (req, res) => {
  try {
    const { quantity, session, fat, snf, protein, lactose, ec, temperature, storageTank } = req.body;

    if (quantity == null || quantity === "") {
      return res.status(400).json({ message: "Milk quantity is required" });
    }

    const record = await MilkRecord.create({
      userId: req.user.id,
      session: session || "Morning",
      quantity, fat, snf, protein, lactose, ec, temperature, storageTank,
      collectionDate: new Date(),
    });

    // auto-grade this submission
    const q = evaluateQuality({ fat: record.fat, snf: record.snf, protein: record.protein, temperature: record.temperature });
    await QualityResult.create({
      milkRecordId: record._id, grade: q.grade, score: q.score, reasons: q.reasons,
    });

    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/milk?range=daily|monthly|all
exports.listMilk = async (req, res) => {
  try {
    const { range } = req.query;
    const filter = {};

    if (req.user.role !== "admin") filter.userId = new mongoose.Types.ObjectId(req.user.id);
    if (range === "daily") filter.collectionDate = { $gte: startOfToday() };
    if (range === "monthly") filter.collectionDate = { $gte: startOfMonth() };

    const records = await MilkRecord.find(filter).sort({ collectionDate: -1 }).limit(200);
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/milk/calculations
exports.calculations = async (req, res) => {
  try {
    const scope = req.user.role === "admin" ? {} : { userId: new mongoose.Types.ObjectId(req.user.id) };

    // computed in JS so it runs on MongoDB and Mongo-compatible databases alike
    const rows = await MilkRecord.find(scope).select("fat snf quantity collectionDate").lean();
    const avg = (k) => { const v = rows.map((r) => r[k]).filter((x) => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
    const sumSince = (d) => rows.filter((r) => r.collectionDate >= d).reduce((a, r) => a + (r.quantity || 0), 0);
    const all = { avgFat: avg("fat"), avgSnf: avg("snf"), totalMilk: rows.reduce((a, r) => a + (r.quantity || 0), 0), count: rows.length };
    const daily = { total: sumSince(startOfToday()) };
    const monthly = { total: sumSince(startOfMonth()) };

    res.json({
      avgFat: +((all?.avgFat) || 0).toFixed(2),
      avgSnf: +((all?.avgSnf) || 0).toFixed(2),
      totalMilk: +((all?.totalMilk) || 0).toFixed(1),
      dailyCollection: +((daily?.total) || 0).toFixed(1),
      monthlyCollection: +((monthly?.total) || 0).toFixed(1),
      recordCount: all?.count || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/milk/report?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.reportMilk = async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (req.user.role !== "admin") match.userId = new mongoose.Types.ObjectId(req.user.id);
    if (from || to) {
      match.collectionDate = {};
      if (from) match.collectionDate.$gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); match.collectionDate.$lte = t; }
    }

    const records = await MilkRecord.find(match).sort({ collectionDate: -1 }).limit(500);

    const avg = (k) => { const v = records.map((r) => r[k]).filter((x) => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
    const summary = { total: records.reduce((a, r) => a + (r.quantity || 0), 0), avgFat: avg("fat"), avgSnf: avg("snf"), count: records.length };

    res.json({
      records,
      summary: {
        total: +((summary?.total) || 0).toFixed(1),
        avgFat: +((summary?.avgFat) || 0).toFixed(2),
        avgSnf: +((summary?.avgSnf) || 0).toFixed(2),
        count: summary?.count || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};