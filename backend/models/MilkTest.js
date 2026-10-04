const mongoose = require("mongoose");

// One analyzer sample run through the ML service: inputs + quality grade + disease risk.
const reasonSchema = new mongoose.Schema({ level: String, text: String }, { _id: false });

const milkTestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" },
    testNo: { type: String },
    shift: { type: String, enum: ["Morning", "Evening"], default: "Morning" },
    species: { type: String, enum: ["cow", "buffalo", "mixed"], default: "cow" },

    // analyzer readings (all optional except what the user enters)
    fat: Number, snf: Number, clr: Number, protein: Number, lactose: Number,
    addedWater: Number, temp: Number,
    // optional lab readings
    ec: Number, scc: Number,

    quality: {
      grade: { type: String, enum: ["Good", "Average", "Poor"] },
      score: Number,
      standard: String,
      reasons: [reasonSchema],
    },
    disease: {
      status: { type: String, enum: ["Healthy", "High Risk"] },
      riskLevel: { type: String, enum: ["Low", "Medium", "High"] },
      condition: String,
      probabilities: { Mastitis: Number, Ketosis: Number, anyRisk: Number },
      labInputsUsed: [String],
      reasons: [reasonSchema],
      advice: String,
    },
    modelVersion: String,
    testedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

milkTestSchema.index({ userId: 1, testedAt: -1 });
module.exports = mongoose.model("MilkTest", milkTestSchema);
