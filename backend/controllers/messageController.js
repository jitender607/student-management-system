const { createId, readDb, writeDb } = require("../models/dataStore");
const { getActorFromRequest } = require("../models/activityLogger");
const { normalizeRole } = require("../models/roleUtils");

function canMessageRole(senderRole, recipientRole) {
  if (senderRole === "Admin") {
    return true;
  }

  if (senderRole === "Teacher") {
    return recipientRole === "Admin" || recipientRole === "Teacher" || recipientRole === "Student";
  }

  return recipientRole === "Admin" || recipientRole === "Teacher";
}

async function getMessages(req, res) {
  const userId = req.currentUser?.id;
  const db = await readDb();

  if (normalizeRole(req.currentUser?.role) === "Admin" && req.query.scope === "all") {
    return res.json(
      db.messages.sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    );
  }

  const messages = db.messages
    .filter((message) => message.senderId === userId || message.recipientId === userId)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

  return res.json(messages);
}

async function createMessage(req, res) {
  const { recipientId, subject, content } = req.body;
  const db = await readDb();
  const actor = getActorFromRequest(req, db);
  const actorRole = normalizeRole(actor.role);

  if (!recipientId || !subject || !content) {
    return res.status(400).json({ message: "Recipient, subject, and message content are required." });
  }

  if (actor.id === "system") {
    return res.status(401).json({ message: "A valid sender is required." });
  }

  if (recipientId === "__broadcast__") {
    if (actorRole !== "Admin") {
      return res.status(403).json({ message: "Only Admin can broadcast announcements." });
    }

    const recipients = db.users.filter((user) => user.id !== actor.id);
    const createdAt = new Date().toISOString();
    const messages = recipients.map((recipient) => ({
      id: createId("message"),
      senderId: actor.id,
      senderName: actor.name,
      senderRole: actorRole,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientRole: normalizeRole(recipient.role),
      subject: `Announcement: ${subject}`,
      content,
      category: "announcement",
      createdAt
    }));

    db.messages.unshift(...messages);
    await writeDb(db);

    return res.status(201).json({
      message: "Announcement broadcast successfully.",
      data: messages
    });
  }

  const recipient = db.users.find((entry) => entry.id === recipientId);

  if (!recipient) {
    return res.status(404).json({ message: "Recipient not found." });
  }

  const recipientRole = normalizeRole(recipient.role);

  if (!canMessageRole(actorRole, recipientRole)) {
    return res.status(403).json({ message: "This role is not allowed to message that recipient." });
  }

  const message = {
    id: createId("message"),
    senderId: actor.id,
    senderName: actor.name,
    senderRole: actorRole,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientRole,
    subject,
    content,
    category: "direct",
    createdAt: new Date().toISOString()
  };

  db.messages.unshift(message);
  await writeDb(db);

  return res.status(201).json({
    message: "Message sent successfully.",
    data: message
  });
}

module.exports = {
  getMessages,
  createMessage
};
