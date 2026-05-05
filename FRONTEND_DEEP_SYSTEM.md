# Frontend Deep System

## Purpose

This document explains how the frontend is actually assembled, how each page behaves, where state lives, how navigation works, and where the design and rendering approach is strong versus fragile. It is written for refactoring, debugging, and safely extending the UI without breaking role logic or data expectations.

## Files Involved

HTML entry pages:

- `frontend/pages/overview.html`
- `frontend/pages/login.html`
- `frontend/pages/signup.html`
- `frontend/pages/dashboard.html`
- `frontend/pages/students.html`
- `frontend/pages/attendance.html`
- `frontend/pages/performance.html`
- `frontend/pages/tasks.html`
- `frontend/pages/logs.html`
- `frontend/pages/messages.html`
- `frontend/pages/profile.html`

Shared frontend files:

- `frontend/js/api.js`
- `frontend/js/app.js`
- `frontend/components/layout.js`
- `frontend/css/styles.css`

Page modules:

- `frontend/js/dashboard.js`
- `frontend/js/students.js`
- `frontend/js/attendance.js`
- `frontend/js/performance.js`
- `frontend/js/tasks.js`
- `frontend/js/logs.js`
- `frontend/js/messages.js`
- `frontend/js/profile.js`
- `frontend/js/login.js`
- `frontend/js/signup.js`

## How It Works Internally

The frontend is a page-module architecture, not an SPA framework.

Each protected page follows roughly the same lifecycle:

1. The HTML file loads shared CSS and sometimes a CDN dependency like Chart.js or jsPDF
2. The page script imports shared helpers from `api.js`, `app.js`, and `layout.js`
3. `requireAuth()` decides whether the user should remain on the page
4. `renderShell()` injects the sidebar, topbar, global search box, and page container
5. A `buildContent()` function fills the page container with cards, forms, tables, modals, or charts
6. A `bindEvents()` function connects the DOM to handlers
7. A `load*()` function fetches the page’s runtime data
8. Render functions transform in-memory arrays into markup using `innerHTML`

The major advantage is clarity. The major cost is duplication and weak separation of concerns.

## Every Page Purpose

### `overview.html`

Purpose:

- Acts as the public landing page
- Positions the project as a polished premium platform
- Provides login/signup entry points

Important notes:

- No JS page module
- Inline theme bootstrapping exists in the HTML head
- Marketing-style copy is embedded directly in markup

### `login.html` + `login.js`

Purpose:

- Handles sign-in
- Stores the current user locally
- Redirects authenticated users away

Important behavior:

- `redirectIfAuthenticated()` short-circuits repeat visits
- `apiFetch("/auth/login")` does the request
- `setCurrentUser()` writes to `localStorage`
- Theme is applied immediately from returned user data

### `signup.html` + `signup.js`

Purpose:

- Handles self-registration
- Immediately signs the user in after account creation

Important behavior:

- Password confirmation is frontend-only
- Role selection is exposed to the user, including Admin
- Role defaults to Teacher in practice after normalization
- Signup writes directly to `users` in the backend

### `dashboard.html` + `dashboard.js`

Purpose:

- Aggregated command center
- High-level KPIs and charts
- Recent activity and messages preview

Important behavior:

- Fetches many endpoints in parallel
- Role changes the page meaning significantly
- Student view becomes a personal dashboard
- Admin/Teacher view becomes operational overview

Important hidden detail:

- `presentToday` uses the current system date, so if seed data is old, the dashboard can appear “empty” even when attendance data exists historically

### `students.html` + `students.js`

Purpose:

- Main directory and CRUD screen for student records
- PDF report trigger point

Important behavior:

- Uses a modal for create/update
- Uses client-side search, class filtering, and pagination
- Sends create/update/delete to backend
- Generates PDF entirely in the browser

Important hidden detail:

- There is no dedicated student detail page
- The “student profile” concept is split between table rows, report generation, and backend summary endpoints

