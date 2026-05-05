import {
  apiFetch,
  applyTheme,
  getAccessLabel,
  getRoleCapabilities,
  formatDateLabel,
  requireAuth,
  setCurrentUser,
  showToast
} from "./api.js";
import { getGrade } from "./app.js";
import { renderShell } from "../components/layout.js";

const state = {
  user: null,
  capabilities: null,
  student: null,
  attendanceSummary: null,
  marksSummary: null
};

function buildContent() {
  const page = renderShell("profile", {
    title: "Profile",
    subtitle: "Manage your personal details, theme preference, and role-based access visibility.",
    searchPlaceholder: "Profile search is disabled",
    disableSearch: true
  });

  page.innerHTML = `
    <section class="profile-grid">
      <article class="panel profile-card" data-animate>
        <div class="panel-head">
          <div>
            <h3>User Snapshot</h3>
            <p>Your current SSMS Pro identity and access footprint.</p>
          </div>
        </div>
        <div class="avatar" style="width:4.2rem;height:4.2rem;font-size:1.3rem;">${state.user.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}</div>
        <h2 style="margin-top:1rem;">${state.user.name}</h2>
        <p class="muted">${state.capabilities.role}</p>
        <div class="summary-grid" style="margin-top:1.4rem;">
          <div class="mini-card">
            <span class="muted">Theme</span>
            <strong id="themeLabel">${state.user.theme || "light"}</strong>
          </div>
          <div class="mini-card">
            <span class="muted">Access</span>
            <strong style="font-size:1rem;">${getAccessLabel(state.user)}</strong>
          </div>
          <div class="mini-card">
            <span class="muted">Linked Student</span>
            <strong style="font-size:1rem;">${state.user.studentId || "Not linked"}</strong>
          </div>
        </div>
      </article>

      <article class="panel profile-card" data-animate>
        <div class="panel-head">
          <div>
            <h3>${state.capabilities.isStudent ? "Student Profile" : state.capabilities.isTeacher ? "Teacher Profile" : "Admin Profile"}</h3>
            <p>${state.capabilities.isStudent ? "Personal academic details and report access." : state.capabilities.isTeacher ? "Assigned teaching scope and classes." : "System-level controls and administrator scope."}</p>
          </div>
        </div>
        ${renderRoleProfile()}
      </article>

      <article class="panel profile-card" data-animate>
        <div class="panel-head">
          <div>
            <h3>Edit Profile</h3>
            <p>Update your contact details and personalize the dashboard theme.</p>
          </div>
        </div>
        <form id="profileForm" class="form-grid">
          <div>
            <label class="input-label" for="profileName">Name</label>
            <input id="profileName" name="name" value="${state.user.name}" required />
          </div>
          <div>
            <label class="input-label" for="profileRole">Role</label>
            <input id="profileRole" value="${state.capabilities.role}" disabled />
          </div>
          <div>
            <label class="input-label" for="profileEmail">Email</label>
            <input id="profileEmail" name="email" type="email" value="${state.user.email}" required />
          </div>
          <div>
            <label class="input-label" for="profilePhone">Phone</label>
            <input id="profilePhone" name="phone" value="${state.user.phone || ""}" />
          </div>
          <div class="full-span">
            <label class="input-label">Theme</label>
            <div class="theme-switch" id="themeSwitch">
              <button type="button" class="${(state.user.theme || "light") === "light" ? "active" : ""}" data-theme="light">Light</button>
              <button type="button" class="${(state.user.theme || "light") === "dark" ? "active" : ""}" data-theme="dark">Dark</button>
            </div>
          </div>
          <div class="full-span inline-actions">
            <button class="btn btn-primary" type="submit">Save Profile</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderRoleProfile() {
  if (state.capabilities.isStudent) {
    return `
      <div class="summary-grid">
        <div class="mini-card">
          <span class="muted">Full Name</span>
          <strong style="font-size:1rem;">${state.student?.name || state.user.name}</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Roll Number</span>
          <strong style="font-size:1rem;">${state.student?.rollNo || "Not linked"}</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Class</span>
          <strong style="font-size:1rem;">${state.student?.className || "Not linked"}</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Attendance</span>
          <strong>${state.attendanceSummary?.percentage || 0}%</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Average Marks</span>
          <strong>${Number(state.marksSummary?.average || 0).toFixed(1)}%</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Grade</span>
          <strong>${state.marksSummary?.grade || getGrade(Number(state.marksSummary?.average || 0))}</strong>
        </div>
      </div>
      <button class="btn btn-primary" id="profileReportButton" type="button" style="margin-top:1rem;">Download My Report</button>
    `;
  }

  if (state.capabilities.isTeacher) {
    return `
      <div class="summary-grid">
        <div class="mini-card">
          <span class="muted">Subjects</span>
          <strong style="font-size:1rem;">${state.capabilities.subjects.length ? state.capabilities.subjects.join(", ") : "Mathematics, Science"}</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Assigned Classes</span>
          <strong style="font-size:1rem;">${state.capabilities.assignedClassNames.length ? state.capabilities.assignedClassNames.join(", ") : "No classes assigned"}</strong>
        </div>
        <div class="mini-card">
          <span class="muted">Workflow Access</span>
          <strong style="font-size:1rem;">Attendance, marks, messages</strong>
        </div>
      </div>
    `;
  }

  return `
    <div class="summary-grid">
      <div class="mini-card">
        <span class="muted">Role Details</span>
        <strong style="font-size:1rem;">Full system administrator</strong>
      </div>
      <div class="mini-card">
        <span class="muted">System Controls</span>
        <strong style="font-size:1rem;">Users, logs, reports</strong>
      </div>
      <div class="mini-card">
        <span class="muted">Report Scope</span>
        <strong style="font-size:1rem;">All students</strong>
      </div>
    </div>
  `;
}

function generateProfileReport() {
  if (!state.student || !state.attendanceSummary || !state.marksSummary) {
    showToast("Report data is not available for this profile.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const averageScore = Number(state.marksSummary.average || 0);
  const grade = state.marksSummary.grade || getGrade(averageScore);

  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, 210, 12, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 12, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Student Management System", 14, 21);
  doc.setFontSize(10);
  doc.text(`Student Report - ${formatDateLabel(new Date().toISOString())}`, 14, 29);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text("Student Information", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${state.student.name}`, 14, 58);
  doc.text(`Roll Number: ${state.student.rollNo}`, 14, 66);
  doc.text(`Registration ID: ${state.student.id}`, 14, 74);
  doc.text(`Class: ${state.student.className}`, 110, 58);
  doc.text(`Email: ${state.student.email}`, 110, 66);
  doc.text(`Phone: ${state.student.phone}`, 110, 74);

  doc.setFont("helvetica", "bold");
  doc.text("Attendance", 14, 94);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Days: ${state.attendanceSummary.totalDays}`, 14, 104);
  doc.text(`Present: ${state.attendanceSummary.present}`, 14, 112);
  doc.text(`Absent: ${state.attendanceSummary.absent}`, 14, 120);
  doc.text(`Attendance %: ${state.attendanceSummary.percentage}%`, 14, 128);

  doc.setFont("helvetica", "bold");
  doc.text("Academic Marks", 110, 94);
  doc.setFont("helvetica", "normal");
  let row = 104;
  state.marksSummary.subjects.forEach((entry) => {
    doc.text(`${entry.subject}: ${entry.score}`, 110, row);
    row += 8;
  });
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${state.marksSummary.total || 0}`, 110, row + 4);
  doc.text(`Average: ${averageScore.toFixed(1)}%`, 110, row + 12);
  doc.text(`Grade: ${grade}`, 110, row + 20);
  doc.text(`Remark: ${state.marksSummary.remark}`, 14, 156);
  doc.line(14, 182, 80, 182);
  doc.text("Authorized Signature", 14, 190);
  doc.save(`${state.student.name.replace(/\s+/g, "-").toLowerCase()}-profile-report.pdf`);
  showToast("Profile report downloaded.");
}

