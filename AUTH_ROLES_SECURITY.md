# Auth Roles Security

## Purpose

This document explains the real authentication model, role system, route protection mechanics, security weaknesses, and the upgrade path toward something trustworthy. The most important thing to understand is that the current system looks role-aware, but it is not secure in the way a production auth system needs to be secure.

## Files Involved

Frontend:

- `frontend/js/api.js`
- `frontend/js/login.js`
- `frontend/js/signup.js`
- `frontend/js/profile.js`
- `frontend/components/layout.js`

Backend:

- `backend/middleware/authMiddleware.js`
- `backend/controllers/authController.js`
- `backend/controllers/studentController.js`
- `backend/controllers/attendanceController.js`
- `backend/controllers/marksController.js`
- `backend/controllers/taskController.js`
- `backend/controllers/logController.js`
- `backend/controllers/messageController.js`
- `backend/models/roleUtils.js`
- `backend/models/dataStore.js`
- `backend/models/seedData.js`
- `backend/models/db.json`

## Login Flow

### Frontend flow

1. `frontend/js/login.js` reads email and password from the form
2. It calls `apiFetch("/auth/login", { method: "POST", body })`
3. On success, `setCurrentUser(response.user)` stores the user in `localStorage`
4. `applyTheme()` applies user theme
5. The browser redirects to `/dashboard`

### Backend flow

1. `authController.login()` receives email/password
2. `readDb()` loads `db.json`
3. Backend searches for a user whose `email` and `password` both match
4. On success, it creates a login activity log
5. It returns the sanitized user object

Important reality:

- There is no hashing
- There is no token issuing
- There is no signed session

## Signup Flow

### Frontend flow

1. `frontend/js/signup.js` validates name/email/password/confirm password
2. It sends the payload to `POST /api/auth/signup`
3. On success, it stores the returned user locally and redirects to `/dashboard`

### Backend flow

1. `authController.signup()` validates required fields
2. It rejects duplicate email
3. It normalizes role
4. If the new user is a Student, it tries to auto-link a `studentId` by matching the student record email
5. It creates the user and stores it in `db.json`

Important reality:

- The signup form lets the user choose `Admin`
- That is acceptable for a demo and dangerous for any serious environment

## Session / Token Logic

The honest answer is: there is no real session or token logic.

What exists instead:

- `localStorage("ssms-current-user")`
- `apiFetch()` attaching `x-user-id`
- Backend lookup of that user ID on every protected request

The flow is:

1. Frontend trusts the locally stored user
2. Backend trusts the user ID sent by the client if it exists in `db.json`

This means the app has identity transport, not authentication security.

## Role System

Role normalization exists in both:

- `frontend/js/api.js`
- `backend/models/roleUtils.js`

Supported normalized roles:

- `Admin`
- `Teacher`
- `Student`

Important risk:

- Unknown roles silently normalize to `Teacher`

That means bad data does not fail closed. It fails into medium privilege.

## Admin Role

Admin capabilities in current implementation:

- Full frontend navigation visibility
- Student management
- Attendance management
- Marks management
- Task management
- Logs visibility
- Messaging to everyone
- Message broadcast
- Profile access to own account
- Backend ability to view/update any profile if API is called directly

Admin is the only role that truly behaves like “system owner.”

## Teacher Role

Teacher capabilities:

- Dashboard access
- Student directory access
- Attendance management
- Marks management
- Task board access
- Logs access with filtered visibility
- Messaging to Admin/Teacher/Student
- Profile editing for self

Teacher access scope is also shaped by:

- `assignedClassNames`
- `assignedStudentIds`

Current seeded teacher has:

- subjects: `Mathematics`, `Science`, `Computer`
- assigned classes: `12-A`, `11-B`

Important hidden detail:

- If a teacher record lacks assignments during normalization, `dataStore.js` can default them to `["12-A"]`

## Student Role

Student capabilities:

- Dashboard access
- Attendance read-only
- Performance read-only
- Logs visibility limited to own activity/student link
- Messages to Admin/Teacher
- Profile editing for self
- Report download from profile

Student access is anchored to `studentId`.

If that link is broken, student-facing pages become unstable or empty.

## Route Protection

### Backend-protected APIs

Protected with `requireAuth`:

- `/api/students`
- `/api/attendance`
- `/api/marks`
- `/api/tasks`
- `/api/logs`
- `/api/messages`
- `/api/auth/users`
- `/api/auth/profile/:userId`

Extra router-level role enforcement:

- `/api/tasks` also uses `requireRoles("Admin", "Teacher")`

