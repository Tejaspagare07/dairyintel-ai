const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createMilk, listMilk, calculations, reportMilk } = require("../controllers/milkController");

router.post("/", auth, createMilk);
router.get("/calculations", auth, calculations);
router.get("/report", auth, reportMilk);
router.get("/", auth, listMilk);

module.exports = router;