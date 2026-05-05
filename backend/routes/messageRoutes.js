const express = require("express");
const {
  getMessages,
  createMessage
} = require("../controllers/messageController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getMessages);
router.post("/", createMessage);

module.exports = router;