Other domains often do role enforcement inside the controller instead.

### Frontend-protected pages

Protected pages use `requireAuth()` at JS boot time:

- dashboard
- students
- attendance
- performance
- tasks
- logs
- messages
- profile

Important reality:

- The actual HTML page routes in `backend/server.js` are not server-protected
- Anyone can load `/dashboard` HTML
- The redirect happens only when page JS runs and notices missing `localStorage`

That is UI gating, not server-side page protection.

## UI Hiding vs Real Protection

This system uses both UI hiding and backend filtering.

### UI hiding

- Sidebar navigation is filtered by role
- Some pages redirect users away
- Buttons/forms are hidden for read-only roles

### Real backend checks

- `requireAuth`
- `requireRoles` for tasks
- `canAccessStudent()` in student, marks, and attendance controllers
- Role checks in controllers for create/update/delete actions

### The key lesson

UI hiding is not enough.

The backend is the only place that matters for real access control. In this project, the backend does enforce a lot of role behavior, but the auth identity model itself is weak, so the protection is only as strong as the user ID transport.

## How Role Filtering Actually Works

### Frontend capability model

`getRoleCapabilities()` returns:

- `isAdmin`
- `isTeacher`
- `isStudent`
- `canManageAll`
- `canManageAcademic`
- `canManageTasks`
- `isReadOnly`
- `studentId`
- `subjects`
- `assignedClassNames`
- `assignedStudentIds`

This powers:

- nav visibility
- page messaging
- view-only versus editable UI

### Backend access model

`roleUtils.js` powers:

- `getAssignedStudentIds()`
- `canAccessStudent()`
- `filterStudentsByRole()`
- `filterStudentRecordsByRole()`

This powers:

- student directory visibility
- attendance visibility
- marks visibility
- summary endpoint authorization
- log visibility

## Hidden Dependencies

- Student users need a valid `studentId`
- Teacher visibility depends on `assignedClassNames` or `assignedStudentIds`
- Student signup auto-linking depends on matching student email
- `normalizeRole()` exists in two layers and must behave identically
- Profile update behavior depends on `req.currentUser.role`, not just the target user
- `auth/users` is effectively a contact directory for the messaging system

## Major Security Weaknesses

### 1. Identity can be spoofed

If a client sends another valid `x-user-id`, the backend trusts it.

### 2. Passwords are stored in plaintext

Anyone with file access to `db.json` can read real passwords.

### 3. Role creation is too open

Signup exposes Admin role in the public form.

### 4. Unknown roles fail open into Teacher

This is a data-quality bug with security implications.

### 5. No input sanitization

Many frontend views render user-provided content via `innerHTML`, including:

- student names
- email values
- message subjects and content
- profile names

That creates XSS risk.

### 6. No rate limiting or lockout

Login can be brute forced.

### 7. No CSRF-safe session model

There are no cookies today, so classic CSRF is not the current problem. The real problem is that there is no secure auth session model at all.

### 8. No audit integrity

Logs are useful, but they are not immutable, signed, or independently stored.

## Common Mistakes

- Assuming `localStorage` equals security
- Assuming hidden nav items mean the route is protected
- Forgetting that deleting a student does not clean a linked student user
- Editing role strings without updating both frontend and backend normalization
- Changing the signup flow without rethinking auto-link behavior for student accounts

## How To Improve

### Immediate improvements

- Remove Admin from self-signup UI
- Hash passwords using `bcrypt`
- Reject unknown roles instead of defaulting to Teacher
- Sanitize or escape any user-controlled HTML output
- Add login throttling/rate limiting

### Next improvements

- Replace `x-user-id` auth with signed JWT or session cookies
- Use `HttpOnly` cookies for session storage if building a web-first product
- Add backend validation for email/phone/password rules
- Add authorization middleware per domain, not mixed styles

### Production-grade target

- session or JWT auth
- hashed passwords
- refresh/expiration rules
- server-side role claims
- structured RBAC
- audit trail that cannot be silently altered by normal app code

## What To Never Break

- The difference between UI capability checks and backend access checks
- `studentId` linkage for Student role users
- Teacher assignment fields:
  - `assignedClassNames`
  - `assignedStudentIds`
- Password stripping in `sanitizeUser()`
- Backend role-based summary protection for marks and attendance

## Future Notes

The current auth system is acceptable only for:

- local development
- demos
- portfolio walkthroughs
- internal learning

It is not acceptable for:

- real school deployment
- public internet exposure
- any environment with real student data

The correct mindset is to treat the current role system as a good product model on top of a weak security model. Keep the product logic. Replace the security foundation.
