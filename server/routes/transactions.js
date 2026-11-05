import express from 'express';
import { randomBytes } from 'node:crypto';
import { query } from '../db/database.js';
import { authenticate, logAudit } from '../middleware/auth.js';

const router = express.Router();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderReceiptVerificationPage({ verified, title, message, transactionCode, documentType, issuer, issuedAt }) {
  const details = verified
    ? `<dl><dt>Nomor transaksi</dt><dd>${escapeHtml(transactionCode)}</dd><dt>Jenis dokumen</dt><dd>${escapeHtml(documentType)}</dd><dt>Diterbitkan oleh</dt><dd>${escapeHtml(issuer)}</dd><dt>Waktu pencatatan</dt><dd>${escapeHtml(issuedAt)}</dd></dl>`
    : '';
  const color = verified ? '#166534' : '#991b1b';

  return `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - Nventori</title><style>body{font:16px system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}.card{max-width:560px;margin:8vh auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 12px 32px #0f172a12}h1{font-size:22px;color:${color}}p{line-height:1.55}dl{display:grid;grid-template-columns:150px 1fr;gap:12px;margin:24px 0}dt{color:#64748b}dd{margin:0;font-weight:600;overflow-wrap:anywhere}.note{font-size:13px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px}</style><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${details}<p class="note">Verifikasi ini memeriksa catatan transaksi dan identitas petugas pada server Nventori. Ini bukan Tanda Tangan Elektronik (TTE) tersertifikasi.</p></main></html>`;
}

function generateTxCode() {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${yearMonth}-${randomSuffix}`;
}

// GET /api/transactions/:id/receipt-proof?type=handover|return
router.get('/:id/receipt-proof', authenticate, (req, res) => {
  const receiptType = req.query.type;
  if (!['handover', 'return'].includes(receiptType)) {
    return res.status(400).json({ success: false, message: 'Jenis dokumen tidak valid.' });
  }

  const tx = query.get('SELECT id, transaction_code FROM transactions WHERE id = ?', [req.params.id]);
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
  }

  const isReturn = receiptType === 'return';
  const event = query.get(`
    SELECT e.id, e.operator_id, e.${isReturn ? 'return_time' : 'handover_time'} as issued_at,
           u.name as operator_name
    FROM ${isReturn ? 'return_events' : 'handover_events'} e
    JOIN users u ON e.operator_id = u.id
    WHERE e.transaction_id = ?
    ORDER BY e.id DESC
    LIMIT 1`,
    [tx.id]
  );
  if (!event) {
    return res.status(409).json({
      success: false,
      message: isReturn
        ? 'Bukti pengembalian belum dapat diterbitkan karena belum ada pengembalian yang dicatat.'
        : 'Bukti serah terima belum dapat diterbitkan karena belum ada serah terima yang dicatat.'
    });
  }

  let tokenRecord = query.get(
    `SELECT token FROM receipt_verification_tokens
     WHERE document_type = ? AND event_id = ?`,
    [receiptType, event.id]
  );
  if (!tokenRecord) {
    const token = randomBytes(16).toString('base64url');
    query.run(`
      INSERT OR IGNORE INTO receipt_verification_tokens
        (token, transaction_id, document_type, event_id, issued_by_id, issued_by_name, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [token, tx.id, receiptType, event.id, event.operator_id, event.operator_name, event.issued_at]
    );
    tokenRecord = query.get(
      `SELECT token FROM receipt_verification_tokens
       WHERE document_type = ? AND event_id = ?`,
      [receiptType, event.id]
    );
  }

  res.json({
    success: true,
    proof: {
      verification_path: `/api/transactions/verify-receipt/${tokenRecord.token}`,
      transaction_code: tx.transaction_code,
      document_type: receiptType,
      issued_by: event.operator_name,
      issued_at: event.issued_at
    }
  });
});

