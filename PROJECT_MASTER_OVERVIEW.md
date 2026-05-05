# Project Master Overview

## Purpose

This document is the high-level technical map of the current SSMS Pro codebase. It is written for maintenance, refactoring, debugging, and future architecture work, not for end users. The goal is to describe the system as it actually exists in code today, including the strong parts, the fragile parts, and the hidden assumptions that will matter when the project evolves.

At the time of inspection, the project is a lightweight full-stack application with:

- A plain HTML/CSS/JavaScript frontend with page-specific ES modules
- An Express backend
- A JSON file datastore at `backend/models/db.json`
- No build step, no database server, no test suite, and no real authentication/session system

Current persisted data in `backend/models/db.json` is already beyond the original seed state:

- `3` users
- `7` students
- `74` attendance records
- `33` marks records
- `1` task
- `62` logs
- `5` messages

That matters because this project is not just seeded demo data anymore; runtime writes are part of the system design.

## Files Involved

Core runtime files:

- `package.json`
- `backend/server.js`
- `backend/middleware/authMiddleware.js`
- `backend/routes/*.js`
- `backend/controllers/*.js`
- `backend/models/dataStore.js`
- `backend/models/activityLogger.js`
- `backend/models/roleUtils.js`
- `backend/models/seedData.js`
- `backend/models/db.json`
- `frontend/pages/*.html`
- `frontend/js/*.js`
- `frontend/components/layout.js`
- `frontend/css/styles.css`

## Real Project Purpose

SSMS Pro is a role-aware academic operations dashboard. In practical terms, the system currently solves these internal use cases:

- Create and manage student records
- Mark and review attendance
- Record and analyze marks
- Generate PDF student reports
- Track activity logs
- Exchange simple teacher/student/admin messages
- Provide separate Admin, Teacher, and Student experiences
- Allow users to edit their own profile and theme

This is not a multi-tenant school ERP yet. It is a single-instance academic operations app with portfolio-grade UI ambition and MVP-grade data/auth infrastructure.

## Real Architecture Overview

### 1. Frontend architecture

The frontend is not component-framework-based. It is a collection of HTML entry pages plus page-specific JavaScript modules.

The pattern is:

1. Load an HTML page from Express
2. Load a page-specific JS module
3. Call `requireAuth()` for protected pages
4. Render the shared shell with `renderShell()` from `frontend/components/layout.js`
5. Fill the page body using `innerHTML`
6. Fetch backend data using `apiFetch()`
7. Render cards, tables, charts, and modals
8. Mutate the JSON-backed backend through API calls

The frontend is simple to trace because almost all behavior is visible in page modules, but it also means rendering, state, and business rules are duplicated across files.

### 2. Backend architecture

The backend is a direct Express app in `backend/server.js`.

There is no separate `app.js`, service layer, repository layer, or domain layer. The chain is:

- `server.js` mounts routes
- Each route file binds endpoints
- Controllers do authorization checks, validation, read/write, and response shaping
- `dataStore.js` reads/writes `db.json`
- `activityLogger.js` appends log entries
- `roleUtils.js` calculates role-based access

This makes the code easy to follow for a small project, but it also concentrates too much responsibility inside controllers.

### 3. Persistence architecture

Persistence is file-based.

`backend/models/dataStore.js` provides:

- `ensureDb()`
- `readDb()`
- `writeDb()`
- `createId()`

All collections live in a single JSON file:

- `users`
- `students`
- `attendance`
- `marks`
- `tasks`
- `logs`
- `messages`

This is effectively a document store without concurrency protection, query optimization, transactions, schema enforcement, or migration tooling.

### 4. Authentication architecture

There is no real session, JWT, or cookie-based auth layer.

Identity works like this:

- The frontend stores a sanitized user object in `localStorage` under `ssms-current-user`
- `apiFetch()` sends `x-user-id`
- `requireAuth` middleware finds the user in `db.json`
- The user is trusted if the ID exists

This is fine for local demos and unacceptable for production.

## Folder Structure Explanation

### `backend/`

- `server.js`
  Entry point, route mounting, static serving, page routing, 404 handler, startup boot.

- `routes/`
  Thin Express routers. These are mostly route-to-controller maps with `requireAuth` at router level.

- `controllers/`
  The main business logic layer. Validation, authorization, filtering, mutation, and response shaping all happen here.

- `models/dataStore.js`
  The actual persistence adapter. Everything eventually passes through this file.

- `models/activityLogger.js`
  Centralized helper for log creation. Important because multiple modules depend on it as a side effect.

- `models/roleUtils.js`
  The backend’s authoritative role/access helper. Critical dependency for authorization behavior.

- `models/seedData.js`
  Default starting data. Also acts as a fallback source during normalization.

