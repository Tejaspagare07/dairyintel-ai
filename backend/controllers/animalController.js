const Animal = require("../models/Animal");
const User = require("../models/User");
const AnimalSample = require("../models/AnimalSample");

// GET /api/animals
exports.listAnimals = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { ownerId: req.user.id };
    const animals = await Animal.find(filter).sort({ animalId: 1 });
    res.json(animals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/animals
exports.addAnimal = async (req, res) => {
  try {
    const { animalId, name, breed, age, weight, location, feedType } = req.body;
    if (!animalId) return res.status(400).json({ message: "Animal ID is required" });

    const exists = await Animal.findOne({ animalId });
    if (exists) return res.status(409).json({ message: "This Animal ID already exists" });

    const user = await User.findById(req.user.id);
    const animal = await Animal.create({
      animalId, name, breed,
      age: age ? Number(age) : undefined,
      weight: weight ? Number(weight) : undefined,
      location, feedType,
      ownerId: req.user.id,
      companyId: user?.companyId,
    });
    res.status(201).json(animal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/animals/:id/history  → reads AnimalSample, not MilkRecord
exports.animalHistory = async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id).populate("ownerId", "name");
    if (!animal) return res.status(404).json({ message: "Animal not found" });

    const ownerId = String(animal.ownerId?._id || animal.ownerId);
    if (req.user.role !== "admin" && ownerId !== req.user.id) {
      return res.status(403).json({ message: "This animal is not yours" });
    }

    const records = await AnimalSample.find({ animalId: animal._id }).sort({ sampleDate: 1 });

    const series = records.map((r) => ({
      date: new Date(r.sampleDate).toLocaleDateString(),
      quantity: r.quantity ?? null,
      fat: r.fat ?? null,
      protein: r.protein ?? null,
      ec: r.ec ?? null,
      scc: r.scc ?? null,
    }));

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const q = records.map((r) => r.quantity).filter((v) => v != null);
    const half = Math.floor(q.length / 2);
    const firstAvg = avg(q.slice(0, half));
    const lastAvg = avg(q.slice(half));
    let productionTrend = "stable", productionChange = 0;
    if (firstAvg && lastAvg) {
      productionChange = +(((lastAvg - firstAvg) / firstAvg) * 100).toFixed(1);
      productionTrend = productionChange <= -8 ? "down" : productionChange >= 8 ? "up" : "stable";
    }

    const ecArr = records.map((r) => r.ec).filter((v) => v != null);
    const ecHalf = Math.floor(ecArr.length / 2);
    const ecFirst = avg(ecArr.slice(0, ecHalf));
    const ecLast = avg(ecArr.slice(ecHalf));
    let healthTrend = "stable";
    if (ecFirst && ecLast) {
      healthTrend = ecLast > ecFirst * 1.12 ? "worsening" : ecLast < ecFirst * 0.9 ? "improving" : "stable";
    }

    res.json({ animal, series, productionTrend, productionChange, healthTrend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};