// GET /api/transactions/verify-receipt/:token
router.get('/verify-receipt/:token', (req, res) => {
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) {
    return res.status(400).type('html').send(renderReceiptVerificationPage({
      verified: false,
      title: 'Dokumen tidak terverifikasi',
      message: 'Kode verifikasi tidak valid.'
    }));
  }

  const record = query.get(`
    SELECT t.transaction_code, v.transaction_id, v.document_type, v.event_id,
           v.issued_by_id, v.issued_by_name, v.issued_at
    FROM receipt_verification_tokens v
    JOIN transactions t ON v.transaction_id = t.id
    WHERE v.token = ?`,
    [token]
  );
  if (!record) {
    return res.status(404).type('html').send(renderReceiptVerificationPage({
      verified: false,
      title: 'Dokumen tidak terverifikasi',
      message: 'Kode QR tidak terdaftar pada server Nventori.'
    }));
  }

  const eventTable = record.document_type === 'return' ? 'return_events' : 'handover_events';
  const eventTimeColumn = record.document_type === 'return' ? 'return_time' : 'handover_time';
  const event = query.get(`
    SELECT operator_id, ${eventTimeColumn} as issued_at
    FROM ${eventTable}
    WHERE id = ? AND transaction_id = ?`,
    [record.event_id, record.transaction_id]
  );
  if (!event || event.operator_id !== record.issued_by_id || event.issued_at !== record.issued_at) {
    return res.status(404).type('html').send(renderReceiptVerificationPage({
      verified: false,
      title: 'Catatan penerbitan tidak cocok',
      message: 'Catatan penerbitan tidak ditemukan atau tidak lagi cocok dengan data pada server.'
    }));
  }

  return res.type('html').send(renderReceiptVerificationPage({
    verified: true,
    title: 'Dokumen terverifikasi',
    message: 'Catatan penerbitan dan petugas yang tercantum cocok dengan data pada server Nventori.',
    transactionCode: record.transaction_code,
    documentType: record.document_type === 'return' ? 'Bukti Pengembalian Inventaris' : 'Bukti Serah Terima Inventaris',
    issuer: record.issued_by_name,
    issuedAt: record.issued_at
  }));
});

