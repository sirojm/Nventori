import express from 'express';
import { query } from '../db/database.js';
import { authenticate, authorize, logAudit } from '../middleware/auth.js';

const router = express.Router();

// GET /api/categories
router.get('/categories', authenticate, (req, res) => {
  const includeInactive = req.query.include_inactive === 'true';
  const categories = query.all(`
    SELECT c.*, COUNT(it.id) as item_count
    FROM categories c
    LEFT JOIN item_types it ON c.id = it.category_id AND it.is_active = 1
    ${includeInactive ? '' : 'WHERE c.is_active = 1'}
    GROUP BY c.id
    ORDER BY c.name ASC`
  );
  res.json({ success: true, categories });
});

// POST /api/categories (Admin Inventaris / Super Admin)
router.post('/categories', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, code, description } = req.body;
  if (!name?.trim() || !code?.trim()) {
    return res.status(400).json({ success: false, message: 'Nama dan kode kategori wajib diisi.' });
  }

  try {
    const result = query.run(
      'INSERT INTO categories (name, code, description) VALUES (?, ?, ?)',
      [name.trim(), code.trim().toUpperCase(), description?.trim() || null]
    );
    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE', 'CATEGORY', result.lastInsertRowid, { name, code });
    res.json({ success: true, message: 'Kategori berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'Kode atau nama kategori sudah ada.' });
    }
    console.error('[Inventory] Failed to create category:', err);
    res.status(500).json({ success: false, message: 'Gagal menambahkan kategori.' });
  }
});

// PUT /api/categories/:id
router.put('/categories/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, code, description, is_active } = req.body;
  if (!name?.trim() || !code?.trim()) {
    return res.status(400).json({ success: false, message: 'Nama dan kode kategori wajib diisi.' });
  }

  const category = query.get('SELECT id FROM categories WHERE id = ?', [req.params.id]);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
  }

  try {
    query.run(
      'UPDATE categories SET name = ?, code = ?, description = ?, is_active = ? WHERE id = ?',
      [name.trim(), code.trim().toUpperCase(), description?.trim() || null, is_active === 0 ? 0 : 1, req.params.id]
    );
    logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE', 'CATEGORY', req.params.id, { name, code, is_active });
    res.json({ success: true, message: 'Kategori berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'Kode atau nama kategori sudah digunakan.' });
    }
    console.error('[Inventory] Failed to update category:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui kategori.' });
  }
});

// DELETE /api/categories/:id (soft delete to preserve catalog history)
router.delete('/categories/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const result = query.run('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.id]);
  if (!result.changes) {
    return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
  }

  logAudit(req.user.id, req.user.name, req.user.role, 'DEACTIVATE', 'CATEGORY', req.params.id, {});
  res.json({ success: true, message: 'Kategori dinonaktifkan. Riwayat katalog tetap tersimpan.' });
});

// GET /api/locations
router.get('/locations', authenticate, (req, res) => {
  const locations = query.all(`
    SELECT l.*, 
           (SELECT COUNT(*) FROM asset_units WHERE location_id = l.id) as asset_count
    FROM locations l
    ORDER BY l.name ASC`
  );
  res.json({ success: true, locations });
});

// POST /api/locations
router.post('/locations', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, code, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Nama dan kode lokasi wajib diisi.' });
  }

  try {
    const result = query.run(
      'INSERT INTO locations (name, code, description) VALUES (?, ?, ?)',
      [name, code.toUpperCase(), description || null]
    );
    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE', 'LOCATION', result.lastInsertRowid, { name, code });
    res.json({ success: true, message: 'Lokasi penyimpanan berhasil ditambahkan.' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Kode atau nama lokasi sudah ada.' });
  }
});

