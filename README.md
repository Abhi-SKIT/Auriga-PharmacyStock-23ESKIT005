# PharmFEFO — Smart Batch & FEFO Dispensing System

A batch-aware pharmacy inventory management system built to enforce First-Expiry-First-Out (FEFO) dispensing, audit in-date sellable stock in real time, and eliminate accidental dispensation of expired medications.

---

## Features

- **Automated FEFO Allocation:** Automatically claims stock from the earliest-expiring available batch and splits orders across batches when necessary.
- **Accurate Sellable Stock:** Excludes expired batches from sellable quantity counters at read time.
- **Critical Expiry Alerts:** Surfacing batches within a 30-day expiration window.
- **Full Catalog Search & Sort:** Filter medicines by name or category with server-side pagination and stock-level sorting.
- **Atomic Operations:** Uses SQLite Write-Ahead Logging (WAL) and atomic transactions to prevent double-allocation during concurrent sales.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Environment**: Tested on Linux (GitHub Codespaces) and macOS/Windows.

---

## Quickstart & Installation

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd pharmacy-fefo-system
   npm install







   