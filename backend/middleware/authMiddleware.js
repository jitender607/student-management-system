const { readDb } = require("../models/dataStore");
const { normalizeRole } = require("../models/roleUtils");

async function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"] || req.body?.userId || req.query?.userId;
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);

  if (!user) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  req.currentUser = {
    ...user,
    role: normalizeRole(user.role)
  };
  return next();
}

function requireRoles(...roles) {
  const allowedRoles = roles.map((role) => normalizeRole(role));

  return (req, res, next) => {
    const currentRole = normalizeRole(req.currentUser?.role);

    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRoles
};