### `attendance.html` + `attendance.js`

Purpose:

- Mark daily attendance
- Review monthly summary
- Provide student read-only attendance visibility

Important behavior:

- Maintains a `Map` keyed by `studentId`
- Loads attendance twice:
  - selected date
  - all dates
- Supports “Mark All Present” and “Mark All Absent”
- Saves attendance in bulk

Important hidden detail:

- Any student with no record for the selected day is treated as absent in the UI
- That is convenient for bulk entry and risky for data accuracy

### `performance.html` + `performance.js`

Purpose:

- Add marks
- Visualize subject and student performance
- Show academic insights

Important behavior:

- Admin/Teacher can add and delete marks
- Student is read-only
- Charts are built with Chart.js
- Uses hardcoded `SUBJECTS` ordering

Important hidden detail:

- The selected student filter does not affect every visualization consistently
- The subject bar chart always reflects all marks, while the line chart reflects one student

### `tasks.html` + `tasks.js`

Purpose:

- Operational task board for Admin/Teacher

Important behavior:

- Student users are redirected away
- All task filtering and pagination are client-side
- The UI supports create, complete/reopen, and delete

Important limitation:

- Tasks have no assignee, no description, no owner, and no workflow beyond `completed: boolean`

### `logs.html` + `logs.js`

Purpose:

- Activity timeline for operational traceability

Important behavior:

- Loads logs from the server, then filters client-side
- Supports entity type, actor role, date, and keyword filters

Important hidden detail:

- Visibility is already filtered on the backend by role, so frontend filtering is only presentation filtering, not access control

### `messages.html` + `messages.js`

Purpose:

- Simple internal messaging and announcement workflow

Important behavior:

- Loads user directory and message history
- Filters allowed recipients by role
- Admin can broadcast announcements

Important hidden detail:

- It is not real chat
- There is no live connection, conversation grouping, read status, or threading

### `profile.html` + `profile.js`

Purpose:

- User profile editor
- Theme switch
- Role-specific identity summary
- Student report download shortcut

Important behavior:

- Fetches authenticated user profile from backend
- Student role fetches linked student and summary data
- Theme is persisted both locally and to backend

Important hidden detail:

- This is the only place where theme changes are pushed into the backend user record
- The page includes inline styles in its markup, which shows some design drift from reusable CSS conventions

## Navigation Logic

Navigation is centralized in `frontend/components/layout.js`.

`navItems` defines:

- page key
- label
- href
- allowed roles

At render time:

- `getCurrentUser()` returns the stored user
- `getRoleCapabilities()` resolves role flags
- `navItems` are filtered by role
- The page key passed into `renderShell(pageKey)` determines the active item

Important implications:

- Adding a new protected page requires updates in multiple places:
  - new HTML file
  - new JS module
  - route in `backend/server.js`
  - `navItems` in `layout.js`
- Role visibility in the sidebar is only a UX layer
- Backend enforcement still has to exist independently

## Sidebar / Navbar System

The shell built by `renderShell()` is the real UI backbone.

It includes:

- Fixed sidebar on desktop
- Brand block
- Role-filtered navigation list
- Sticky topbar on larger screens
- Global search field
- Notification button
- Account menu with profile/settings/logout

Important observations:

- The notification bell is visual only; it does not load real notification data
- The profile dropdown is functional
- The shell dispatches search input as a global custom event:
  - `window.dispatchEvent(new CustomEvent("ssms:search", ...))`

This means page modules do not own the search input; they subscribe to it.

## CSS Structure

`frontend/css/styles.css` is a single global stylesheet for everything.

The structure is roughly:

- Root variables and dark theme variables
- Global resets
- Auth page styles
- Shell styles
- Shared card/table/modal/button styles
- Page-specific patterns like attendance rows and overview cards
- Media queries
- A second design override block labeled “Corporate dashboard polish”

This second style layer is important. The file contains two visual systems stacked on top of each other:

