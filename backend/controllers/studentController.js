const { createId, readDb, writeDb } = require("../models/dataStore");
const { addActivityLog, getActorFromRequest } = require("../models/activityLogger");
const { canAccessStudent, filterStudentsByRole, normalizeRole } = require("../models/roleUtils");

function validateStudent(payload) {
  return (
    payload.name &&
    payload.rollNo &&
    payload.className &&
    payload.email &&
    payload.phone
  );
}

async function getStudents(req, res) {
  const { search = "", className = "" } = req.query;
  const db = await readDb();
  const visibleStudents = filterStudentsByRole(db.students, req.currentUser);

  const students = visibleStudents
    .filter((student) => {
      const keyword = search.toLowerCase();
      const matchesSearch =
        !keyword ||
        student.name.toLowerCase().includes(keyword) ||
        student.rollNo.toLowerCase().includes(keyword) ||
        student.className.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword);
      const matchesClass =
        !className || student.className.toLowerCase() === className.toLowerCase();

      return matchesSearch && matchesClass;
    })
    .sort((first, second) => first.name.localeCompare(second.name));

  return res.json(students);
}

async function getStudentById(req, res) {
  const db = await readDb();
  const student = db.students.find((entry) => entry.id === req.params.id);

  if (!student) {
    return res.status(404).json({ message: "Student not found." });
  }

  if (!canAccessStudent(req.currentUser, student.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to this student record." });
  }

  return res.json(student);
}

async function createStudent(req, res) {
  if (!validateStudent(req.body)) {
    return res.status(400).json({ message: "Please fill all student fields." });
  }

  const db = await readDb();
  const role = normalizeRole(req.currentUser?.role);

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can create students." });
  }

  const duplicateRollNo = db.students.find(
    (student) => student.rollNo.toLowerCase() === req.body.rollNo.toLowerCase()
  );

  if (duplicateRollNo) {
    return res.status(409).json({ message: "Roll number already exists." });
  }

  const newStudent = {
    id: createId("student"),
    name: req.body.name,
    rollNo: req.body.rollNo,
    className: req.body.className,
    email: req.body.email,
    phone: req.body.phone
  };

  db.students.push(newStudent);
  const actor = getActorFromRequest(req, db);
  addActivityLog(db, {
    action: "Admin Action",
    entityType: "students",
    entityId: newStudent.id,
    title: `${newStudent.name} profile created`,
    description: `${newStudent.name} was added to class ${newStudent.className}.`,
    actor,
    relatedStudentId: newStudent.id,
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.status(201).json({
    message: "Student added successfully.",
    student: newStudent
  });
}

async function updateStudent(req, res) {
  const db = await readDb();
  const studentIndex = db.students.findIndex((entry) => entry.id === req.params.id);

  if (studentIndex === -1) {
    return res.status(404).json({ message: "Student not found." });
  }

  const role = normalizeRole(req.currentUser?.role);

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can update students." });
  }

  if (!canAccessStudent(req.currentUser, req.params.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to update this student." });
  }

  const nextStudent = {
    ...db.students[studentIndex],
    ...req.body
  };

  if (!validateStudent(nextStudent)) {
    return res.status(400).json({ message: "Please fill all student fields." });
  }

  const duplicateRollNo = db.students.find(
    (student) =>
      student.id !== req.params.id &&
      student.rollNo.toLowerCase() === nextStudent.rollNo.toLowerCase()
  );

  if (duplicateRollNo) {
    return res.status(409).json({ message: "Roll number already exists." });
  }

  db.students[studentIndex] = nextStudent;
  const actor = getActorFromRequest(req, db);
  addActivityLog(db, {
    action: "Profile Updated",
    entityType: "students",
    entityId: nextStudent.id,
    title: `${nextStudent.name} student profile updated`,
    description: `${nextStudent.name} profile details were updated.`,
    actor,
    relatedStudentId: nextStudent.id,
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.json({
    message: "Student updated successfully.",
    student: db.students[studentIndex]
  });
}

async function deleteStudent(req, res) {
  const db = await readDb();
  const studentIndex = db.students.findIndex((entry) => entry.id === req.params.id);

  if (studentIndex === -1) {
    return res.status(404).json({ message: "Student not found." });
  }

  const role = normalizeRole(req.currentUser?.role);

  if (role !== "Admin" && role !== "Teacher") {
    return res.status(403).json({ message: "Only Admin and Teacher roles can delete students." });
  }

  if (!canAccessStudent(req.currentUser, req.params.id, db.students)) {
    return res.status(403).json({ message: "You do not have access to delete this student." });
  }

  const [student] = db.students.splice(studentIndex, 1);
  db.attendance = db.attendance.filter((record) => record.studentId !== req.params.id);
  db.marks = db.marks.filter((record) => record.studentId !== req.params.id);

  const actor = getActorFromRequest(req, db);
  addActivityLog(db, {
    action: "Admin Action",
    entityType: "students",
    entityId: req.params.id,
    title: `${student.name} student profile deleted`,
    description: `${student.name} and related attendance and marks records were removed.`,
    actor,
    relatedStudentId: "",
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.json({ message: "Student deleted successfully." });
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
};
