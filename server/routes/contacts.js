import express from 'express';
import { query } from '../db/database.js';
import { authenticate, logAudit } from '../middleware/auth.js';

const router = express.Router();

// GET /api/contacts
router.get('/', authenticate, (req, res) => {
  const { search, limit } = req.query;
  let sql = `
    SELECT bc.*,
           (SELECT COUNT(*) FROM transactions WHERE borrower_contact_id = bc.id) as total_transactions,
           (SELECT COUNT(*) FROM transactions WHERE borrower_contact_id = bc.id AND status IN ('diserahkan', 'kembali_sebagian')) as active_loans
    FROM borrower_contacts bc
    WHERE bc.is_active = 1
  `;
  const params = [];

  if (search) {
    sql += ' AND (bc.full_name LIKE ? OR bc.institution LIKE ? OR bc.phone_wa LIKE ? OR bc.email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY bc.full_name ASC';
  if (limit) {
    sql += ` LIMIT ${Number(limit)}`;
  }

  const contacts = query.all(sql, params);
  res.json({ success: true, contacts });
});

// GET /api/contacts/:id
router.get('/:id', authenticate, (req, res) => {
  const contact = query.get('SELECT * FROM borrower_contacts WHERE id = ?', [req.params.id]);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Kontak peminjam tidak ditemukan.' });
  }

  const transactions = query.all(`
    SELECT t.*, u.name as operator_name
    FROM transactions t
    JOIN users u ON t.operator_id = u.id
    WHERE t.borrower_contact_id = ?
    ORDER BY t.created_at DESC`,
    [contact.id]
  );

  res.json({ success: true, contact: { ...contact, transactions } });
});

// POST /api/contacts
router.post('/', authenticate, (req, res) => {
  const { full_name, institution, phone_wa, email, notes } = req.body;

  if (!full_name || !institution || !phone_wa || !email) {
    return res.status(400).json({ success: false, message: 'Nama lengkap, unit/instansi, HP/WA, dan email aktif wajib diisi.' });
  }

  // Check possible duplicates for operator assistance
  const duplicateCandidate = query.get(
    'SELECT id, full_name, institution FROM borrower_contacts WHERE is_active = 1 AND (email = ? OR phone_wa = ?)',
    [email.trim().toLowerCase(), phone_wa.trim()]
  );

  const result = query.run(`
    INSERT INTO borrower_contacts (full_name, institution, phone_wa, email, notes)
    VALUES (?, ?, ?, ?, ?)`,
    [full_name.trim(), institution.trim(), phone_wa.trim(), email.trim().toLowerCase(), notes || null]
  );

  logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_CONTACT', 'BORROWER_CONTACT', result.lastInsertRowid, { full_name, email });

  res.json({
    success: true,
    message: 'Kontak peminjam berhasil disimpan.',
    contact_id: result.lastInsertRowid,
    potential_duplicate: duplicateCandidate ? `Perhatian: Email/HP mirip dengan kontak tersimpan (${duplicateCandidate.full_name} - ${duplicateCandidate.institution})` : null
  });
});

// PUT /api/contacts/:id
router.put('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { full_name, institution, phone_wa, email, notes } = req.body;

  if (!full_name || !institution || !phone_wa || !email) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  const existing = query.get('SELECT id FROM borrower_contacts WHERE id = ? AND is_active = 1', [id]);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Kontak peminjam tidak ditemukan.' });
  }

  // Only the contact record changes. Past transactions keep their own snapshot of the
  // borrower's name/unit/phone/email, so history stays exactly as it was issued.
  query.run(`
    UPDATE borrower_contacts
    SET full_name = ?, institution = ?, phone_wa = ?, email = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [full_name.trim(), institution.trim(), phone_wa.trim(), email.trim().toLowerCase(), notes || null, id]
  );

  logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_CONTACT', 'BORROWER_CONTACT', id, { full_name, email });

  res.json({ success: true, message: 'Kontak peminjam berhasil diperbarui.' });
});

// DELETE /api/contacts/:id  (soft delete: hides the contact, keeps all transaction history)
router.delete('/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const contact = query.get('SELECT * FROM borrower_contacts WHERE id = ? AND is_active = 1', [id]);
  if (!contact) {
    return res.status(404).json({ success: false, message: 'Kontak peminjam tidak ditemukan.' });
  }

  const active = query.get(
    `SELECT COUNT(*) as n FROM transactions
     WHERE borrower_contact_id = ? AND status IN ('dipesan', 'diserahkan', 'kembali_sebagian')`,
    [id]
  );
  if (active && active.n > 0) {
    return res.status(409).json({
      success: false,
      message: `Kontak masih memiliki ${active.n} transaksi yang belum selesai. Selesaikan transaksinya terlebih dahulu.`
    });
  }

  // Soft delete only: transactions/activities keep their reference and stored borrower snapshot.
  query.run('UPDATE borrower_contacts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

  logAudit(req.user.id, req.user.name, req.user.role, 'DELETE_CONTACT', 'BORROWER_CONTACT', id, {
    full_name: contact.full_name,
    email: contact.email
  });

  res.json({ success: true, message: 'Kontak dihapus. Riwayat transaksi tetap tersimpan.' });
});

export default router;
