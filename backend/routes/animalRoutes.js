const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { listAnimals, addAnimal, animalHistory } = require("../controllers/animalController");

router.get("/", auth, listAnimals);
router.post("/", auth, addAnimal);
router.get("/:id/history", auth, animalHistory);

module.exports = router;