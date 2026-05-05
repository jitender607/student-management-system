const { createId, readDb, writeDb } = require("../models/dataStore");
const { addActivityLog, getActorFromRequest } = require("../models/activityLogger");
const { canAccessStudent, filterStudentRecordsByRole, normalizeRole } = require("../models/roleUtils");

async function getAttendance(req, res) {
  const { date, studentId } = req.query;
  const db = await readDb();

  const records = filterStudentRecordsByRole(db.attendance, req.currentUser, db.students).filter(
    (record) => {
      const dateMatches = !date || record.date === date;
      const studentMatches = !studentId || record.studentId === studentId;
      return dateMatches && studentMatches;
    }
  );

  return res.json(records);
}

async function saveAttendance(req, res) {
  const { date, records } = req.body;

  if (!date || !Array.isArray(records)) {
    return res.status(400).json({ message: "Date and attendance records are required." });
  }

  const db = await readDb();
  const role = normalizeRole(req.currentUser?.role);

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can mark attendance." });
  }

  const actor = getActorFromRequest(req, db);
  const updates = [];

  records.forEach((entry) => {
    if (!entry.studentId || !entry.status) {
      return;
    }

    const student = db.students.find((record) => record.id === entry.studentId);

    if (!student) {
      return;
    }

    if (!canAccessStudent(req.currentUser, student.id, db.students)) {
      return;
    }

    const recordIndex = db.attendance.findIndex(
      (record) => record.date === date && record.studentId === entry.studentId
    );

    if (recordIndex === -1) {
      db.attendance.push({
        id: createId("attendance"),
        studentId: entry.studentId,
        date,
        status: entry.status
      });
      updates.push({ student, status: entry.status });
      return;
    }

    if (db.attendance[recordIndex].status !== entry.status) {
      updates.push({ student, status: entry.status });
    }

    db.attendance[recordIndex] = {
      ...db.attendance[recordIndex],
      status: entry.status
    };
  });

  updates.forEach(({ student, status }) => {
    addActivityLog(db, {
      action: "Attendance Updated",
      entityType: "attendance",
      entityId: student.id,
      title: `${student.name} marked ${status}`,
      description: `${student.name} was marked ${status} for ${date}.`,
      actor,
      relatedStudentId: student.id,
      relatedUserId: actor.id
    });
  });

  await writeDb(db);

  return res.json({
    message: "Attendance saved successfully.",
    updated: updates.length
  });
}

async function getAttendanceSummary(req, res) {
  const db = await readDb();
  const student = db.students.find((entry) => entry.id === req.params.studentId);

  if (!student) {
    return res.status(404).json({ message: "Student not found." });
  }

  const records = db.attendance.filter((entry) => entry.studentId === req.params.studentId);
  if (!canAccessStudent(req.currentUser, student.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to this attendance summary." });
  }

  const totalDays = records.length;
  const present = records.filter((entry) => entry.status === "present").length;
  const absent = totalDays - present;
  const percentage = totalDays ? Number(((present / totalDays) * 100).toFixed(2)) : 0;

  return res.json({
    studentId: student.id,
    totalDays,
    present,
    absent,
    percentage
  });
}

module.exports = {
  getAttendance,
  saveAttendance,
  getAttendanceSummary
};
