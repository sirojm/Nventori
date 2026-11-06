import { query } from '../db/database.js';

// Transactions that still hold stock/assets.
export const ACTIVE_TX_STATUSES = ['draft', 'dipesan', 'diserahkan', 'kembali_sebagian'];
const IN_ACTIVE = ACTIVE_TX_STATUSES.map((s) => `'${s}'`).join(', ');

/**
 * The pool a transaction draws from for an item. Transactions, reservations, returns and
 * reconciliation must all agree on this, so it lives in one place.
 */
export function primaryPool(itemTypeId) {
  return (
    query.get(
      "SELECT * FROM stock_pools WHERE item_type_id = ? AND condition = 'baik' ORDER BY id ASC LIMIT 1",
      [itemTypeId]
    ) || query.get('SELECT * FROM stock_pools WHERE item_type_id = ? ORDER BY id ASC LIMIT 1', [itemTypeId])
  );
}

/** What is really out / reserved for an item according to the transactions themselves. */
export function liveUsageForItem(itemTypeId) {
  const rows = query.all(
    `SELECT t.transaction_code, t.status, tl.tracking_mode, tl.quantity_requested,
            tl.quantity_handed_over, tl.quantity_returned
     FROM transaction_lines tl
     JOIN transactions t ON t.id = tl.transaction_id
     WHERE tl.item_type_id = ? AND tl.asset_kit_id IS NULL AND tl.asset_unit_id IS NULL
       AND t.status IN (${IN_ACTIVE})`,
    [itemTypeId]
  );
  let outstanding = 0;
  let reserved = 0;
  const transactions = [];
  for (const row of rows) {
    if (row.status === 'diserahkan' || row.status === 'kembali_sebagian') {
      if (row.tracking_mode !== 'quantity_pool') continue;
      const out = Math.max(0, row.quantity_handed_over - row.quantity_returned);
      if (out > 0) {
        outstanding += out;
        transactions.push(`${row.transaction_code} (${out} dipinjam)`);
      }
    } else {
      reserved += row.quantity_requested;
      transactions.push(`${row.transaction_code} (${row.quantity_requested} dipesan)`);
    }
  }
  return { outstanding, reserved, transactions };
}

/** Active transactions that reference a given asset unit. */
export function liveTransactionsForAsset(assetId) {
  return query.all(
    `SELECT DISTINCT t.transaction_code, t.status FROM (
       SELECT tl.transaction_id AS tid FROM transaction_lines tl
         WHERE tl.asset_unit_id = ? AND tl.quantity_returned < MAX(tl.quantity_handed_over, 1)
       UNION
       SELECT kmi.transaction_id FROM kit_manifest_items kmi
         WHERE kmi.asset_unit_id = ? AND kmi.is_completed = 0
     ) x JOIN transactions t ON t.id = x.tid
     WHERE t.status IN (${IN_ACTIVE})`,
    [assetId, assetId]
  );
}

/**
 * Compares stored counters/statuses with what the transactions say and returns the differences.
 * Pure read; applyPlan() performs the repair.
 */
export function buildReconcilePlan() {
  const assetChanges = [];
  const poolChanges = [];

  // ---- Physical assets: tersedia / dipesan / dipakai must match active transactions
  const assets = query.all(
    `SELECT au.id, au.asset_code, au.status, it.name AS item_name
     FROM asset_units au JOIN item_types it ON it.id = au.item_type_id
     WHERE au.status IN ('tersedia', 'dipesan', 'dipakai')`
  );
  for (const asset of assets) {
    const refs = query.all(
      `SELECT t.status, tl.quantity_handed_over, tl.quantity_returned
       FROM transaction_lines tl JOIN transactions t ON t.id = tl.transaction_id
       WHERE tl.asset_unit_id = ? AND t.status IN (${IN_ACTIVE})`,
      [asset.id]
    );
    const manifest = query.get(
      `SELECT 1 AS x FROM kit_manifest_items kmi JOIN transactions t ON t.id = kmi.transaction_id
       WHERE kmi.asset_unit_id = ? AND kmi.is_completed = 0 AND t.status IN ('diserahkan', 'kembali_sebagian') LIMIT 1`,
      [asset.id]
    );
    let expected = 'tersedia';
    if (refs.some((r) => r.status === 'dipesan' || r.status === 'draft')) expected = 'dipesan';
    if (manifest || refs.some((r) => (r.status === 'diserahkan' || r.status === 'kembali_sebagian') && r.quantity_returned < r.quantity_handed_over)) {
      expected = 'dipakai';
    }
    if (expected !== asset.status) {
      assetChanges.push({
        id: asset.id,
        label: `${asset.asset_code} — ${asset.item_name}`,
        from: asset.status,
        to: expected,
      });
    }
  }

  // ---- Quantity pools
  const items = query.all(
    `SELECT DISTINCT it.id, it.name, it.tracking_mode FROM item_types it
     JOIN stock_pools sp ON sp.item_type_id = it.id WHERE it.tracking_mode IN ('quantity_pool', 'consumable')`
  );
  for (const item of items) {
    const usage = liveUsageForItem(item.id);
    const pools = query.all('SELECT * FROM stock_pools WHERE item_type_id = ? ORDER BY id ASC', [item.id]);
    const primary = primaryPool(item.id);
    for (const pool of pools) {
      const isPrimary = primary && pool.id === primary.id;
      const checkedOut = isPrimary && item.tracking_mode === 'quantity_pool' ? usage.outstanding : 0;
      const reserved = isPrimary ? usage.reserved : 0;
      const available = Math.max(0, pool.quantity_total - checkedOut - reserved);
      if (
        checkedOut !== pool.quantity_checked_out ||
        reserved !== pool.quantity_reserved ||
        available !== pool.quantity_available
      ) {
        poolChanges.push({
          id: pool.id,
          label: item.name,
          before: { available: pool.quantity_available, reserved: pool.quantity_reserved, checked_out: pool.quantity_checked_out },
          after: { available, reserved, checked_out: checkedOut },
          total: pool.quantity_total,
          note: usage.transactions.join(', '),
        });
      }
    }
  }

  return { assetChanges, poolChanges };
}

export function applyReconcilePlan(plan) {
  const apply = query.transaction(() => {
    for (const change of plan.assetChanges) {
      query.run('UPDATE asset_units SET status = ? WHERE id = ?', [change.to, change.id]);
    }
    for (const change of plan.poolChanges) {
      query.run(
        `UPDATE stock_pools
         SET quantity_available = ?, quantity_reserved = ?, quantity_checked_out = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [change.after.available, change.after.reserved, change.after.checked_out, change.id]
      );
    }
  });
  apply();
}
