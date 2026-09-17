import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-super-secret-key-2026';
const REORDER_THRESHOLD = 20;

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================
function authenticate(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized. Please sign in.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================
app.post('/api/auth/register', (req, res) => {
  const { email, password, pharmacyName } = req.body;
  if (!email || !password || !pharmacyName) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, pharmacy_name) VALUES (?, ?, ?)
    `).run(email.trim().toLowerCase(), hash, pharmacyName.trim());

    const token = jwt.sign(
      { id: result.lastInsertRowid, email, pharmacyName },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
    res.status(201).json({ message: 'Registration successful', pharmacyName });
  } catch (err) {
    res.status(400).json({ error: 'Email already registered.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, pharmacyName: user.pharmacy_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Login successful', pharmacyName: user.pharmacy_name });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ============================================================
// MEDICINES & INVENTORY ROUTES
// ============================================================
app.get('/api/medicines', authenticate, (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 8);
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy === 'sellable_stock' ? 'sellable_stock' : 'm.name';
  const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  const today = new Date().toISOString().split('T')[0];

  const totalCount = db.prepare(`
    SELECT COUNT(*) as count FROM medicines WHERE name LIKE ? OR category LIKE ?
  `).get(search, search).count;

  // Calculates sellable stock strictly ignoring expired & quarantined batches
  const rows = db.prepare(`
    SELECT 
      m.id, 
      m.name, 
      m.category,
      COALESCE(SUM(CASE WHEN b.expiry_date >= ? AND b.quantity > 0 AND b.is_quarantined = 0 THEN b.quantity ELSE 0 END), 0) AS sellable_stock,
      MIN(CASE WHEN b.expiry_date >= ? AND b.quantity > 0 AND b.is_quarantined = 0 THEN b.expiry_date ELSE NULL END) AS next_expiry,
      COUNT(CASE WHEN (b.expiry_date < ? OR b.is_quarantined = 1) AND b.quantity > 0 THEN 1 ELSE NULL END) AS expired_batch_count
    FROM medicines m
    LEFT JOIN batches b ON m.id = b.medicine_id
    WHERE m.name LIKE ? OR m.category LIKE ?
    GROUP BY m.id
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(today, today, today, search, search, limit, offset);

  res.json({
    data: rows,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1
    }
  });
});

app.post('/api/medicines', authenticate, (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Medicine name and category are required.' });
  }

  const result = db.prepare('INSERT INTO medicines (name, category) VALUES (?, ?)').run(
    name.trim(),
    category.trim()
  );
  res.status(201).json({ id: result.lastInsertRowid, name, category });
});

// ============================================================
// BATCHES ROUTES
// ============================================================
app.get('/api/medicines/:id/batches', authenticate, (req, res) => {
  const batches = db.prepare(`
    SELECT 
      id, 
      batch_number, 
      quantity, 
      expiry_date,
      is_quarantined,
      is_flagged,
      CASE WHEN expiry_date < DATE('now') OR is_quarantined = 1 THEN 1 ELSE 0 END AS is_expired
    FROM batches
    WHERE medicine_id = ?
    ORDER BY expiry_date ASC
  `).all(req.params.id);

  res.json(batches);
});

app.post('/api/medicines/:id/batches', authenticate, (req, res) => {
  const { batchNumber, quantity, expiryDate } = req.body;
  const qty = parseInt(quantity);

  if (!batchNumber || isNaN(qty) || qty <= 0 || !expiryDate) {
    return res.status(400).json({ error: 'Valid batch number, positive quantity, and expiry date are required.' });
  }

  const result = db.prepare(`
    INSERT INTO batches (medicine_id, batch_number, quantity, expiry_date, is_quarantined, is_flagged)
    VALUES (?, ?, ?, ?, 0, 0)
  `).run(req.params.id, batchNumber.trim(), qty, expiryDate);

  res.status(201).json({ message: 'Batch stocked successfully', id: result.lastInsertRowid });
});

