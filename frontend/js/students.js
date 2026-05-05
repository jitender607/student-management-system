import {
  apiFetch,
  debounce,
  formatDateLabel,
  getRoleCapabilities,
  requireAuth,
  showToast
} from "./api.js";
import { confirmAction, createModalController, getGrade, renderEmptyState, setButtonLoading } from "./app.js";
import { renderShell } from "../components/layout.js";

const state = {
  currentUser: null,
  capabilities: null,
  students: [],
  filteredStudents: [],
  search: "",
  className: "",
  editingId: null,
  page: 1,
  pageSize: 8
};

const modal = createModalController("#studentModal");

function buildContent() {
  const page = renderShell("students", {
    title: "Students",
    subtitle: "Manage student records with polished workflows, powerful filters, and one-click report cards.",
    searchPlaceholder: "Search by name, roll no, or class..."
  });

  page.innerHTML = `
    <section class="summary-grid">
      <article class="mini-card" data-animate>
        <span class="muted">Directory Size</span>
        <strong id="totalStudentCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Visible Results</span>
        <strong id="filteredStudentCount">0</strong>
      </article>
      <article class="mini-card" data-animate>
        <span class="muted">Classes</span>
        <strong id="classCount">0</strong>
      </article>
    </section>

    <section class="panel" data-animate>
      <div class="section-head">
        <div>
          <h3>Student Directory</h3>
          <p>Add, edit, filter, and export student records with ease.</p>
        </div>
        <div class="data-toolbar">
          <select id="classFilter" style="min-width:180px;"></select>
          <button class="btn btn-primary" id="openStudentModal" type="button">Add Student</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="studentsTableBody"></tbody>
        </table>
      </div>
      <div class="pagination-bar">
        <span id="studentPaginationLabel" class="muted">Showing 0 students</span>
        <div class="inline-actions">
          <button class="btn btn-secondary" id="studentPrevPage" type="button">Previous</button>
          <button class="btn btn-secondary" id="studentNextPage" type="button">Next</button>
        </div>
      </div>
    </section>

    <div class="modal" id="studentModal">
      <div class="modal-content">
        <div class="modal-head">
          <div>
            <h3 id="studentModalTitle">Add Student</h3>
            <p class="muted">Create polished records for student operations.</p>
          </div>
          <button class="icon-btn" id="closeStudentModal" type="button">✕</button>
        </div>
        <form id="studentForm" class="form-grid">
          <div>
            <label class="input-label" for="studentName">Name</label>
            <input id="studentName" name="name" placeholder="Student full name" required />
          </div>
          <div>
            <label class="input-label" for="studentRollNo">Roll No</label>
            <input id="studentRollNo" name="rollNo" placeholder="SSMS-007" required />
          </div>
          <div>
            <label class="input-label" for="studentClass">Class</label>
            <input id="studentClass" name="className" placeholder="12-A" required />
          </div>
          <div>
            <label class="input-label" for="studentPhone">Phone</label>
            <input id="studentPhone" name="phone" placeholder="9876501007" required />
          </div>
          <div class="full-span">
            <label class="input-label" for="studentEmail">Email</label>
            <input id="studentEmail" type="email" name="email" placeholder="student@schoolmail.com" required />
          </div>
          <div class="full-span inline-actions">
            <button class="btn btn-primary" id="saveStudentButton" type="submit">Save Student</button>
            <button class="btn btn-secondary" id="cancelStudentButton" type="button">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function populateClassFilter() {
  const select = document.getElementById("classFilter");
  const classes = [...new Set(state.students.map((student) => student.className))];

  select.innerHTML = `
    <option value="">All Classes</option>
    ${classes.map((className) => `<option value="${className}">${className}</option>`).join("")}
  `;

  select.value = state.className;
}

function applyFilters() {
  state.filteredStudents = state.students.filter((student) => {
    const keyword = state.search.toLowerCase();
    const matchesSearch =
      !keyword ||
      student.name.toLowerCase().includes(keyword) ||
      student.rollNo.toLowerCase().includes(keyword) ||
      student.className.toLowerCase().includes(keyword) ||
      student.email.toLowerCase().includes(keyword);
    const matchesClass = !state.className || student.className === state.className;
    return matchesSearch && matchesClass;
  });
}

function renderStudents() {
  applyFilters();
  const tableBody = document.getElementById("studentsTableBody");
  const pageCount = Math.max(1, Math.ceil(state.filteredStudents.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const startIndex = (state.page - 1) * state.pageSize;
  const visibleStudents = state.filteredStudents.slice(startIndex, startIndex + state.pageSize);
  document.getElementById("totalStudentCount").textContent = state.students.length;
  document.getElementById("filteredStudentCount").textContent = state.filteredStudents.length;
  document.getElementById("classCount").textContent = new Set(state.students.map((student) => student.className)).size;
  document.getElementById("studentPaginationLabel").textContent = state.filteredStudents.length
    ? `Showing ${startIndex + 1}-${Math.min(startIndex + state.pageSize, state.filteredStudents.length)} of ${state.filteredStudents.length} students`
    : "Showing 0 students";
  document.getElementById("studentPrevPage").disabled = state.page <= 1;
  document.getElementById("studentNextPage").disabled = state.page >= pageCount;

  if (!state.filteredStudents.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">${renderEmptyState("No students found", "Try a different search or add a new student.")}</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = visibleStudents
    .map(
      (student) => `
        <tr>
          <td>
            <strong>${student.name}</strong>
          </td>
          <td>${student.rollNo}</td>
          <td><span class="badge primary">${student.className}</span></td>
          <td>${student.email}</td>
          <td>${student.phone}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary row-edit" data-id="${student.id}" type="button">Edit</button>
              <button class="btn btn-secondary row-report" data-id="${student.id}" type="button">Report</button>
              <button class="btn btn-danger row-delete" data-id="${student.id}" type="button">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function openStudentForm(student = null) {
  const form = document.getElementById("studentForm");
  const title = document.getElementById("studentModalTitle");
  const fields = form.elements;

  state.editingId = student?.id || null;
  title.textContent = student ? "Edit Student" : "Add Student";
  form.reset();

  fields.name.value = student?.name || "";
  fields.rollNo.value = student?.rollNo || "";
  fields.className.value = student?.className || "";
  fields.email.value = student?.email || "";
  fields.phone.value = student?.phone || "";

  modal.open();
}

async function loadStudents() {
  state.students = await apiFetch("/students");
  populateClassFilter();
  renderStudents();
}

async function saveStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const saveButton = document.getElementById("saveStudentButton");
  const payload = {
    name: fields.name.value.trim(),
    rollNo: fields.rollNo.value.trim(),
    className: fields.className.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim()
  };

  if (Object.values(payload).some((value) => !value)) {
    showToast("All student fields are required.", "error");
    return;
  }

  try {
    setButtonLoading(saveButton, true, "Saving...");

    if (state.editingId) {
      await apiFetch(`/students/${state.editingId}`, {
        method: "PUT",
        body: payload
      });
      showToast("Student updated successfully.");
    } else {
      await apiFetch("/students", {
        method: "POST",
        body: payload
      });
      showToast("Student added successfully.");
    }

    modal.close();
    await loadStudents();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(saveButton, false);
  }
}

