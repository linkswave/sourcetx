# SourceTX Visitor Chat Assistant — Design

Date: 2026-08-28
Status: Approved (user approved design)

## Overview

Add an interactive chat assistant to the website so visitors can ask questions
and receive instant answers. The assistant is a **site knowledge-base bot**: it
answers from a curated SourceTX knowledge base (services, jobs, hiring, contact,
process). No AI API key is required and it works fully on the existing Node
backend and Namecheap shared hosting. When it cannot confidently answer, the
question is captured for the site owner and an email alert is sent.

## Architecture

- `data/chatbot.json` — knowledge base (intents + answers). Plain JSON, no
  secrets, easy to edit. Read-only at runtime: it is always loaded from the
  bundled project data directory (never from a `STORAGE_PATH` override).
- `chatbot.js` (new module) — pure matching logic: `answer(message)` returns
  `{ reply, followups, confidence, fallback }`. No HTTP, unit-testable.
- `server.js` — new endpoint `POST /api/chat`:
  - request body `{ message: string, email?: string }`
  - validates input (message required, trimmed, ≤ 500 chars; email optional and
    validated if present) → 400 `{ok:false,message}` on invalid
  - calls `answer(message)`
  - confidence ≥ threshold (0.6) → `{ok:true, reply, followups, fallback:false}`
  - below threshold → stores a chat capture, emails the owner, returns
    `{ok:true, reply:<fallback text>, followups, fallback:true}`
  - covered by the existing global rate limiter (250 req / 15 min / IP)
- `public/js/chat-widget.js` — floating bubble + chat panel, injected on every
  public page. Builds its own DOM, sends messages to `/api/chat`, renders the
  conversation. No inline scripts; all text rendered via `textContent`.
- `public/css/styles.css` — widget styles matching the deep-navy / teal / violet
  design system.
- Widget script injection: `<script defer src="js/chat-widget.js"></script>`
  added before `</body>` in every `public/*.html` page (29 files, incl.
  `404.html` and the dynamic `job-detail.html` / `apply-detail.html` templates).
  `admin/` pages are excluded.

## Knowledge base & matching engine

- `data/chatbot.json` holds ~14-16 intents covering: company overview, all six
  solution areas (Talent & Workforce, Cloud & Infrastructure, Data/AI &
  Analytics, Application Engineering, Cybersecurity & Quality, Managed
  Services), open jobs + how to apply, submit résumé / talent network,
  employers / hiring, contact details (email, phone, offices), how SourceTX
  works, privacy, and "talk to a person" / greeting.
- Each intent: `{ id, keywords: {phrase: weight}, answer, followups[] }`.
  Multi-word phrases (e.g. "machine learning") weigh more than single words.
- Matching in `chatbot.js`:
  - normalize message (lowercase, strip punctuation, collapse whitespace,
    ignore stopwords like what/is/the/how/do/you)
  - score each intent by summing matched keyword weights
  - pick the top intent above the confidence threshold, else fallback
  - alias map maps synonyms to canonical terms (e.g. "ai"/"artificial
    intelligence"/"ml"; "cv" → résumé)
- Fallback reply politely acknowledges, lists a few common topics, and suggests
  contacting SourceTX; it triggers capture + alert.

## Chat widget UI/UX

- Floating action button (bottom-right, fixed), teal gradient chat icon,
  keyboard-accessible with `aria-label`.
- Opens a ~360px panel (near-full-screen sheet on mobile). Header: "Ask
  SourceTX" + "Virtual assistant — replies instantly" + close button.
- Messages: visitor bubbles right (teal gradient), bot bubbles left (soft navy
  panel). Typing-indicator dots while awaiting the reply.
- Quick-reply chips: 3-4 starter suggestions on open, plus follow-up chips from
  the last bot answer.
- Optional "Share your email (optional)" field in the panel; if filled it is
  attached to chat requests so captures include a contact address.
- "Talk to a person" link always available → opens `/contact`.
- On first open, the assistant sends a greeting. Conversation is in-memory
  (session only); no persistence across reloads.
- Degrades gracefully if `/api/chat` is unreachable ("Chat is temporarily
  unavailable" and input disabled).

## Unanswered capture & admin

- Capture record:
  `{ id, submittedAt, status:"new", email (optional), question, intent:"none",
    read:false }`.
- `storage.js` gains a `chat_captures` kind:
  - `JsonStore`: `data/chat_captures.json` (auto-created `[]` like the other
    files); methods `insertChatCapture(item)`, `listChatCaptures()`.
  - `MySqlStore`: `chat_captures` table (id, submittedAt, status, email,
    question, intent, isRead), auto-created in `init()`; methods
    `insertChatCapture`, `listChatCaptures`, `markRead` (reuses existing
    pattern).
- Server startup creates `chat_captures.json` alongside the other data files.
- On capture, `notify("Chat: unanswered question", question + email)` to
  `NOTIFY_EMAIL`; failures caught so the visitor reply is never blocked.
- Admin app gains a **Chat Captures** tab: list, search, mark read/unread, CSV
  export. No reply button (email is optional).
- Backend admin routes (all behind `adminAuth`):
  - `GET /api/admin/chat-captures`
  - `POST /api/admin/chat-captures/:id/read` (add `chat-captures` to the
    allowed kinds in the read route)
  - `GET /admin/export/chat-captures.csv`

## Error handling & security

- Invalid input → 400 JSON; never a 500 for chat.
- If `chatbot.js` fails or the knowledge base is corrupt, the server logs and
  returns the safe fallback reply (still `ok:true`).
- Storage / notify failures are caught and logged; the visitor always receives
  the fallback reply.
- XSS-safe: all dynamic text rendered via `textContent`.
- No secrets or API keys anywhere in this feature.

## Testing

- Extend `scripts/check.js`: add `POST /api/chat` checks — a known-intent
  question returns `{ok:true, reply}` (non-empty), and an unknown question
  returns `{ok:true, fallback:true}`.
- Verify capture: after a fallback question, `data/chat_captures.json` contains
  the record; admin list and CSV export return it (Basic Auth).
- DOM-shim test of `chat-widget.js` renderer (greeting, visitor + bot bubbles,
  quick-reply chips, email field).
- Manual curl verification of the endpoint, then `npm test` (now 18+ checks).

## Files touched

New: `data/chatbot.json`, `chatbot.js`, `public/js/chat-widget.js`,
`data/chat_captures.json`, this spec.

Modified: `server.js`, `storage.js`, `admin/admin.html`, `admin/admin.js`,
`public/css/styles.css`, every `public/*.html` (widget script tag),
`scripts/check.js`, `.env.example`.
