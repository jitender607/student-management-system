import {
  apiFetch,
  debounce,
  filterRecordsForUser,
  filterStudentsForUser,
  getRoleCapabilities,
  requireAuth,
  showToast
} from "./api.js";
import { SUBJECTS, average, confirmAction, getGrade, getRemark, renderEmptyState } from "./app.js";
import { renderShell } from "../components/layout.js";

let subjectChart;
let lineChart;

const state = {
  currentUser: null,
  capabilities: null,
  students: [],
  marks: [],
  attendance: [],
  selectedStudent: "",
  search: ""
};

function buildContent() {
  const page = renderShell("performance", {
    title: "Performance",
    subtitle: state.capabilities.isStudent
      ? "Your subject-wise marks, averages, and progress charts in a clean academic view."
      : "Capture marks, compare subject trends, and monitor learning outcomes with premium analytics.",
    searchPlaceholder: "Search subjects, exams, or student names..."
  });

  page.innerHTML = `
    ${
      state.capabilities.canManageAcademic
        ? `
          <section class="panel" data-animate>
            <div class="section-head">
              <div>
                <h3>Add Marks</h3>
                <p>Record new assessments instantly and keep charts in sync.</p>
              </div>
            </div>
            <form id="marksForm" class="form-grid">
              <div>
                <label class="input-label" for="marksStudent">Student</label>
                <select id="marksStudent" name="studentId" required></select>
              </div>
              <div>
                <label class="input-label" for="marksSubject">Subject</label>
                <select id="marksSubject" name="subject" required>
                  ${SUBJECTS.map((subject) => `<option value="${subject}">${subject}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="input-label" for="marksScore">Score</label>
                <input id="marksScore" name="score" type="number" min="0" max="100" placeholder="85" required />
              </div>
              <div>
                <label class="input-label" for="marksExamType">Exam Type</label>
                <input id="marksExamType" name="examType" placeholder="Weekly Test" required />
              </div>
              <div class="full-span inline-actions">
                <button class="btn btn-primary" type="submit">Add Marks</button>
              </div>
            </form>
          </section>
        `
        : `
          <section class="panel" data-animate>
            <div class="section-head">
              <div>
                <h3>Performance Overview</h3>
                <p>Your account has view-only access to published marks and insights.</p>
              </div>
              <span class="pill neutral">View Only</span>
            </div>
          </section>
        `
    }

    <section class="summary-grid">
      <article class="mini-card" data-animate>
        <span class="muted">Total Marks</span>
        <strong id="totalMarksCard">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Average Marks</span>
        <strong id="averageScoreCard">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Top Subject</span>
        <strong id="topSubjectCard">-</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Grade</span>
        <strong id="gradeCard">-</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Remark</span>
        <strong id="remarkCard">-</strong>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Performance Insights</h3>
          <p>Filter by student to focus on individual learning trends and subject breakdown.</p>
        </div>
        <div class="inline-actions">
          <select id="analyticsStudentFilter"></select>
        </div>
      </div>
      <div class="summary-grid" id="subjectBreakdown"></div>
      <div class="panel-grid" style="margin-top:1rem;">
        <article class="chart-surface chart-card">
          <div class="panel-head">
            <div>
              <h3>Subject Averages</h3>
              <p>Bar chart for subject-wise marks strength.</p>
            </div>
          </div>
          <div class="chart-wrap">
            <canvas id="subjectChart"></canvas>
          </div>
        </article>
        <article class="chart-surface chart-card">
          <div class="panel-head">
            <div>
              <h3>Progress Line</h3>
              <p>Line chart for the currently selected student.</p>
            </div>
          </div>
          <div class="chart-wrap">
            <canvas id="lineChart"></canvas>
          </div>
        </article>
      </div>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Academic Insights</h3>
          <p>Quickly identify top performers, weak subjects, and attendance risks.</p>
        </div>
      </div>
      <div class="insight-grid" id="performanceInsights"></div>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Marks Ledger</h3>
          <p>Review ${
            state.capabilities.canManageAcademic ? "and manage" : ""
          } subject scores and exam entries.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Score</th>
              <th>Exam</th>
              ${state.capabilities.canManageAcademic ? "<th>Action</th>" : ""}
            </tr>
          </thead>
          <tbody id="marksTableBody"></tbody>
        </table>
      </div>
    </section>
  `;
}

function populateStudentSelectors() {
  const options = state.students
    .map((student) => `<option value="${student.id}">${student.name} • ${student.className}</option>`)
    .join("");

  const marksStudent = document.getElementById("marksStudent");
  const analyticsStudentFilter = document.getElementById("analyticsStudentFilter");

  if (marksStudent) {
    marksStudent.innerHTML = options;
  }

  analyticsStudentFilter.innerHTML = `
    ${state.capabilities.canManageAcademic ? '<option value="">All Students</option>' : ""}
    ${options}
  `;

  analyticsStudentFilter.value = state.selectedStudent;
}

function renderSummaryAndBreakdown() {
  const selectedStudentId = state.selectedStudent || state.students[0]?.id || "";
  const relevantMarks = selectedStudentId
    ? state.marks.filter((mark) => mark.studentId === selectedStudentId)
    : state.marks;

  const breakdown = SUBJECTS.map((subject) => {
    const scores = relevantMarks
      .filter((mark) => mark.subject === subject)
      .map((mark) => Number(mark.score));
    return {
      subject,
      average: average(scores)
    };
  }).sort((first, second) => second.average - first.average);

  const averageScore = average(relevantMarks.map((mark) => Number(mark.score)));
  const totalMarks = relevantMarks.reduce((sum, mark) => sum + Number(mark.score || 0), 0);
  const topSubject = breakdown.find((entry) => entry.average > 0)?.subject || "-";

  document.getElementById("totalMarksCard").textContent = totalMarks;
  document.getElementById("averageScoreCard").textContent = averageScore.toFixed(1);
  document.getElementById("topSubjectCard").textContent = topSubject;
  document.getElementById("gradeCard").textContent = getGrade(averageScore);
  document.getElementById("remarkCard").textContent = getRemark(averageScore);
  document.getElementById("subjectBreakdown").innerHTML = breakdown
    .map(
      (entry) => `
        <article class="mini-card">
          <span class="muted">${entry.subject}</span>
          <strong>${entry.average.toFixed(1)}</strong>
        </article>
      `
    )
    .join("");
}

function renderInsights() {
  const studentSummaries = state.students.map((student) => {
    const studentMarks = state.marks
      .filter((mark) => mark.studentId === student.id)
      .map((mark) => Number(mark.score));
    const attendanceRecords = state.attendance.filter((record) => record.studentId === student.id);
    const present = attendanceRecords.filter((record) => record.status === "present").length;
    const attendanceRate = attendanceRecords.length
      ? Number(((present / attendanceRecords.length) * 100).toFixed(1))
      : 0;

    return {
      ...student,
      averageScore: average(studentMarks),
      attendanceRate
    };
  });

  const topPerformer = [...studentSummaries].sort((first, second) => second.averageScore - first.averageScore)[0];
  const attendanceRisk = studentSummaries.find((student) => student.attendanceRate > 0 && student.attendanceRate < 75);
  const selectedStudentId = state.selectedStudent || state.students[0]?.id || "";
  const weakSubjects = SUBJECTS.map((subject) => {
    const subjectMarks = state.marks
      .filter((mark) => (!selectedStudentId || mark.studentId === selectedStudentId) && mark.subject === subject)
      .map((mark) => Number(mark.score));

    return {
      subject,
      score: average(subjectMarks)
    };
  }).filter((entry) => entry.score > 0 && entry.score < 60);

  document.getElementById("performanceInsights").innerHTML = `
    <article class="insight-card">
      <span class="muted">Top Performer</span>
      <strong>${topPerformer?.name || "No data"}</strong>
      <p>${topPerformer ? `${topPerformer.averageScore.toFixed(1)} average marks` : "Add marks to calculate the leader."}</p>
    </article>
    <article class="insight-card">
      <span class="muted">Low Attendance Warning</span>
      <strong>${attendanceRisk?.name || "Clear"}</strong>
      <p>${attendanceRisk ? `${attendanceRisk.attendanceRate}% attendance needs attention.` : "No student is below the attendance warning threshold."}</p>
    </article>
    <article class="insight-card">
      <span class="muted">Weak Subjects</span>
      <strong>${weakSubjects.length ? weakSubjects.map((entry) => entry.subject).join(", ") : "None"}</strong>
      <p>${weakSubjects.length ? "Focus revision plans around these subjects." : "Current subject scores are above the weak-subject threshold."}</p>
    </article>
  `;
}

function renderMarksTable() {
  const container = document.getElementById("marksTableBody");
  const filteredMarks = state.marks.filter((mark) => {
    const student = state.students.find((entry) => entry.id === mark.studentId);
    const keyword = state.search.toLowerCase();
    return (
      !keyword ||
      mark.subject.toLowerCase().includes(keyword) ||
      mark.examType.toLowerCase().includes(keyword) ||
      student?.name.toLowerCase().includes(keyword)
    );
  });

  if (!filteredMarks.length) {
    container.innerHTML = `
      <tr>
        <td colspan="${state.capabilities.canManageAcademic ? 5 : 4}">
          ${renderEmptyState("No marks found", "Add a new mark or broaden your search.")}
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filteredMarks
    .map((mark) => {
      const student = state.students.find((entry) => entry.id === mark.studentId);
      return `
        <tr>
          <td>${student?.name || "Unknown"}</td>
          <td>${mark.subject}</td>
          <td><span class="badge primary">${mark.score}</span></td>
          <td>${mark.examType}</td>
          ${
            state.capabilities.canManageAcademic
              ? `
                <td>
                  <button class="btn btn-danger delete-mark" data-id="${mark.id}" type="button">Delete</button>
                </td>
              `
              : ""
          }
        </tr>
      `;
    })
    .join("");
}

function renderCharts() {
  const subjectAverages = SUBJECTS.map((subject) => {
    const scores = state.marks
      .filter((mark) => mark.subject === subject)
      .map((mark) => Number(mark.score));
    return average(scores);
  });

  const selectedStudentId = state.selectedStudent || state.students[0]?.id || "";
  const selectedStudent = state.students.find((student) => student.id === selectedStudentId);
  const studentMarks = SUBJECTS.map((subject) => {
    const scores = state.marks
      .filter((mark) => mark.studentId === selectedStudentId && mark.subject === subject)
      .map((mark) => Number(mark.score));
    return average(scores);
  });

  if (subjectChart) {
    subjectChart.destroy();
  }

  if (lineChart) {
    lineChart.destroy();
  }

  subjectChart = new Chart(document.getElementById("subjectChart"), {
    type: "bar",
    data: {
      labels: SUBJECTS,
      datasets: [
        {
          label: "Average Score",
          data: subjectAverages,
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
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  lineChart = new Chart(document.getElementById("lineChart"), {
    type: "line",
    data: {
      labels: SUBJECTS,
      datasets: [
        {
          label: selectedStudent ? `${selectedStudent.name} Score` : "Student Score",
          data: studentMarks,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(99, 102, 241, 0.18)",
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

async function loadPerformance() {
  const [students, marks, attendance] = await Promise.all([
    apiFetch("/students"),
    apiFetch("/marks"),
    apiFetch("/attendance")
  ]);
  state.students = filterStudentsForUser(students, state.currentUser);
  state.marks = filterRecordsForUser(marks, "studentId", state.currentUser);
  state.attendance = filterRecordsForUser(attendance, "studentId", state.currentUser);

  if (!state.selectedStudent && state.students.length) {
    state.selectedStudent = state.capabilities.canManageAcademic ? "" : state.students[0].id;
  }

  populateStudentSelectors();
  renderSummaryAndBreakdown();
  renderInsights();
  renderMarksTable();
  renderCharts();
}

async function handleMarksSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;

  try {
    await apiFetch("/marks", {
      method: "POST",
      body: {
        studentId: fields.studentId.value,
        subject: fields.subject.value,
        score: Number(fields.score.value),
        examType: fields.examType.value.trim()
      }
    });

    form.reset();
    showToast("Marks added successfully.");
    await loadPerformance();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteMark(id) {
  const confirmed = await confirmAction({
    title: "Delete marks entry?",
    message: "This removes the selected marks record from the academic ledger.",
    confirmLabel: "Delete Entry"
  });

  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(`/marks/${id}`, { method: "DELETE" });
    showToast("Mark deleted successfully.");
    await loadPerformance();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function bindEvents() {
  document.getElementById("marksForm")?.addEventListener("submit", handleMarksSubmit);
  document.getElementById("analyticsStudentFilter")?.addEventListener("change", (event) => {
    state.selectedStudent = event.target.value;
    renderSummaryAndBreakdown();
    renderInsights();
    renderCharts();
  });

  document.getElementById("marksTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-mark");

    if (!button) {
      return;
    }

    await deleteMark(button.dataset.id);
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      renderMarksTable();
    })
  );
}

async function initPerformance() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);
  buildContent();
  bindEvents();
  await loadPerformance();
}

initPerformance();
