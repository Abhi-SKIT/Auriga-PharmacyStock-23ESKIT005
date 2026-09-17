import db from './db.js';
import bcrypt from 'bcryptjs';

console.log('Seeding pharmacy database...');

// Clean existing records
db.exec(`
  DELETE FROM dispense_logs;
  DELETE FROM batches;
  DELETE FROM medicines;
  DELETE FROM users;
`);

// Insert default pharmacist (Password: admin123)
const passwordHash = bcrypt.hashSync('admin123', 10);
db.prepare(`
  INSERT INTO users (email, password_hash, pharmacy_name)
  VALUES (?, ?, ?)
`).run('demo@pharmacy.com', passwordHash, 'Central Care Pharmacy');

// Insert sample medicines
const insertMed = db.prepare('INSERT INTO medicines (name, category) VALUES (?, ?)');
const paracetamolId = insertMed.run('Paracetamol 500mg', 'Analgesics').lastInsertRowid;
const amoxicillinId = insertMed.run('Amoxicillin 250mg', 'Antibiotics').lastInsertRowid;
const cetirizineId = insertMed.run('Cetirizine 10mg', 'Antihistamines').lastInsertRowid;
const ibuprofenId = insertMed.run('Ibuprofen 400mg', 'NSAID').lastInsertRowid;

// Date generation helpers
const now = new Date();
const formatDate = (date) => date.toISOString().split('T')[0];

const expiredDate = new Date(now);
expiredDate.setDate(now.getDate() - 15); // 15 days ago (expired)

const nearExpiryDate = new Date(now);
nearExpiryDate.setDate(now.getDate() + 12); // In 12 days (triggers 30-day alert + FEFO first)

const futureDate = new Date(now);
futureDate.setMonth(now.getMonth() + 6); // In 6 months (fresh stock)

const farFutureDate = new Date(now);
farFutureDate.setFullYear(now.getFullYear() + 1); // In 1 year

const insertBatch = db.prepare(`
  INSERT INTO batches (medicine_id, batch_number, quantity, expiry_date)
  VALUES (?, ?, ?, ?)
`);

// 1. Paracetamol: 40 expired, 30 near-expiry, 100 safe future
insertBatch.run(paracetamolId, 'PARA-EXP-01', 40, formatDate(expiredDate));
insertBatch.run(paracetamolId, 'PARA-SOON-02', 30, formatDate(nearExpiryDate));
insertBatch.run(paracetamolId, 'PARA-SAFE-03', 100, formatDate(futureDate));

// 2. Amoxicillin: 25 near-expiry, 60 safe future
insertBatch.run(amoxicillinId, 'AMOX-SOON-01', 25, formatDate(nearExpiryDate));
insertBatch.run(amoxicillinId, 'AMOX-SAFE-02', 60, formatDate(farFutureDate));

// 3. Cetirizine: 50 safe future
insertBatch.run(cetirizineId, 'CETR-SAFE-01', 50, formatDate(futureDate));

// 4. Ibuprofen: Only expired batch (tests 0 sellable units state)
insertBatch.run(ibuprofenId, 'IBU-EXP-01', 20, formatDate(expiredDate));

console.log('Seeding complete. Run "npm run dev" to boot the server.');