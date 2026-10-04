const mongoose = require("mongoose");

const animalSchema = new mongoose.Schema(
  {
    animalId: { type: String, required: true, unique: true }, // e.g. "COW-001"
    name: { type: String },
    breed: { type: String },
    age: { type: Number }, // in years
    weight: { type: Number }, // in kg
    location: { type: String },
    feedType: { type: String }, // optional
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },     // the farmer
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Animal", animalSchema);