- `models/db.json`
  Runtime datastore. This is not static sample data anymore; it is live application state.

### `frontend/`

- `pages/`
  HTML entry points. Each protected page only contains shell bootstrap HTML and script tags.

- `js/api.js`
  Shared frontend platform file. Handles fetch, auth state, role capabilities, theme state, and role-based filtering.

- `js/app.js`
  Shared UI helpers such as loading buttons, modal controller, averages, grade/remark helpers, and confirm modal.

- `components/layout.js`
  Shared dashboard shell: sidebar, topbar, global search box, profile dropdown, logout.

- `js/*.js`
  Page modules. Each page owns its own state, rendering, and event binding.

- `css/styles.css`
  Monolithic global stylesheet for every page and every component state.

## Main Workflows

### Login workflow

1. User visits `/login`
2. `frontend/js/login.js` validates fields
3. `POST /api/auth/login`
4. Backend checks email/password in `db.json`
5. Backend records a login activity log
6. Frontend stores the returned user in `localStorage`
7. User is redirected to `/dashboard`

### Dashboard workflow

1. `/dashboard` loads `frontend/js/dashboard.js`
2. `requireAuth()` checks `localStorage`
3. `renderShell()` builds the app chrome
4. Dashboard fetches students, attendance, marks, tasks, logs, messages, and users in parallel
5. Role-aware filters shape what the user sees
6. Charts and KPI cards are rendered client-side

### Student management workflow

1. `/students` loads `frontend/js/students.js`
2. Frontend fetches `/api/students`
3. User can search, filter, paginate, add, edit, delete, or generate report
4. Student create/update/delete mutates `db.json`
5. Student changes also create activity logs
6. Delete also cascades attendance and marks removal

### Attendance workflow

1. `/attendance` loads `frontend/js/attendance.js`
2. Frontend fetches students and attendance for selected date plus all attendance
3. A `Map` is built in memory per student for the day
4. User can mark all present/absent, then manually override
5. Save sends bulk records to `POST /api/attendance`
6. Backend upserts daily records and writes logs for changed items

### Performance workflow

1. `/performance` loads `frontend/js/performance.js`
2. Frontend fetches students, marks, attendance
3. Charts and summaries are calculated client-side
4. Marks can be added from the UI and deleted from the ledger
5. Grade and remark logic is duplicated in both frontend and backend

### Reporting workflow

1. Students page or profile page triggers report generation
2. Frontend fetches student data plus attendance and marks summaries
3. jsPDF builds the document fully client-side
4. A custom canvas chart is converted to image and embedded
5. The PDF is downloaded locally

### Messaging workflow

1. `/messages` loads `frontend/js/messages.js`
2. Frontend fetches user directory and message history
3. Allowed recipients are filtered client-side by role
4. Backend enforces sender-recipient role rules again
5. Admin can broadcast announcements via a special recipient value

## Feature Map

| Feature | Frontend | Backend | Data collections |
| --- | --- | --- | --- |
| Authentication | `login.js`, `signup.js`, `api.js` | `authRoutes.js`, `authController.js`, `authMiddleware.js` | `users`, `logs` |
| Dashboard | `dashboard.js`, `layout.js` | multiple route/controllers | all major collections |
| Students | `students.js` | `studentRoutes.js`, `studentController.js` | `students`, `attendance`, `marks`, `logs` |
| Attendance | `attendance.js` | `attendanceRoutes.js`, `attendanceController.js` | `attendance`, `logs` |
| Performance | `performance.js` | `markRoutes.js`, `marksController.js` | `marks`, `attendance`, `logs` |
| Tasks | `tasks.js` | `taskRoutes.js`, `taskController.js` | `tasks`, `logs` |
| Logs | `logs.js` | `logRoutes.js`, `logController.js` | `logs` |
| Messages | `messages.js` | `messageRoutes.js`, `messageController.js` | `messages`, `users` |
| Profile | `profile.js` | `authController.js` summary APIs from other modules | `users`, `students`, `attendance`, `marks` |
| Reporting | `students.js`, `profile.js` | summary endpoints from attendance/marks/students | `students`, `attendance`, `marks` |

## How It Works Internally

The most important system truth is that the app is role-aware, but not session-aware.

The second important truth is that most important pages are hydration-by-fetch pages:

- HTML page is minimal
- Shared shell is injected at runtime
- Page content is injected after that
- Data is then fetched and rendered

The third important truth is that the backend is really a JSON file mutation layer with Express around it.

Because of that, many pieces are coupled by shape rather than by explicit contracts:

- The frontend expects very specific response shapes
- The PDF engine expects summary payloads with exact fields
- Role checks depend on role strings normalizing consistently
- Subject analytics depend on hardcoded `SUBJECTS`
- Theme behavior depends on both backend user theme and `localStorage`

