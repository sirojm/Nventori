import express from 'express';
import { query } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, (req, res) => {
  const now = new Date().toISOString();

  // 1. Physical Assets KPI
  const assetStats = query.get(`
    SELECT 
      COUNT(*) as total_units,
      SUM(CASE WHEN status = 'tersedia' THEN 1 ELSE 0 END) as available_units,
      SUM(CASE WHEN status = 'dipakai' THEN 1 ELSE 0 END) as in_use_units,
      SUM(CASE WHEN status = 'dipesan' THEN 1 ELSE 0 END) as reserved_units,
      SUM(CASE WHEN status = 'nonaktif' OR condition IN ('rusak_ringan', 'rusak_berat', 'perawatan') THEN 1 ELSE 0 END) as maintenance_units
    FROM asset_units
  `);

  // 2. Quantity Pools KPI (Separated per Blueprint Bagian 10)
  const poolStats = query.get(`
    SELECT 
      COALESCE(SUM(quantity_total), 0) as total_quantity,
      COALESCE(SUM(quantity_available), 0) as available_quantity,
      COALESCE(SUM(quantity_checked_out), 0) as checked_out_quantity
    FROM stock_pools
  `);

  // 3. Transactions & Overdue
  const txStats = query.get(`
    SELECT
      COUNT(*) as total_transactions,
      SUM(CASE WHEN status IN ('diserahkan', 'kembali_sebagian') THEN 1 ELSE 0 END) as active_loans,
      SUM(CASE WHEN status = 'dipesan' THEN 1 ELSE 0 END) as pending_reservations,
      SUM(CASE WHEN status IN ('diserahkan', 'kembali_sebagian') AND expected_return_date < ? THEN 1 ELSE 0 END) as overdue_loans
    FROM transactions`,
    [now]
  );

  // 4. Overdue items list
  const overdueItems = query.all(`
    SELECT t.id, t.transaction_code, t.borrower_name, t.borrower_unit, t.borrower_phone,
           t.event_name, t.expected_return_date, t.status,
           ROUND((julianday('now') - julianday(t.expected_return_date))) as days_overdue
    FROM transactions t
    WHERE t.status IN ('diserahkan', 'kembali_sebagian') AND t.expected_return_date < ?
    ORDER BY t.expected_return_date ASC
    LIMIT 10`,
    [now]
  );

  // 5. Recent activities
  const upcomingActivities = query.all(`
    SELECT a.*, bc.phone_wa as pic_phone
    FROM activities a
    LEFT JOIN borrower_contacts bc ON a.pic_contact_id = bc.id
    WHERE a.status = 'terjadwal'
    ORDER BY a.start_time ASC
    LIMIT 5`
  );

  // 6. Recent transactions
  const recentTransactions = query.all(`
    SELECT t.id, t.transaction_code, t.transaction_type, t.status, t.borrower_name,
           t.event_name, t.start_date, t.expected_return_date, t.created_at,
           u.name as operator_name
    FROM transactions t
    JOIN users u ON t.operator_id = u.id
    ORDER BY t.id DESC
    LIMIT 6`
  );

  res.json({
    success: true,
    stats: {
      assets: assetStats,
      pools: poolStats,
      transactions: txStats
    },
    overdue_items: overdueItems,
    upcoming_activities: upcomingActivities,
    recent_transactions: recentTransactions
  });
});

