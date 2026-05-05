const express = require("express");
const path = require("path");
const { ensureDb } = require("./models/dataStore");

const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const markRoutes = require("./routes/markRoutes");
const taskRoutes = require("./routes/taskRoutes");
const logRoutes = require("./routes/logRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const pagesDir = path.join(__dirname, "../frontend/pages");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/frontend", express.static(path.join(__dirname, "../frontend")));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/marks", markRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/messages", messageRoutes);

const pages = {
  "/": "overview.html",
  "/overview": "overview.html",
  "/login": "login.html",
  "/signup": "signup.html",
  "/dashboard": "dashboard.html",
  "/students": "students.html",
  "/attendance": "attendance.html",
  "/performance": "performance.html",
  "/tasks": "tasks.html",
  "/logs": "logs.html",
  "/messages": "messages.html",
  "/profile": "profile.html"
};

Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(pagesDir, file));
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "Resource not found." });
});

ensureDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SSMS Pro is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Unable to start SSMS Pro:", error);
    process.exit(1);
  });
