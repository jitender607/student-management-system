const { createId, readDb, writeDb } = require("../models/dataStore");
const { addActivityLog, getActorFromRequest } = require("../models/activityLogger");
const { canAccessStudent, filterStudentRecordsByRole, normalizeRole } = require("../models/roleUtils");

function getRemark(average) {
  if (average >= 80) {
    return "Excellent";
  }

  if (average >= 60) {
    return "Good";
  }

  return "Needs Improvement";
}

function getGrade(average) {
  if (average >= 90) {
    return "A+";
  }

  if (average >= 80) {
    return "A";
  }

  if (average >= 70) {
    return "B";
  }

  if (average >= 60) {
    return "C";
  }

  if (average >= 50) {
    return "D";
  }

  return "Needs Support";
}

async function getMarks(req, res) {
  const { studentId, subject } = req.query;
  const db = await readDb();

  const marks = filterStudentRecordsByRole(db.marks, req.currentUser, db.students).filter(
    (record) => {
      const studentMatches = !studentId || record.studentId === studentId;
      const subjectMatches = !subject || record.subject === subject;
      return studentMatches && subjectMatches;
    }
  );

  return res.json(marks);
}

async function addMark(req, res) {
  const { studentId, subject, score, examType = "Assessment" } = req.body;

  if (!studentId || !subject || score === undefined) {
    return res.status(400).json({ message: "Student, subject, and score are required." });
  }

  const numericScore = Number(score);

  if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
    return res.status(400).json({ message: "Score must be between 0 and 100." });
  }

  const db = await readDb();
  const role = normalizeRole(req.currentUser?.role);

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can add marks." });
  }

  const student = db.students.find((entry) => entry.id === studentId);
  const actor = getActorFromRequest(req, db);

  if (!student) {
    return res.status(404).json({ message: "Student not found." });
  }

  if (!canAccessStudent(req.currentUser, student.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to add marks for this student." });
  }

  const newMark = {
    id: createId("mark"),
    studentId,
    subject,
    score: numericScore,
    examType
  };

  db.marks.push(newMark);
  addActivityLog(db, {
    action: "Marks Updated",
    entityType: "marks",
    entityId: newMark.id,
    title: `${student.name} scored ${numericScore} in ${subject}`,
    description: `${examType} marks recorded for ${student.name} in ${subject}.`,
    actor,
    relatedStudentId: student.id,
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.status(201).json({
    message: "Marks added successfully.",
    mark: newMark
  });
}

async function updateMark(req, res) {
  const db = await readDb();
  const markIndex = db.marks.findIndex((entry) => entry.id === req.params.id);
  const actor = getActorFromRequest(req, db);
  const role = normalizeRole(req.currentUser?.role);

  if (markIndex === -1) {
    return res.status(404).json({ message: "Mark record not found." });
  }

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can update marks." });
  }

  if (!canAccessStudent(req.currentUser, db.marks[markIndex].studentId, db.students)) {
    return res.status(403).json({ message: "You do not have access to update this mark." });
  }

  const score = Number(req.body.score ?? db.marks[markIndex].score);

  if (Number.isNaN(score) || score < 0 || score > 100) {
    return res.status(400).json({ message: "Score must be between 0 and 100." });
  }

  const updatedMark = {
    ...db.marks[markIndex],
    ...req.body,
    score
  };
  db.marks[markIndex] = updatedMark;

  const student = db.students.find((entry) => entry.id === updatedMark.studentId);
  if (student) {
    addActivityLog(db, {
      action: "Marks Updated",
      entityType: "marks",
      entityId: updatedMark.id,
      title: `${student.name} marks adjusted`,
      description: `${updatedMark.subject} score updated to ${updatedMark.score}.`,
      actor,
      relatedStudentId: student.id,
      relatedUserId: actor.id
    });
  }

  await writeDb(db);

  return res.json({
    message: "Marks updated successfully.",
    mark: db.marks[markIndex]
  });
}

async function deleteMark(req, res) {
  const db = await readDb();
  const markIndex = db.marks.findIndex((entry) => entry.id === req.params.id);
  const actor = getActorFromRequest(req, db);
  const role = normalizeRole(req.currentUser?.role);

  if (markIndex === -1) {
    return res.status(404).json({ message: "Mark record not found." });
  }

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can delete marks." });
  }

  if (!canAccessStudent(req.currentUser, db.marks[markIndex].studentId, db.students)) {
    return res.status(403).json({ message: "You do not have access to delete this mark." });
  }

  const [deletedMark] = db.marks.splice(markIndex, 1);
  const student = db.students.find((entry) => entry.id === deletedMark.studentId);

  if (student) {
    addActivityLog(db, {
      action: "Marks Updated",
      entityType: "marks",
      entityId: deletedMark.id,
      title: `${student.name} marks record removed`,
      description: `${deletedMark.subject} marks entry was deleted.`,
      actor,
      relatedStudentId: student.id,
      relatedUserId: actor.id
    });
  }

  await writeDb(db);

  return res.json({ message: "Mark deleted successfully." });
}

async function getMarksSummary(req, res) {
  const db = await readDb();
  const student = db.students.find((entry) => entry.id === req.params.studentId);

  if (!student) {
    return res.status(404).json({ message: "Student not found." });
  }

  if (!canAccessStudent(req.currentUser, student.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to this marks summary." });
  }

  const records = db.marks.filter((entry) => entry.studentId === req.params.studentId);
  const total = records.reduce((sum, entry) => sum + Number(entry.score), 0);
  const average = records.length ? Number((total / records.length).toFixed(2)) : 0;

  return res.json({
    studentId: student.id,
    subjects: records.map((record) => ({
      subject: record.subject,
      score: record.score,
      examType: record.examType
    })),
    total,
    average,
    averagePercentage: average,
    grade: getGrade(average),
    remark: getRemark(average)
  });
}

module.exports = {
  getMarks,
  addMark,
  updateMark,
  deleteMark,
  getMarksSummary
};
