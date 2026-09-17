import Database from 'better-sqlite3';

const db = new Database('pharmacy.db');

// Enable Write-Ahead Logging for high concurrency
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pharmacy_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medicines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    expiry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dispense_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    patient_name TEXT,
    dispensed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add to db.js right after existing tables:
db.exec(`
  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id INTEGER,
    medicine_name TEXT,
    type TEXT,
    message TEXT,
    stock INTEGER,
    threshold INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migration for existing databases
try {
  db.exec(`ALTER TABLE batches ADD COLUMN is_quarantined INTEGER DEFAULT 0;`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE batches ADD COLUMN is_flagged INTEGER DEFAULT 0;`);
} catch (e) { /* column already exists */ }

export default db;