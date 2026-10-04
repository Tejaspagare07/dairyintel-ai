const mongoose = require("mongoose");

const diseasePredictionSchema = new mongoose.Schema(
  {
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true },
    milkRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "MilkRecord" },

    riskLevel: { type: String, enum: ["Low", "Medium", "High"], required: true },
    status: { type: String, enum: ["Healthy", "High Risk"] },
    diseases: [{ type: String }],       // e.g. ["Mastitis", "Ketosis"]
    explanation: [{ type: String }],    // human-readable reasons
    source: { type: String, enum: ["sample", "history"], default: "sample" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DiseasePrediction", diseasePredictionSchema);