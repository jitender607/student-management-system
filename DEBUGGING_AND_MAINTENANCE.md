# Debugging And Maintenance

## Purpose

This document is the maintenance playbook for the current codebase. It focuses on likely failure points, debugging strategy, safe edit zones, dangerous edit zones, and the exact kinds of bugs that are most likely to appear based on the current architecture.

The goal is not to document ideal behavior. The goal is to help you fix real problems quickly without breaking adjacent features.

## Files Involved

Core files to inspect first in most bugs:

- `backend/server.js`
- `backend/models/db.json`
- `backend/models/dataStore.js`
- `backend/models/roleUtils.js`
- `backend/middleware/authMiddleware.js`
- `frontend/js/api.js`
- `frontend/components/layout.js`
- `frontend/css/styles.css`

Domain files by symptom:

- Students: `frontend/js/students.js`, `backend/controllers/studentController.js`
- Attendance: `frontend/js/attendance.js`, `backend/controllers/attendanceController.js`
- Performance/marks: `frontend/js/performance.js`, `backend/controllers/marksController.js`
- Reports: `frontend/js/students.js`, `frontend/js/profile.js`
- Logs: `frontend/js/logs.js`, `backend/controllers/logController.js`
- Messages: `frontend/js/messages.js`, `backend/controllers/messageController.js`
- Tasks: `frontend/js/tasks.js`, `backend/controllers/taskController.js`
- Profile/Auth: `frontend/js/profile.js`, `frontend/js/login.js`, `frontend/js/signup.js`, `backend/controllers/authController.js`

## How It Works Internally

Most bugs in this project come from one of five root causes:

1. Client-side state assumptions
2. Role/access mismatches
3. `db.json` data drift
4. Unsynchronized duplicated logic across frontend and backend
5. Global CSS side effects

Because the app is small and direct, debugging usually means tracing:

`page JS -> shared helper -> API endpoint -> controller -> db.json`

That is a strength. Use it.

## Most Likely Bugs In Current Project

### 1. Auth identity drift

Symptoms:

- random 401 errors
- user suddenly redirected to login
- actions fail after data edits

Likely causes:

- `localStorage("ssms-current-user")` contains a stale or removed user
- `apiFetch()` sends an invalid `x-user-id`
- `requireAuth` cannot find the user in `db.json`

Where to check:

- `frontend/js/api.js`
- `backend/middleware/authMiddleware.js`
- `backend/models/db.json`

### 2. Student delete breaks student account

Symptoms:

- student login still works but profile/dashboard data is missing
- summary endpoints start returning 404

Root cause:

- deleting a student removes student, marks, attendance
- linked `user.studentId` is not cleaned

Where to check:

- `backend/controllers/studentController.js`
- `backend/controllers/authController.js`
- `backend/models/db.json`

### 3. Attendance looks wrong on new dates

Symptoms:

- all students appear absent on a new date
- coverage looks full before records exist

Root cause:

- missing daily records are defaulted to `absent` in `attendance.js`

Where to check:

- `frontend/js/attendance.js`

### 4. Performance charts do not match selected student filter

Symptoms:

- summary cards change but subject chart does not
- line chart and bar chart seem to describe different scopes

Root cause:

- `renderCharts()` uses all marks for subject averages
- selected student affects only part of the analytics

Where to check:

- `frontend/js/performance.js`

### 5. PDF overlaps or cuts off content

Symptoms:

- chart overlaps marks rows
- long names or emails run off the page
- report looks fine for one student and broken for another

Root cause:

- fixed coordinate layout
- no dynamic pagination

Where to check:

- `frontend/js/students.js`
- `frontend/js/profile.js`

### 6. CSS changes create unrelated UI regressions

Symptoms:

- corner radius or panel styles change everywhere
- dark mode shifts unexpectedly
- mobile layout breaks after small visual edits

Root cause:

- monolithic global stylesheet
- duplicated token layers

Where to check:

- `frontend/css/styles.css`

### 7. XSS-like rendering issues

Symptoms:

- strange layout break after entering special text
- HTML-like strings render as markup

Root cause:

- unsanitized values injected through `innerHTML`

Where to check:

- all page render functions using template strings

## File Dependency Risks

### High-risk core dependencies

- `frontend/js/api.js`
- `backend/models/roleUtils.js`
- `backend/models/dataStore.js`
- `frontend/components/layout.js`
- `frontend/css/styles.css`

Why they are dangerous:

- they affect multiple pages/domains
- they encode hidden global assumptions

### Medium-risk shared contracts

- marks summary response shape
- attendance summary response shape
- student record field names
- localStorage keys
- subject constant list

### Runtime dependency file

- `backend/models/db.json`

This file is both datastore and bug source. Bad edits here can mimic app logic bugs even when the code is fine.

## Sidebar Issues

Common sidebar/topbar issues:

- nav item missing after adding a new page
- role-specific links not visible
- active nav styling incorrect
- search event not reaching the page
- dropdown behavior duplicated after rerenders

