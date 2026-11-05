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