// GET /api/transactions
router.get('/', authenticate, (req, res) => {
  const { status, type, search } = req.query;
  let sql = `
    SELECT t.*, u.name as operator_name,
           rl.letter_number, rl.letter_date, rl.sender_unit,
           (SELECT COUNT(*) FROM transaction_lines WHERE transaction_id = t.id) as total_lines
    FROM transactions t
    JOIN users u ON t.operator_id = u.id
    LEFT JOIN request_letters rl ON t.id = rl.transaction_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (type) {
    sql += ' AND t.transaction_type = ?';
    params.push(type);
  }
  if (search) {
    sql += ' AND (t.transaction_code LIKE ? OR t.borrower_name LIKE ? OR t.event_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY t.id DESC';
  const transactions = query.all(sql, params);
  res.json({ success: true, transactions });
});

// GET /api/transactions/:id
router.get('/:id', authenticate, (req, res) => {
  const tx = query.get(`
    SELECT t.*, u.name as operator_name, rl.letter_number, rl.letter_date, rl.sender_unit, rl.notes as letter_notes
    FROM transactions t
    JOIN users u ON t.operator_id = u.id
    LEFT JOIN request_letters rl ON t.id = rl.transaction_id
    WHERE t.id = ? OR t.transaction_code = ? OR t.qr_token = ?`,
    [req.params.id, req.params.id, req.params.id]
  );

  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
  }

  // Lines
  const lines = query.all(`
    SELECT tl.*, it.name as item_name, it.brand_model, it.unit_of_measure,
           au.asset_code, au.serial_number, ak.name as kit_name, ak.kit_code
    FROM transaction_lines tl
    JOIN item_types it ON tl.item_type_id = it.id
    LEFT JOIN asset_units au ON tl.asset_unit_id = au.id
    LEFT JOIN asset_kits ak ON tl.asset_kit_id = ak.id
    WHERE tl.transaction_id = ?`,
    [tx.id]
  );

  // Kit manifest snapshot (components checked out)
  const manifestItems = query.all(`
    SELECT kmi.*, au.asset_code, ak.name as kit_name
    FROM kit_manifest_items kmi
    JOIN asset_kits ak ON kmi.asset_kit_id = ak.id
    LEFT JOIN asset_units au ON kmi.asset_unit_id = au.id
    WHERE kmi.transaction_id = ?`,
    [tx.id]
  );

  // Handover events
  const handovers = query.all(`
    SELECT he.*, u.name as operator_name
    FROM handover_events he
    JOIN users u ON he.operator_id = u.id
    WHERE he.transaction_id = ?
    ORDER BY he.id ASC`,
    [tx.id]
  );

  // Return events and return lines
  const returns = query.all(`
    SELECT re.*, u.name as operator_name
    FROM return_events re
    JOIN users u ON re.operator_id = u.id
    WHERE re.transaction_id = ?
    ORDER BY re.id ASC`,
    [tx.id]
  );

  const enrichedReturns = returns.map(r => {
    const rLines = query.all(`
      SELECT rl.*, au.asset_code, kmi.component_name
      FROM return_lines rl
      LEFT JOIN asset_units au ON rl.asset_unit_id = au.id
      LEFT JOIN kit_manifest_items kmi ON rl.kit_manifest_item_id = kmi.id
      WHERE rl.return_event_id = ?`,
      [r.id]
    );
    return { ...r, lines: rLines };
  });

  res.json({
    success: true,
    transaction: {
      ...tx,
      lines,
      manifest_items: manifestItems,
      handovers,
      returns: enrichedReturns
    }
  });
});

// POST /api/transactions (Create transaction)
router.post('/', authenticate, (req, res) => {
  const {
    transaction_type, // 'internal_usage' | 'inter_unit_loan'
    borrower_contact_id,
    borrower_name,
    borrower_unit,
    borrower_phone,
    borrower_email,
    event_name,
    location_name,
    start_date,
    expected_return_date,
    notes,
    letter_number,
    letter_date,
    sender_unit,
    letter_notes,
    lines // array of { item_type_id, asset_unit_id?, asset_kit_id?, tracking_mode, quantity_requested }
  } = req.body;

  if (!['internal_usage', 'inter_unit_loan'].includes(transaction_type)) {
    return res.status(400).json({ success: false, message: 'Jenis transaksi tidak valid.' });
  }
  if (!event_name || !start_date || !expected_return_date || !Array.isArray(lines) || !lines.length) {
    return res.status(400).json({ success: false, message: 'Harap lengkapi semua data wajib transaksi dan minimal 1 barang.' });
  }

  if (transaction_type === 'inter_unit_loan' &&
    (!borrower_name?.trim() || !borrower_unit?.trim() || !borrower_email?.trim() || !borrower_phone?.trim())) {
    return res.status(400).json({ success: false, message: 'Identitas peminjam/PIC wajib diisi untuk pinjaman antarunit.' });
  }

  // Inter-unit loan must have letter reference per blueprint
  if (transaction_type === 'inter_unit_loan' && !letter_number?.trim()) {
    return res.status(400).json({ success: false, message: 'Pinjaman antarunit wajib menyertakan referensi nomor surat permohonan.' });
  }

  const borrowerSnapshot = transaction_type === 'internal_usage'
    ? { name: 'Pemakaian Internal', unit: 'Internal', phone: '', email: '' }
    : {
        name: borrower_name.trim(),
        unit: borrower_unit.trim(),
        phone: borrower_phone.trim(),
        email: borrower_email.trim().toLowerCase(),
      };
  const txCode = generateTxCode();
  const qrToken = `QR-${txCode}`;

  const createTx = query.transaction(() => {
    const assetIds = new Set();
    for (const line of lines) {
      if (line.asset_unit_id) {
        const assetId = Number(line.asset_unit_id);
        if (!Number.isSafeInteger(assetId) || assetIds.has(assetId)) {
          const err = new Error('Daftar unit aset berisi ID tidak valid atau unit yang sama lebih dari sekali.');
          err.code = 'INVALID_ASSET_SELECTION';
          throw err;
        }
        assetIds.add(assetId);
        const availableAsset = query.get(
          `SELECT au.id FROM asset_units au
           JOIN item_types it ON au.item_type_id = it.id
           WHERE au.id = ? AND au.item_type_id = ? AND au.status = 'tersedia'
             AND it.is_active = 1 AND it.tracking_mode = 'unique_unit'`,
          [assetId, Number(line.item_type_id)]
        );
        if (!availableAsset) {
          const err = new Error('Salah satu aset sudah tidak tersedia. Muat ulang pilihan aset lalu coba lagi.');
          err.code = 'ASSET_UNAVAILABLE';
          throw err;
        }
      }
    }

    // 1. Insert transaction
    const txResult = query.run(`
      INSERT INTO transactions (
        transaction_code, transaction_type, status, borrower_contact_id,
        borrower_name, borrower_unit, borrower_phone, borrower_email,
        event_name, location_name, start_date, expected_return_date,
        operator_id, notes, qr_token
      ) VALUES (?, ?, 'dipesan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txCode, transaction_type, transaction_type === 'inter_unit_loan' ? borrower_contact_id || null : null,
        borrowerSnapshot.name, borrowerSnapshot.unit, borrowerSnapshot.phone, borrowerSnapshot.email,
        event_name.trim(), location_name.trim(), start_date, expected_return_date,
        req.user.id, notes || null, qrToken
      ]
    );

    const txId = txResult.lastInsertRowid;

    // 2. Insert request letter if inter-unit
    if (transaction_type === 'inter_unit_loan') {
      query.run(`
        INSERT INTO request_letters (transaction_id, letter_number, letter_date, sender_unit, notes)
        VALUES (?, ?, ?, ?, ?)`,
        [txId, letter_number.trim(), letter_date || new Date().toISOString().slice(0, 10), sender_unit || borrower_unit.trim(), letter_notes || null]
      );
    }

    // 3. Insert transaction lines
    for (const line of lines) {
      query.run(`
        INSERT INTO transaction_lines (
          transaction_id, item_type_id, asset_unit_id, asset_kit_id,
          tracking_mode, quantity_requested, quantity_handed_over, quantity_returned
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
        [
          txId, line.item_type_id, line.asset_unit_id || null, line.asset_kit_id || null,
          line.tracking_mode, line.quantity_requested || 1
        ]
      );

      // If unit unik is reserved, mark status as dipesan
      if (line.asset_unit_id) {
        query.run("UPDATE asset_units SET status = 'dipesan' WHERE id = ?", [line.asset_unit_id]);
      }
    }

    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_TRANSACTION', 'TRANSACTION', txId, {
      code: txCode,
      type: transaction_type,
      borrower: borrowerSnapshot.name,
      items_count: lines.length
    });

    return { txId, txCode };
  });

  try {
    const result = createTx();
    res.json({
      success: true,
      message: 'Transaksi berhasil dicatat dan reservasi dikonfirmasi.',
      transaction_id: result.txId,
      transaction_code: result.txCode
    });
  } catch (err) {
    console.error('[Transaction] Error creating transaction:', err);
    if (err.code === 'ASSET_UNAVAILABLE' || err.code === 'INVALID_ASSET_SELECTION') {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Gagal membuat transaksi: ' + err.message });
  }
});

// POST /api/transactions/:id/handover (Serah terima / checkout)
router.post('/:id/handover', authenticate, (req, res) => {
  const txId = req.params.id;
  const { notes, recipient_name } = req.body;

  const tx = query.get('SELECT * FROM transactions WHERE id = ?', [txId]);
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
  }

  if (tx.status !== 'dipesan' && tx.status !== 'draft') {
    return res.status(400).json({ success: false, message: `Status transaksi saat ini (${tx.status}) tidak dapat diserahterimakan.` });
  }

  const lines = query.all('SELECT * FROM transaction_lines WHERE transaction_id = ?', [txId]);

  const processHandover = query.transaction(() => {
    // 1. Record handover event
    query.run(`
      INSERT INTO handover_events (transaction_id, operator_id, notes, recipient_name)
      VALUES (?, ?, ?, ?)`,
      [txId, req.user.id, notes || 'Serah terima diselesaikan operator', recipient_name || tx.borrower_name]
    );

    // 2. Process each line
    for (const line of lines) {
      query.run(`
        UPDATE transaction_lines
        SET quantity_handed_over = quantity_requested
        WHERE id = ?`,
        [line.id]
      );

      // Unique asset
      if (line.asset_unit_id) {
        query.run("UPDATE asset_units SET status = 'dipakai' WHERE id = ?", [line.asset_unit_id]);
        query.run(`
          INSERT INTO stock_movements (item_type_id, asset_unit_id, movement_type, quantity, reference_transaction_id, operator_id, reason)
          VALUES (?, ?, 'keluar', 1, ?, ?, 'Penyerahan barang peminjaman')`,
          [line.item_type_id, line.asset_unit_id, txId, req.user.id]
        );
      }

      // Quantity pool
      if (line.tracking_mode === 'quantity_pool') {
        const pool = query.get('SELECT * FROM stock_pools WHERE item_type_id = ? LIMIT 1', [line.item_type_id]);
        if (pool) {
          query.run(`
            UPDATE stock_pools
            SET quantity_available = MAX(0, quantity_available - ?),
                quantity_checked_out = quantity_checked_out + ?
            WHERE id = ?`,
            [line.quantity_requested, line.quantity_requested, pool.id]
          );
          query.run(`
            INSERT INTO stock_movements (item_type_id, movement_type, quantity, reference_transaction_id, operator_id, reason)
            VALUES (?, 'keluar', ?, ?, ?, 'Penyerahan barang stok kuantitas')`,
            [line.item_type_id, line.quantity_requested, txId, req.user.id]
          );
        }
      }

      // Consumable
      if (line.tracking_mode === 'consumable') {
        const pool = query.get('SELECT * FROM stock_pools WHERE item_type_id = ? LIMIT 1', [line.item_type_id]);
        if (pool) {
          query.run(`
            UPDATE stock_pools
            SET quantity_total = MAX(0, quantity_total - ?),
                quantity_available = MAX(0, quantity_available - ?)
            WHERE id = ?`,
            [line.quantity_requested, line.quantity_requested, pool.id]
          );
          query.run(`
            INSERT INTO stock_movements (item_type_id, movement_type, quantity, reference_transaction_id, operator_id, reason)
            VALUES (?, 'keluar', ?, ?, ?, 'Pengeluaran barang habis pakai')`,
            [line.item_type_id, line.quantity_requested, txId, req.user.id]
          );
        }
      }

      // Kit snapshot into manifest
      if (line.asset_kit_id) {
        query.run("UPDATE asset_kits SET status = 'dipakai' WHERE id = ?", [line.asset_kit_id]);
        const components = query.all('SELECT * FROM kit_components WHERE asset_kit_id = ?', [line.asset_kit_id]);
        for (const comp of components) {
          query.run(`
            INSERT INTO kit_manifest_items (
              transaction_id, asset_kit_id, component_name, asset_unit_id,
              quantity_handed_over, quantity_returned, condition_out, is_completed
            ) VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
            [txId, line.asset_kit_id, comp.component_name, comp.asset_unit_id || null, comp.quantity, comp.condition]
          );
          if (comp.asset_unit_id) {
            query.run("UPDATE asset_units SET status = 'dipakai' WHERE id = ?", [comp.asset_unit_id]);
          }
        }
      }
    }

    // 3. Update transaction status
    query.run("UPDATE transactions SET status = 'diserahkan', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [txId]);

    if (tx.borrower_email) {
      query.run(`
        INSERT INTO notification_outbox (transaction_id, recipient_email, recipient_name, notification_type, subject, message_body, scheduled_at)
        VALUES (?, ?, ?, 'handover_receipt', ?, ?, CURRENT_TIMESTAMP)`,
        [
          txId, tx.borrower_email, tx.borrower_name,
          `[Nventori] Bukti Serah Terima Aset - ${tx.transaction_code}`,
          `Halo ${tx.borrower_name},\n\nPeralatan untuk kegiatan "${tx.event_name}" telah diserahkan. Batas pengembalian: ${tx.expected_return_date}.\n\nTerima kasih,\nTim Inventaris`
        ]
      );
    }

    logAudit(req.user.id, req.user.name, req.user.role, 'HANDOVER', 'TRANSACTION', txId, {
      code: tx.transaction_code,
      recipient: recipient_name || tx.borrower_name
    });
  });

  try {
    processHandover();
    res.json({ success: true, message: 'Barang berhasil diserahterimakan dan manifest tercatat.' });
  } catch (err) {
    console.error('[Handover] Error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses serah terima: ' + err.message });
  }
});