Where to debug:

- `frontend/components/layout.js`
- `frontend/js/api.js`
- `backend/server.js`

Important note:

- adding a page requires both backend route mapping and layout nav mapping

## Search Bugs

Likely search problems:

- search appears to do nothing on a page
- search filters only visible client-side data and not all records
- placeholder implies global search but behavior is page-local

Debug method:

1. confirm the page uses `renderShell()`
2. confirm the page subscribes to `ssms:search`
3. confirm the page updates `state.search`
4. confirm render function uses `state.search`

Check:

- `frontend/components/layout.js`
- target page module

## Attendance Bugs

Most common attendance debugging checklist:

1. Check selected date
2. Check visible students returned from `/api/students`
3. Check `/api/attendance?date=...` response
4. Inspect `attendanceMap` building logic
5. Check whether missing records are being interpreted as absent
6. Verify save payload contains expected statuses
7. Inspect `db.json` after save

Files:

- `frontend/js/attendance.js`
- `backend/controllers/attendanceController.js`

## PDF Issues

PDF debugging checklist:

1. Confirm jsPDF CDN loaded
2. Confirm summary endpoints return expected fields
3. Check if subject count is larger than layout budget
4. Check long-value wrapping risk
5. Compare student report vs profile report paths

Files:

- `frontend/pages/students.html`
- `frontend/pages/profile.html`
- `frontend/js/students.js`
- `frontend/js/profile.js`

## Route Failures

If a route fails, debug in this order:

1. Is the page HTML route mapped in `backend/server.js`?
2. Is the API route mounted in `server.js`?
3. Does the route file define the endpoint?
4. Is `requireAuth` rejecting the request?
5. Is the controller doing extra role/access rejection?
6. Is `db.json` missing the required entity?

Common causes:

- stale `x-user-id`
- student access denied due to broken `studentId`
- teacher cannot access class/student by assignment
- deleted record still referenced from frontend

## CSS Conflicts

The stylesheet has layered overrides, so visual bugs often come from later declarations silently winning.

Debug method:

1. Find selector in `styles.css`
2. Search for duplicate or later overrides
3. Check root variable definitions in both theme blocks
4. Inspect media query overrides

High-conflict zones:

- `:root`
- `html[data-theme="dark"]`
- shared card classes
- responsive breakpoints

## How To Debug Systematically

### Step 1: reproduce from the correct role

Many bugs are role-specific. Always know whether you are reproducing as:

- Admin
- Teacher
- Student

### Step 2: inspect the live data

Because `db.json` is the real datastore, always verify:

- the entity exists
- the IDs match
- the linking fields are valid

### Step 3: inspect network requests

For protected pages:

- confirm `x-user-id` is being sent
- confirm endpoint returns expected JSON
- confirm the right route is being hit

### Step 4: compare frontend state to backend response

Many bugs are not backend failures. They are render assumptions after a correct response.

### Step 5: check logs for side effects

Mutations usually write logs. If the main data changed but no log exists, inspect mutation path.

## Safe Editing Zones

These are relatively safe to modify if you stay within current contracts:

- page copy text
- empty-state wording
- card layout markup inside a single page module
- non-shared page-specific visuals
- adding new summary cards that only read existing data

## Dangerous Editing Zones

These need extra caution:

- `frontend/js/api.js`
- `backend/models/roleUtils.js`
- `backend/models/dataStore.js`
- `frontend/components/layout.js`
- `backend/middleware/authMiddleware.js`
- `frontend/css/styles.css` root tokens and shared selectors
- summary endpoint response shapes
- `SUBJECTS` constant

Changing these can create broad regressions.

## How To Safely Modify Project

Recommended workflow for non-trivial changes:

1. Inspect current `db.json`
2. Trace the feature across frontend and backend files
3. Identify shared contracts before editing
4. Make the smallest change possible
5. Retest by role
6. Check related pages, not just the page you changed

For data-structure changes:

1. update seed data
2. update normalization logic
3. update controllers
4. update frontend rendering
5. update any report code

## Common Mistakes

- Editing only frontend logic when backend contract also changed
- Editing only backend logic when duplicated frontend logic also exists
- Forgetting to test as Student after changing Admin/Teacher flows
- Hand-editing `db.json` carelessly and misdiagnosing the resulting bug as code failure
- Adding fields to one collection without deciding how old records should normalize

## What To Never Break

- `ssms-current-user` and `ssms-theme` localStorage contracts
- role normalization behavior, unless intentionally redesigned everywhere
- summary endpoint shapes for attendance/marks
- `studentId` relationships between users and students
- `readDb()` / `writeDb()` full-database behavior
- shell search event and nav routing contracts

## Future Notes

This project is debug-friendly because it is not abstract. Lean into that.

The right maintenance mindset is:

- trace the full flow
- verify data shape early
- distrust assumptions more than code
- change shared contracts carefully

If you do that, this codebase is very teachable and very maintainable, even with its current technical debt.
