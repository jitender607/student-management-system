import {
  applyTheme,
  getAccessLabel,
  getCurrentUser,
  getInitials,
  getRoleCapabilities,
  getStoredTheme,
  logout
} from "../js/api.js";

const icons = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 13h8V3H3z"/><path d="M13 21h8v-6h-8z"/><path d="M13 3h8v8h-8z"/><path d="M3 21h8v-4H3z"/></svg>`,
  students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="14" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 3-3.87"/><path d="M6 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
  performance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
  tasks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  logs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`
};

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", roles: ["Admin", "Teacher", "Student"] },
  { key: "students", label: "Students", href: "/students", roles: ["Admin", "Teacher"] },
  { key: "attendance", label: "Attendance", href: "/attendance", roles: ["Admin", "Teacher", "Student"] },
  { key: "performance", label: "Performance", href: "/performance", roles: ["Admin", "Teacher", "Student"] },
  { key: "tasks", label: "Tasks", href: "/tasks", roles: ["Admin", "Teacher"] },
  { key: "logs", label: "Student Logs", href: "/logs", roles: ["Admin", "Teacher", "Student"] },
  { key: "messages", label: "Messages", href: "/messages", roles: ["Admin", "Teacher", "Student"] },
  { key: "profile", label: "Profile", href: "/profile", roles: ["Admin", "Teacher", "Student"] }
];

export function renderShell(pageKey, options = {}) {
  const user = getCurrentUser();
  const mountNode = document.querySelector("[data-shell]");

  if (!user || !mountNode) {
    return null;
  }

  applyTheme(getStoredTheme());
  const capabilities = getRoleCapabilities(user);
  const visibleNavItems = navItems.filter((item) => item.roles.includes(capabilities.role));
  const accessLabel = getAccessLabel(user);

  mountNode.innerHTML = `
    <div class="shell page-layer">
      <aside class="sidebar" data-animate>
        <div class="sidebar-card">
          <div class="brand-block">
            <div class="brand-logo">
              <div class="brand-logo-mark">S</div>
              <div>
                <strong>SSMS Pro</strong>
                <div class="muted">Smart campus command center</div>
              </div>
            </div>
            <div class="brand-pills">
              <span class="pill primary">Premium SMS</span>
              <span class="pill neutral">${capabilities.role}</span>
            </div>
            <p class="brand-meta">Student operations, attendance, performance, reporting, and communication.</p>
          </div>
          <nav class="nav-list">
            ${visibleNavItems
              .map(
                (item) => `
                  <a class="nav-link ${item.key === pageKey ? "active" : ""}" href="${item.href}">
                    ${icons[item.key]}
                    <span>${item.label}</span>
                  </a>
                `
              )
              .join("")}
          </nav>
        </div>
      </aside>
      <main class="layout-main">
        <header class="topbar" data-animate>
          <div class="topbar-intro">
            <h1>${options.title || "SSMS Pro"}</h1>
            <p>${options.subtitle || "Smart student operations with a clean, high-impact workflow."}</p>
          </div>
          <div class="topbar-actions">
            <label class="search-box" for="globalSearch">
              ${icons.search}
              <input id="globalSearch" type="search" placeholder="${options.searchPlaceholder || "Search records..."}" ${
                options.disableSearch ? "disabled" : ""
              } />
            </label>
            <div class="notification-menu">
              <button class="notification-btn" id="notificationMenuButton" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="notificationPanel">
                ${icons.bell}
                <span class="notification-dot"></span>
              </button>
              <div class="notification-panel" id="notificationPanel">
                <div class="notification-panel-head">
                  <strong>Notifications</strong>
                  <span>Live campus updates</span>
                </div>
                <div class="notification-item unread">
                  ${icons.bell}
                  <div>
                    <strong>${capabilities.role} dashboard ready</strong>
                    <span>Your latest records, marks, attendance, and messages are synced.</span>
                  </div>
                </div>
                <div class="notification-item">
                  ${icons.performance}
                  <div>
                    <strong>Performance data updated</strong>
                    <span>Subject-wise reports and analytics are available from the Performance page.</span>
                  </div>
                </div>
                <a class="notification-link" href="/logs">View activity logs</a>
              </div>
            </div>
            <div class="account-menu">
              <button class="topbar-profile" id="profileMenuButton" type="button" aria-expanded="false">
                <div class="avatar">${getInitials(user.name)}</div>
                <div class="profile-meta">
                  <strong>${user.name}</strong>
                  <small>${capabilities.role}</small>
                </div>
                ${icons.chevron}
              </button>
              <div class="profile-dropdown" id="profileDropdown">
                <div class="profile-dropdown-head">
                  <strong>${user.name}</strong>
                  <small>${user.email}</small>
                  <span>${accessLabel}</span>
                </div>
                <a href="/profile">${icons.profile}<span>My Profile</span></a>
                <a href="/profile#settings">${icons.settings}<span>Settings</span></a>
                <button id="logoutBtn" type="button">${icons.logout}<span>Logout</span></button>
              </div>
            </div>
          </div>
        </header>
        <section class="page-content" id="pageContent"></section>
      </main>
    </div>
  `;

  const profileMenuButton = document.getElementById("profileMenuButton");
  const profileDropdown = document.getElementById("profileDropdown");
  const notificationMenuButton = document.getElementById("notificationMenuButton");
  const notificationPanel = document.getElementById("notificationPanel");

  profileMenuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = profileDropdown?.classList.toggle("open");
    notificationPanel?.classList.remove("open");
    notificationMenuButton?.setAttribute("aria-expanded", "false");
    profileMenuButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });

  notificationMenuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = notificationPanel?.classList.toggle("open");
    profileDropdown?.classList.remove("open");
    profileMenuButton?.setAttribute("aria-expanded", "false");
    notificationMenuButton.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu")) {
      profileDropdown?.classList.remove("open");
      profileMenuButton?.setAttribute("aria-expanded", "false");
    }

    if (!event.target.closest(".notification-menu")) {
      notificationPanel?.classList.remove("open");
      notificationMenuButton?.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("globalSearch")?.addEventListener("input", (event) => {
    window.dispatchEvent(
      new CustomEvent("ssms:search", {
        detail: event.target.value.trim()
      })
    );
  });

  return document.getElementById("pageContent");
}
