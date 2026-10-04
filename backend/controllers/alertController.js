const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const Animal = require("../models/Animal");
const MilkRecord = require("../models/MilkRecord");
const { evaluateQuality } = require("../utils/quality");

exports.listAlerts = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") filter.userId = new mongoose.Types.ObjectId(req.user.id);
    if (req.query.resolved === "true") filter.resolved = true;
    else if (req.query.resolved === "false") filter.resolved = false;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("animalId", "animalId name");
    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.scanAlerts = async (req, res) => {
  try {
    const animals = await Animal.find();
    let created = 0;

    for (const animal of animals) {
      const records = await MilkRecord.find({ animalId: animal._id }).sort({ collectionDate: 1 });
      if (!records.length) continue;
      const latest = records[records.length - 1];

      const addAlert = async (type, message, severity) => {
        const exists = await Alert.findOne({ animalId: animal._id, type, resolved: false });
        if (exists) return;
        await Alert.create({ type, message, severity, animalId: animal._id, userId: animal.ownerId });
        created++;
      };

      if (latest.scc && latest.scc > 200000) {
        await addAlert("high_scc", `${animal.animalId}: high somatic cell count (${latest.scc}).`, "high");
      }

      const q = evaluateQuality({ fat: latest.fat, snf: latest.snf, protein: latest.protein, temperature: latest.temperature });
      if (q.grade === "Poor") {
        await addAlert("poor_quality", `${animal.animalId}: poor milk quality — ${q.reasons[0]}.`, "medium");
      }

      const qty = records.map((r) => r.quantity).filter((v) => v != null);
      if (qty.length >= 4) {
        const half = Math.floor(qty.length / 2);
        const firstAvg = qty.slice(0, half).reduce((a, b) => a + b, 0) / half;
        const recent = qty.slice(-3);
        const recAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        if (firstAvg && (firstAvg - recAvg) / firstAvg >= 0.15) {
          const pct = Math.round(((firstAvg - recAvg) / firstAvg) * 100);
          await addAlert("low_production", `${animal.animalId}: milk production down ${pct}%.`, "medium");
        }
      }
    }

    res.json({ message: `Scan complete. ${created} new alert(s) created.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};