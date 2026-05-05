const API_PREFIX = "/api";

export function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (value === "admin" || value === "administrator") {
    return "Admin";
  }

  if (value === "teacher" || value === "faculty") {
    return "Teacher";
  }

  if (value === "student") {
    return "Student";
  }

  return "Teacher";
}

export async function apiFetch(path, options = {}) {
  const currentUser = getCurrentUser();
  const config = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(currentUser?.id ? { "x-user-id": currentUser.id } : {}),
      ...(options.headers || {})
    }
  };

  if (options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_PREFIX}${path}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearCurrentUser();
    }

    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem("ssms-current-user") || "null");

    if (!user) {
      return null;
    }

    return {
      ...user,
      role: normalizeRole(user.role),
      theme: user.theme || "light",
      studentId: user.studentId || null,
      subjects: Array.isArray(user.subjects) ? user.subjects : [],
      assignedClassNames: Array.isArray(user.assignedClassNames) ? user.assignedClassNames : [],
      assignedStudentIds: Array.isArray(user.assignedStudentIds) ? user.assignedStudentIds : []
    };
  } catch (error) {
    return null;
  }
}

export function setCurrentUser(user) {
  const nextUser = {
    ...user,
    role: normalizeRole(user.role),
    theme: user.theme || "light",
    studentId: user.studentId || null,
    subjects: Array.isArray(user.subjects) ? user.subjects : [],
    assignedClassNames: Array.isArray(user.assignedClassNames) ? user.assignedClassNames : [],
    assignedStudentIds: Array.isArray(user.assignedStudentIds) ? user.assignedStudentIds : []
  };

  localStorage.setItem("ssms-current-user", JSON.stringify(nextUser));
}

export function clearCurrentUser() {
  localStorage.removeItem("ssms-current-user");
}

export function getStoredTheme() {
  const user = getCurrentUser();
  return localStorage.getItem("ssms-theme") || user?.theme || "light";
}

export function applyTheme(theme) {
  const nextTheme = theme || "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("ssms-theme", nextTheme);
}

export function requireAuth() {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  applyTheme(getStoredTheme());
  return user;
}

export function redirectIfAuthenticated() {
  const user = getCurrentUser();

  if (user) {
    applyTheme(getStoredTheme());
    window.location.href = "/dashboard";
    return true;
  }

  return false;
}

export function logout() {
  clearCurrentUser();
  window.location.href = "/";
}

export function showToast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");

  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

export function formatDateLabel(dateString) {
  if (!dateString) {
    return "Not scheduled";
  }

  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function debounce(fn, delay = 300) {
  let timerId;

  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delay);
  };
}

export function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function getRoleCapabilities(user = getCurrentUser()) {
  const role = normalizeRole(user?.role);
  const isAdmin = role === "Admin";
  const isTeacher = role === "Teacher";
  const isStudent = role === "Student";

  return {
    role,
    isAdmin,
    isTeacher,
    isStudent,
    studentId: user?.studentId || null,
    canManageAll: isAdmin,
    canManageAcademic: isAdmin || isTeacher,
    canManageTasks: isAdmin || isTeacher,
    isReadOnly: isStudent,
    subjects: Array.isArray(user?.subjects) ? user.subjects : [],
    assignedClassNames: Array.isArray(user?.assignedClassNames) ? user.assignedClassNames : [],
    assignedStudentIds: Array.isArray(user?.assignedStudentIds) ? user.assignedStudentIds : []
  };
}

export function getAccessLabel(user = getCurrentUser()) {
  const capabilities = getRoleCapabilities(user);

  if (capabilities.isAdmin) {
    return "Full access";
  }

  if (capabilities.isTeacher) {
    return "Academic management";
  }

  return "View-only access";
}

export function filterStudentsForUser(students = [], user = getCurrentUser()) {
  const capabilities = getRoleCapabilities(user);

  if (capabilities.isAdmin) {
    return students;
  }

  if (capabilities.isStudent) {
    return capabilities.studentId
      ? students.filter((student) => student.id === capabilities.studentId)
      : [];
  }

  const assignedClasses = capabilities.assignedClassNames.map((className) =>
    String(className).toLowerCase()
  );

  return students.filter(
    (student) =>
      capabilities.assignedStudentIds.includes(student.id) ||
      assignedClasses.includes(String(student.className).toLowerCase())
  );
}

export function filterRecordsForUser(records = [], key = "studentId", user = getCurrentUser()) {
  const capabilities = getRoleCapabilities(user);

  if (capabilities.isStudent) {
    return capabilities.studentId
      ? records.filter((record) => record[key] === capabilities.studentId)
      : [];
  }

  return records;
}
