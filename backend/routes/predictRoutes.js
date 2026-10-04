const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { predictQuality, qualityReport } = require("../controllers/qualityController");

router.post("/quality", auth, predictQuality);
router.get("/quality/report", auth, qualityReport);

const { predictDisease, predictHistory } = require("../controllers/diseaseController");

router.post("/disease", auth, predictDisease);
router.post("/history", auth, predictHistory);

module.exports = router;