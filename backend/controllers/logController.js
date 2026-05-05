const { readDb } = require("../models/dataStore");
const { getAssignedStudentIds, normalizeRole } = require("../models/roleUtils");

async function getLogs(req, res) {
  const {
    entityType = "",
    studentId = "",
    actorId = "",
    role = "",
    date = "",
    search = ""
  } = req.query;
  const db = await readDb();
  const currentRole = normalizeRole(req.currentUser?.role);
  const assignedStudentIds = getAssignedStudentIds(req.currentUser, db.students);
  const keyword = String(search).trim().toLowerCase();

  const logs = db.logs
    .filter((entry) => {
      const matchesEntityType = !entityType || entry.entityType === entityType;
      const matchesStudent = !studentId || entry.relatedStudentId === studentId;
      const matchesActor = !actorId || entry.actorId === actorId;
      const matchesRole = !role || normalizeRole(entry.actorRole) === normalizeRole(role);
      const matchesDate = !date || String(entry.createdAt || "").slice(0, 10) === date;
      const matchesSearch =
        !keyword ||
        String(entry.action || "").toLowerCase().includes(keyword) ||
        String(entry.title || "").toLowerCase().includes(keyword) ||
        String(entry.description || "").toLowerCase().includes(keyword) ||
        String(entry.actorName || "").toLowerCase().includes(keyword);
      const isVisible =
        currentRole === "Admin" ||
        (currentRole === "Teacher" &&
          (entry.actorId === req.currentUser?.id || assignedStudentIds.includes(entry.relatedStudentId))) ||
        (currentRole === "Student" &&
          (entry.relatedStudentId === req.currentUser?.studentId || entry.actorId === req.currentUser?.id));

      return matchesEntityType && matchesStudent && matchesActor && matchesRole && matchesDate && matchesSearch && isVisible;
    })
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

  return res.json(logs);
}

module.exports = {
  getLogs
};