1. Original glass-heavy rounded visual system
2. Later corporate polish overrides that flatten corners, reduce visual noise, and change spacing

That means the current UI is the result of cumulative overrides, not a single clean design system.

## Theme Architecture

Theme switching is built around `html[data-theme]`.

Relevant frontend logic:

- HTML pages set the theme immediately from `localStorage` before CSS loads
- `applyTheme()` updates the HTML attribute and stores `ssms-theme`
- `getStoredTheme()` prefers `localStorage("ssms-theme")`, then `user.theme`

Important consequence:

- There are two theme truths:
  - `localStorage("ssms-theme")`
  - `user.theme` from backend

If they diverge, `localStorage` wins visually.

## Reusable UI Components

There is no component framework, but there are reusable behavioral utilities.

### In `frontend/js/api.js`

- `apiFetch()`
- `requireAuth()`
- `redirectIfAuthenticated()`
- `logout()`
- `showToast()`
- `getRoleCapabilities()`
- `filterStudentsForUser()`
- `filterRecordsForUser()`
- `applyTheme()`

### In `frontend/js/app.js`

- `setButtonLoading()`
- `renderEmptyState()`
- `createModalController()`
- `average()`
- `getRemark()`
- `getGrade()`
- `confirmAction()`

### In `frontend/components/layout.js`

- `renderShell()`

These three files form the frontend’s actual shared platform.

## State Handling In Frontend

State is page-local and plain.

Patterns used:

- A page-level `state` object
- Some module-level chart references
- `localStorage` for auth and theme
- Re-fetch after mutations instead of in-place normalization

Examples:

- `students.js` keeps `students`, `filteredStudents`, `search`, `className`, `editingId`, `page`
- `attendance.js` keeps `students`, `allAttendance`, `attendanceMap`, `selectedDate`, `search`
- `performance.js` keeps `students`, `marks`, `attendance`, `selectedStudent`, `search`

This approach is easy to reason about per file, but there is no shared store, no derived-state memoization, and no consistency enforcement across pages.

## DOM Manipulation Logic

Most rendering is done with raw template strings and `innerHTML`.

Patterns:

- Whole sections are replaced at once
- Tables and card lists are rebuilt after load or after state changes
- Event delegation is used for row buttons and list actions
- Chart instances are destroyed and recreated

Why this works:

- The data sizes are still small
- The codebase is simple enough that full rerenders are affordable

Why this is risky:

- Unsanitized user-generated content is injected into HTML
- Repeated rerenders can duplicate event listeners when shell rebuilds happen more than once
- Large datasets will degrade quickly

## Search / Filter Implementation

Search is centrally broadcast from the shell.

The flow is:

1. User types into topbar search
2. `renderShell()` dispatches `ssms:search`
3. Page module listens with `window.addEventListener("ssms:search", debounce(...))`
4. Page updates `state.search`
5. Page re-renders filtered content

Current implementation style:

- Students: client-side name/roll/class/email search
- Attendance: client-side student search
- Tasks: client-side title search
- Logs: client-side title/action/description/actor/date search
- Messages: client-side subject/content/people search
- Performance: client-side marks table search only

Important limitation:

- The backend does support some query filtering, especially for students and logs, but the frontend mostly ignores it and fetches the full allowed dataset first

## Data Flow

Frontend protected page data flow:

`localStorage -> requireAuth() -> renderShell() -> page state -> apiFetch() -> JSON -> render functions -> DOM`

Mutation flow:

`user action -> event handler -> apiFetch() -> backend write -> frontend reload -> rerender`

This “reload after mutation” pattern is consistent across pages and keeps local mutation logic simple.

## Important Functions

Most important frontend functions to understand before changing anything:

