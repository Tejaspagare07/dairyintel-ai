const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String },
    contact: { type: String },
    email: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // which admin added it
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);