// GET /api/items (Item types catalog)
router.get('/items', authenticate, (req, res) => {
  const { search, category_id, tracking_mode, include_inactive } = req.query;
  let sql = `
    SELECT it.*, c.name as category_name,
           (SELECT COUNT(*) FROM asset_units WHERE item_type_id = it.id AND status = 'tersedia') as units_available,
           (SELECT COUNT(*) FROM asset_units WHERE item_type_id = it.id AND status = 'dipakai') as units_in_use,
           (SELECT COUNT(*) FROM asset_units WHERE item_type_id = it.id AND status != 'nonaktif') as units_total,
           (SELECT SUM(quantity_total) FROM stock_pools WHERE item_type_id = it.id) as pool_total,
           (SELECT SUM(quantity_available) FROM stock_pools WHERE item_type_id = it.id) as pool_available
    FROM item_types it
    JOIN categories c ON it.category_id = c.id
    WHERE 1=1 ${include_inactive === 'true' ? '' : "AND it.is_active = 1"}
  `;
  const params = [];

  if (category_id) {
    sql += ' AND it.category_id = ?';
    params.push(category_id);
  }
  if (tracking_mode) {
    sql += ' AND it.tracking_mode = ?';
    params.push(tracking_mode);
  }
  if (search) {
    sql += ' AND (it.name LIKE ? OR it.code LIKE ? OR it.brand_model LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY it.name ASC';
  const items = query.all(sql, params);
  res.json({ success: true, items });
});

// POST /api/items
router.post('/items/generate-code', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, category_id } = req.body;
  if (!name?.trim() || !category_id) {
    return res.status(400).json({ success: false, message: 'Nama barang dan kategori wajib dipilih untuk membuat kode.' });
  }

  const category = query.get(
    'SELECT code FROM categories WHERE id = ? AND is_active = 1',
    [category_id]
  );
  if (!category) {
    return res.status(400).json({ success: false, message: 'Kategori tidak ditemukan atau sudah dinonaktifkan.' });
  }

  const normalize = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const categoryCode = normalize(category.code);
  const itemNameCode = normalize(name).slice(0, 20).replace(/-+$/g, '');
  if (!categoryCode || !itemNameCode) {
    return res.status(400).json({ success: false, message: 'Nama atau kode kategori tidak menghasilkan kode yang valid.' });
  }

  const baseCode = `${categoryCode}-${itemNameCode}`;
  const existingCodes = query.all('SELECT code FROM item_types WHERE code LIKE ?', [`${baseCode}-%`]);
  const sequence = existingCodes.reduce((max, row) => {
    const match = row.code.match(new RegExp(`^${baseCode}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  const code = `${baseCode}-${String(sequence).padStart(3, '0')}`;
  res.json({ success: true, code });
});

// POST /api/items/import (atomic CSV catalog import)
router.post('/items/import', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'File tidak berisi data barang untuk diimpor.' });
  }
  if (rows.length > 500) {
    return res.status(400).json({ success: false, message: 'Maksimal 500 baris barang dapat diimpor sekaligus.' });
  }

  const errors = [];
  const normalizedRows = [];
  const seenCodes = new Set();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`Baris ${rowNumber}: format data tidak valid.`);
      return;
    }
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const code = typeof row.code === 'string' ? row.code.trim().toUpperCase() : '';
    const categoryCode = typeof row.category_code === 'string' ? row.category_code.trim().toUpperCase() : '';
    const trackingMode = typeof row.tracking_mode === 'string' ? row.tracking_mode.trim() : '';
    const unitOfMeasure = typeof row.unit_of_measure === 'string' ? row.unit_of_measure.trim() : '';
    const locationCode = typeof row.location_code === 'string' ? row.location_code.trim().toUpperCase() : '';
    const condition = typeof row.condition === 'string' && row.condition.trim() ? row.condition.trim().toLowerCase() : 'baik';
    const quantity = row.opening_stock === '' || row.opening_stock === null || row.opening_stock === undefined
      ? 0
      : Number(row.opening_stock);

    if (!name || !code || !categoryCode || !trackingMode || !unitOfMeasure) {
      errors.push(`Baris ${rowNumber}: nama, kode katalog, kode kategori, mode pelacakan, dan satuan wajib diisi.`);
      return;
    }
    if (!['unique_unit', 'quantity_pool', 'consumable'].includes(trackingMode)) {
      errors.push(`Baris ${rowNumber}: mode pelacakan harus unique_unit, quantity_pool, atau consumable.`);
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      errors.push(`Baris ${rowNumber}: stok awal harus berupa bilangan bulat nol atau lebih.`);
      return;
    }
    if (trackingMode === 'unique_unit' && quantity !== 0) {
      errors.push(`Baris ${rowNumber}: stok awal untuk unique_unit harus 0; daftarkan setiap unit fisik secara terpisah.`);
      return;
    }
    if (trackingMode !== 'unique_unit' && !locationCode) {
      errors.push(`Baris ${rowNumber}: kode lokasi wajib untuk barang dengan stok kuantitas.`);
      return;
    }
    if (!['baik', 'rusak'].includes(condition)) {
      errors.push(`Baris ${rowNumber}: kondisi stok harus baik atau rusak.`);
      return;
    }
    if (seenCodes.has(code)) {
      errors.push(`Baris ${rowNumber}: kode katalog ${code} muncul lebih dari sekali dalam file.`);
      return;
    }
    seenCodes.add(code);

    const category = query.get('SELECT id FROM categories WHERE code = ? AND is_active = 1', [categoryCode]);
    if (!category) {
      errors.push(`Baris ${rowNumber}: kategori aktif dengan kode ${categoryCode} tidak ditemukan.`);
      return;
    }
    const location = trackingMode === 'unique_unit'
      ? null
      : query.get('SELECT id FROM locations WHERE code = ? AND is_active = 1', [locationCode]);
    if (trackingMode !== 'unique_unit' && !location) {
      errors.push(`Baris ${rowNumber}: lokasi aktif dengan kode ${locationCode} tidak ditemukan.`);
      return;
    }
    if (query.get('SELECT id FROM item_types WHERE code = ? COLLATE NOCASE', [code])) {
      errors.push(`Baris ${rowNumber}: kode katalog ${code} sudah digunakan.`);
      return;
    }

    normalizedRows.push({
      rowNumber,
      name,
      code,
      categoryId: category.id,
      categoryCode,
      brandModel: typeof row.brand_model === 'string' ? row.brand_model.trim() : '',
      unitOfMeasure,
      specs: typeof row.specs === 'string' ? row.specs.trim() : '',
      trackingMode,
      openingStock: quantity,
      locationId: location?.id ?? null,
      condition,
    });
  });

  if (errors.length) {
    const summary = errors.slice(0, 8).join(' ');
    const remainder = errors.length > 8 ? ` Dan ${errors.length - 8} kesalahan lainnya.` : '';
    return res.status(400).json({
      success: false,
      message: `Impor dibatalkan; tidak ada data yang disimpan. ${summary}${remainder}`,
    });
  }

  const importRows = query.transaction(() => {
    for (const row of normalizedRows) {
      const result = query.run(`
        INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.name, row.code, row.categoryId, row.brandModel || null, row.unitOfMeasure, row.specs || null, row.trackingMode]
      );
      const itemId = result.lastInsertRowid;

      if (row.trackingMode !== 'unique_unit') {
        query.run(`
          INSERT INTO stock_pools (item_type_id, location_id, quantity_total, quantity_available, quantity_reserved, quantity_checked_out, condition)
          VALUES (?, ?, ?, ?, 0, 0, ?)`,
          [itemId, row.locationId, row.openingStock, row.openingStock, row.condition]
        );
        if (row.openingStock > 0) {
          query.run(`
            INSERT INTO stock_movements (item_type_id, movement_type, quantity, destination_location_id, operator_id, reason)
            VALUES (?, 'masuk', ?, ?, ?, ?)`,
            [itemId, row.openingStock, row.locationId, req.user.id, `Stok awal dari impor katalog CSV (${row.code})`]
          );
        }
      }

      logAudit(req.user.id, req.user.name, req.user.role, 'IMPORT', 'ITEM_TYPE', itemId, {
        name: row.name,
        code: row.code,
        category_code: row.categoryCode,
        opening_stock: row.openingStock,
      });
    }
    return normalizedRows.length;
  });

  try {
    const imported = importRows();
    res.json({ success: true, imported, message: `${imported} katalog barang berhasil diimpor.` });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'Impor dibatalkan karena ada kode katalog atau kombinasi stok yang sudah digunakan.' });
    }
    console.error('[Inventory] Failed to import catalog CSV:', err);
    res.status(500).json({ success: false, message: 'Gagal mengimpor katalog barang.' });
  }
});

