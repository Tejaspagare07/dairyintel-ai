const mongoose = require("mongoose");

const qualityResultSchema = new mongoose.Schema(
  {
    milkRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "MilkRecord", required: true },
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" },
    grade: { type: String, enum: ["Good", "Average", "Poor"], required: true },
    score: { type: Number }, // 0-100, optional numeric score
    reasons: [{ type: String }], // e.g. ["Low fat", "High temperature"]
  },
  { timestamps: true }
);

module.exports = mongoose.model("QualityResult", qualityResultSchema);