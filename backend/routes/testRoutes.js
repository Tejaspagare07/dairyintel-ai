const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createTest, listTests, getTest, stats } = require("../controllers/testController");

router.use(auth);
router.post("/", createTest);
router.get("/stats", stats);
router.get("/", listTests);
router.get("/:id", getTest);

module.exports = router;
