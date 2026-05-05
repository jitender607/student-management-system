const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { defaultData } = require("./seedData");
const { normalizeRole } = require("./roleUtils");

const dbPath = path.join(__dirname, "db.json");

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultData));
}

function normalizeDb(data) {
  const fallback = cloneDefaultData();
  const existingUsers = Array.isArray(data?.users) ? data.users : [];
  const mergedUsers = [...existingUsers];

  fallback.users.forEach((fallbackUser) => {
    const exists = mergedUsers.some(
      (user) =>
        user.id === fallbackUser.id ||
        String(user.email || "").toLowerCase() === fallbackUser.email.toLowerCase()
    );

    if (!exists) {
      mergedUsers.push(fallbackUser);
    }
  });

  function findFallbackUser(user) {
    return fallback.users.find(
      (fallbackUser) =>
        fallbackUser.id === user.id ||
        String(user.email || "").toLowerCase() === fallbackUser.email.toLowerCase()
    );
  }

  function normalizeUser(user) {
    const fallbackUser = findFallbackUser(user) || {};
    const role = normalizeRole(user.role || fallbackUser.role);

    return {
      ...fallbackUser,
      ...user,
      role,
      theme: user.theme || fallbackUser.theme || "light",
      studentId: user.studentId ?? fallbackUser.studentId ?? null,
      subjects: Array.isArray(user.subjects)
        ? user.subjects
        : Array.isArray(fallbackUser.subjects)
          ? fallbackUser.subjects
          : [],
      assignedClassNames: Array.isArray(user.assignedClassNames)
        ? user.assignedClassNames
        : Array.isArray(fallbackUser.assignedClassNames)
          ? fallbackUser.assignedClassNames
          : role === "Teacher"
            ? ["12-A"]
            : [],
      assignedStudentIds: Array.isArray(user.assignedStudentIds)
        ? user.assignedStudentIds
        : Array.isArray(fallbackUser.assignedStudentIds)
          ? fallbackUser.assignedStudentIds
          : []
    };
  }

  return {
    users: mergedUsers.map((user) => normalizeUser(user)),
    students: Array.isArray(data?.students) ? data.students : fallback.students,
    attendance: Array.isArray(data?.attendance) ? data.attendance : fallback.attendance,
    marks: Array.isArray(data?.marks) ? data.marks : fallback.marks,
    tasks: Array.isArray(data?.tasks) ? data.tasks : fallback.tasks,
    logs: Array.isArray(data?.logs) ? data.logs : fallback.logs,
    messages: Array.isArray(data?.messages) ? data.messages : fallback.messages
  };
}

async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

async function ensureDb() {
  try {
    await fs.access(dbPath);
  } catch (error) {
    await writeDb(cloneDefaultData());
  }
}

async function readDb() {
  await ensureDb();

  const raw = await fs.readFile(dbPath, "utf8");

  if (!raw.trim()) {
    const fallback = cloneDefaultData();
    await writeDb(fallback);
    return fallback;
  }

  const parsed = JSON.parse(raw);
  const normalized = normalizeDb(parsed);

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeDb(normalized);
  }

  return normalized;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

module.exports = {
  ensureDb,
  readDb,
  writeDb,
  createId
};
