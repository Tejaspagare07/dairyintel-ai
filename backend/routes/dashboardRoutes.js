const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const { adminSummary, userSummary } = require("../controllers/dashboardController");

router.get("/admin", auth, adminOnly, adminSummary); // must be logged in AND admin
router.get("/user", auth, userSummary);              // any logged-in user

module.exports = router;