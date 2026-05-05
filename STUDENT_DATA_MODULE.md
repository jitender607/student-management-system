# Student Data Module

## Purpose

This document explains how student records behave end-to-end: object shape, CRUD flow, filtering logic, report generation touchpoints, consistency risks, and the exact places where student data leaks into other parts of the system such as marks, attendance, logs, auth, and profile logic.

## Files Involved

Frontend:

- `frontend/js/students.js`
- `frontend/js/api.js`
- `frontend/js/app.js`
- `frontend/components/layout.js`

Backend:

- `backend/routes/studentRoutes.js`
- `backend/controllers/studentController.js`
- `backend/controllers/attendanceController.js`
- `backend/controllers/marksController.js`
- `backend/controllers/authController.js`
- `backend/models/roleUtils.js`
- `backend/models/activityLogger.js`
- `backend/models/dataStore.js`
- `backend/models/db.json`

Related summary/report files:

- `frontend/js/profile.js`

## Student Object Structure

Current student record shape:

```json
{
  "id": "student_xxxxxxxx",
  "name": "Student Name",
  "rollNo": "SSMS-001",
  "className": "12-A",
  "email": "student@schoolmail.com",
  "phone": "9876501001"
}
```

Observations:

- This is intentionally flat
- There is no address, guardian, DOB, admission date, status, section hierarchy, or metadata block
- `className` is a raw string, not a foreign key
- There is no separate profile table or extended student detail model

## How It Works Internally

The student module is split between:

- frontend directory management in `students.js`
- backend CRUD in `studentController.js`
- cross-module summaries via marks and attendance

The frontend keeps a local state object:

- `students`
- `filteredStudents`
- `search`
- `className`
- `editingId`
- `page`
- `pageSize`

The backend uses `filterStudentsByRole()` and `canAccessStudent()` to enforce scope.

## Add Student Flow

### Frontend

1. User opens modal from `Add Student`
2. `openStudentForm()` resets the form and clears `editingId`
3. Submit triggers `saveStudent()`
4. Form values are trimmed and assembled into payload
5. `POST /api/students`
6. On success, modal closes and students reload

### Backend

1. `createStudent()` validates presence of all fields
2. `readDb()` loads current state
3. Role must be Admin or Teacher
4. Duplicate `rollNo` is rejected
5. A new ID is created with `createId("student")`
6. Student is pushed into `db.students`
7. Activity log is added
8. `writeDb()` persists the change

Important note:

- No user account is created automatically for the new student
- No marks or attendance seed records are created automatically

## Edit Student Flow

### Frontend

1. User clicks `Edit`
2. The existing student record is found in local state
3. Modal is prefilled
4. `editingId` is set
5. Submit sends `PUT /api/students/:id`
6. On success, students reload

### Backend

1. `updateStudent()` locates the student by ID
2. Role must be Admin or Teacher
3. Access is checked with `canAccessStudent()`
4. Incoming fields are merged onto the old student object
5. Validation checks final merged object
6. Duplicate roll number is rejected
7. Activity log is created
8. Updated database is written

Important note:

- Update is merge-based, so missing fields keep old values
- There is no field-level audit trail beyond the generic activity log message

## Delete Student Flow

### Frontend

1. User clicks `Delete`
2. `confirmAction()` opens a confirmation modal
3. On confirm, `DELETE /api/students/:id`
4. Students reload after success

### Backend

1. `deleteStudent()` verifies role and access
2. Student is removed from `db.students`
3. All attendance records for that `studentId` are removed
4. All marks records for that `studentId` are removed
5. Activity log is added
6. Database is written

Important risk:

- Linked student users are not updated
- Existing logs referencing that student are not cleaned
- Messages are not touched

This is the single biggest student-module consistency hazard.

## Search Logic

The frontend uses client-side search on already-fetched student data.

Fields searched:

- `name`
- `rollNo`
- `className`
- `email`

Source:

- `students.js -> applyFilters()`

The backend also supports:

- `search`
- `className`

via query parameters in `getStudents()`, but the current students page does not use those query params for live filtering. It fetches the allowed directory and filters in memory.

## Filtering

There are two filter layers.

### Backend filtering

`getStudents()` calls `filterStudentsByRole(db.students, req.currentUser)`.

That means:

- Admin sees all students
- Student sees only the linked student
- Teacher sees students allowed by assigned classes or assigned IDs

### Frontend filtering

After fetch, `students.js` applies:

- keyword search
- class dropdown filter
- pagination

The class dropdown options are derived from currently visible students only.

Important implication:

- Teachers do not even see hidden class options, which is good for UX and reinforces limited scope

## Sorting

Sorting is primarily backend-controlled.

`studentController.getStudents()` sorts students by:

- `name.localeCompare()`

The frontend preserves the returned order and only filters/paginates it.

