function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (value === "admin" || value === "administrator") {
    return "Admin";
  }

  if (value === "teacher" || value === "faculty") {
    return "Teacher";
  }

  if (value === "student") {
    return "Student";
  }

  return "Teacher";
}

function getAssignedStudentIds(user, students = []) {
  const role = normalizeRole(user?.role);

  if (role === "Admin") {
    return students.map((student) => student.id);
  }

  if (role === "Student") {
    return user?.studentId ? [user.studentId] : [];
  }

  const assignedStudentIds = Array.isArray(user?.assignedStudentIds)
    ? user.assignedStudentIds
    : [];
  const assignedClassNames = Array.isArray(user?.assignedClassNames)
    ? user.assignedClassNames.map((className) => String(className).toLowerCase())
    : [];

  return students
    .filter(
      (student) =>
        assignedStudentIds.includes(student.id) ||
        assignedClassNames.includes(String(student.className).toLowerCase())
    )
    .map((student) => student.id);
}

function canAccessStudent(user, studentId, students = []) {
  return getAssignedStudentIds(user, students).includes(studentId);
}

function filterStudentsByRole(students = [], user) {
  const allowedStudentIds = getAssignedStudentIds(user, students);
  return students.filter((student) => allowedStudentIds.includes(student.id));
}

function filterStudentRecordsByRole(records = [], user, students = [], key = "studentId") {
  const allowedStudentIds = getAssignedStudentIds(user, students);
  return records.filter((record) => allowedStudentIds.includes(record[key]));
}

module.exports = {
  canAccessStudent,
  filterStudentRecordsByRole,
  filterStudentsByRole,
  getAssignedStudentIds,
  normalizeRole
};