// ============================================================
// FEFO DISPENSE ENGINE (WITH RE-ORDER NOTIFICATION TRIGGER)
// ============================================================
app.post('/api/medicines/:id/dispense', authenticate, (req, res) => {
  const medicineId = req.params.id;
  const quantityToDispense = parseInt(req.body.quantity);
  const patientName = req.body.patientName?.trim() || 'Walk-in Patient';
  const today = new Date().toISOString().split('T')[0];

  if (isNaN(quantityToDispense) || quantityToDispense <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive whole number.' });
  }

  const dispenseTransaction = db.transaction(() => {
    // 1. Calculate unexpired, unquarantined sellable stock
    const stockRow = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS total_sellable
      FROM batches
      WHERE medicine_id = ? AND expiry_date >= ? AND quantity > 0 AND is_quarantined = 0
    `).get(medicineId, today);

    if (stockRow.total_sellable < quantityToDispense) {
      throw new Error(`Insufficient in-date stock. Requested: ${quantityToDispense}, Available: ${stockRow.total_sellable}`);
    }

    // 2. Fetch available batches ordered strictly by earliest expiry (FEFO)
    const availableBatches = db.prepare(`
      SELECT id, batch_number, quantity, expiry_date
      FROM batches
      WHERE medicine_id = ? AND expiry_date >= ? AND quantity > 0 AND is_quarantined = 0
      ORDER BY expiry_date ASC, id ASC
    `).all(medicineId, today);

    let remaining = quantityToDispense;
    const deductions = [];

    // 3. Incrementally exhaust batches
    for (const batch of availableBatches) {
      if (remaining <= 0) break;

      const deduction = Math.min(batch.quantity, remaining);

      db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(deduction, batch.id);

      db.prepare(`
        INSERT INTO dispense_logs (medicine_id, batch_id, quantity, patient_name)
        VALUES (?, ?, ?, ?)
      `).run(medicineId, batch.id, deduction, patientName);

      deductions.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        deducted: deduction,
        expiryDate: batch.expiry_date
      });

      remaining -= deduction;
    }

    return deductions;
  });

  try {
    const allocations = dispenseTransaction();

    // LEVEL 3 TRIGGER: Check if sellable stock dropped below threshold
    const stockCheck = db.prepare(`
      SELECT m.id, m.name, 
             COALESCE(SUM(b.quantity), 0) AS remaining_stock
      FROM medicines m
      LEFT JOIN batches b ON m.id = b.medicine_id 
        AND b.expiry_date >= ? 
        AND b.quantity > 0 
        AND b.is_quarantined = 0
      WHERE m.id = ?
      GROUP BY m.id
    `).get(today, medicineId);

    if (stockCheck && stockCheck.remaining_stock < REORDER_THRESHOLD) {
      db.prepare(`
        INSERT INTO outbox (medicine_id, medicine_name, type, message, stock, threshold)
        VALUES (?, ?, 'REORDER_ALERT', ?, ?, ?)
      `).run(
        stockCheck.id,
        stockCheck.name,
        `Low stock alert: ${stockCheck.name} has dropped to ${stockCheck.remaining_stock} in-date units (threshold: ${REORDER_THRESHOLD}).`,
        stockCheck.remaining_stock,
        REORDER_THRESHOLD
      );
    }

    res.json({
      success: true,
      message: `Dispensed ${quantityToDispense} units successfully via FEFO.`,
      breakdown: allocations
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// EXPIRY ALERTS
// ============================================================
app.get('/api/alerts/expiring', authenticate, (req, res) => {
  const days = parseInt(req.query.days) || 30;

  const alerts = db.prepare(`
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.quantity,
      b.expiry_date,
      m.name AS medicine_name,
      CAST((julianday(b.expiry_date) - julianday('now')) AS INTEGER) AS days_remaining
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.expiry_date >= DATE('now')
      AND b.expiry_date <= DATE('now', '+' || ? || ' days')
      AND b.quantity > 0
      AND b.is_quarantined = 0
    ORDER BY b.expiry_date ASC
  `).all(days);

  res.json(alerts);
});

// ============================================================
// TWIST LEVEL 1 (T2): AUTOMATION (POST /clock)
// ============================================================
const handleClock = (req, res) => {
  const targetDate = req.body?.date || new Date().toISOString().split('T')[0];

  // 1. Quarantine expired batches
  const quarantined = db.prepare(`
    UPDATE batches 
    SET is_quarantined = 1 
    WHERE expiry_date < ? AND is_quarantined = 0
  `).run(targetDate).changes;

  // 2. Flag batches expiring within 7 days
  const flagged = db.prepare(`
    UPDATE batches 
    SET is_flagged = 1 
    WHERE expiry_date >= ? 
      AND expiry_date <= DATE(?, '+7 days') 
      AND is_quarantined = 0
  `).run(targetDate, targetDate).changes;

  res.json({
    date: targetDate,
    quarantined,
    flagged
  });
};
app.post('/clock', handleClock);
app.post('/api/clock', handleClock);

// ============================================================
// TWIST LEVEL 2 (T4): MESSY DATA IMPORT (POST /batches/import)
// ============================================================
function parseDate(rawDate) {
  if (!rawDate) return null;
  const str = String(rawDate).trim();

  // Match DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Match YYYY-MM-DD
  const iso = str.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return str;

  // Generic date parsing fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseQuantity(rawQty) {
  if (rawQty === null || rawQty === undefined) return null;
  const match = String(rawQty).replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

const handleImport = (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : (req.body.batches || []);
  let imported = 0;
  let deduped = 0;
  let rejected = 0;

  const seenInPayload = new Set();

  const insertTx = db.transaction(() => {
    for (const row of rows) {
      const medIdentifier = row.medicine_id || row.medicine_name || row.name || row.medicine;
      const batchNum = row.batch_number || row.batchNumber || row.batch;
      const qty = parseQuantity(row.quantity || row.qty);
      const expiry = parseDate(row.expiry_date || row.expiryDate || row.expiry);

      // Validation check
      if (!medIdentifier || !batchNum || qty === null || qty <= 0 || !expiry) {
        rejected++;
        continue;
      }

      // Resolve or auto-create medicine
      let med = db.prepare('SELECT id FROM medicines WHERE id = ? OR LOWER(name) = LOWER(?)').get(medIdentifier, String(medIdentifier).trim());
      if (!med) {
        const createMed = db.prepare('INSERT INTO medicines (name, category) VALUES (?, ?)').run(String(medIdentifier).trim(), 'General');
        med = { id: createMed.lastInsertRowid };
      }

      // Deduplication check (within batch payload & existing DB)
      const dedupKey = `${med.id}:${String(batchNum).trim().toUpperCase()}`;
      if (seenInPayload.has(dedupKey)) {
        deduped++;
        continue;
      }
      seenInPayload.add(dedupKey);

      const existingBatch = db.prepare('SELECT id FROM batches WHERE medicine_id = ? AND UPPER(batch_number) = UPPER(?)').get(med.id, String(batchNum).trim());
      if (existingBatch) {
        deduped++;
        continue;
      }

      // Insert valid, normalized batch
      db.prepare(`
        INSERT INTO batches (medicine_id, batch_number, quantity, expiry_date, is_quarantined, is_flagged)
        VALUES (?, ?, ?, ?, 0, 0)
      `).run(med.id, String(batchNum).trim(), qty, expiry);

      imported++;
    }
  });

  insertTx();
  res.json({ imported, deduped, rejected });
};
app.post('/batches/import', handleImport);
app.post('/api/batches/import', handleImport);

// ============================================================
// TWIST LEVEL 3 (T1): RE-ORDER NOTIFICATIONS (/outbox)
// ============================================================
const handleOutbox = (req, res) => {
  const messages = db.prepare('SELECT * FROM outbox ORDER BY created_at DESC').all();
  res.json(messages);
};
app.get('/outbox', handleOutbox);
app.get('/api/outbox', handleOutbox);

// ============================================================
// BOOT SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`PharmFEFO server active at http://localhost:${PORT}`);
});