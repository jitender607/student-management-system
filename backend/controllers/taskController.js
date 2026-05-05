const { createId, readDb, writeDb } = require("../models/dataStore");
const { addActivityLog, getActorFromRequest } = require("../models/activityLogger");

async function getTasks(req, res) {
  const db = await readDb();
  const tasks = db.tasks.sort((first, second) => Number(first.completed) - Number(second.completed));
  return res.json(tasks);
}

async function createTask(req, res) {
  const { title, dueDate = "", priority = "Medium" } = req.body;

  if (!title) {
    return res.status(400).json({ message: "Task title is required." });
  }

  const db = await readDb();
  const actor = getActorFromRequest(req, db);
  const newTask = {
    id: createId("task"),
    title,
    dueDate,
    priority,
    completed: false
  };

  db.tasks.unshift(newTask);
  addActivityLog(db, {
    action: "Task Activity",
    entityType: "tasks",
    entityId: newTask.id,
    title: "Task created",
    description: `${title} was created with ${priority} priority.`,
    actor,
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.status(201).json({
    message: "Task added successfully.",
    task: newTask
  });
}

async function updateTask(req, res) {
  const db = await readDb();
  const taskIndex = db.tasks.findIndex((entry) => entry.id === req.params.id);
  const actor = getActorFromRequest(req, db);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "Task not found." });
  }

  db.tasks[taskIndex] = {
    ...db.tasks[taskIndex],
    ...req.body
  };

  addActivityLog(db, {
    action: "Task Activity",
    entityType: "tasks",
    entityId: db.tasks[taskIndex].id,
    title: req.body.completed ? "Task completed" : "Task updated",
    description: `${db.tasks[taskIndex].title} was ${req.body.completed ? "marked complete" : "updated"}.`,
    actor,
    relatedUserId: actor.id
  });

  await writeDb(db);

  return res.json({
    message: "Task updated successfully.",
    task: db.tasks[taskIndex]
  });
}

async function deleteTask(req, res) {
  const db = await readDb();
  const taskIndex = db.tasks.findIndex((entry) => entry.id === req.params.id);
  const actor = getActorFromRequest(req, db);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "Task not found." });
  }

  const [task] = db.tasks.splice(taskIndex, 1);
  addActivityLog(db, {
    action: "Task Activity",
    entityType: "tasks",
    entityId: task.id,
    title: "Task deleted",
    description: `${task.title} was removed from the board.`,
    actor,
    relatedUserId: actor.id
  });
  await writeDb(db);

  return res.json({ message: "Task deleted successfully." });
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};
