const mongoose = require("mongoose");
const axios = require("axios");
const MilkTest = require("../models/MilkTest");
const Animal = require("../models/Animal");
const Alert = require("../models/Alert");

const ML = () => process.env.ML_SERVICE_URL || "http://localhost:8000";

// "" / null / undefined -> undefined, otherwise a finite number (else NaN -> rejected)
const num = (v) => (v === undefined || v === null || v === "" ? undefined : Number(v));

const FIELDS = ["fat", "snf", "clr", "protein", "lactose", "addedWater", "temp", "ec", "scc"];
const LIMITS = { fat: [0, 15], snf: [0, 15], clr: [0, 45], protein: [0, 10], lactose: [0, 10], addedWater: [0, 100], temp: [-5, 60], ec: [0, 30], scc: [0, 10000000] };

function mlError(res, err) {
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return res.status(503).json({ message: "ML service not reachable. Start it with: uvicorn main:app --port 8000" });
  }
  if (err.response?.status === 422) return res.status(400).json({ message: "Some readings are out of range." });
  console.error(err.message);
  return res.status(500).json({ message: "Prediction failed" });
}

// POST /api/tests  -> run ML + save
exports.createTest = async (req, res) => {
  try {
    const b = req.body || {};
    const vals = {};
    for (const f of FIELDS) {
      const v = num(b[f]);
      if (v === undefined) continue;
      if (!Number.isFinite(v) || v < LIMITS[f][0] || v > LIMITS[f][1]) {
        return res.status(400).json({ message: `${f} must be between ${LIMITS[f][0]} and ${LIMITS[f][1]}` });
      }
      vals[f] = v;
    }
    if (vals.fat === undefined && vals.snf === undefined) {
      return res.status(400).json({ message: "Enter at least fat and SNF." });
    }

    let animal;
    if (b.animalId) {
      if (!mongoose.isValidObjectId(b.animalId)) return res.status(400).json({ message: "Invalid animal" });
      animal = await Animal.findById(b.animalId);
      if (!animal) return res.status(404).json({ message: "Animal not found" });
      if (req.user.role !== "admin" && String(animal.ownerId) !== req.user.id) {
        return res.status(403).json({ message: "This animal is not yours" });
      }
    }
    const shift = b.shift === "Evening" ? "Evening" : "Morning";
    const species = ["cow", "buffalo", "mixed"].includes(b.species) ? b.species : "cow";

    const { data } = await axios.post(`${ML()}/predict/sample`, {
      fat: vals.fat, snf: vals.snf, clr: vals.clr, protein: vals.protein, lactose: vals.lactose,
      added_water: vals.addedWater, temp: vals.temp, ec: vals.ec, scc: vals.scc, shift, species,
    }, { timeout: 15000 });

    const count = await MilkTest.countDocuments({ userId: req.user.id });
    const test = await MilkTest.create({
      userId: req.user.id, animalId: animal?._id, shift, species, ...vals,
      testNo: `T${String(count + 1).padStart(3, "0")}`,
      quality: data.quality,
      disease: {
        status: data.disease.status, riskLevel: data.disease.riskLevel, condition: data.disease.condition,
        probabilities: data.disease.probabilities, labInputsUsed: data.disease.labInputsUsed,
        reasons: data.disease.reasons, advice: data.disease.advice,
      },
      modelVersion: data.model?.version,
    });

    const who = animal ? `${animal.animalId}${animal.name ? " (" + animal.name + ")" : ""}` : `Sample ${test.testNo}`;
    if (data.disease.status === "High Risk") {
      await Alert.create({
        type: "disease_risk", severity: "high", animalId: animal?._id, userId: req.user.id,
        message: `${who}: ${data.disease.condition || "health"} risk (${Math.round(data.disease.probabilities.anyRisk * 100)}%). Do a CMT test or call a vet.`,
      });
    }
    if (data.quality.grade === "Poor") {
      await Alert.create({
        type: "poor_quality", severity: "medium", animalId: animal?._id, userId: req.user.id,
        message: `${who}: Poor milk quality (score ${data.quality.score}). ${data.quality.reasons.find((r) => r.level === "bad")?.text || ""}`,
      });
    }

    res.status(201).json({ test, model: data.model });
  } catch (err) {
    return mlError(res, err);
  }
};

// GET /api/tests?limit=50
exports.listTests = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { userId: req.user.id };
    if (req.user.role === "admin" && req.query.userId && mongoose.isValidObjectId(req.query.userId)) filter.userId = req.query.userId;
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const tests = await MilkTest.find(filter).sort({ testedAt: -1 }).limit(limit)
      .populate("animalId", "animalId name").populate("userId", "name village");
    res.json(tests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/tests/:id
exports.getTest = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const t = await MilkTest.findById(req.params.id).populate("animalId", "animalId name");
    if (!t || (req.user.role !== "admin" && String(t.userId) !== req.user.id)) return res.status(404).json({ message: "Not found" });
    res.json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/tests/stats?days=14
exports.stats = async (req, res) => {
  try {
    const days = Math.min(365, Number(req.query.days) || 14);
    const since = new Date(Date.now() - days * 864e5);
    const match = { testedAt: { $gte: since } };
    if (req.user.role !== "admin") match.userId = new mongoose.Types.ObjectId(req.user.id);

    // computed in JS (works on MongoDB, Atlas, and Mongo-compatible DBs)
    const rows = await MilkTest.find(match).select("testNo fat snf addedWater testedAt shift quality.grade disease.status disease.condition")
      .sort({ testedAt: 1 }).limit(5000).lean();
    const mean = (k) => { const v = rows.map((r) => r[k]).filter((x) => typeof x === "number"); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
    const count = (fn) => rows.filter(fn).length;
    res.json({
      days,
      count: rows.length,
      avgFat: mean("fat"),
      avgSnf: mean("snf"),
      grades: { Good: count((r) => r.quality?.grade === "Good"), Average: count((r) => r.quality?.grade === "Average"), Poor: count((r) => r.quality?.grade === "Poor") },
      highRisk: count((r) => r.disease?.status === "High Risk"),
      mastitis: count((r) => r.disease?.condition === "Subclinical mastitis"),
      ketosis: count((r) => r.disease?.condition === "Subclinical ketosis"),
      watered: count((r) => (r.addedWater || 0) >= 8),
      trend: rows.slice(-60).map((t) => ({ test: t.testNo, date: t.testedAt, shift: t.shift, fat: t.fat, snf: t.snf })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
