import express from 'express';
import { query } from '../db/database.js';
import { authenticate, logAudit } from '../middleware/auth.js';

const router = express.Router();

// GET /api/activities
router.get('/', authenticate, (req, res) => {
  const { status, search } = req.query;
  let sql = `
    SELECT a.*, bc.phone_wa as pic_phone, bc.email as pic_email, bc.institution as pic_institution
    FROM activities a
    LEFT JOIN borrower_contacts bc ON a.pic_contact_id = bc.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (a.name LIKE ? OR a.location LIKE ? OR a.pic_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY a.start_time ASC';
  const activities = query.all(sql, params);
  res.json({ success: true, activities });
});

// POST /api/activities
router.post('/', authenticate, (req, res) => {
  const { name, activity_type, location, start_time, end_time, pic_contact_id, pic_name, notes } = req.body;
  if (!name || !activity_type || !location || !start_time || !end_time || !pic_name) {
    return res.status(400).json({ success: false, message: 'Harap lengkapi semua data wajib kegiatan.' });
  }

  const result = query.run(`
    INSERT INTO activities (name, activity_type, location, start_time, end_time, pic_contact_id, pic_name, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name.trim(), activity_type, location.trim(), start_time, end_time, pic_contact_id || null, pic_name.trim(), notes || null]
  );

  logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_ACTIVITY', 'ACTIVITY', result.lastInsertRowid, { name });
  res.json({ success: true, message: 'Agenda kegiatan berhasil ditambahkan.', id: result.lastInsertRowid });
});

// GET /api/activities/templates
router.get('/templates', authenticate, (req, res) => {
  const templates = query.all('SELECT * FROM activity_templates ORDER BY name ASC');
  const enriched = templates.map(t => {
    const lines = query.all(`
      SELECT atl.*, it.name as item_name, it.brand_model, it.tracking_mode,
             alt.name as alternative_item_name
      FROM activity_template_lines atl
      JOIN item_types it ON atl.item_type_id = it.id
      LEFT JOIN item_types alt ON atl.alternative_item_type_id = alt.id
      WHERE atl.activity_template_id = ?`,
      [t.id]
    );
    return { ...t, lines };
  });

  res.json({ success: true, templates: enriched });
});

// POST /api/activities/recommend (Smart Recommendation Engine)
router.post('/recommend', authenticate, (req, res) => {
  const { template_id, scale_factor = 1.0, start_date, expected_return_date } = req.body;

  if (!template_id) {
    return res.status(400).json({ success: false, message: 'Template kegiatan harus dipilih.' });
  }

  const template = query.get('SELECT * FROM activity_templates WHERE id = ?', [template_id]);
  if (!template) {
    return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
  }

  const templateLines = query.all(`
    SELECT atl.*, it.name as item_name, it.brand_model, it.tracking_mode, it.unit_of_measure,
           alt.name as alternative_item_name
    FROM activity_template_lines atl
    JOIN item_types it ON atl.item_type_id = it.id
    LEFT JOIN item_types alt ON atl.alternative_item_type_id = alt.id
    WHERE atl.activity_template_id = ?`,
    [template_id]
  );

  const recommendations = templateLines.map(line => {
    const rawQty = Math.ceil(line.base_quantity * (line.scale_factor || 1.0) * Number(scale_factor));
    const calculatedQty = Math.max(1, rawQty);

    let availableCount = 0;
    let availableUnits = [];

    if (line.tracking_mode === 'unique_unit') {
      // Find units that are in 'tersedia' status and 'baik'
      availableUnits = query.all(
        "SELECT id, asset_code, condition FROM asset_units WHERE item_type_id = ? AND status = 'tersedia' AND condition = 'baik'",
        [line.item_type_id]
      );
      availableCount = availableUnits.length;
    } else {
      // Quantity pool
      const pool = query.get('SELECT quantity_available FROM stock_pools WHERE item_type_id = ? LIMIT 1', [line.item_type_id]);
      availableCount = pool ? pool.quantity_available : 0;
    }

    const isSufficient = availableCount >= calculatedQty;
    const shortage = isSufficient ? 0 : (calculatedQty - availableCount);

    return {
      item_type_id: line.item_type_id,
      item_name: line.item_name,
      brand_model: line.brand_model,
      tracking_mode: line.tracking_mode,
      unit_of_measure: line.unit_of_measure,
      required_quantity: calculatedQty,
      available_quantity: availableCount,
      is_sufficient: isSufficient,
      shortage: shortage,
      available_units: availableUnits,
      notes: line.notes,
      alternative_item_type_id: line.alternative_item_type_id,
      alternative_item_name: line.alternative_item_name
    };
  });

  res.json({
    success: true,
    template_name: template.name,
    category: template.event_category,
    scale_factor: Number(scale_factor),
    recommendations
  });
});

export default router;
