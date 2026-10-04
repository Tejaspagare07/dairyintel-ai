const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/adminOnly");
const { listUsers, getUser, createUser, updateUser, deleteUser, setStatus } = require("../controllers/userController");

router.use(auth, adminOnly); // applies to EVERY route below

router.get("/", listUsers);
router.post("/", createUser);
router.get("/:id", getUser);
router.put("/:id", updateUser);
router.patch("/:id/status", setStatus);
router.delete("/:id", deleteUser);

module.exports = router;