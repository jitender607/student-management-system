const express = require("express");
const {
  getMarks,
  addMark,
  updateMark,
  deleteMark,
  getMarksSummary
} = require("../controllers/marksController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);
router.get("/", getMarks);
router.post("/", addMark);
router.put("/:id", updateMark);
router.delete("/:id", deleteMark);
router.get("/summary/:studentId", getMarksSummary);

module.exports = router;
