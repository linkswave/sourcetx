# SourceTX Admin Web App — Design

Date: 2026-08-25
Status: Approved (user approved design)

## Overview

Replace the current single-page server-rendered `/admin` with a proper admin web
application: an inbox for applications, contact messages, and talent requests
with read/unread states, search & filter, CSV export, CV preview/download, and
SMTP reply-to-sender. Add full management of opening positions in
`data/jobs.json` (create, edit, activate/deactivate).

## Architecture

- New files kept out of `public/` so they are not publicly served:
  - `admin/admin.html` — single-page admin UI
  - `admin/admin.js` — frontend logic (fetch calls to the API)
- Served only behind Basic Auth (`adminAuth` middleware):
  - `GET /admin` -> `admin.html`
  - `GET /admin/admin.js` -> `admin.js`
- New JSON API, all behind `adminAuth`:
  - `GET /api/admin/:kind` — list records
    (`applications` | `messages` | `talent-requests`)
  - `POST /api/admin/:kind/:id/read` — set read state `{read:true|false}`
  - `POST /api/admin/:kind/:id/reply` — send SMTP email `{to, subject, body}`
  - `GET /api/admin/jobs` — list jobs
  - `POST /api/admin/jobs` — create job
  - `PUT /api/admin/jobs/:id` — update job (or toggle `active`)
- Existing CSV export routes (`/admin/export/:kind.csv`) stay unchanged.

## Storage layer extensions (`storage.js`)

All three submission types gain two new fields: `read` (bool, default `false`)
and `replies` (array, default `[]`).

- `JsonStore`: records get `read:false` and `replies:[]` on insert;
  `markRead()` and `addReply()` persist to the JSON file.
- `MySqlStore`: `init()` adds two columns if missing —
  `isRead TINYINT(1) DEFAULT 0` and `replies TEXT` (JSON string).
  `markRead()` and `addReply()` update them. New inserts include the columns.
- New `JsonJobs` class for `data/jobs.json`: `list()`, `upsert(job)` (create or
  update by id), and `setActive(id, active)`. No MySQL for jobs.

## Admin UI (tabs)

1. **Applications** — table: date, job, candidate, message, CV link
   (`/uploads/...` opens/downloads), read/unread indicator, reply button, mark
   read/unread.
2. **Messages** — cards: name, email, topic, message, read/unread, reply.
3. **Talent Requests** — cards: company, contact, service, needs, read/unread,
   reply.
4. **Jobs** — table + Add Job button and Edit modal (title, location, type,
   department, posted, summary, description, responsibilities[], requirements[],
   skills[], active toggle).

Each inbox tab has a search box (name/email/message/keyword) and a read/unread/
all filter. Unread records are visually highlighted.

## Reply flow (SMTP)

- Reply modal per record: `to` (prefilled from sender email, editable),
  `subject` (prefilled), `body` (textarea).
- On send: `POST /api/admin/:kind/:id/reply` uses nodemailer to email the
  sender, then appends the reply to the record's `replies` history.
- If SMTP is not configured (`SMTP_HOST` empty), the API returns
  "SMTP is not configured on this server" and no email is sent.

## Auth

- Page and every API call return 401 + `WWW-Authenticate` when unauthenticated,
  triggering the browser Basic Auth prompt.
- Same origin, so after the prompt the browser sends credentials on subsequent
  fetches automatically.

## Error handling

- API failures return `{ok:false, message}` with an appropriate status; the UI
  shows the message inline.
- Reply with SMTP failure -> shown to admin; reply not appended to history
  unless the send succeeded.

## Testing

- `npm test` must still pass (existing routes unchanged).
- Manual smoke: without SMTP, reply shows the "not configured" message; with a
  test MySQL/MariaDB, mark-read and reply history persist; job add/edit/activate
  appears in `/api/jobs` and `/jobs`.
