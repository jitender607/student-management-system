const express = require("express");
const {
  getAttendance,
  saveAttendance,
  getAttendanceSummary
} = require("../controllers/attendanceController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getAttendance);
router.post("/", saveAttendance);
router.get("/summary/:studentId", getAttendanceSummary);

module.exports = router;
