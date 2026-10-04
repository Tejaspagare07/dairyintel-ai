const mongoose = require("mongoose");
const QualityResult = require("../models/QualityResult");
const MilkRecord = require("../models/MilkRecord");
const { evaluateQuality } = require("../utils/quality");

// POST /api/predict/quality  → predict from raw inputs (optionally tied to a milk record)
exports.predictQuality = async (req, res) => {
  try {
    let { fat, snf, protein, temperature, milkRecordId } = req.body;
    let animalId;

    // if a record id is passed, fill any missing values from that record
    if (milkRecordId) {
      const rec = await MilkRecord.findById(milkRecordId);
      if (rec) {
        fat = fat ?? rec.fat; snf = snf ?? rec.snf;
        protein = protein ?? rec.protein; temperature = temperature ?? rec.temperature;
        animalId = rec.animalId;
      }
    }

    const result = evaluateQuality({ fat, snf, protein, temperature });

    // store the result only when it's linked to a real record
    if (milkRecordId) {
      await QualityResult.create({
        milkRecordId, animalId,
        grade: result.grade, score: result.score, reasons: result.reasons,
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/predict/quality/report  → Good/Average/Poor breakdown of recent records
exports.qualityReport = async (req, res) => {
  try {
    const scope = req.user.role === "admin" ? {} : { userId: new mongoose.Types.ObjectId(req.user.id) };

    const records = await MilkRecord.find(scope)
      .sort({ collectionDate: -1 })
      .limit(100)
      .populate("animalId", "animalId name");

    const counts = { Good: 0, Average: 0, Poor: 0 };
    const rows = records.map((r) => {
      const q = evaluateQuality({ fat: r.fat, snf: r.snf, protein: r.protein, temperature: r.temperature });
      counts[q.grade]++;
      return {
        id: r._id,
        animal: r.animalId?.animalId || "—",
        date: r.collectionDate,
        grade: q.grade,
        score: q.score,
      };
    });

    res.json({ counts, total: records.length, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};