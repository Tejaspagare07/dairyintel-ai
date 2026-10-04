const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const { listCompanies, createCompany, updateCompany, deleteCompany } = require("../controllers/companyController");

router.use(auth, adminOnly);

router.get("/", listCompanies);
router.post("/", createCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);

module.exports = router;