router.post('/items', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode } = req.body;
  if (!name || !code || !category_id || !tracking_mode) {
    return res.status(400).json({ success: false, message: 'Nama, kode, kategori, dan mode pelacakan wajib diisi.' });
  }

  try {
    const result = query.run(`
      INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, code.toUpperCase(), category_id, brand_model || null, unit_of_measure || 'Unit', specs || null, tracking_mode]
    );

    // If quantity_pool or consumable, initialize default stock pool at first location
    if (tracking_mode !== 'unique_unit') {
      const firstLoc = query.get('SELECT id FROM locations LIMIT 1');
      if (firstLoc) {
        query.run(`
          INSERT INTO stock_pools (item_type_id, location_id, quantity_total, quantity_available, quantity_reserved, quantity_checked_out)
          VALUES (?, ?, 0, 0, 0, 0)`,
          [result.lastInsertRowid, firstLoc.id]
        );
      }
    }

    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE', 'ITEM_TYPE', result.lastInsertRowid, { name, code });
    res.json({ success: true, message: 'Jenis barang berhasil didaftarkan.' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Kode jenis barang sudah ada.' });
  }
});

// PUT /api/items/:id
router.put('/items/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode } = req.body;
  if (!name?.trim() || !code?.trim() || !category_id || !['unique_unit', 'quantity_pool', 'consumable'].includes(tracking_mode)) {
    return res.status(400).json({ success: false, message: 'Nama, kode, kategori, dan mode pelacakan wajib diisi.' });
  }

  const item = query.get('SELECT * FROM item_types WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Katalog barang tidak ditemukan.' });
  }

  const category = query.get('SELECT id FROM categories WHERE id = ? AND is_active = 1', [category_id]);
  if (!category) {
    return res.status(400).json({ success: false, message: 'Kategori tidak ditemukan atau sudah dinonaktifkan.' });
  }

  if (tracking_mode !== item.tracking_mode) {
    const hasAssets = query.get('SELECT 1 FROM asset_units WHERE item_type_id = ? LIMIT 1', [item.id]);
    const hasPools = query.get('SELECT 1 FROM stock_pools WHERE item_type_id = ? LIMIT 1', [item.id]);
    if (hasAssets || hasPools) {
      return res.status(400).json({
        success: false,
        message: 'Mode pelacakan tidak dapat diubah karena barang sudah memiliki data stok atau unit aset.',
      });
    }
  }

  try {
    query.run(`
      UPDATE item_types
      SET name = ?, code = ?, category_id = ?, brand_model = ?, unit_of_measure = ?, specs = ?, tracking_mode = ?
      WHERE id = ?`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        category_id,
        brand_model?.trim() || null,
        unit_of_measure?.trim() || 'Unit',
        specs?.trim() || null,
        tracking_mode,
        item.id,
      ]
    );

    logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE', 'ITEM_TYPE', item.id, { name, code, category_id, tracking_mode });
    res.json({ success: true, message: 'Katalog barang berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'Kode katalog sudah digunakan.' });
    }
    console.error('[Inventory] Failed to update item type:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui katalog barang.' });
  }
});

// DELETE /api/items/:id (Archive catalog while preserving its history)
router.delete('/items/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isSafeInteger(itemId) || itemId < 1) {
    return res.status(400).json({ success: false, message: 'ID katalog tidak valid.' });
  }

  const item = query.get('SELECT id, name, code, is_active FROM item_types WHERE id = ?', [itemId]);
  if (!item || !item.is_active) {
    return res.status(404).json({ success: false, message: 'Katalog aktif tidak ditemukan.' });
  }

  const activeAsset = query.get(
    "SELECT asset_code FROM asset_units WHERE item_type_id = ? AND status != 'nonaktif' LIMIT 1",
    [itemId]
  );
  if (activeAsset) {
    return res.status(409).json({
      success: false,
      message: `Katalog masih memiliki unit aktif (${activeAsset.asset_code}). Hapus/nonaktifkan unit fisik tersebut terlebih dahulu.`,
    });
  }

  const stock = query.get(
    `SELECT 1 FROM stock_pools
     WHERE item_type_id = ? AND (
       quantity_total > 0 OR quantity_available > 0 OR quantity_reserved > 0 OR quantity_checked_out > 0
     ) LIMIT 1`,
    [itemId]
  );
  if (stock) {
    return res.status(409).json({
      success: false,
      message: 'Katalog masih memiliki stok kuantitas. Sesuaikan seluruh stok menjadi nol terlebih dahulu.',
    });
  }

  query.run('UPDATE item_types SET is_active = 0 WHERE id = ?', [itemId]);
  logAudit(req.user.id, req.user.name, req.user.role, 'DEACTIVATE', 'ITEM_TYPE', itemId, {
    name: item.name,
    code: item.code,
  });
  res.json({ success: true, message: 'Katalog dihapus dari daftar aktif. Riwayat dan data terkait tetap tersimpan.' });
});

// POST /api/items/:id/restore
router.post('/items/:id/restore', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isSafeInteger(itemId) || itemId < 1) {
    return res.status(400).json({ success: false, message: 'ID katalog tidak valid.' });
  }

  const result = query.run('UPDATE item_types SET is_active = 1 WHERE id = ? AND is_active = 0', [itemId]);
  if (!result.changes) {
    return res.status(404).json({ success: false, message: 'Katalog nonaktif tidak ditemukan.' });
  }
  logAudit(req.user.id, req.user.name, req.user.role, 'RESTORE', 'ITEM_TYPE', itemId, {});
  res.json({ success: true, message: 'Katalog berhasil diaktifkan kembali.' });
});

// GET /api/assets (Physical unique units)
router.get('/assets', authenticate, (req, res) => {
  const { item_type_id, location_id, status, condition, search, include_inactive } = req.query;
  let sql = `
    SELECT au.*, it.name as item_name, it.brand_model, it.unit_of_measure, c.name as category_name,
           l.name as location_name, ou.name as unit_name
    FROM asset_units au
    JOIN item_types it ON au.item_type_id = it.id
    JOIN categories c ON it.category_id = c.id
    JOIN locations l ON au.location_id = l.id
    LEFT JOIN organizational_units ou ON au.unit_id = ou.id
    WHERE 1=1
  `;
  const params = [];

  if (include_inactive !== 'true' && !status) {
    sql += " AND au.status != 'nonaktif'";
  }
  if (item_type_id) {
    sql += ' AND au.item_type_id = ?';
    params.push(item_type_id);
  }
  if (location_id) {
    sql += ' AND au.location_id = ?';
    params.push(location_id);
  }
  if (status) {
    sql += ' AND au.status = ?';
    params.push(status);
  }
  if (condition) {
    sql += ' AND au.condition = ?';
    params.push(condition);
  }
  if (search) {
    sql += ' AND (au.asset_code LIKE ? OR au.serial_number LIKE ? OR it.name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY au.id DESC';
  const assets = query.all(sql, params);
  res.json({ success: true, assets });
});

// DELETE /api/assets/:id (Soft-delete a physical asset)
router.delete('/assets/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const assetId = Number(req.params.id);
  if (!Number.isSafeInteger(assetId) || assetId < 1) {
    return res.status(400).json({ success: false, message: 'ID aset tidak valid.' });
  }
  const asset = query.get('SELECT id, asset_code, item_type_id, status FROM asset_units WHERE id = ?', [assetId]);
  if (!asset || asset.status === 'nonaktif') {
    return res.status(404).json({ success: false, message: 'Unit aset aktif tidak ditemukan.' });
  }
  if (asset.status !== 'tersedia') {
    return res.status(409).json({ success: false, message: 'Aset yang sedang dipinjam atau dipesan tidak dapat dihapus.' });
  }
  const kitReference = query.get('SELECT 1 FROM kit_components WHERE asset_unit_id = ? LIMIT 1', [assetId]);
  if (kitReference) {
    return res.status(409).json({ success: false, message: 'Aset masih tercatat sebagai komponen paket. Lepaskan aset dari paket sebelum menghapusnya.' });
  }

  query.run("UPDATE asset_units SET status = 'nonaktif' WHERE id = ?", [assetId]);
  logAudit(req.user.id, req.user.name, req.user.role, 'DELETE_ASSET', 'ASSET_UNIT', assetId, {
    asset_code: asset.asset_code,
    item_type_id: asset.item_type_id,
  });
  res.json({ success: true, message: `Aset ${asset.asset_code} dihapus dari daftar aktif. Riwayat tetap tersimpan.` });
});

// POST /api/assets/:id/restore
router.post('/assets/:id/restore', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const assetId = Number(req.params.id);
  if (!Number.isSafeInteger(assetId) || assetId < 1) {
    return res.status(400).json({ success: false, message: 'ID aset tidak valid.' });
  }

  const asset = query.get(
    `SELECT au.id, au.asset_code, au.item_type_id, au.location_id
     FROM asset_units au
     JOIN item_types it ON au.item_type_id = it.id
     JOIN locations l ON au.location_id = l.id
     WHERE au.id = ? AND au.status = 'nonaktif' AND it.is_active = 1 AND l.is_active = 1`,
    [assetId]
  );
  if (!asset) {
    return res.status(404).json({ success: false, message: 'Aset nonaktif dengan katalog dan lokasi aktif tidak ditemukan.' });
  }

  query.run("UPDATE asset_units SET status = 'tersedia' WHERE id = ?", [assetId]);
  logAudit(req.user.id, req.user.name, req.user.role, 'RESTORE_ASSET', 'ASSET_UNIT', assetId, {
    asset_code: asset.asset_code,
  });
  res.json({ success: true, message: `Aset ${asset.asset_code} berhasil diaktifkan kembali.` });
});

// PUT /api/assets/:id (Correct physical asset data)
router.put('/assets/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const assetId = Number(req.params.id);
  const { item_type_id, asset_code, serial_number, location_id, condition } = req.body;
  const itemTypeId = Number(item_type_id);
  const locationId = Number(location_id);
  const normalizedCode = typeof asset_code === 'string' ? asset_code.trim().toUpperCase() : '';
  const normalizedSerial = typeof serial_number === 'string' ? serial_number.trim() : '';

  if (!Number.isSafeInteger(assetId) || assetId < 1 ||
    !Number.isSafeInteger(itemTypeId) || itemTypeId < 1 ||
    !Number.isSafeInteger(locationId) || locationId < 1 ||
    !normalizedCode ||
    !['baik', 'rusak_ringan', 'rusak_berat', 'perawatan'].includes(condition)) {
    return res.status(400).json({ success: false, message: 'Data barang, kode aset, lokasi, atau kondisi tidak valid.' });
  }

  const asset = query.get('SELECT * FROM asset_units WHERE id = ?', [assetId]);
  if (!asset) {
    return res.status(404).json({ success: false, message: 'Unit aset fisik tidak ditemukan.' });
  }
  const item = query.get(
    "SELECT id FROM item_types WHERE id = ? AND is_active = 1 AND tracking_mode = 'unique_unit'",
    [itemTypeId]
  );
  if (!item) {
    return res.status(400).json({ success: false, message: 'Pilih katalog aktif dengan mode pelacakan Unit Unik.' });
  }
  const location = query.get('SELECT id FROM locations WHERE id = ? AND is_active = 1', [locationId]);
  if (!location) {
    return res.status(400).json({ success: false, message: 'Lokasi tidak ditemukan atau sudah dinonaktifkan.' });
  }
  if (locationId !== asset.location_id && ['dipakai', 'dipesan'].includes(asset.status)) {
    return res.status(400).json({ success: false, message: 'Lokasi aset tidak dapat diubah saat sedang dipinjam atau dipesan.' });
  }
  if (itemTypeId !== asset.item_type_id) {
    const hasHistory = query.get(
      `SELECT 1
       WHERE EXISTS (SELECT 1 FROM transaction_lines WHERE asset_unit_id = ?)
          OR EXISTS (SELECT 1 FROM kit_components WHERE asset_unit_id = ?)
          OR EXISTS (SELECT 1 FROM kit_manifest_items WHERE asset_unit_id = ?)
       LIMIT 1`,
      [assetId, assetId, assetId]
    );
    if (hasHistory) {
      return res.status(400).json({ success: false, message: 'Jenis barang tidak dapat diubah karena aset sudah tercatat pada transaksi atau paket.' });
    }
  }

  try {
    query.transaction(() => {
      const locationChanged = locationId !== asset.location_id;
      const itemTypeChanged = itemTypeId !== asset.item_type_id;
      query.run(`
        UPDATE asset_units
        SET item_type_id = ?, asset_code = ?, qr_code = ?, serial_number = ?, location_id = ?, condition = ?
        WHERE id = ?`,
        [itemTypeId, normalizedCode, normalizedCode, normalizedSerial || null, locationId, condition, assetId]
      );

      if (itemTypeChanged) {
        query.run('UPDATE stock_movements SET item_type_id = ? WHERE asset_unit_id = ?', [itemTypeId, assetId]);
      }
      if (locationChanged) {
        query.run(`
          INSERT INTO stock_movements (
            item_type_id, asset_unit_id, movement_type, quantity, source_location_id, destination_location_id, operator_id, reason
          ) VALUES (?, ?, 'mutasi', 1, ?, ?, ?, 'Koreksi lokasi aset fisik')`,
          [itemTypeId, assetId, asset.location_id, locationId, req.user.id]
        );
      }

      logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_ASSET', 'ASSET_UNIT', assetId, {
        before: {
          item_type_id: asset.item_type_id,
          asset_code: asset.asset_code,
          serial_number: asset.serial_number,
          location_id: asset.location_id,
          condition: asset.condition,
        },
        after: {
          item_type_id: itemTypeId,
          asset_code: normalizedCode,
          serial_number: normalizedSerial || null,
          location_id: locationId,
          condition,
        },
      });
    })();

    res.json({ success: true, message: 'Data aset fisik berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, message: 'Kode aset tersebut sudah digunakan.' });
    }
    console.error('[Inventory] Failed to update physical asset:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui data aset fisik.' });
  }
});

// POST /api/assets/bulk (Register physical units using catalog-based asset codes)
router.post('/assets/bulk', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { item_type_id, quantity, location_id, condition, serial_number } = req.body;
  const itemTypeId = Number(item_type_id);
  const unitCount = Number(quantity);
  const locationId = Number(location_id);
  const initialCondition = condition || 'baik';
  const serialNumber = typeof serial_number === 'string' ? serial_number.trim() : '';

  if (!Number.isSafeInteger(itemTypeId) || itemTypeId < 1 ||
    !Number.isSafeInteger(locationId) || locationId < 1 ||
    !Number.isSafeInteger(unitCount) || unitCount < 1 || unitCount > 500) {
    return res.status(400).json({ success: false, message: 'Barang, lokasi, dan jumlah unit (1–500) wajib diisi dengan benar.' });
  }
  if (!['baik', 'rusak_ringan', 'rusak_berat', 'perawatan'].includes(initialCondition)) {
    return res.status(400).json({ success: false, message: 'Kondisi awal aset tidak valid.' });
  }
  if (unitCount > 1 && serialNumber) {
    return res.status(400).json({ success: false, message: 'Nomor seri hanya dapat diisi saat mendaftarkan satu unit.' });
  }

  const item = query.get(
    "SELECT id, code FROM item_types WHERE id = ? AND is_active = 1 AND tracking_mode = 'unique_unit'",
    [itemTypeId]
  );
  if (!item) {
    return res.status(400).json({ success: false, message: 'Pilih katalog aktif dengan mode pelacakan Unit Unik.' });
  }
  const location = query.get('SELECT id FROM locations WHERE id = ? AND is_active = 1', [locationId]);
  if (!location) {
    return res.status(400).json({ success: false, message: 'Lokasi tidak ditemukan atau sudah dinonaktifkan.' });
  }

  try {
    const assetCodes = query.transaction(() => {
      const existingCodes = query.all(
        'SELECT asset_code FROM asset_units WHERE item_type_id = ?',
        [itemTypeId]
      );
      const escapedCatalogCode = item.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codePattern = new RegExp(`^${escapedCatalogCode}-(\\d+)$`, 'i');
      let sequence = existingCodes.reduce((highest, asset) => {
        const match = asset.asset_code.match(codePattern);
        const existingSequence = match ? Number(match[1]) : 0;
        return Number.isSafeInteger(existingSequence) ? Math.max(highest, existingSequence) : highest;
      }, 0) + 1;
      const createdCodes = [];

      while (createdCodes.length < unitCount) {
        const assetCode = `${item.code}-${String(sequence).padStart(3, '0')}`;
        sequence += 1;
        if (query.get('SELECT 1 FROM asset_units WHERE asset_code = ? OR qr_code = ?', [assetCode, assetCode])) continue;

        const result = query.run(`
          INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, condition, status, qr_code)
          VALUES (?, ?, ?, ?, ?, 'tersedia', ?)`,
          [itemTypeId, assetCode, unitCount === 1 ? serialNumber || null : null, locationId, initialCondition, assetCode]
        );
        query.run(`
          INSERT INTO stock_movements (item_type_id, asset_unit_id, movement_type, quantity, destination_location_id, operator_id, reason)
          VALUES (?, ?, 'masuk', 1, ?, ?, 'Pendaftaran unit aset fisik baru')`,
          [itemTypeId, result.lastInsertRowid, locationId, req.user.id]
        );
        createdCodes.push(assetCode);
      }

      logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_ASSET_BATCH', 'ASSET_UNIT', createdCodes[0], {
        item_type_id: itemTypeId,
        quantity: createdCodes.length,
        asset_codes: createdCodes,
      });
      return createdCodes;
    })();

    res.json({
      success: true,
      message: `${assetCodes.length} unit aset fisik berhasil didaftarkan.`,
      asset_codes: assetCodes,
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ success: false, message: 'Kode aset yang dihasilkan sudah digunakan. Silakan coba lagi.' });
    }
    console.error('[Inventory] Failed to register physical asset units:', err);
    res.status(500).json({ success: false, message: 'Gagal mendaftarkan unit aset fisik.' });
  }
});

// POST /api/assets (Add physical unit)
router.post('/assets', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { item_type_id, asset_code, serial_number, location_id, unit_id, condition, notes } = req.body;
  if (!item_type_id || !asset_code || !location_id) {
    return res.status(400).json({ success: false, message: 'Item, kode aset, dan lokasi wajib diisi.' });
  }

  try {
    const result = query.run(`
      INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'tersedia', ?, ?)`,
      [item_type_id, asset_code.toUpperCase(), serial_number || null, location_id, unit_id || null, condition || 'baik', asset_code.toUpperCase(), notes || null]
    );

    // Record movement
    query.run(`
      INSERT INTO stock_movements (item_type_id, asset_unit_id, movement_type, quantity, destination_location_id, operator_id, reason)
      VALUES (?, ?, 'masuk', 1, ?, ?, 'Pendaftaran unit aset fisik baru')`,
      [item_type_id, result.lastInsertRowid, location_id, req.user.id]
    );

    logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_ASSET', 'ASSET_UNIT', result.lastInsertRowid, { asset_code });
    res.json({ success: true, message: 'Unit aset fisik berhasil ditambahkan.' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Kode aset fisik sudah digunakan.' });
  }
});

// GET /api/stock-pools
router.get('/stock-pools', authenticate, (req, res) => {
  const pools = query.all(`
    SELECT sp.*, it.name as item_name, it.code as item_code, it.unit_of_measure, it.tracking_mode,
           l.name as location_name
    FROM stock_pools sp
    JOIN item_types it ON sp.item_type_id = it.id
    JOIN locations l ON sp.location_id = l.id
    ORDER BY it.name ASC`
  );
  res.json({ success: true, pools });
});

// POST /api/stock-pools/adjust (Stock correction with audit)
router.post('/stock-pools/adjust', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { pool_id, new_quantity, reason } = req.body;
  const parsedQuantity = Number(new_quantity);
  if (!pool_id || !Number.isInteger(parsedQuantity) || parsedQuantity < 0 || !reason?.trim()) {
    return res.status(400).json({ success: false, message: 'Pool ID, jumlah baru, dan alasan wajib diisi.' });
  }

  const pool = query.get('SELECT * FROM stock_pools WHERE id = ?', [pool_id]);
  if (!pool) {
    return res.status(404).json({ success: false, message: 'Stok pool tidak ditemukan.' });
  }

  const diff = parsedQuantity - pool.quantity_total;
  const newAvailable = pool.quantity_available + diff;

  if (newAvailable < 0) {
    return res.status(400).json({ success: false, message: 'Jumlah tersedia tidak mencukupi untuk pengurangan ini.' });
  }

  const adjustStock = query.transaction(() => {
    query.run(`
      UPDATE stock_pools
      SET quantity_total = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [parsedQuantity, newAvailable, pool_id]
    );

    query.run(`
      INSERT INTO stock_movements (item_type_id, movement_type, quantity, destination_location_id, operator_id, reason)
      VALUES (?, 'penyesuaian', ?, ?, ?, ?)`,
      [pool.item_type_id, diff, pool.location_id, req.user.id, reason.trim()]
    );

    logAudit(req.user.id, req.user.name, req.user.role, 'STOCK_ADJUST', 'STOCK_POOL', pool_id, {
      old_total: pool.quantity_total,
      new_total: parsedQuantity,
      diff,
      reason
    });
  });

  adjustStock();
  res.json({ success: true, message: 'Penyesuaian stok berhasil disimpan.' });
});

