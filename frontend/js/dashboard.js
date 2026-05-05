import {
  apiFetch,
  filterRecordsForUser,
  filterStudentsForUser,
  formatDateLabel,
  getRoleCapabilities,
  requireAuth
} from "./api.js";
import { average, getRemark, renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

let marksChart;
let attendanceChart;

function buildContent(capabilities) {
  const page = renderShell("dashboard", {
    title: "Dashboard",
    subtitle: capabilities.isStudent
      ? "Your personal academic command center with live performance, attendance, and communication."
      : "A premium overview of student operations, academic performance, and live activity.",
    searchPlaceholder: "Search analytics, activity, or messages..."
  });

  page.innerHTML = `
    <section class="hero-panel" data-animate>
      <div>
        <span class="hero-kicker">${capabilities.isStudent ? "Student View" : "Glass Dashboard"}</span>
        <h2>${
          capabilities.isStudent
            ? "Track your academic progress, attendance pattern, and teacher communication in one polished workspace."
            : "Manage students, monitor learning outcomes, and move school operations with clarity and confidence."
        }</h2>
        <p>${
          capabilities.isStudent
            ? "Your dashboard shows role-aware insights, view-only academic data, and recent communication updates."
            : "The upgraded SSMS Pro experience brings charts, logs, communication, and premium dashboard visuals together in a modern SaaS-style layout."
        }</p>
      </div>
      <div class="hero-metrics">
        <div class="metric-card">
          <span class="muted">${capabilities.isStudent ? "My attendance" : "Campus attendance"}</span>
          <strong id="campusHealth">0%</strong>
          <span class="muted">Latest attendance strength</span>
        </div>
        <div class="metric-card">
          <span class="muted">${capabilities.isStudent ? "My average" : "Performance pulse"}</span>
          <strong id="performancePulse">0</strong>
          <span class="muted">Current marks average</span>
        </div>
      </div>
    </section>

    <section class="stats-grid">
      <article class="stat-card" data-animate>
        <h3>${capabilities.isStudent ? "Visible Records" : "Total Students"}</h3>
        <div class="stat-value" id="totalStudents">0</div>
        <div class="stat-change">Smart directory scope</div>
      </article>
      <article class="stat-card" data-animate>
        <h3>Teachers</h3>
        <div class="stat-value" id="teacherCount">0</div>
        <div class="stat-change">Academic support team</div>
      </article>
      <article class="stat-card" data-animate>
        <h3>Present Today</h3>
        <div class="stat-value" id="presentToday">0</div>
        <div class="stat-change">Daily attendance pulse</div>
      </article>
      <article class="stat-card" data-animate>
        <h3>${capabilities.isStudent ? "Messages" : "Pending Tasks"}</h3>
        <div class="stat-value" id="openTasks">0</div>
        <div class="stat-change">${capabilities.isStudent ? "Direct communication threads" : "Operational workload in motion"}</div>
      </article>
      <article class="stat-card" data-animate>
        <h3>Avg Attendance</h3>
        <div class="stat-value" id="attendanceRate">0%</div>
        <div class="stat-change">Monthly participation strength</div>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel chart-card" data-animate>
        <div class="panel-head">
          <div>
            <h3 id="marksChartTitle">Marks Overview</h3>
            <p id="marksChartSubtitle">Interactive academic snapshot.</p>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas id="marksChart"></canvas>
        </div>
      </article>

      <article class="panel chart-card" data-animate>
        <div class="panel-head">
          <div>
            <h3>Monthly Attendance</h3>
            <p>Monthly attendance trend in the current role scope.</p>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas id="attendanceChart"></canvas>
        </div>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel" data-animate>
        <div class="panel-head">
          <div>
            <h3 id="insightsTitle">${capabilities.isStudent ? "Subject Breakdown" : "Top Performers"}</h3>
            <p id="insightsSubtitle">${
              capabilities.isStudent
                ? "Your subject-wise progress at a glance."
                : "Students leading the latest performance snapshot."
            }</p>
          </div>
        </div>
        <div class="${capabilities.isStudent ? "list-grid" : "student-grid"}" id="topStudents"></div>
      </article>
      <article class="panel" data-animate>
        <div class="panel-head">
          <div>
            <h3>Recent Activity</h3>
            <p>Live academic and operational activity pulled from student logs.</p>
          </div>
        </div>
        <div class="list-grid" id="activityPreview"></div>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="panel-head">
        <div>
          <h3>Communication Portal</h3>
          <p>Latest teacher and student messages in your workspace.</p>
        </div>
      </div>
      <div class="list-grid" id="messagePreview"></div>
    </section>
  `;
}

function renderDashboard(data, currentUser, capabilities) {
  const { students, attendance, marks, tasks, logs, messages, users } = data;
  const attendanceRate = attendance.length
    ? Number(
        (
          (attendance.filter((record) => record.status === "present").length / attendance.length) *
          100
        ).toFixed(1)
      )
    : 0;
  const averageMarks = average(marks.map((mark) => Number(mark.score)));
  const userTaskMetric = capabilities.isStudent ? messages.length : tasks.filter((task) => !task.completed).length;
  const today = new Date().toISOString().split("T")[0];
  const presentToday = attendance.filter((record) => record.date === today && record.status === "present").length;
  const teacherCount = users.filter((user) => getRoleCapabilities(user).isTeacher).length;

  const studentAverages = students
    .map((student) => {
      const studentMarks = marks
        .filter((mark) => mark.studentId === student.id)
        .map((mark) => Number(mark.score));
      return {
        ...student,
        averageScore: average(studentMarks)
      };
    })
    .sort((first, second) => second.averageScore - first.averageScore);

  document.getElementById("campusHealth").textContent = `${attendanceRate}%`;
  document.getElementById("performancePulse").textContent = averageMarks.toFixed(1);
  document.getElementById("totalStudents").textContent = students.length;
  document.getElementById("teacherCount").textContent = teacherCount;
  document.getElementById("presentToday").textContent = presentToday;
  document.getElementById("attendanceRate").textContent = `${attendanceRate}%`;
  document.getElementById("openTasks").textContent = userTaskMetric;

  if (capabilities.isStudent) {
    const subjectBreakdown = marks
      .map((entry) => ({
        subject: entry.subject,
        score: Number(entry.score)
      }))
      .sort((first, second) => second.score - first.score);

    document.getElementById("topStudents").innerHTML = subjectBreakdown.length
      ? subjectBreakdown
          .map(
            (entry) => `
              <article class="student-card">
                <div class="student-card-header">
                  <div>
                    <h4>${entry.subject}</h4>
                    <p class="muted">Current assessment contribution</p>
                  </div>
                  <span class="badge primary">${entry.score}</span>
                </div>
                <p class="muted">${getRemark(entry.score)} performance in ${entry.subject}.</p>
              </article>
            `
          )
          .join("")
      : renderEmptyState("No marks available", "Once marks are published, your subject breakdown will appear here.");
  } else {
    document.getElementById("topStudents").innerHTML = studentAverages.length
      ? studentAverages
          .slice(0, 4)
          .map(
            (student) => `
              <article class="student-card">
                <div class="student-card-header">
                  <div>
                    <h4>${student.name}</h4>
                    <p class="muted">${student.className} • ${student.rollNo}</p>
                  </div>
                  <span class="badge primary">${student.averageScore.toFixed(1)}</span>
                </div>
                <p class="muted">Consistent academic output with a ${getRemark(student.averageScore).toLowerCase()} trajectory.</p>
              </article>
            `
          )
          .join("")
      : renderEmptyState("No student insights", "Add marks to start surfacing top performers.");
  }

  document.getElementById("activityPreview").innerHTML = logs.length
    ? logs.slice(0, 5).map(
        (log) => `
          <article class="task-card">
            <div class="task-card-header">
              <div>
                <h4>${log.title}</h4>
                <p class="muted">${log.actorName} • ${formatDateLabel(log.createdAt)}</p>
              </div>
              <span class="badge ${
                log.entityType === "attendance"
                  ? "success"
                  : log.entityType === "marks"
                    ? "primary"
                    : "warning"
              }">${log.entityType}</span>
            </div>
            <p class="muted">${log.description}</p>
          </article>
        `
      ).join("")
    : renderEmptyState("No recent logs", "Activity will appear here as attendance, marks, and tasks are updated.");

  document.getElementById("messagePreview").innerHTML = messages.length
    ? messages.slice(0, 4).map(
        (message) => `
          <article class="task-card">
            <div class="task-card-header">
              <div>
                <h4>${message.subject}</h4>
                <p class="muted">${message.senderName} to ${message.recipientName}</p>
              </div>
              <span class="badge primary">${formatDateLabel(message.createdAt)}</span>
            </div>
            <p class="muted">${message.content}</p>
          </article>
        `
      ).join("")
    : renderEmptyState("No messages yet", "Use the communication portal to send the first message.");

  const chartLabels = capabilities.isStudent
    ? marks.map((entry) => entry.subject)
    : studentAverages.slice(0, 5).map((student) => student.name.split(" ")[0]);
  const chartValues = capabilities.isStudent
    ? marks.map((entry) => Number(entry.score))
    : studentAverages.slice(0, 5).map((student) => student.averageScore);

  document.getElementById("marksChartTitle").textContent = capabilities.isStudent
    ? "My Subject Scores"
    : "Marks Overview";
  document.getElementById("marksChartSubtitle").textContent = capabilities.isStudent
    ? "Role-aware view of your current subject performance."
    : "Top student averages in the latest assessment cycle.";

  if (marksChart) {
    marksChart.destroy();
  }

  if (attendanceChart) {
    attendanceChart.destroy();
  }

  marksChart = new Chart(document.getElementById("marksChart"), {
    type: "bar",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: capabilities.isStudent ? "My Marks" : "Average Marks",
          data: chartValues,
          borderRadius: 14,
          backgroundColor: ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c084fc"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });

  const attendanceByDate = [...new Set(attendance.map((record) => record.date))]
    .sort()
    .slice(-6)
    .map((date) => {
      const records = attendance.filter((record) => record.date === date);
      const present = records.filter((record) => record.status === "present").length;

      return {
        date,
        percentage: records.length ? Number(((present / records.length) * 100).toFixed(1)) : 0
      };
    });

  attendanceChart = new Chart(document.getElementById("attendanceChart"), {
    type: "line",
    data: {
      labels: attendanceByDate.map((entry) => formatDateLabel(entry.date)),
      datasets: [
        {
          label: "Attendance %",
          data: attendanceByDate.map((entry) => entry.percentage),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.14)",
          pointBackgroundColor: "#7c3aed",
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      plugins: {
        legend: { display: false }
      },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

async function initDashboard() {
  const currentUser = requireAuth();

  if (!currentUser) {
    return;
  }

  const capabilities = getRoleCapabilities(currentUser);
  buildContent(capabilities);

  const [studentsData, attendanceData, marksData, tasksData, logsData, messagesData, usersData] = await Promise.all([
    apiFetch("/students"),
    apiFetch("/attendance"),
    apiFetch("/marks"),
    capabilities.isStudent ? Promise.resolve([]) : apiFetch("/tasks"),
    apiFetch(capabilities.isStudent && capabilities.studentId ? `/logs?studentId=${capabilities.studentId}` : "/logs"),
    apiFetch(`/messages?userId=${currentUser.id}`),
    apiFetch("/auth/users")
  ]);

  const students = filterStudentsForUser(studentsData, currentUser);
  const attendance = filterRecordsForUser(attendanceData, "studentId", currentUser);
  const marks = filterRecordsForUser(marksData, "studentId", currentUser);
  const logs = capabilities.isStudent && capabilities.studentId
    ? logsData
    : logsData;
  const tasks = capabilities.isStudent ? [] : tasksData;

  renderDashboard(
    {
      students,
      attendance,
      marks,
      tasks,
      logs,
      messages: messagesData,
      users: usersData
    },
    currentUser,
    capabilities
  );
}

initDashboard();
