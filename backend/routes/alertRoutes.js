const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const { listAlerts, resolveAlert, scanAlerts } = require("../controllers/alertController");

router.get("/", auth, listAlerts);
router.patch("/:id/resolve", auth, resolveAlert);
router.post("/scan", auth, adminOnly, scanAlerts);

module.exports = router;