// GET /api/kits (Asset kits / packages)
router.get('/kits', authenticate, (req, res) => {
  const kits = query.all(`
    SELECT ak.*, kt.name as template_name, l.name as location_name,
           (SELECT COUNT(*) FROM kit_components WHERE asset_kit_id = ak.id) as component_count,
           (SELECT COUNT(*) FROM kit_components WHERE asset_kit_id = ak.id AND condition = 'baik') as good_component_count
    FROM asset_kits ak
    JOIN kit_templates kt ON ak.kit_template_id = kt.id
    JOIN locations l ON ak.location_id = l.id
    ORDER BY ak.name ASC`
  );

  const enrichedKits = kits.map(k => {
    const components = query.all(`
      SELECT kc.*, au.asset_code, it.name as item_name
      FROM kit_components kc
      LEFT JOIN asset_units au ON kc.asset_unit_id = au.id
      LEFT JOIN item_types it ON kc.item_type_id = it.id
      WHERE kc.asset_kit_id = ?`,
      [k.id]
    );
    return { ...k, components };
  });

  res.json({ success: true, kits: enrichedKits });
});

// GET /api/kits/:id
router.get('/kits/:id', authenticate, (req, res) => {
  const kit = query.get(`
    SELECT ak.*, kt.name as template_name, l.name as location_name
    FROM asset_kits ak
    JOIN kit_templates kt ON ak.kit_template_id = kt.id
    JOIN locations l ON ak.location_id = l.id
    WHERE ak.id = ?`,
    [req.params.id]
  );

  if (!kit) {
    return res.status(404).json({ success: false, message: 'Paket tidak ditemukan.' });
  }

  const components = query.all(`
    SELECT kc.*, au.asset_code, au.serial_number, it.name as item_name
    FROM kit_components kc
    LEFT JOIN asset_units au ON kc.asset_unit_id = au.id
    LEFT JOIN item_types it ON kc.item_type_id = it.id
    WHERE kc.asset_kit_id = ?`,
    [kit.id]
  );

  res.json({ success: true, kit: { ...kit, components } });
});

