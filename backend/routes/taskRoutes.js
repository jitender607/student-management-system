const express = require("express");
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask
} = require("../controllers/taskController");
const { requireAuth, requireRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth, requireRoles("Admin", "Teacher"));
router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