async function deleteStudent(id) {
  const confirmed = await confirmAction({
    title: "Delete student?",
    message: "This will remove the student and related attendance and marks records.",
    confirmLabel: "Delete Student"
  });

  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(`/students/${id}`, { method: "DELETE" });
    showToast("Student deleted successfully.");
    await loadStudents();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function createMarksChartImage(subjects) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 320;
  const context = canvas.getContext("2d");
  const padding = 54;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  const barGap = 18;
  const barWidth = subjects.length
    ? (chartWidth - barGap * (subjects.length - 1)) / subjects.length
    : chartWidth;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#dbeafe";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding, padding);
  context.lineTo(padding, padding + chartHeight);
  context.lineTo(padding + chartWidth, padding + chartHeight);
  context.stroke();

  subjects.forEach((entry, index) => {
    const score = Number(entry.score || 0);
    const barHeight = (score / 100) * chartHeight;
    const x = padding + index * (barWidth + barGap);
    const y = padding + chartHeight - barHeight;

    context.fillStyle = index % 2 === 0 ? "#7c3aed" : "#2563eb";
    context.fillRect(x, y, barWidth, barHeight);
    context.fillStyle = "#0f172a";
    context.font = "bold 24px Inter, Arial";
    context.textAlign = "center";
    context.fillText(String(score), x + barWidth / 2, y - 10);
    context.font = "20px Inter, Arial";
    context.fillText(entry.subject.slice(0, 10), x + barWidth / 2, padding + chartHeight + 30);
  });

  return canvas.toDataURL("image/png", 0.95);
}