// POST /api/transactions/:id/returns (Single QR Return / Partial Return per Blueprint Section 6)
router.post('/:id/returns', authenticate, (req, res) => {
  const txId = req.params.id;
  const { notes, returned_items } = req.body;
  // returned_items: array of {
  //   type: 'line' | 'manifest',
  //   id: number,
  //   quantity_returned: number,
  //   condition: 'baik' | 'rusak',
  //   notes: string
  // }

  if (!returned_items || !returned_items.length) {
    return res.status(400).json({ success: false, message: 'Pilih minimal satu barang yang diterima kembali.' });
  }

  const tx = query.get('SELECT * FROM transactions WHERE id = ?', [txId]);
  if (!tx) {
    return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
  }

  if (tx.status !== 'diserahkan' && tx.status !== 'kembali_sebagian') {
    return res.status(400).json({ success: false, message: 'Transaksi ini tidak dalam status pinjam aktif.' });
  }

  const processReturn = query.transaction(() => {
    // 1. Create return event
    const reResult = query.run(`
      INSERT INTO return_events (transaction_id, operator_id, notes)
      VALUES (?, ?, ?)`,
      [txId, req.user.id, notes || 'Pengembalian barang dikonfirmasi operator']
    );
    const returnEventId = reResult.lastInsertRowid;

    for (const item of returned_items) {
      if (item.type === 'line') {
        const line = query.get('SELECT * FROM transaction_lines WHERE id = ?', [item.id]);
        if (line) {
          const qty = Number(item.quantity_returned) || 1;
          const newReturnedQty = line.quantity_returned + qty;

          query.run('UPDATE transaction_lines SET quantity_returned = ? WHERE id = ?', [newReturnedQty, line.id]);

          // Record return line
          query.run(`
            INSERT INTO return_lines (return_event_id, transaction_line_id, asset_unit_id, quantity_returned, condition, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [returnEventId, line.id, line.asset_unit_id || null, qty, item.condition || 'baik', item.notes || null]
          );

          // Update physical asset
          if (line.asset_unit_id) {
            const newStatus = item.condition === 'rusak' ? 'perawatan' : 'tersedia';
            const newCond = item.condition === 'rusak' ? 'rusak_ringan' : 'baik';
            query.run('UPDATE asset_units SET status = ?, condition = ? WHERE id = ?', [newStatus, newCond, line.asset_unit_id]);

            query.run(`
              INSERT INTO stock_movements (item_type_id, asset_unit_id, movement_type, quantity, reference_transaction_id, operator_id, reason)
              VALUES (?, ?, 'kembali', 1, ?, ?, ?)`,
              [line.item_type_id, line.asset_unit_id, txId, req.user.id, `Pengembalian unit kondisi ${item.condition || 'baik'}`]
            );
          }

          // Update stock pool
          if (line.tracking_mode === 'quantity_pool') {
            const pool = query.get('SELECT * FROM stock_pools WHERE item_type_id = ? LIMIT 1', [line.item_type_id]);
            if (pool) {
              query.run(`
                UPDATE stock_pools
                SET quantity_available = quantity_available + ?,
                    quantity_checked_out = MAX(0, quantity_checked_out - ?)
                WHERE id = ?`,
                [qty, qty, pool.id]
              );
              query.run(`
                INSERT INTO stock_movements (item_type_id, movement_type, quantity, reference_transaction_id, operator_id, reason)
                VALUES (?, 'kembali', ?, ?, ?, 'Pengembalian stok kuantitas')`,
                [line.item_type_id, qty, txId, req.user.id]
              );
            }
          }
        }
      } else if (item.type === 'manifest') {
        const manifest = query.get('SELECT * FROM kit_manifest_items WHERE id = ?', [item.id]);
        if (manifest) {
          const qty = Number(item.quantity_returned) || 1;
          const newReturnedQty = manifest.quantity_returned + qty;
          const isCompleted = newReturnedQty >= manifest.quantity_handed_over ? 1 : 0;

          query.run(`
            UPDATE kit_manifest_items
            SET quantity_returned = ?, condition_in = ?, is_completed = ?
            WHERE id = ?`,
            [newReturnedQty, item.condition || 'baik', isCompleted, manifest.id]
          );

          query.run(`
            INSERT INTO return_lines (return_event_id, kit_manifest_item_id, asset_unit_id, quantity_returned, condition, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [returnEventId, manifest.id, manifest.asset_unit_id || null, qty, item.condition || 'baik', item.notes || null]
          );

          if (manifest.asset_unit_id) {
            const newStatus = item.condition === 'rusak' ? 'perawatan' : 'tersedia';
            query.run('UPDATE asset_units SET status = ? WHERE id = ?', [newStatus, manifest.asset_unit_id]);
          }
        }
      }
    }

    // 2. Check overall completion
    const allLines = query.all("SELECT * FROM transaction_lines WHERE transaction_id = ? AND tracking_mode != 'consumable'", [txId]);
    const allManifests = query.all('SELECT * FROM kit_manifest_items WHERE transaction_id = ?', [txId]);

    const linesComplete = allLines.every(l => l.quantity_returned >= l.quantity_handed_over);
    const manifestsComplete = allManifests.every(m => m.quantity_returned >= m.quantity_handed_over);

    const isFullyReturned = linesComplete && manifestsComplete;
    const newTxStatus = isFullyReturned ? 'selesai' : 'kembali_sebagian';

    query.run(`
      UPDATE transactions
      SET status = ?, actual_return_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [newTxStatus, isFullyReturned ? new Date().toISOString() : null, txId]
    );

    query.run('UPDATE return_events SET is_partial = ? WHERE id = ?', [isFullyReturned ? 0 : 1, returnEventId]);

    // Update kit status if fully returned
    if (isFullyReturned) {
      for (const line of allLines) {
        if (line.asset_kit_id) {
          query.run("UPDATE asset_kits SET status = 'siap_lengkap' WHERE id = ?", [line.asset_kit_id]);
        }
      }
    }

    if (tx.borrower_email) {
      query.run(`
        INSERT INTO notification_outbox (transaction_id, recipient_email, recipient_name, notification_type, subject, message_body, scheduled_at)
        VALUES (?, ?, ?, 'return_receipt', ?, ?, CURRENT_TIMESTAMP)`,
        [
          txId, tx.borrower_email, tx.borrower_name,
          `[Nventori] Bukti Pengembalian Aset - ${tx.transaction_code} (${isFullyReturned ? 'Lengkap' : 'Parsial'})`,
          `Halo ${tx.borrower_name},\n\nPengembalian barang transaksi ${tx.transaction_code} telah dicatat oleh operator.\nStatus pengembalian: ${isFullyReturned ? 'SELESAI (Seluruh barang telah kembali)' : 'KEMBALI SEBAGIAN (Masih ada sisa kewajiban tanggungan)'}.\n\nTerima kasih,\nTim Inventaris`
        ]
      );
    }

    logAudit(req.user.id, req.user.name, req.user.role, 'RETURN', 'TRANSACTION', txId, {
      code: tx.transaction_code,
      status: newTxStatus,
      is_fully_returned: isFullyReturned
    });

    return { isFullyReturned, newTxStatus };
  });

  try {
    const result = processReturn();
    res.json({
      success: true,
      message: result.isFullyReturned
        ? 'Seluruh barang berhasil diterima kembali. Transaksi selesai.'
        : 'Pengembalian sebagian berhasil dicatat. Sisa barang tetap tercatat sebagai tanggungan.',
      status: result.newTxStatus,
      is_fully_returned: result.isFullyReturned
    });
  } catch (err) {
    console.error('[Return] Error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses pengembalian: ' + err.message });
  }
});

export default router;
