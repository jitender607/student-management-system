const { createId, readDb, writeDb } = require("../models/dataStore");
const { addActivityLog } = require("../models/activityLogger");
const { normalizeRole } = require("../models/roleUtils");

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return {
    ...safeUser,
    role: normalizeRole(safeUser.role),
    studentId: safeUser.studentId || null,
    theme: safeUser.theme || "light",
    subjects: Array.isArray(safeUser.subjects) ? safeUser.subjects : [],
    assignedClassNames: Array.isArray(safeUser.assignedClassNames) ? safeUser.assignedClassNames : [],
    assignedStudentIds: Array.isArray(safeUser.assignedStudentIds) ? safeUser.assignedStudentIds : []
  };
}

async function signup(req, res) {
  const {
    name,
    email,
    password,
    phone = "",
    role = "Teacher",
    theme = "light",
    studentId = null
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const db = await readDb();
  const existingUser = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const normalizedRole = normalizeRole(role);
  const linkedStudent = normalizedRole === "Student"
    ? db.students.find((student) => student.email.toLowerCase() === email.toLowerCase())
    : null;
  const newUser = {
    id: createId("user"),
    name,
    email,
    password,
    phone,
    role: normalizedRole,
    theme,
    studentId: studentId || linkedStudent?.id || null,
    subjects: [],
    assignedClassNames: normalizedRole === "Teacher" ? ["12-A"] : [],
    assignedStudentIds: []
  };

  db.users.push(newUser);
  await writeDb(db);

  return res.status(201).json({
    message: "Account created successfully.",
    user: sanitizeUser(newUser)
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const db = await readDb();
  const user = db.users.find(
    (entry) =>
      entry.email.toLowerCase() === email.toLowerCase() && entry.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  addActivityLog(db, {
    action: "Login Activity",
    entityType: "login",
    entityId: user.id,
    title: `${user.name} signed in`,
    description: `${normalizeRole(user.role)} login activity recorded for ${user.email}.`,
    actor: {
      id: user.id,
      name: user.name,
      role: normalizeRole(user.role)
    },
    relatedStudentId: user.studentId || "",
    relatedUserId: user.id
  });
  await writeDb(db);

  return res.json({
    message: "Login successful.",
    user: sanitizeUser(user)
  });
}

async function getProfile(req, res) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === req.params.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const currentRole = normalizeRole(req.currentUser?.role);
  const isOwnProfile = req.currentUser?.id === user.id;

  if (!isOwnProfile && currentRole !== "Admin") {
    return res.status(403).json({ message: "You can only view your own profile." });
  }

  return res.json(sanitizeUser(user));
}

async function updateProfile(req, res) {
  const { userId } = req.params;
  const { name, email, phone, role, theme, studentId } = req.body;
  const db = await readDb();
  const userIndex = db.users.findIndex((entry) => entry.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ message: "User not found." });
  }

  const emailInUse = db.users.find(
    (entry) => entry.id !== userId && entry.email.toLowerCase() === String(email || "").toLowerCase()
  );

  if (emailInUse) {
    return res.status(409).json({ message: "Email is already in use." });
  }

  const currentRole = normalizeRole(req.currentUser?.role);
  const isOwnProfile = req.currentUser?.id === userId;

  if (!isOwnProfile && currentRole !== "Admin") {
    return res.status(403).json({ message: "You can only update your own profile." });
  }

  const nextRole = currentRole === "Admin" ? normalizeRole(role || db.users[userIndex].role) : normalizeRole(db.users[userIndex].role);

  db.users[userIndex] = {
    ...db.users[userIndex],
    name: name || db.users[userIndex].name,
    email: email || db.users[userIndex].email,
    phone: phone ?? db.users[userIndex].phone,
    role: nextRole,
    theme: theme || db.users[userIndex].theme,
    studentId: currentRole === "Admin" ? studentId ?? db.users[userIndex].studentId ?? null : db.users[userIndex].studentId ?? null
  };

  addActivityLog(db, {
    action: "Profile Updated",
    entityType: "profile",
    entityId: db.users[userIndex].id,
    title: `${db.users[userIndex].name} profile updated`,
    description: `${db.users[userIndex].name} updated profile information.`,
    actor: {
      id: req.currentUser?.id || db.users[userIndex].id,
      name: req.currentUser?.name || db.users[userIndex].name,
      role: normalizeRole(req.currentUser?.role || db.users[userIndex].role)
    },
    relatedStudentId: db.users[userIndex].studentId || "",
    relatedUserId: db.users[userIndex].id
  });
  await writeDb(db);

  return res.json({
    message: "Profile updated successfully.",
    user: sanitizeUser(db.users[userIndex])
  });
}

async function listUsers(req, res) {
  const db = await readDb();
  const currentRole = normalizeRole(req.currentUser?.role);
  const users = db.users.filter((user) => {
    const role = normalizeRole(user.role);

    if (currentRole === "Admin") {
      return true;
    }

    if (currentRole === "Teacher") {
      return role === "Admin" || role === "Teacher" || role === "Student";
    }

    return role === "Admin" || role === "Teacher" || user.id === req.currentUser?.id;
  });

  return res.json(users.map((user) => sanitizeUser(user)));
}

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  listUsers
};
