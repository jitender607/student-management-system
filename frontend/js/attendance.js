import {
  apiFetch,
  debounce,
  filterRecordsForUser,
  filterStudentsForUser,
  getRoleCapabilities,
  requireAuth,
  showToast
} from "./api.js";
import { renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

let attendanceChart;

const state = {
  currentUser: null,
  capabilities: null,
  students: [],
  allAttendance: [],
  attendanceMap: new Map(),
  selectedDate: new Date().toISOString().split("T")[0],
  search: ""
};

function buildContent() {
  const page = renderShell("attendance", {
    title: "Attendance",
    subtitle: state.capabilities.isStudent
      ? "Review your attendance record with a clear date-based view."
      : "Mark attendance with bulk actions, live summaries, and responsive controls.",
    searchPlaceholder: "Search attendance records..."
  });

  page.innerHTML = `
    <section class="summary-grid">
      <article class="mini-card" data-animate>
        <span class="muted">Present</span>
        <strong id="presentCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Absent</span>
        <strong id="absentCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Coverage</span>
        <strong id="coverageCount">0%</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Monthly Avg</span>
        <strong id="monthlyAverage">0%</strong>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel" data-animate>
        <div class="section-head">
          <div>
            <h3>${state.capabilities.canManageAcademic ? "Daily Attendance Register" : "Attendance Register"}</h3>
            <p>${
              state.capabilities.canManageAcademic
                ? "Choose a date, mark all present when needed, then fine-tune manually."
                : "Read-only attendance visibility for your linked student record."
            }</p>
          </div>
          <div class="inline-actions">
            <input type="date" id="attendanceDate" />
            ${
              state.capabilities.canManageAcademic
                ? `
                  <button class="btn btn-secondary" id="selectAllPresentBtn" type="button">Mark All Present</button>
                  <button class="btn btn-secondary" id="selectAllAbsentBtn" type="button">Mark All Absent</button>
                  <button class="btn btn-primary" id="saveAttendanceBtn" type="button">Save Attendance</button>
                `
                : `<span class="pill neutral">View Only</span>`
            }
          </div>
        </div>
        <div class="attendance-list" id="attendanceList"></div>
      </article>

      <article class="panel chart-card" data-animate>
        <div class="panel-head">
          <div>
            <h3>Daily Attendance Chart</h3>
            <p>Visual breakdown of present and absent entries for the selected date.</p>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas id="attendanceBreakdownChart"></canvas>
        </div>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Monthly Attendance Summary</h3>
          <p>Present, absent, and attendance percentage for the selected month.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Attendance %</th>
            </tr>
          </thead>
          <tbody id="monthlyAttendanceBody"></tbody>
        </table>
      </div>
    </section>
  `;
}

function updateSummary() {
  const values = [...state.attendanceMap.values()];
  const present = values.filter((value) => value === "present").length;
  const absent = values.filter((value) => value === "absent").length;
  const coverage = state.students.length
    ? Number(((values.length / state.students.length) * 100).toFixed(0))
    : 0;

  document.getElementById("presentCount").textContent = present;
  document.getElementById("absentCount").textContent = absent;
  document.getElementById("coverageCount").textContent = `${coverage}%`;
  updateMonthlySummary();

  if (attendanceChart) {
    attendanceChart.destroy();
  }

  attendanceChart = new Chart(document.getElementById("attendanceBreakdownChart"), {
    type: "pie",
    data: {
      labels: ["Present", "Absent"],
      datasets: [
        {
          data: [present, absent],
          backgroundColor: ["#3b82f6", "#8b5cf6"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function renderAttendanceRows() {
  const container = document.getElementById("attendanceList");
  const filteredStudents = state.students.filter((student) => {
    const keyword = state.search.toLowerCase();
    return (
      !keyword ||
      student.name.toLowerCase().includes(keyword) ||
      student.rollNo.toLowerCase().includes(keyword) ||
      student.className.toLowerCase().includes(keyword)
    );
  });

  if (!filteredStudents.length) {
    container.innerHTML = renderEmptyState(
      "No attendance records found",
      state.capabilities.isStudent
        ? "This student account is not linked to a visible record yet."
        : "Try a broader search or choose another date."
    );
    return;
  }

  container.innerHTML = filteredStudents
    .map((student) => {
      const currentStatus = state.attendanceMap.get(student.id) || "absent";

      return `
        <article class="attendance-row">
          <div>
            <h4>${student.name}</h4>
            <p class="muted">${student.className} • ${student.rollNo}</p>
          </div>
          <div>
            <span class="badge ${currentStatus === "present" ? "success" : "danger"}">
              ${currentStatus === "present" ? "Present" : "Absent"}
            </span>
          </div>
          <div class="attendance-actions">
            ${
              state.capabilities.canManageAcademic
                ? `
                  <button class="status-btn ${currentStatus === "present" ? "active present" : ""}" data-id="${student.id}" data-status="present" type="button">Present</button>
                  <button class="status-btn ${currentStatus === "absent" ? "active absent" : ""}" data-id="${student.id}" data-status="absent" type="button">Absent</button>
                `
                : `<span class="pill ${currentStatus === "present" ? "primary" : "neutral"}">${currentStatus}</span>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function updateMonthlySummary() {
  const selectedMonth = state.selectedDate.slice(0, 7);
  const summaries = state.students.map((student) => {
    const records = state.allAttendance.filter(
      (entry) => entry.studentId === student.id && entry.date.startsWith(selectedMonth)
    );
    const present = records.filter((entry) => entry.status === "present").length;
    const absent = records.filter((entry) => entry.status === "absent").length;
    const percentage = records.length ? Number(((present / records.length) * 100).toFixed(1)) : 0;

    return {
      ...student,
      present,
      absent,
      percentage
    };
  });
  const averagePercentage = summaries.length
    ? Number((summaries.reduce((sum, entry) => sum + entry.percentage, 0) / summaries.length).toFixed(1))
    : 0;

  document.getElementById("monthlyAverage").textContent = `${averagePercentage}%`;
  document.getElementById("monthlyAttendanceBody").innerHTML = summaries.length
    ? summaries
        .map(
          (entry) => `
            <tr>
              <td><strong>${entry.name}</strong></td>
              <td>${entry.className}</td>
              <td>${entry.present}</td>
              <td>${entry.absent}</td>
              <td><span class="badge ${entry.percentage >= 75 ? "success" : "danger"}">${entry.percentage}%</span></td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td colspan="5">${renderEmptyState("No monthly records", "Attendance summaries will appear after records are saved.")}</td>
      </tr>
    `;
}

async function loadAttendance() {
  const [students, attendance, allAttendance] = await Promise.all([
    apiFetch("/students"),
    apiFetch(`/attendance?date=${state.selectedDate}`),
    apiFetch("/attendance")
  ]);

  state.students = filterStudentsForUser(students, state.currentUser);
  state.allAttendance = filterRecordsForUser(allAttendance, "studentId", state.currentUser);
  state.attendanceMap = new Map(
    attendance
      .filter((entry) => state.students.some((student) => student.id === entry.studentId))
      .map((entry) => [entry.studentId, entry.status])
  );

  state.students.forEach((student) => {
    if (!state.attendanceMap.has(student.id)) {
      state.attendanceMap.set(student.id, "absent");
    }
  });

  renderAttendanceRows();
  updateSummary();
}

async function saveAttendance() {
  if (!state.capabilities.canManageAcademic) {
    return;
  }

  try {
    const records = state.students.map((student) => ({
      studentId: student.id,
      status: state.attendanceMap.get(student.id) || "absent"
    }));

    await apiFetch("/attendance", {
      method: "POST",
      body: {
        date: state.selectedDate,
        records
      }
    });

    showToast("Attendance saved successfully.");
    await loadAttendance();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function markAllPresent() {
  state.students.forEach((student) => {
    state.attendanceMap.set(student.id, "present");
  });
  renderAttendanceRows();
  updateSummary();
}

function markAllAbsent() {
  state.students.forEach((student) => {
    state.attendanceMap.set(student.id, "absent");
  });
  renderAttendanceRows();
  updateSummary();
}

function bindEvents() {
  const dateInput = document.getElementById("attendanceDate");
  dateInput.value = state.selectedDate;

  dateInput.addEventListener("change", async (event) => {
    state.selectedDate = event.target.value;
    await loadAttendance();
  });

  document.getElementById("saveAttendanceBtn")?.addEventListener("click", saveAttendance);
  document.getElementById("selectAllPresentBtn")?.addEventListener("click", markAllPresent);
  document.getElementById("selectAllAbsentBtn")?.addEventListener("click", markAllAbsent);

  document.getElementById("attendanceList")?.addEventListener("click", (event) => {
    if (!state.capabilities.canManageAcademic) {
      return;
    }

    const button = event.target.closest(".status-btn");

    if (!button) {
      return;
    }

    state.attendanceMap.set(button.dataset.id, button.dataset.status);
    renderAttendanceRows();
    updateSummary();
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      renderAttendanceRows();
    })
  );
}

async function initAttendance() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);
  buildContent();
  bindEvents();
  await loadAttendance();
}

initAttendance();
