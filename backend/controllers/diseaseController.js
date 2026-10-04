const axios = require("axios");
const Animal = require("../models/Animal");
const AnimalSample = require("../models/AnimalSample");
const DiseasePrediction = require("../models/DiseasePrediction");
const Alert = require("../models/Alert");

const ML = process.env.ML_SERVICE_URL || "http://localhost:8000";

// POST /api/predict/disease  → single milk sample
exports.predictDisease = async (req, res) => {
  try {
    const { fat, protein, lactose, ec, scc, animalId, milkRecordId } = req.body;

    const { data } = await axios.post(`${ML}/predict/disease`, { fat, protein, lactose, ec, scc });

    let saved = false;
    if (animalId) {
      await DiseasePrediction.create({
        animalId, milkRecordId,
        riskLevel: data.riskLevel, status: data.status,
        diseases: data.diseases, explanation: data.explanation, source: "sample",
      });
      saved = true;

      if (data.riskLevel === "High") {
        await Alert.create({
          type: "disease_risk", severity: "high",
          message: `Disease risk: ${data.diseases.join(", ") || "abnormal sample"} — vet check advised.`,
          animalId, userId: req.user.id,
        });
      }
    }

    res.json({ ...data, saved });
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ message: "ML service not reachable. Is FastAPI running on port 8000?" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/predict/history  → { animalId }  → reads AnimalSample history
exports.predictHistory = async (req, res) => {
  try {
    const { animalId } = req.body;
    if (!animalId) return res.status(400).json({ message: "animalId is required" });

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    if (req.user.role !== "admin" && String(animal.ownerId) !== req.user.id) {
      return res.status(403).json({ message: "This animal is not yours" });
    }

    const records = await AnimalSample.find({ animalId }).sort({ sampleDate: 1 }); // oldest → newest

    if (records.length < 4) {
      return res.json({
        riskLevel: "Low",
        diseases: [],
        explanation: ["Not enough health samples logged for this animal yet (need at least 4)."],
        days: records.length,
      });
    }

    const payload = records.map((r) => ({
      date: r.sampleDate,
      quantity: r.quantity, fat: r.fat, protein: r.protein,
      lactose: r.lactose, ec: r.ec, scc: r.scc,
    }));

    const { data } = await axios.post(`${ML}/predict/history`, { records: payload });

    await DiseasePrediction.create({
      animalId, riskLevel: data.riskLevel,
      diseases: data.diseases, explanation: data.explanation, source: "history",
    });

    if (data.riskLevel === "High") {
      await Alert.create({
        type: "disease_risk", severity: "high",
        message: `AI alert — ${animal.animalId}: ${data.explanation[0] || "abnormal trend"}`,
        animalId, userId: animal.ownerId,
      });
    }

    res.json({ ...data, animal: { animalId: animal.animalId, name: animal.name }, days: records.length });
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({ message: "ML service not reachable. Is FastAPI running on port 8000?" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};