- `apiFetch()` in `frontend/js/api.js`
- `getRoleCapabilities()` in `frontend/js/api.js`
- `renderShell()` in `frontend/components/layout.js`
- `renderStudents()` in `frontend/js/students.js`
- `loadAttendance()` and `saveAttendance()` in `frontend/js/attendance.js`
- `renderSummaryAndBreakdown()` and `renderCharts()` in `frontend/js/performance.js`
- `generateReport()` in `frontend/js/students.js`
- `generateProfileReport()` in `frontend/js/profile.js`

## Hidden Dependencies

- Google Fonts is required for the intended typography
- Chart.js is loaded via CDN on dashboard/performance pages
- jsPDF is loaded via CDN on students/profile pages
- Search only works because every page listens for `ssms:search`
- Role filtering is duplicated between frontend and backend
- Grade and remark logic is duplicated between frontend and backend
- `SUBJECTS` in `app.js` is assumed by performance analytics and marks form options
- Unknown roles normalize to Teacher, which changes both nav visibility and capability checks

## UI Performance Issues

- Dashboard loads several datasets at once and recomputes aggregates in the browser
- Attendance page fetches all attendance on every date change
- Performance page recalculates averages repeatedly using nested `.filter()` calls
- Charts are destroyed and recreated rather than updated
- Full tables are rerendered via `innerHTML`
- CSS is one large file for every page, with no code splitting

These are acceptable for small demos and will become noticeable when records grow.

## Responsiveness Logic

Key breakpoints:

- `1180px`
- `980px`
- `760px`

Behavior:

- Desktop: fixed sidebar + main content area
- Tablet: sidebar becomes top block, nav becomes grid
- Small mobile: auth layout stacks, forms collapse to one column, nav collapses further, tables remain scrollable

Current responsive strengths:

- The app does not completely break on smaller screens
- Many grids use `auto-fit` or one-column fallbacks

Current responsive weaknesses:

- There is no mobile drawer navigation
- Tables remain dense on narrow devices
- Search, profile menu, and account controls are cramped on small viewports
- Sidebar becoming a full grid at smaller widths is functional but not elegant

## Common Mistakes

- Changing `renderShell()` without checking every page that depends on global search
- Modifying `localStorage` keys and forgetting auth/theme bootstrapping
- Adding a new subject without updating `SUBJECTS`
- Adding a new page without updating both `server.js` and `layout.js`
- Assuming frontend role restrictions are real security
- Injecting new data into template strings without thinking about HTML escaping
- Rebuilding the shell repeatedly and accidentally stacking document-level listeners

## How To Improve

### Short-term

- Create a tiny HTML escaping helper before inserting user-generated strings
- Split `styles.css` into:
  - tokens
  - shell
  - auth
  - shared components
  - page modules
- Centralize page bootstrapping into one helper
- Move repeated chart colors and table render helpers into shared utilities
- Add proper loading states on tasks, messages, attendance, and performance

### Medium-term

- Replace duplicated page patterns with small reusable render helpers
- Introduce a lightweight state management pattern
- Replace full rerenders with targeted DOM updates for hot paths
- Consolidate report generation helpers
- Normalize page module structure:
  - `state`
  - `buildContent`
  - `bindEvents`
  - `loadData`
  - `render`

### Long-term

- Move to a real frontend framework only if the project scope justifies it
- If not, keep the current no-build approach but modularize aggressively

## What To Never Break

- `renderShell()` global search event emission
- `requireAuth()` redirect behavior
- `setCurrentUser()` / `getCurrentUser()` shape
- Theme bootstrapping in page heads
- `SUBJECTS` unless analytics is redesigned with dynamic subject discovery
- `data-shell` mount pattern for protected pages
- jsPDF and Chart.js script loading on pages that need them

## Future Notes

The frontend is best viewed as a well-organized “advanced vanilla JS dashboard,” not as a half-finished framework app.

That is a strength if maintained intentionally.

The best next move is not to rewrite everything. It is to:

1. Stabilize the shared platform files
2. Reduce duplication across page modules
3. Clean the CSS architecture
4. Add sanitization and predictable render contracts

If that is done well, the current frontend can scale much further before a framework migration becomes necessary.
