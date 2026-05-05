const express = require("express");
const { getLogs } = require("../controllers/logController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getLogs);

module.exports = router;
