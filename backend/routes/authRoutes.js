const express = require("express");
const {
  signup,
  login,
  getProfile,
  updateProfile,
  listUsers
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/users", requireAuth, listUsers);
router.get("/profile/:userId", requireAuth, getProfile);
router.put("/profile/:userId", requireAuth, updateProfile);

module.exports = router;
