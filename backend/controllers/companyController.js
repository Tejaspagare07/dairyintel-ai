const Company = require("../models/Company");

// GET /api/companies
exports.listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/companies
exports.createCompany = async (req, res) => {
  try {
    const { name, location, contact, email } = req.body;
    if (!name) return res.status(400).json({ message: "Company name is required" });
    const company = await Company.create({ name, location, contact, email, createdBy: req.user.id });
    res.status(201).json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/companies/:id
exports.updateCompany = async (req, res) => {
  try {
    const { name, location, contact, email } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { name, location, contact, email },
      { new: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/companies/:id
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};