# Attendance Marks Analytics

## Purpose

This document explains the academic core of the project: attendance tracking, marks entry, grade/remark logic, chart rendering, summary calculations, and the analytics behavior that powers the dashboard, attendance page, performance page, student reports, and student profile summaries.

This is one of the most interconnected areas of the codebase. Changes here ripple into:

- dashboards
- reports
- logs
- student-facing views
- teacher workflows
- profile summaries

## Files Involved

Frontend:

- `frontend/js/attendance.js`
- `frontend/js/performance.js`
- `frontend/js/dashboard.js`
- `frontend/js/app.js`
- `frontend/js/api.js`

Backend:

- `backend/routes/attendanceRoutes.js`
- `backend/routes/markRoutes.js`
- `backend/controllers/attendanceController.js`
- `backend/controllers/marksController.js`
- `backend/models/roleUtils.js`
- `backend/models/activityLogger.js`
- `backend/models/db.json`

External dependencies:

- Chart.js loaded in:
  - `frontend/pages/dashboard.html`
  - `frontend/pages/performance.html`
  - `frontend/pages/attendance.html`

## How It Works Internally

The attendance and marks modules are separate backend domains, but they behave like a single academic system on the frontend.

Attendance is date-centric.

Marks are assessment-centric.

Analytics are mostly frontend-derived.

Summary endpoints exist for:

- student attendance summary
- student marks summary

But most dashboard and performance insights are still computed in the browser from full allowed datasets.

## Attendance Workflow

### Page boot

`attendance.js` initializes:

- `currentUser`
- `capabilities`
- `students`
- `allAttendance`
- `attendanceMap`
- `selectedDate`
- `search`

The selected date defaults to:

- `new Date().toISOString().split("T")[0]`

That means the app opens on the current machine date, not on the latest stored attendance date.

### Data load

`loadAttendance()` fetches:

- `/api/students`
- `/api/attendance?date=<selectedDate>`
- `/api/attendance`

Then it does three important things:

1. Stores visible students based on role
2. Stores the full allowed attendance history
3. Builds `attendanceMap` from the selected date

Any visible student missing from the selected date map is automatically inserted with status `absent`.

This is the biggest attendance UX/data assumption in the entire app.

### UI workflow

Teacher/Admin flow:

- select date
- mark all present or absent if needed
- adjust individuals manually
- save all students in bulk

Student flow:

- view-only attendance list
- view monthly summary
- no edit controls

## Mark All Present Logic

This lives entirely in `attendance.js`.

`markAllPresent()` iterates visible students and sets:

```js
state.attendanceMap.set(student.id, "present");
```

Then it:

- rerenders the rows
- recalculates summary cards
- rebuilds the pie chart

This is fast and simple because everything is local state until save.

## Manual Overrides

Manual override behavior:

- Each row has two status buttons
- Button click updates `attendanceMap`
- UI rerenders immediately
- Save is deferred until explicit button click

This is a solid optimistic-editing pattern for a simple app.

The weak point is not the override behavior. The weak point is the default assumption that “missing record means absent.”

## Attendance Save Logic

`saveAttendance()` sends every visible student for the selected date:

```json
{
  "date": "YYYY-MM-DD",
  "records": [
    { "studentId": "...", "status": "present|absent" }
  ]
}
```

Backend behavior in `attendanceController.saveAttendance()`:

1. Validate date and records array exist
2. Reject non-Admin/Teacher
3. For each entry:
   - ignore if missing `studentId` or `status`
   - ignore if student not found
   - ignore if teacher cannot access that student
   - upsert on `(date, studentId)`
4. Write activity logs for changed/new items
5. Persist db

Important consequence:

- Invalid statuses are not strongly validated
- Missing entries are silently ignored
- Saving after a fresh load on a date with no records can create a full absent batch unless the user changes statuses first

## Attendance Summary Logic

Backend summary endpoint:

- `GET /api/attendance/summary/:studentId`

Response fields:

- `totalDays`
- `present`
- `absent`
- `percentage`

Formula:

`percentage = present / totalDays * 100`

Frontend usage:

- Student report PDF
- Student profile page

## Attendance Page Analytics

### Daily summary cards

Calculated from `attendanceMap`:

- present count
- absent count
- coverage percentage

Coverage formula:

`attendanceMap.size / state.students.length`

Because `attendanceMap` is backfilled for every visible student, coverage usually hits `100%` after load, even when no actual records existed in storage yet for that date. That makes “coverage” visually reassuring but semantically misleading.

### Monthly summary

Calculated from all attendance records in the selected month:

- present count per student
- absent count per student
- attendance percentage per student
- monthly average across visible students

Important subtlety:

- Students with no records in the month still contribute `0%` to the overall monthly average
- Newly added students therefore depress monthly averages until they have records

## Marks Entry System

### Page boot

`performance.js` loads:

- students
- marks
- attendance

Role decides whether the marks form is shown.

### Add marks flow

Frontend:

1. User selects student
2. User selects subject from `SUBJECTS`
3. User enters score and exam type
4. `POST /api/marks`
5. Page reloads all data

Backend:

1. Validate student, subject, score
2. Convert score to number
3. Enforce `0..100`
4. Reject non-Admin/Teacher
5. Verify student exists and is accessible
6. Create marks entry
7. Log the change
8. Persist

### Delete marks flow

Frontend:

- delete only, no edit UI

Backend:

- update endpoint exists
- delete endpoint exists

This means the backend is more capable than the current UI exposes.

## Marks Data Model

Marks record shape:

```json
{
  "id": "mark_xxxxxxxx",
  "studentId": "student_xxxxxxxx",
  "subject": "Mathematics",
  "score": 92,
  "examType": "Term Assessment"
}
```

