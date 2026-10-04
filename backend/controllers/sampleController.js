const AnimalSample = require("../models/AnimalSample");
const Animal = require("../models/Animal");

// POST /api/samples  → log a health check for one specific animal
exports.createSample = async (req, res) => {
  try {
    const { animalId, quantity, fat, protein, lactose, ec, scc, temperature } = req.body;
    if (!animalId) return res.status(400).json({ message: "Animal is required" });

    const animal = await Animal.findById(animalId);
    if (!animal) return res.status(404).json({ message: "Animal not found" });
    if (req.user.role !== "admin" && String(animal.ownerId) !== req.user.id) {
      return res.status(403).json({ message: "This animal is not yours" });
    }

    const sample = await AnimalSample.create({
      animalId, userId: req.user.id, quantity, fat, protein, lactose, ec, scc, temperature,
      sampleDate: new Date(),
    });
    res.status(201).json(sample);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/samples/:animalId
exports.listSamples = async (req, res) => {
  try {
    const samples = await AnimalSample.find({ animalId: req.params.animalId }).sort({ sampleDate: 1 });
    res.json(samples);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};