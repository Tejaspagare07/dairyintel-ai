const mongoose = require("mongoose");

const milkRecordSchema = new mongoose.Schema(
  {
    // animalId is now OPTIONAL — bulk collection isn't tied to one animal
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },

    session: { type: String, enum: ["Morning", "Evening"], default: "Morning" }, // ← new

    quantity: { type: Number, required: true },   // total litres for this farmer this session
    fat: { type: Number },
    snf: { type: Number },
    protein: { type: Number },
    lactose: { type: Number },
    ec: { type: Number },
    scc: { type: Number },
    temperature: { type: Number },
    storageTank: { type: String },

    collectionDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MilkRecord", milkRecordSchema);