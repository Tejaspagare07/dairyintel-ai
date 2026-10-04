const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createSample, listSamples } = require("../controllers/sampleController");

router.post("/", auth, createSample);
router.get("/:animalId", auth, listSamples);

module.exports = router;