There is no user-controlled sort UI for:

- class
- roll number
- created date

## Profile Page Logic

There is no dedicated student detail page in this project.

This is important because the name “profile” can be misleading.

What actually exists:

- `profile.html` is a user-account page
- Student users see their linked academic summary there
- Student rows on the students page only support edit/delete/report
- Backend summary endpoints provide “student detail” data indirectly

So the current system has:

- student directory page
- user profile page
- no standalone student profile page

If a true student profile page is added later, it should not be confused with the existing user profile page.

## Data Flow

### Student listing flow

`students.js -> GET /api/students -> role filter in backend -> frontend filters -> table render`

### Student create/update/delete flow

`modal form -> apiFetch -> studentController -> db mutation -> addActivityLog -> writeDb -> reload table`

### Student report flow

`students.js -> GET student + attendance summary + marks summary -> jsPDF generation`

### Student-linked account flow

`authController.signup() -> optional email-based student linking -> user.studentId`

## Important Functions

Frontend:

- `buildContent()` in `students.js`
- `applyFilters()` in `students.js`
- `renderStudents()` in `students.js`
- `openStudentForm()` in `students.js`
- `saveStudent()` in `students.js`
- `deleteStudent()` in `students.js`
- `generateReport()` in `students.js`

Backend:

- `validateStudent()` in `studentController.js`
- `getStudents()` in `studentController.js`
- `getStudentById()` in `studentController.js`
- `createStudent()` in `studentController.js`
- `updateStudent()` in `studentController.js`
- `deleteStudent()` in `studentController.js`
- `canAccessStudent()` in `roleUtils.js`

## Hidden Dependencies

- Student reports depend on attendance and marks summary endpoints
- Student login experience depends on `user.studentId`
- Student signup auto-link depends on matching student email
- Teacher access scope depends on assignment fields in the user object
- Student deletion assumes attendance and marks should be hard-deleted
- Search and reporting assume field names stay exactly:
  - `name`
  - `rollNo`
  - `className`
  - `email`
  - `phone`

## Common Mistakes

- Assuming creating a student also creates a login
- Deleting a student without considering linked student users
- Changing `rollNo` uniqueness rules without thinking about external identity expectations
- Adding new student fields only in the frontend form but not backend validation
- Treating email as unique in student records when the backend does not enforce it
- Forgetting that backend search exists but frontend currently filters locally

## Common Bugs / Risks

### 1. User-student linkage drift

If a linked student record is deleted, the student user remains with a stale `studentId`.

Likely symptoms:

- profile summary fetches fail
- student dashboard becomes partial or empty
- student logs view becomes inconsistent

### 2. Duplicate or conflicting emails

Student creation does not enforce unique email among students or against users.

This can create:

- ambiguous future student signup linking
- confusing directory data

### 3. Partial academic history

New students do not automatically receive baseline marks or attendance entries.

This leads to:

- empty summaries
- dashboard averages that include zeros or missing context
- monthly averages that can be distorted

### 4. Class naming inconsistency

`className` is a free text string.

That means:

- `12-A`
- `12-A `
- `12a`
- `BCA AI ML`

are all effectively different labels unless normalized manually.

## Data Consistency Risks

- No transaction when deleting student plus dependent records
- Logs retain references to removed students
- Messages are not tied to students directly, only users
- No lifecycle state like active/inactive/alumni
- No join table for classes or enrollments

## How To Improve

### Short-term

- Enforce unique student email if that is meant to be identity-linked
- Validate class names consistently
- When deleting a student, also check for linked user accounts
- Add optional “soft delete” instead of hard delete
- Add server-side validation for email and phone format

### Medium-term

- Create a dedicated student detail page
- Separate academic profile from identity profile
- Add admission metadata and status fields
- Add backend support for server-side pagination and filtering

### Long-term database mapping

Recommended relational model:

- `students`
  - id
  - name
  - roll_no
  - class_id
  - email
  - phone
  - status
- `users`
  - id
  - name
  - email
  - password_hash
  - role
  - theme
- `student_user_links`
  - user_id
  - student_id
- `classes`
  - id
  - code
  - label
  - section

If using MongoDB, keep a `students` collection but still formalize:

- normalized class metadata
- student-user linking
- soft delete and status fields

## What To Never Break

- Student record field names used across reports and summaries
- Roll number uniqueness unless a migration plan exists
- `studentId` references inside marks/attendance
- Role-based student scoping via `canAccessStudent()`
- Delete cascade for marks and attendance unless replaced by archival logic

## Future Notes

The student module is the center of gravity for the whole project.

If student data becomes cleaner and more relational, these other modules get easier automatically:

- auth
- attendance
- marks
- reporting
- analytics
- logs

If student data stays loose and string-based, every future feature will become harder.