async function generateReport(id) {
  try {
    const [student, attendanceSummary, marksSummary] = await Promise.all([
      apiFetch(`/students/${id}`),
      apiFetch(`/attendance/summary/${id}`),
      apiFetch(`/marks/summary/${id}`)
    ]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const averageScore = Number(marksSummary.average || 0).toFixed(2);
    const grade = marksSummary.grade || getGrade(Number(marksSummary.average || 0));
    const generatedOn = formatDateLabel(new Date().toISOString());
    const chartImage = createMarksChartImage(marksSummary.subjects || []);

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 12, "F");
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 12, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Student Management System", 14, 21);
    doc.setFontSize(10);
    doc.text("SSMS Pro Academic Report", 14, 29);
    doc.text(`Generated: ${generatedOn}`, 148, 29);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Student Information", 14, 48);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 53, 182, 38, 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Full Name: ${student.name}`, 20, 63);
    doc.text(`Roll Number: ${student.rollNo}`, 20, 71);
    doc.text(`Registration ID: ${student.id}`, 20, 79);
    doc.text(`Class: ${student.className}`, 116, 63);
    doc.text(`Email: ${student.email}`, 116, 71);
    doc.text(`Phone: ${student.phone}`, 116, 79);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Attendance Section", 14, 105);
    doc.roundedRect(14, 110, 84, 32, 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Days: ${attendanceSummary.totalDays}`, 20, 120);
    doc.text(`Present: ${attendanceSummary.present}`, 20, 128);
    doc.text(`Absent: ${attendanceSummary.absent}`, 58, 128);
    doc.text(`Attendance: ${attendanceSummary.percentage}%`, 20, 136);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Academic Section", 112, 105);
    doc.roundedRect(112, 110, 84, 32, 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Marks: ${marksSummary.total || 0}`, 118, 120);
    doc.text(`Average: ${averageScore}%`, 118, 128);
    doc.text(`Grade: ${grade}`, 118, 136);

    doc.setFont("helvetica", "bold");
    doc.text("Subject-wise Marks", 14, 157);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 163, 182, 8, 2, 2, "F");
    doc.setFontSize(9);
    doc.text("Subject", 20, 168);
    doc.text("Exam", 92, 168);
    doc.text("Marks", 170, 168);

    doc.setFont("helvetica", "normal");
    let rowPosition = 178;
    marksSummary.subjects.forEach((entry) => {
      doc.text(entry.subject, 20, rowPosition);
      doc.text(entry.examType || "Assessment", 92, rowPosition);
      doc.text(String(entry.score), 174, rowPosition);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, rowPosition + 4, 196, rowPosition + 4);
      rowPosition += 8;
    });

    doc.addImage(chartImage, "PNG", 18, 214, 174, 50);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Remarks: ${marksSummary.remark}`, 14, 276);
    doc.setFont("helvetica", "normal");
    doc.text("Authorized Signature", 14, 288);
    doc.line(54, 287, 104, 287);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 292, 210, 5, "F");
    doc.setFontSize(8);
    doc.text("Official report generated by Student Management System", 14, 295);

    doc.save(`${student.name.replace(/\s+/g, "-").toLowerCase()}-report.pdf`);
    showToast("PDF report generated successfully.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function bindEvents() {
  document.getElementById("openStudentModal")?.addEventListener("click", () => openStudentForm());
  document.getElementById("closeStudentModal")?.addEventListener("click", () => modal.close());
  document.getElementById("cancelStudentButton")?.addEventListener("click", () => modal.close());
  document.getElementById("studentForm")?.addEventListener("submit", saveStudent);
  document.getElementById("classFilter")?.addEventListener("change", (event) => {
    state.className = event.target.value;
    state.page = 1;
    renderStudents();
  });
  document.getElementById("studentPrevPage")?.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderStudents();
  });
  document.getElementById("studentNextPage")?.addEventListener("click", () => {
    state.page += 1;
    renderStudents();
  });

  window.addEventListener(
    "ssms:search",
    debounce((event) => {
      state.search = event.detail;
      state.page = 1;
      renderStudents();
    })
  );

  document.getElementById("studentsTableBody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    const student = state.students.find((entry) => entry.id === button.dataset.id);

    if (button.classList.contains("row-edit")) {
      openStudentForm(student);
    }

    if (button.classList.contains("row-delete")) {
      await deleteStudent(button.dataset.id);
    }

    if (button.classList.contains("row-report")) {
      await generateReport(button.dataset.id);
    }
  });

  document.getElementById("studentModal")?.addEventListener("click", (event) => {
    if (event.target.id === "studentModal") {
      modal.close();
    }
  });
}

async function initStudents() {
  state.currentUser = requireAuth();

  if (!state.currentUser) {
    return;
  }

  state.capabilities = getRoleCapabilities(state.currentUser);

  if (!state.capabilities.canManageAcademic) {
    showToast("Students management is available for Admin and Teacher roles.", "info");
    window.location.href = "/dashboard";
    return;
  }

  buildContent();
  bindEvents();
  await loadStudents();
}

initStudents();