Important limitations:

- No exam date
- No weight
- No max marks field
- No term/semester linkage
- No unique rule for student+subject+examType

This means multiple entries can accumulate for the same subject and student, which may be fine for assessments but is not explicitly modeled.

## Grade Calculations

Grade logic exists in both:

- `frontend/js/app.js`
- `backend/controllers/marksController.js`

Thresholds:

- `>= 90` -> `A+`
- `>= 80` -> `A`
- `>= 70` -> `B`
- `>= 60` -> `C`
- `>= 50` -> `D`
- otherwise -> `Needs Support`

## Remark Calculations

Remark logic also exists in both frontend and backend.

Thresholds:

- `>= 80` -> `Excellent`
- `>= 60` -> `Good`
- otherwise -> `Needs Improvement`

Important risk:

- Duplicated business logic will drift if one side changes first

## Performance Page Analytics Calculations

### Summary cards

Calculated from relevant marks:

- total marks
- average marks
- top subject
- grade
- remark

### Subject breakdown

For each subject in `SUBJECTS`, the page calculates average score across relevant marks.

Important hidden dependency:

- Only subjects present in `SUBJECTS` appear in this breakdown
- Any marks stored with a new subject string outside that constant will exist in the ledger but disappear from the charts and breakdown summaries

### Insights block

Three insight cards are rendered:

- top performer
- low attendance warning
- weak subjects

Weak subject rule:

- subject average above `0`
- below `60`

Attendance risk rule:

- first student found with attendance below `75%`

That is not “worst student” logic. It is “first matching student in current array order” logic.

## Chart.js Integration

Chart.js is used in three places:

### `attendance.js`

- Pie chart for present vs absent on selected day

### `dashboard.js`

- Bar chart for marks overview
- Line chart for attendance trend over recent dates

### `performance.js`

- Bar chart for subject averages
- Line chart for selected student scores across subjects

Current chart implementation pattern:

- destroy old chart if it exists
- create new chart instance from scratch

This is simple but not efficient for large datasets or frequent updates.

## Dashboard Analytics Logic

The dashboard reuses academic data in a more executive way.

It calculates:

- attendance rate across visible records
- average marks across visible marks
- present today count
- student average ranking
- recent activity preview

Important weakness:

- “today” uses the current machine date, not the latest attendance date in storage
- if the stored records are historical, “Present Today” can misleadingly show `0`

## Data Flow

### Attendance flow

`attendance page -> students + attendance APIs -> local Map -> daily summary + pie chart -> save bulk -> backend upsert -> logs`

### Marks flow

`performance page -> students + marks + attendance APIs -> marks summary + charts + insight cards -> add/delete -> backend mutation -> logs`

### Reporting flow dependency

`student/profile report -> summary endpoints -> grade/remark fields -> PDF`

## Important Functions

Frontend:

- `loadAttendance()` in `attendance.js`
- `updateSummary()` in `attendance.js`
- `updateMonthlySummary()` in `attendance.js`
- `saveAttendance()` in `attendance.js`
- `renderSummaryAndBreakdown()` in `performance.js`
- `renderInsights()` in `performance.js`
- `renderCharts()` in `performance.js`
- `handleMarksSubmit()` in `performance.js`

Backend:

- `saveAttendance()` in `attendanceController.js`
- `getAttendanceSummary()` in `attendanceController.js`
- `addMark()` in `marksController.js`
- `deleteMark()` in `marksController.js`
- `getMarksSummary()` in `marksController.js`

## Hidden Dependencies

- `SUBJECTS` order controls analytics shape and chart labels
- Role filtering must match between frontend capability assumptions and backend scoping
- Marks summary response is consumed by both reports and profile page
- Attendance summary response is consumed by both reports and profile page
- Grade/remark duplication must stay aligned across layers

## Performance Bottlenecks

- Full attendance history is fetched on every attendance page reload
- Full marks, attendance, and students are fetched for performance analytics
- Most averages are computed with repeated nested filtering
- Charts are destroyed and recreated rather than updated
- No server-side aggregation exists for dashboard analytics

## Common Mistakes

- Adding a new subject string without updating `SUBJECTS`
- Assuming missing attendance means unmarked when the UI treats it as absent
- Forgetting that performance charts and summary cards do not all honor the same student filter
- Assuming the marks update endpoint is used from the UI
- Changing grade thresholds in one layer only

## How To Improve

### Attendance improvements

- Introduce a third state: `unmarked`
- Save only explicitly marked entries, not forced absent defaults
- Add status enum validation in backend
- Add attendance session metadata like class, period, or teacher

### Marks improvements

- Add exam date
- Add term/semester
- Add score max/weight
- Add edit UI, not just delete
- Add duplicate detection or formal multi-assessment modeling

### Analytics improvements

- Move heavy calculations server-side
- Add trend-over-time analytics by exam date
- Add class-level averages and comparison cohorts
- Add real risk scoring combining attendance + marks

## What To Never Break

- Attendance record shape:
  - `studentId`
  - `date`
  - `status`
- Marks record shape:
  - `studentId`
  - `subject`
  - `score`
  - `examType`
- Summary endpoint fields used by PDF and profile pages
- Subject constant or any replacement mechanism that keeps analytics complete
- Role-based visibility around student data

## Future Notes

This module is the academic intelligence layer of the whole app. If it becomes more explicit and more data-correct, the product instantly feels much more serious.

The best next evolution is:

1. stop treating absence as the default state of missing data
2. formalize assessments
3. centralize grade/remark rules
4. move expensive analytics to backend or database queries

That alone would make the app feel closer to a real institution system instead of a polished demo.
