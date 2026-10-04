const mongoose = require("mongoose");

const animalSampleSchema = new mongoose.Schema(
  {
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: "Animal", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    fat: { type: Number },
    protein: { type: Number },
    lactose: { type: Number },
    ec: { type: Number },        // electrical conductivity
    scc: { type: Number },       // somatic cell count
    quantity: { type: Number },  // that animal's own yield, if measured
    temperature: { type: Number },

    sampleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AnimalSample", animalSampleSchema);