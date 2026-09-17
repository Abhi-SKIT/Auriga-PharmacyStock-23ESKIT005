# AI Collaboration & Engineering Logs (`AI_LOGS.md`)

**Project:** Pharmacy FEFO Inventory & Dispensing System  
**Environment:** GitHub Codespaces | Node.js, Express, SQLite (`better-sqlite3`), Vanilla JS, Tailwind CSS  
**Session Scope:** Full-stack implementation under a strict 2.5-hour assessment window  
**Effort Distribution:** ~40% Candidate Architecture, Steering, Testing & Validation | ~60% AI Acceleration, Scaffolding & Core Algorithms  

---

## Executive Summary of Collaboration

The project was developed iteratively using AI as an interactive technical co-pilot. Architectural direction, dependency control, framework vetting, testing verification, and workflow management were directed by the candidate. The AI was utilized to draft SQL schemas, formulate atomic FEFO transaction routines, accelerate boilerplate creation, and structure mandatory documentation.

---

## Chronological Interaction & Development Log

### Phase 1: Problem Decomposition, Stack Selection & Data Modeling

* **Candidate Direction & Query:**
  - Provided the assessment brief: build a batch-aware pharmacy system enforcing First-Expiry-First-Out (FEFO) dispensing, in-date sellable stock counts, expiry alerts, and full CRUD within 2.5 hours in GitHub Codespaces.
  - Requested a low-overhead, zero-config tech stack that eliminates build failures, container latency, and multi-port CORS issues.
  - Inquired about the exact `package.json` script configurations.

* **AI Assistance & Proposal:**
  - Proposed a unified Node.js + Express backend paired with an embedded SQLite database (`better-sqlite3`) in WAL mode to eliminate database configuration delays.
  - Outlined the normalized database schema separating catalog definitions (`medicines`) from physical lots (`batches`) and audit logs (`dispense_logs`).
  - Outlined the atomic FEFO allocation logic utilizing SQLite transactions to prevent race conditions during concurrent dispenses.
  - Clarified `npm` script formatting and recommended `node --watch server.js` over `nodemon` to reduce external dependency overhead.

* **Candidate Evaluation & Decision:**
  - Approved the SQLite + Express architecture.
  - Enforced single-port static serving out of `/public` to ensure Codespaces port forwarding remained reliable.

---

### Phase 2: Frontend Strategy & Rejection of Alpine.js

* **Candidate Direction & Query:**
  - Reviewed the initial UI proposal (which suggested Alpine.js).
  - Explicitly rejected Alpine.js (`"alpine is not a good option to use for my idea"`), prioritizing predictable DOM manipulation and zero-framework friction.
  - Directed the workflow toward clean Vanilla JavaScript with Tailwind CSS via CDN.

* **AI Assistance & Proposal:**
  - Refactored frontend architecture to standard Vanilla JS (`fetch` API, DOM queries, template literal rendering).
  - Drafted responsive UI layouts for:
    - **One-page landing page (`index.html`)**: Product positioning, audience, and future roadmap features.
    - **Inventory dashboard (`dashboard.html`)**: Search, sorting, batch creation, and dispensing controls.
  - Implemented client-side search input debouncing (300ms) to prevent unnecessary query traffic.

* **Candidate Evaluation & Decision:**
  - Validated Vanilla JS approach in Codespaces; verified absence of build-step overhead and faster initial render times.

---

### Phase 3: Core Implementation & FEFO Algorithm Verification

* **Candidate Direction & Query:**
  - Requested concrete file-by-file implementations for `db.js`, `seed.js`, and `server.js`.
  - Required the seed script to include realistic edge cases: already-expired batches, near-expiry batches (<30 days), and far-future batches.

* **AI Assistance & Proposal:**
  - Delivered `db.js` with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and cascade deletes.
  - Delivered `seed.js` with structured test data:
    - *Paracetamol*: Expired lot (40 units), near-expiry lot (30 units), safe lot (100 units).
    - *Amoxicillin*: Multi-batch unexpired stock.
    - *Ibuprofen*: Seeded strictly with expired stock to verify 0-sellable-unit guards.
  - Delivered `server.js` with JWT-based auth cookies, paginated medicine search, and an atomic `POST /api/medicines/:id/dispense` endpoint running inside `db.transaction()`.

* **Candidate Testing & Verification:**
  - Executed `node seed.js` and booted the development server.
  - Verified in-date stock logic: confirmed that Paracetamol displays exactly 130 sellable units while isolating the 40 expired units.
  - Tested shortage handling: confirmed that attempting to dispense more units than are in-date returns a clean HTTP 400 rejection without mutating inventory.

---

### Phase 4: UI Advancements & Interactive FEFO Simulation

* **Candidate Direction & Query:**
  - Requested usability enhancements to make the dashboard significantly more interactive and user-friendly.

* **AI Assistance & Proposal:**
  - Re-architected `public/dashboard.html` with advanced interaction patterns:
    - **Live FEFO Waterfall Simulator:** Real-time calculation showing the user which batches will be deducted and which will be fully exhausted *as they type the quantity*.
    - **Batch Inspector Drawer:** Dedicated modal to inspect individual lots with colored status badges (`Active Safe`, `Expiring Soon`, `Expired & Locked`).
    - **Quick Filter Chips:** Instant one-click toggles for `All Medicines`, `Low Stock (<25)`, and `Has Expired Lots`.
    - **Keyboard Ergonomics:** Implemented `/` shortcut to focus the global search bar and `Escape` to close active modals.
    - **Toast Notification Stack:** Non-blocking feedback for API operations.

* **Candidate Testing & Verification:**
  - Verified live deduction preview: dispensing 45 units of Paracetamol properly previewed the deduction of 30 units from `PARA-SOON-02` (exhausting it) and 15 units from `PARA-SAFE-03`.
  - Tested keyboard shortcuts and filter chip switching across all medicine states.

---

### Phase 5: Git Operations & Submission Deliverables

* **Candidate Direction & Query:**
  - Inquired about Git workflow inside GitHub Codespaces to push code cleanly to the remote repository.
  - Rejected verbose default commit messages in favor of concise, standard commit syntax.
  - Requested clean, professional evaluation documentation for `README.md`, `REASONING.md`, and `AI_LOGS.md`.

* **AI Assistance & Proposal:**
  - Provided terminal Git commands (`git status`, `git add .`, `git push origin main`).
  - Offered simplified commit alternatives (`"Update dashboard UI"`, `"Improve dashboard interactions"`).
  - Generated production-grade `README.md` (setup instructions, debug notes, API endpoint specifications) and `REASONING.md` (architectural trade-offs, concurrency safeguards, test scenarios).
  - Formatted this collaborative `AI_LOGS.md` transcript.

* **Candidate Final Audit:**
  - Staged and committed files with clean commit messages.
  - Confirmed repository visibility is set to Public on GitHub.
  - Verified that all three required root markdown files (`README.md`, `REASONING.md`, `AI_LOGS.md`) are present in the repository root.