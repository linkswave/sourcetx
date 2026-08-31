# MySQL Storage for SourceTX Forms — Design

Date: 2026-08-25
Status: Approved (user approved design; spec pending review)

## Overview

Add MySQL persistence for the three submission types on the SourceTX website (job
applications with CVs, contact messages, employer talent requests). Opening
positions remain in `data/jobs.json` and are not migrated. CV files remain on
disk in `uploads/`; only metadata (filename + original name) is stored in the
database.

The site must keep working on the MonkeyCode-AI showcase container, which has no
MySQL access. Therefore a graceful fallback is required: when MySQL is not
configured or unreachable at startup, the site uses the existing JSON-file
storage.

## Approach

Approach A: `mysql2` driver with a small storage abstraction layer.

- Add `mysql2` (promise-based) as the only new runtime dependency.
- Introduce `storage.js` exposing a uniform interface.
- Two implementations: `MySqlStore` and `JsonStore`.
- A `getStore()` factory selects the store at startup.

## Architecture

- New file: `storage.js` in the workspace root.
- `server.js` uses the store returned by `getStore()` for:
  - form submissions (`/api/apply`, `/api/contact`, `/api/talent-request`)
  - the admin dashboard (`/admin`)
  - CSV exports (`/admin/export/:kind.csv`)
- Jobs continue to come from `data/jobs.json` (unchanged).

### Storage interface

Both stores implement:

- `insertApplication(item)`
- `insertMessage(item)`
- `insertTalentRequest(item)`
- `listApplications()`
- `listMessages()`
- `listTalentRequests()`

### Store selection

At startup, `getStore()`:

1. If any required `DB_*` env var is empty -> return `JsonStore`.
2. Otherwise create a `mysql2` pool, attempt a ping + create tables.
3. On success -> return `MySqlStore`.
4. On failure -> log a warning, close the pool, return `JsonStore`.

## Database schema

Auto-created on startup with `CREATE TABLE IF NOT EXISTS` when MySQL is active.

### `applications`

| Column | Type |
|---|---|
| id | VARCHAR(36) PRIMARY KEY |
| submittedAt | DATETIME |
| status | VARCHAR(16) |
| jobId | VARCHAR(64) |
| jobTitle | VARCHAR(200) |
| name | VARCHAR(200) |
| email | VARCHAR(200) |
| phone | VARCHAR(64) |
| location | VARCHAR(200) |
| linkedin | VARCHAR(255) |
| workAuthorization | VARCHAR(64) |
| message | TEXT |
| resume | VARCHAR(255) |
| originalResumeName | VARCHAR(255) |

### `messages`

| Column | Type |
|---|---|
| id | VARCHAR(36) PRIMARY KEY |
| submittedAt | DATETIME |
| status | VARCHAR(16) |
| name | VARCHAR(200) |
| email | VARCHAR(200) |
| phone | VARCHAR(64) |
| topic | VARCHAR(200) |
| message | TEXT |

### `talent_requests`

| Column | Type |
|---|---|
| id | VARCHAR(36) PRIMARY KEY |
| submittedAt | DATETIME |
| status | VARCHAR(16) |
| name | VARCHAR(200) |
| company | VARCHAR(200) |
| email | VARCHAR(200) |
| phone | VARCHAR(64) |
| service | VARCHAR(200) |
| targetDate | VARCHAR(64) |
| needs | TEXT |

## Configuration

New optional environment variables (added to `.env` and `.env.example`):

```
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
```

When any of `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` is empty, the site
uses `JsonStore`.

## Data flow

1. Startup: `getStore()` pings MySQL; on success creates tables and returns
   `MySqlStore`; on failure logs a warning and returns `JsonStore`.
2. Form POST: build the item exactly as today, then `store.insertX(item)`. CV
   upload via multer stays identical (file on disk, filename saved to DB).
3. Admin and CSV export: read counts and rows through the same store, so the
   displayed data matches where it was stored.

## Error handling

- MySQL insert failure -> return the same 400 JSON error to the user as today;
  do not silently drop data.
- MySQL down mid-run (after startup) -> per-request catch the error and return a
  clear error message. No silent JSON fallback mid-run, to avoid splitting data
  between stores.

## Testing

- `npm test` (`scripts/check.js`) must still pass; it is page/route-based and
  unaffected by storage changes.
- Smoke checks:
  - With `DB_*` unset, forms write to JSON (unchanged behavior).
  - With MySQL configured, a temporary integration test inserts and reads back a
    row.