## Data Flow

### Standard protected page flow

`browser -> HTML page -> JS module -> requireAuth() -> renderShell() -> apiFetch() -> Express route -> middleware -> controller -> readDb() -> optional role filter -> response -> DOM render`

### Mutation flow

`user action -> page handler -> apiFetch(method != GET) -> controller validation -> readDb() -> mutation -> addActivityLog() -> writeDb() -> response -> page reload/re-render`

### Theme flow

`profile toggle or stored preference -> applyTheme() -> html[data-theme] + localStorage("ssms-theme") -> CSS variable switch`

## Important Functions

Backend:

- `ensureDb`, `readDb`, `writeDb`, `createId` in `backend/models/dataStore.js`
- `normalizeRole`, `canAccessStudent`, `filterStudentsByRole`, `filterStudentRecordsByRole` in `backend/models/roleUtils.js`
- `addActivityLog` in `backend/models/activityLogger.js`
- `requireAuth`, `requireRoles` in `backend/middleware/authMiddleware.js`

Frontend:

- `apiFetch`, `requireAuth`, `getRoleCapabilities`, `filterStudentsForUser`, `filterRecordsForUser` in `frontend/js/api.js`
- `renderShell` in `frontend/components/layout.js`
- `confirmAction`, `createModalController`, `average`, `getGrade`, `getRemark` in `frontend/js/app.js`

## Hidden Dependencies

- Unknown roles normalize to `Teacher` on both frontend and backend. This is a quiet privilege escalation risk.
- The system has two theme sources of truth: `user.theme` and `localStorage("ssms-theme")`.
- Default demo users are reintroduced by normalization logic if missing, because `normalizeDb()` merges fallback users.
- Teachers with missing assignments can silently fall back to `["12-A"]` during normalization.
- Student signup attempts to auto-link to a student record by matching email.
- Student deletion removes attendance and marks, but does not clean linked `users`, old `logs`, or message history references.
- Dashboard, attendance, and performance rely on client-side aggregation over entire datasets.
- Charts and PDF features depend on external CDNs for Chart.js and jsPDF.
- The global search box works only because `renderShell()` emits a custom `ssms:search` event that page modules listen for.

## Current Strengths

- The codebase is easy to read end-to-end because there is very little abstraction hiding behavior.
- Route and file naming is consistent enough that onboarding is fast.
- The UI feels much more productized than a typical basic CRUD college project.
- Role-aware filtering exists on both frontend and backend.
- The activity log model creates useful traceability for demo and debugging scenarios.
- The app has a strong “single machine, single project, easy to run” developer experience.

## Current Weaknesses

- Security is not production-grade.
- Persistence is not concurrency-safe.
- Controllers are doing too much.
- Business rules are duplicated across frontend and backend.
- CSS is monolithic and layered with conflicting design generations.
- There is no test harness, linting strategy, or automated regression protection.
- Many operations fetch all records and compute in memory.
- Some UI states are decorative rather than functional, such as the notification button.

## Technical Debt Areas

### Authentication debt

- Plaintext passwords
- Identity-by-header
- `localStorage`-driven trust
- No token expiration
- No rate limiting

### Data debt

- One-file datastore
- No schema validation library
- No migrations
- No transactional writes
- No referential integrity enforcement

### Frontend debt

- Repeated page initialization patterns
- Heavy `innerHTML` rendering
- Recomputed charts on every refresh
- Global CSS with duplicated overrides
- Repeated grade/remark logic

### Backend debt

- Async controllers without centralized error wrapper
- Inconsistent authorization style
- No service layer
- No response standardization
- No environment-specific configuration strategy

## What To Never Break

- The shape of `users`, `students`, `attendance`, `marks`, `tasks`, `logs`, and `messages` in `db.json`
- `x-user-id` propagation until proper auth replaces it
- Role normalization consistency between frontend and backend
- `studentId` linkage for student users
- `SUBJECTS` expectations in analytics and reports
- Summary endpoint payloads used by PDF generation
- Page route map in `backend/server.js`
- The localStorage keys:
  - `ssms-current-user`
  - `ssms-theme`

## Future Notes

This project is currently in the strongest possible state for one thing: being understood by one developer who wants to master the whole stack.

That means the next major version should not try to become “more advanced” everywhere at once. The safe path is:

1. Stabilize auth and data integrity first
2. Move business rules into reusable backend services
3. Replace file storage with a real database
4. Break the frontend into clearer modules/components
5. Only then add real-time features, multi-user collaboration, or SaaS concerns

The current version is best treated as a strong prototype and internal learning platform, not as a final production architecture.
