# Backend Deep System

## Purpose

This document explains the backend as it exists today: the startup path, request lifecycle, route architecture, authorization shape, validation patterns, storage behavior, failure modes, and the exact places where future scale or complexity will push the current design past its limit.

## Files Involved

Entry point:

- `backend/server.js`

Middleware:

- `backend/middleware/authMiddleware.js`

Routes:

- `backend/routes/authRoutes.js`
- `backend/routes/studentRoutes.js`
- `backend/routes/attendanceRoutes.js`
- `backend/routes/markRoutes.js`
- `backend/routes/taskRoutes.js`
- `backend/routes/logRoutes.js`
- `backend/routes/messageRoutes.js`

Controllers:

- `backend/controllers/authController.js`
- `backend/controllers/studentController.js`
- `backend/controllers/attendanceController.js`
- `backend/controllers/marksController.js`
- `backend/controllers/taskController.js`
- `backend/controllers/logController.js`
- `backend/controllers/messageController.js`

Model/helpers:

- `backend/models/dataStore.js`
- `backend/models/activityLogger.js`
- `backend/models/roleUtils.js`
- `backend/models/seedData.js`
- `backend/models/db.json`

## server.js Flow

There is no `app.js`. The backend is built directly inside `backend/server.js`.

Runtime sequence:

1. Import Express and `path`
2. Import `ensureDb()` from `dataStore.js`
3. Import all route modules
4. Create `app`
5. Register JSON and URL-encoded parsers
6. Serve `/frontend` as static files
7. Mount API routers
8. Register page routes that send HTML files from `frontend/pages`
9. Register a JSON 404 handler
10. Call `ensureDb()`
11. Start listening on `PORT`

Important detail:

- `ensureDb()` only guarantees the file exists
- Full normalization happens inside `readDb()`, not on boot

## Route Architecture

The backend is organized by domain.

| Domain | Route prefix | Main controller | Notes |
| --- | --- | --- | --- |
| Auth | `/api/auth` | `authController.js` | Signup, login, profile, user listing |
| Students | `/api/students` | `studentController.js` | CRUD with access filtering |
| Attendance | `/api/attendance` | `attendanceController.js` | Daily bulk save + summary |
| Marks | `/api/marks` | `marksController.js` | CRUD + summary |
| Tasks | `/api/tasks` | `taskController.js` | Admin/Teacher only at router level |
| Logs | `/api/logs` | `logController.js` | Activity timeline |
| Messages | `/api/messages` | `messageController.js` | Direct messaging + admin broadcast |

This is clean for a small system. The weak point is that almost all deeper rules still live inside controllers.

## How It Works Internally

The backend is controller-centric.

Typical controller sequence:

1. Read request params/query/body
2. Validate basic required fields
3. Call `readDb()`
4. Apply role or access checks
5. Filter or mutate in-memory collections
6. Optionally call `addActivityLog()`
7. Call `writeDb()` if anything changed
8. Return JSON

This is simple and effective for low volume, but it means:

- Controllers know too much
- There is no transaction boundary
- There is no centralized schema validation
- There is no reusable domain service layer

## Request Lifecycle

Protected API request lifecycle:

`request -> express parser -> route -> requireAuth -> controller -> readDb -> role/access logic -> response`

Mutation request lifecycle:

`request -> requireAuth -> controller validation -> readDb -> collection mutation -> optional addActivityLog -> writeDb -> response`

The backend does not use database transactions, queues, or caches. Every read and write is direct file I/O plus in-memory array operations.

## Middleware Usage

### `requireAuth`

Located in `backend/middleware/authMiddleware.js`.

Behavior:

- Reads `x-user-id` header or `userId` from body/query
- Loads the full database
- Finds the user by ID
- Attaches `req.currentUser`

This middleware proves identity only by existence of the user ID.

### `requireRoles`

Also in `authMiddleware.js`.

Behavior:

- Normalizes allowed roles
- Compares them to `req.currentUser.role`
- Rejects unauthorized roles

Important inconsistency:

- `taskRoutes.js` uses `requireRoles("Admin", "Teacher")`
- Most other routes only use `requireAuth` and then do role checks manually inside controllers

This split makes authorization harder to reason about globally.

## Data Access Layer

The real storage layer is `backend/models/dataStore.js`.

### `ensureDb()`

- Creates `db.json` if missing
- Uses cloned `defaultData` from `seedData.js`

### `readDb()`

- Ensures the file exists
- Reads file contents
- Replaces empty file with defaults
- Parses JSON
- Normalizes the structure
- Rewrites the file if normalization changed anything

### `normalizeDb()`

This is more important than it looks.

It does several hidden things:

- Ensures default users exist
- Normalizes role values
- Fills theme defaults
- Fills `studentId`, `subjects`, `assignedClassNames`, `assignedStudentIds`
- Defaults teachers with missing class assignment to `["12-A"]`

That means `readDb()` is not a passive read. It can mutate the live database file.

### `writeDb()`

- Writes the full object back to disk
- Replaces the entire file every time

There is no file lock, optimistic concurrency control, or partial update.

## Controller Design Logic

### `authController.js`

Responsibilities:

- Signup
- Login
- Profile read/update
- User directory listing

Important implementation details:

- Passwords are stored and compared in plaintext
- `sanitizeUser()` strips password before response
- Login also creates an activity log
- Student signup auto-links by email if a matching student record exists
- Profile update allows Admin to change role and `studentId`, but the UI does not expose that power broadly

### `studentController.js`

Responsibilities:

- List students
- Read student by ID
- Create/update/delete student

Important implementation details:

- Search and class filters exist on the backend
- Results are sorted by name
- Validation is only field-presence validation
- Roll number uniqueness is enforced
- Delete cascades attendance and marks deletion
- Delete does not cascade into users, logs, or messages

### `attendanceController.js`

Responsibilities:

- Fetch attendance
- Save daily attendance in bulk
- Return per-student summary

Important implementation details:

- Save endpoint expects `{ date, records }`
- Upsert is based on `(date, studentId)`
- Logs are written only for changed items or new items
- No strict enum validation on `status`

### `marksController.js`

Responsibilities:

- Fetch marks
- Add/update/delete marks
- Return marks summary

Important implementation details:

- Score is validated as `0..100`
- UI only uses create/delete, but update endpoint exists
- Summary returns:
  - `subjects`
  - `total`
  - `average`
  - `averagePercentage`
  - `grade`
  - `remark`

### `taskController.js`

Responsibilities:

- CRUD for tasks

Important implementation details:

- Router-level role protection is stronger than other domains
- `getTasks()` sorts the array in place before returning
- Tasks are simple and intentionally flat

### `logController.js`

Responsibilities:

- Query logs with filters
- Enforce role-aware log visibility

Important implementation details:

- Filtering supports entity type, student, actor, role, date, search
- Sorting is newest first
- Teachers see:
  - their own actions
  - logs related to assigned students
- Students see:
  - their own student-linked logs
  - their own actor logs

### `messageController.js`

Responsibilities:

- Read messages
- Create direct messages
- Create admin broadcasts

Important implementation details:

- Admin can request all messages with `scope=all`
- Admin broadcast uses recipient ID `__broadcast__`
- `canMessageRole()` is the backend message permission gate

## Data Flow

### Read-heavy flow

`route -> readDb() -> filter by role -> filter by query -> sort -> respond`

### Mutation-heavy flow

`route -> readDb() -> validate -> authorize -> mutate arrays -> log action -> writeDb() -> respond`

### Logging flow

`controller mutation -> addActivityLog() -> logs.unshift(...) -> logs trimmed to 400`

Log trimming is important. The backend intentionally discards old logs beyond 400 entries.

## Validation Logic

Validation is mostly manual and shallow.

Examples:

- Auth checks required email/password/name
- Student create/update checks that all fields are truthy
- Marks validate numeric score range
- Attendance validates only presence of date and records array
- Tasks validate title only
- Messages validate recipient/subject/content

Missing validation types:

- email format enforcement on backend
- phone format validation
- strong password rules
- subject enum validation
- attendance status enum validation
- string length limits
- HTML/script sanitization

## Error Handling

This is one of the most important weak points.

There is no centralized async error middleware.

Controllers are declared `async`, but they are not wrapped. In Express 4, rejected promises in async route handlers are not handled cleanly by default. If `readDb()` throws, if `db.json` becomes invalid JSON, or if `writeDb()` fails, the request path does not have a robust recovery mechanism.

Current behavior is fine only as long as disk I/O and JSON parsing do not fail.

Recommended fix:

- Add an async handler wrapper
- Add centralized error middleware
- Normalize error response shape
- Log stack traces server-side

## Hidden Dependencies

- `normalizeRole()` defaults unknown roles to Teacher
- `readDb()` can rewrite the file during reads
- `seedData.js` is not just sample data; it is also normalization fallback data
- Default users are “sticky” because normalization re-merges them
- `activityLogger.js` is a silent side-effect dependency of mutations across multiple modules
- Route auth relies on frontend sending the correct header
- Frontend report generation depends on summary response shapes staying stable

## Current Weak Points

### Security

- No real authentication
- Plaintext passwords
- User ID spoofing
- No rate limiting
- No input sanitization

### Reliability

- One JSON file for all writes
- No locking or transaction model
- No backup/restore strategy inside code
- No error middleware

### Maintainability

- Controllers mix concerns
- Authorization style is inconsistent
- Business logic is duplicated across layers
- No schema definition or typing

### Performance

- Every request reads the whole database file
- Every write rewrites the entire file
- Filtering and aggregation are all in-memory array scans

## Scalability Issues

This backend will start struggling when:

- many users write concurrently
- logs become large
- attendance and marks history grows substantially
- analytics become time-series heavy
- message volume becomes conversational rather than occasional

Most endpoints currently operate at collection-scan cost. That is acceptable for tens or hundreds of records, not for production school volumes over time.

## Recommended Backend Improvements

### Phase 1: stabilize current backend

- Add centralized async error handling
- Add schema validation with Zod or Joi
- Add an explicit config layer for port, env, and feature toggles
- Harden role normalization so unknown roles fail closed, not “Teacher”

### Phase 2: clean architecture

- Introduce service modules per domain
- Keep controllers thin
- Extract reusable authorization helpers
- Extract reusable query/filter helpers

### Phase 3: persistence upgrade

- Replace `db.json` with PostgreSQL or MongoDB
- Add proper relations or document strategy
- Add migrations
- Add indices for common filters

### Phase 4: production hardening

- Real auth
- audit logging strategy
- request logging
- test coverage
- monitoring

## Common Mistakes

- Treating `db.json` like static sample data
- Changing response field names that frontend reports or charts depend on
- Moving role logic into one place without updating the duplicate layer
- Assuming router-level auth exists everywhere because it exists for tasks
- Forgetting that delete student does not clean linked user references
- Adding new collections without normalizing them in `dataStore.js`

## What To Never Break

- `readDb()` and `writeDb()` return/accept full database objects
- User sanitization before auth responses
- Summary endpoint shapes for attendance and marks
- `createId()` prefix conventions if any frontend or logs depend on them
- `relatedStudentId` and `relatedUserId` log semantics
- Route prefixes already consumed by frontend `apiFetch()` calls

## Future Notes

The backend is a good teaching backend and a weak production backend.

That is not an insult. It means the code is still readable enough to be refactored safely.

The best next backend move is not feature expansion. It is structural hardening:

1. fail-safe role handling
2. centralized error handling
3. schema validation
4. real persistence
5. proper auth

Once those are stable, the current domain boundaries are good enough to support a more serious version.
