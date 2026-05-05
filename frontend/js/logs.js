import {
  apiFetch,
  debounce,
  formatDateLabel,
  getRoleCapabilities,
  requireAuth
} from "./api.js";
import { renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

const state = {
  currentUser: null,
  capabilities: null,
  logs: [],
  search: "",
  entityType: "",
  role: "",
  date: ""
};

function buildContent() {
  const page = renderShell("logs", {
    title: "Student Logs",
    subtitle: "Track attendance updates, marks changes, and task activity with a clean activity trail.",
    searchPlaceholder: "Search log titles, actors, or descriptions..."
  });

  page.innerHTML = `
    <section class="summary-grid">
      <article class="mini-card" data-animate>
        <span class="muted">Attendance Logs</span>
        <strong id="attendanceLogsCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Marks Logs</span>
        <strong id="marksLogsCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Task Logs</span>
        <strong id="taskLogsCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Login Logs</span>
        <strong id="loginLogsCount">0</strong>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Activity Timeline</h3>
          <p>Filter by category or search the latest operational events.</p>
        </div>
        <div class="inline-actions">
          <select id="entityTypeFilter">
            <option value="">All Activity</option>
            <option value="login">Login Activity</option>
            <option value="attendance">Attendance</option>
            <option value="marks">Marks</option>
            <option value="tasks">Tasks</option>
            <option value="students">Student Profiles</option>
            <option value="profile">Profile Updates</option>
          </select>
          <select id="roleFilter">
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
          </select>
          <input id="dateFilter" type="date" />
        </div>
      </div>
      <div class="list-grid" id="logsTimeline"></div>
    </section>
  `;
}

function renderLogs() {
  const filteredLogs = state.logs.filter((log) => {
    const keyword = state.search.toLowerCase();
    const matchesSearch =
      !keyword ||
      String(log.title || "").toLowerCase().includes(keyword) ||
      String(log.action || "").toLowerCase().includes(keyword) ||
      String(log.description || "").toLowerCase().includes(keyword) ||
      String(log.actorName || "").toLowerCase().includes(keyword) ||
      String(log.createdAt || "").slice(0, 10).includes(keyword);
    const matchesType = !state.entityType || log.entityType === state.entityType;
    const matchesRole = !state.role || log.actorRole === state.role;
    const matchesDate = !state.date || String(log.createdAt || "").slice(0, 10) === state.date;
    return matchesSearch && matchesType && matchesRole && matchesDate;
  });

  document.getElementById("attendanceLogsCount").textContent = state.logs.filter((log) => log.entityType === "attendance").length;
  document.getElementById("marksLogsCount").textContent = state.logs.filter((log) => log.entityType === "marks").length;
  document.getElementById("taskLogsCount").textContent = state.logs.filter((log) => log.entityType === "tasks").length;
  document.getElementById("loginLogsCount").textContent = state.logs.filter((log) => log.entityType === "login").length;

  document.getElementById("logsTimeline").innerHTML = filteredLogs.length
    ? filteredLogs.map(
        (log) => `
          <article class="timeline-card">
            <div class="timeline-dot ${log.entityType}"></div>
            <div class="timeline-body">
              <div class="task-card-header">
                <div>
                  <h4>${log.title}</h4>
                  <p class="muted">${log.actorName} • ${log.actorRole}</p>
                </div>
                <span class="badge ${
                  log.entityType === "attendance"
                    ? "success"
                    : log.entityType === "marks"
                      ? "primary"
                      : log.entityType === "login"
                        ? "neutral"
                        : "warning"
                }">${formatDateLabel(log.createdAt)}</span>
              </div>
              <p class="muted">${log.description}</p>
            </div>
          </article>
        `
      ).join("")
    : renderEmptyState("No activity found", "Try a different filter or create new updates to populate the log.");
}

function bindEvents() {
  document.getElementById("entityTypeFilter")?.addEventListener("change", (event) => {
    state.entityType = event.target.value;
    renderLogs();
  });
  document.getElementById("roleFilter")?.addEventListener("change", (event) => {
    state.role = event.target.value;
    renderLogs();
  });
  document.getElementById("dateFilter")?.addEventListener("change", (event) => {
    state.date = event.target.value;
    renderLogs();
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      renderLogs();
    })
  );
}

async function initLogs() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);
  buildContent();
  bindEvents();

  state.logs = await apiFetch(
    state.capabilities.isStudent && state.capabilities.studentId
      ? `/logs?studentId=${state.capabilities.studentId}`
      : "/logs"
  );

  renderLogs();
}

initLogs();