// PUT /api/kits/:id
router.put('/kits/:id', authenticate, authorize(['admin_inventaris']), (req, res) => {
  const { name, kit_code, location_id, notes, components } = req.body;
  if (!name?.trim() || !kit_code?.trim() || !location_id || !Array.isArray(components)) {
    return res.status(400).json({ success: false, message: 'Nama, kode, lokasi, dan daftar komponen wajib diisi.' });
  }

  const kit = query.get('SELECT * FROM asset_kits WHERE id = ?', [req.params.id]);
  if (!kit) {
    return res.status(404).json({ success: false, message: 'Paket tidak ditemukan.' });
  }
  if (kit.status === 'dipakai') {
    return res.status(400).json({ success: false, message: 'Paket yang sedang dipakai tidak dapat diedit.' });
  }

  const activeTransaction = query.get(`
    SELECT 1
    FROM transaction_lines tl
    JOIN transactions t ON t.id = tl.transaction_id
    WHERE tl.asset_kit_id = ? AND t.status IN ('dipesan', 'diserahkan', 'kembali_sebagian')
    LIMIT 1`,
    [kit.id]
  );
  if (activeTransaction) {
    return res.status(400).json({ success: false, message: 'Paket masih terhubung dengan transaksi aktif dan belum dapat diedit.' });
  }

  const location = query.get('SELECT id FROM locations WHERE id = ?', [location_id]);
  if (!location) {
    return res.status(400).json({ success: false, message: 'Lokasi tidak ditemukan.' });
  }

  for (const component of components) {
    const quantity = Number(component.quantity);
    if (!component.component_name?.trim() || !Number.isInteger(quantity) || quantity < 1 ||
        !['baik', 'rusak'].includes(component.condition || 'baik')) {
      return res.status(400).json({ success: false, message: 'Setiap komponen harus memiliki nama, jumlah minimal 1, dan kondisi yang valid.' });
    }
    if (component.asset_unit_id) {
      const asset = query.get('SELECT item_type_id FROM asset_units WHERE id = ?', [component.asset_unit_id]);
      if (!asset) {
        return res.status(400).json({ success: false, message: 'Salah satu unit aset komponen tidak ditemukan.' });
      }
      if (component.item_type_id && Number(component.item_type_id) !== asset.item_type_id) {
        return res.status(400).json({ success: false, message: 'Katalog komponen tidak sesuai dengan jenis unit aset yang dipilih.' });
      }
    }
  }

  const updateKit = query.transaction(() => {
    query.run(`
      UPDATE asset_kits
      SET name = ?, kit_code = ?, qr_code = ?, location_id = ?, notes = ?
      WHERE id = ?`,
      [name.trim(), kit_code.trim().toUpperCase(), kit_code.trim().toUpperCase(), location_id, notes?.trim() || null, kit.id]
    );
    query.run('DELETE FROM kit_components WHERE asset_kit_id = ?', [kit.id]);
    for (const component of components) {
      query.run(`
        INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          kit.id,
          component.item_type_id || null,
          component.component_name.trim(),
          component.asset_unit_id || null,
          Number(component.quantity),
          component.condition || 'baik',
          component.is_required === 0 ? 0 : 1,
        ]
      );
    }
  });

  try {
    updateKit();
    logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE', 'ASSET_KIT', kit.id, { name, kit_code, location_id, component_count: components.length });
    res.json({ success: true, message: 'Paket dan kelengkapannya berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ success: false, message: 'Kode paket sudah digunakan.' });
    }
    console.error('[Inventory] Failed to update kit:', err);
    res.status(500).json({ success: false, message: 'Gagal memperbarui paket.' });
  }
});

// GET /api/kit-templates
router.get('/kit-templates', authenticate, (req, res) => {
  const templates = query.all('SELECT * FROM kit_templates WHERE is_active = 1 ORDER BY name ASC');
  const enriched = templates.map(t => {
    const lines = query.all('SELECT * FROM kit_template_lines WHERE kit_template_id = ?', [t.id]);
    return { ...t, lines };
  });
  res.json({ success: true, templates: enriched });
});

export default router;
