const { createId } = require("./dataStore");
const { normalizeRole } = require("./roleUtils");

function getActorFromRequest(req, db) {
  const userId = req.headers["x-user-id"] || req.body?.userId || req.query?.userId;
  const user = db.users.find((entry) => entry.id === userId);

  if (!user) {
    return {
      id: "system",
      name: "System",
      role: "System"
    };
  }

  return {
    id: user.id,
    name: user.name,
    role: normalizeRole(user.role)
  };
}

function addActivityLog(
  db,
  {
    action,
    entityType,
    entityId = "",
    title,
    description,
    actor,
    relatedStudentId = "",
    relatedUserId = ""
  }
) {
  if (!Array.isArray(db.logs)) {
    db.logs = [];
  }

  db.logs.unshift({
    id: createId("log"),
    action,
    entityType,
    entityId,
    title,
    description,
    actorId: actor?.id || "system",
    actorName: actor?.name || "System",
    actorRole: actor?.role || "System",
    relatedStudentId,
    relatedUserId,
    createdAt: new Date().toISOString()
  });

  db.logs = db.logs.slice(0, 400);
}

module.exports = {
  addActivityLog,
  getActorFromRequest
};