function bindEvents() {
  document.getElementById("themeSwitch")?.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) {
      return;
    }

    state.user.theme = button.dataset.theme;
    applyTheme(state.user.theme);
    document.querySelectorAll("#themeSwitch button").forEach((entry) => {
      entry.classList.toggle("active", entry.dataset.theme === state.user.theme);
    });
    document.getElementById("themeLabel").textContent = state.user.theme;
  });

  document.getElementById("profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;

    try {
      const response = await apiFetch(`/auth/profile/${state.user.id}`, {
        method: "PUT",
        body: {
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          phone: fields.phone.value.trim(),
      role: state.capabilities.role,
      studentId: state.user.studentId || null,
      theme: state.user.theme
        }
      });

      state.user = response.user;
      state.capabilities = getRoleCapabilities(state.user);
      setCurrentUser(response.user);
      applyTheme(response.user.theme || "light");
      showToast("Profile updated successfully.");
      buildContent();
      bindEvents();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  document.getElementById("profileReportButton")?.addEventListener("click", generateProfileReport);
}

async function initProfile() {
  const user = requireAuth();

  if (!user) {
    return;
  }

  state.user = await apiFetch(`/auth/profile/${user.id}`);
  state.capabilities = getRoleCapabilities(state.user);
  setCurrentUser(state.user);

  if (state.capabilities.isStudent && state.capabilities.studentId) {
    const [student, attendanceSummary, marksSummary] = await Promise.all([
      apiFetch(`/students/${state.capabilities.studentId}`),
      apiFetch(`/attendance/summary/${state.capabilities.studentId}`),
      apiFetch(`/marks/summary/${state.capabilities.studentId}`)
    ]);

    state.student = student;
    state.attendanceSummary = attendanceSummary;
    state.marksSummary = marksSummary;
  }

  buildContent();
  bindEvents();
}

initProfile();