// GET /api/reports/full?from=YYYY-MM-DD&to=YYYY-MM-DD  (data for the printable report document)
router.get('/full', authenticate, (req, res) => {
  const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const from = isDate(req.query.from) ? req.query.from : monthStart;
  const to = isDate(req.query.to) ? req.query.to : today;
  if (from > to) {
    return res.status(400).json({ success: false, message: 'Tanggal awal tidak boleh setelah tanggal akhir.' });
  }
  const now = new Date().toISOString();

  const assetSummary = query.get(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'tersedia' THEN 1 ELSE 0 END) AS tersedia,
           SUM(CASE WHEN status = 'dipesan' THEN 1 ELSE 0 END) AS dipesan,
           SUM(CASE WHEN status = 'dipakai' THEN 1 ELSE 0 END) AS dipakai,
           SUM(CASE WHEN condition IN ('rusak_ringan', 'rusak_berat', 'perawatan') OR status = 'perawatan' THEN 1 ELSE 0 END) AS perlu_perawatan
    FROM asset_units WHERE status != 'nonaktif'`);

  const poolSummary = query.get(`
    SELECT COALESCE(SUM(sp.quantity_total), 0) AS total, COALESCE(SUM(sp.quantity_available), 0) AS tersedia,
           COALESCE(SUM(sp.quantity_reserved), 0) AS dipesan, COALESCE(SUM(sp.quantity_checked_out), 0) AS dipinjam
    FROM stock_pools sp JOIN item_types it ON it.id = sp.item_type_id WHERE it.is_active = 1`);

  const txSummary = query.get(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'dipesan' THEN 1 ELSE 0 END) AS dipesan,
           SUM(CASE WHEN status IN ('diserahkan', 'kembali_sebagian') THEN 1 ELSE 0 END) AS aktif,
           SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS selesai,
           SUM(CASE WHEN status = 'dibatalkan' THEN 1 ELSE 0 END) AS dibatalkan
    FROM transactions WHERE date(created_at) BETWEEN ? AND ?`, [from, to]);

  const assets = query.all(`
    SELECT au.asset_code, au.serial_number, au.status, au.condition,
           it.name AS item_name, c.name AS category_name, l.name AS location_name
    FROM asset_units au
    JOIN item_types it ON it.id = au.item_type_id
    JOIN categories c ON c.id = it.category_id
    JOIN locations l ON l.id = au.location_id
    WHERE au.status != 'nonaktif'
    ORDER BY c.name ASC, it.name ASC, au.asset_code ASC`);

  const pools = query.all(`
    SELECT it.name AS item_name, it.code AS item_code, it.unit_of_measure, it.tracking_mode,
           c.name AS category_name, l.name AS location_name, sp.condition,
           sp.quantity_total, sp.quantity_available, sp.quantity_reserved, sp.quantity_checked_out
    FROM stock_pools sp
    JOIN item_types it ON it.id = sp.item_type_id
    JOIN categories c ON c.id = it.category_id
    JOIN locations l ON l.id = sp.location_id
    WHERE it.is_active = 1
    ORDER BY c.name ASC, it.name ASC`);

  const itemsOfTx = (id) => query.all(`
    SELECT it.name AS item_name, tl.tracking_mode, tl.quantity_requested, tl.asset_kit_id,
           au.asset_code, ak.name AS kit_name
    FROM transaction_lines tl
    JOIN item_types it ON it.id = tl.item_type_id
    LEFT JOIN asset_units au ON au.id = tl.asset_unit_id
    LEFT JOIN asset_kits ak ON ak.id = tl.asset_kit_id
    WHERE tl.transaction_id = ?`, [id])
    .map((line) => line.kit_name
      ? `Paket: ${line.kit_name}`
      : line.asset_code
        ? `${line.item_name} (${line.asset_code})`
        : `${line.item_name} ×${line.quantity_requested}`);

  const activeLoans = query.all(`
    SELECT t.id, t.transaction_code, t.status, t.borrower_name, t.borrower_unit, t.event_name,
           t.start_date, t.expected_return_date,
           CASE WHEN t.expected_return_date < ? THEN 1 ELSE 0 END AS is_overdue
    FROM transactions t
    WHERE t.status IN ('dipesan', 'diserahkan', 'kembali_sebagian')
    ORDER BY t.expected_return_date ASC`, [now])
    .map((tx) => ({ ...tx, items: itemsOfTx(tx.id) }));

  const transactions = query.all(`
    SELECT t.id, t.transaction_code, t.transaction_type, t.status, t.borrower_name, t.borrower_unit,
           t.event_name, t.start_date, t.expected_return_date, t.actual_return_date, t.created_at,
           u.name AS operator_name
    FROM transactions t JOIN users u ON u.id = t.operator_id
    WHERE date(t.created_at) BETWEEN ? AND ?
    ORDER BY t.id ASC`, [from, to])
    .map((tx) => ({ ...tx, items: itemsOfTx(tx.id) }));

  res.json({
    success: true,
    generated_at: now,
    generated_by: req.user.name,
    period: { from, to },
    summary: { assets: assetSummary, pools: poolSummary, transactions: txSummary },
    assets,
    pools,
    active_loans: activeLoans,
    transactions,
  });
});

// GET /api/reports/audit
router.get('/audit', authenticate, (req, res) => {
  const { limit = 50 } = req.query;
  const logs = query.all(`
    SELECT al.*
    FROM audit_logs al
    ORDER BY al.id DESC
    LIMIT ?`,
    [Number(limit)]
  );
  res.json({ success: true, logs });
});

// GET /api/reports/notifications
router.get('/notifications', authenticate, (req, res) => {
  const notifications = query.all(`
    SELECT no.*, t.transaction_code
    FROM notification_outbox no
    JOIN transactions t ON no.transaction_id = t.id
    ORDER BY no.id DESC
    LIMIT 20`
  );
  res.json({ success: true, notifications });
});

export default router;
