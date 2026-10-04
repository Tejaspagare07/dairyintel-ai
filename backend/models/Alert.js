const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["poor_quality", "disease_risk", "high_scc", "low_production"],
      required: true,
    },
    message: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", alertSchema);