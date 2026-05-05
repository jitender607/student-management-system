# PDF Report Engine

## Purpose

This document explains how PDF reporting works today, where the report data comes from, how the layout is built, why the current output works for a small controlled dataset, and what must change if the reporting feature is expected to feel professional or handle more complex academic history.

## Files Involved

Frontend report generators:

- `frontend/js/students.js`
- `frontend/js/profile.js`

Supporting helpers:

- `frontend/js/app.js`
- `frontend/js/api.js`

Backend data sources:

- `backend/controllers/studentController.js`
- `backend/controllers/attendanceController.js`
- `backend/controllers/marksController.js`

HTML dependencies:

- `frontend/pages/students.html`
- `frontend/pages/profile.html`

External dependency:

- jsPDF from CDN:
  - `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`

## How It Works Internally

There are effectively two client-side report generators:

### 1. Full student report

Located in `frontend/js/students.js` inside `generateReport(id)`.

This is the richer, more designed report.

### 2. Profile report

Located in `frontend/js/profile.js` inside `generateProfileReport()`.

This is a simpler student-self-service report tied to the logged-in student profile.

Both use jsPDF directly in the browser.

Neither uses a server-side reporting engine.

Neither uses a shared report-template module.

## jsPDF Setup

The pages load jsPDF via CDN and access it through:

```js
const { jsPDF } = window.jspdf;
const doc = new jsPDF();
```

Important implications:

- Reporting fails if the CDN is blocked or unavailable
- There is no package-lock control over jsPDF version on the frontend
- The feature is runtime-coupled to page HTML, not only to JS imports

## Data Gathering Process

### Students page report

`generateReport(id)` fetches three endpoints in parallel:

- `/api/students/:id`
- `/api/attendance/summary/:id`
- `/api/marks/summary/:id`

This gives it:

- student identity data
- attendance totals and percentage
- marks totals, average, grade, remark, and subject array

### Profile page report

The profile page preloads:

- linked student record
- attendance summary
- marks summary

Then `generateProfileReport()` uses the already-fetched state instead of re-fetching.

## Layout Logic

The current report engine is coordinate-driven.

Everything is positioned manually:

- header bars
- section titles
- info blocks
- marks rows
- chart image
- signature line
- footer strip

Examples from `students.js`:

- purple top strip
- blue header block
- two side-by-side summary cards
- subject table
- marks chart image placed at fixed coordinates

This is visually nice for a controlled number of rows and fragile when data volume changes.

## Styling System

The PDF styling is not driven by CSS.

It is hardcoded in jsPDF calls:

- `setFillColor()`
- `setTextColor()`
- `setFont()`
- `setFontSize()`
- `rect()`
- `roundedRect()`
- `line()`
- `text()`
- `addImage()`

There is no shared style configuration object, no theme token system, and no reusable report renderer abstraction.

The report design language currently mirrors the product’s purple-blue premium UI, but only by repeated hardcoded numbers.

## Dynamic Content Generation

### Students page

Dynamic content includes:

- student name, roll number, class, ID, email, phone
- attendance totals
- marks totals and average
- subject rows from `marksSummary.subjects`
- grade and remark
- generated date
- custom chart image

### Profile page

Dynamic content includes:

- linked student identity
- attendance summary
- marks per subject
- total, average, grade, remark

## Chart Generation Logic

The students page report uses a custom chart image generated in-browser by `createMarksChartImage(subjects)`.

This function:

- creates an off-screen canvas
- draws axes
- draws bars for each subject
- writes numeric score labels
- writes truncated subject labels
- exports the canvas as PNG

Important detail:

- This is not a screenshot of the existing Chart.js chart
- It is a second charting implementation written specifically for the PDF

That means the report chart and the app chart can drift visually and semantically over time.

## Important Functions

- `createMarksChartImage()` in `frontend/js/students.js`
- `generateReport()` in `frontend/js/students.js`
- `generateProfileReport()` in `frontend/js/profile.js`
- `getAttendanceSummary()` in `backend/controllers/attendanceController.js`
- `getMarksSummary()` in `backend/controllers/marksController.js`
- `getStudentById()` in `backend/controllers/studentController.js`

## Hidden Dependencies

- jsPDF must be loaded globally before the page script runs
- `marksSummary.subjects` must exist and use the expected shape
- `marksSummary.grade` and `marksSummary.remark` are assumed to be present
- `formatDateLabel()` is reused for PDF generation timestamps
- Student report generation depends on backend access rules allowing the current role to fetch all three resources

## Common PDF Bugs

### 1. Content overflow

The report uses fixed Y positions.

If `marksSummary.subjects` grows too large:

- subject rows can collide with the chart
- remarks/signature/footer can overlap content

### 2. Long text overflow

Long student names, emails, or class labels can exceed the intended width because the layout uses `text()` without robust wrapping.

### 3. Inconsistent report designs

Students page report and profile report are visually different and architecturally separate.

That makes future maintenance harder.

### 4. Chart truncation

Subject labels are truncated with `entry.subject.slice(0, 10)`, which helps fit but can create ambiguous labels if several subjects share a prefix.

### 5. Missing library failure

If jsPDF does not load, report generation will fail at runtime.

The error is caught and surfaced as a toast, but the root cause remains page dependency failure.

## Common Mistakes

- Changing summary endpoint fields without updating PDF code
- Assuming report layout will adapt automatically to more rows
- Adding richer marks history without redesigning the subject table
- Treating the profile report and full report as one shared system when they are actually separate implementations
- Forgetting that the report chart is custom canvas code, not Chart.js reuse

## How To Redesign Report Professionally

### Short-term redesign

- Extract a shared report theme object
- Extract a shared “student academic report builder” helper
- Standardize typography, spacing, and section layout between profile and students reports
- Add text wrapping helpers for long values
- Add row overflow detection before chart placement

### Medium-term redesign

- Add auto page-break logic
- Split report sections into composable render functions:
  - header
  - student info
  - attendance card
  - marks summary card
  - subject table
  - chart section
  - footer
- Use shared metadata like school logo, organization name, report version

### Long-term redesign

- Generate PDFs server-side for consistency and auditability
- Support branded themes per institution
- Add export queues for batch report generation
- Add print-ready HTML reports as an alternative to jsPDF

## Export Enhancements

Strong next enhancements:

- batch export all students in a class
- CSV export for marks and attendance
- term-wise report versions
- report watermark support
- report verification code / generated ID
- print preview before download
- email report delivery

## Data Flow

### Students page report flow

`row action -> fetch student + attendance summary + marks summary -> build jsPDF -> download file`

### Profile report flow

`profile page state -> build jsPDF -> download file`

## How To Improve

- Deduplicate the two report generators
- Introduce a report layout engine instead of raw inline coordinates everywhere
- Keep report data contracts versioned
- Move chart rendering to a reusable helper or snapshot the on-screen chart intentionally
- Add defensive logic for empty or large subject arrays

## What To Never Break

- Summary endpoint fields:
  - `totalDays`
  - `present`
  - `absent`
  - `percentage`
  - `subjects`
  - `total`
  - `average`
  - `grade`
  - `remark`
- `window.jspdf` availability on report pages
- Student fetch endpoint access checks
- Filename generation rules if downstream workflows depend on them

## Future Notes

The current report engine is good enough to impress in demos because the data volume is small and the layout is visually intentional.

It is not yet a professional reporting system.

The real upgrade path is:

1. unify both report implementations
2. stop hardcoding so many coordinates
3. support variable-length academic histories
4. decide whether reports should remain client-generated or become authoritative server-generated documents

That decision should happen before adding more reporting complexity.
