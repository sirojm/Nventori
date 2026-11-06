import express from 'express';
import QRCode from 'qrcode';
import { query } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/qr/resolve/:code
router.get('/resolve/:code', authenticate, (req, res) => {
  let code = req.params.code.trim();

  // 0. Receipt proof QR (handover/return documents) encodes a verification URL such as
  //    https://host/api/transactions/verify-receipt/<token>. Resolve it to its transaction.
  let receiptTransactionId = null;
  const receiptMatch = code.match(/verify-receipt\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/);
  if (receiptMatch) {
    const receipt = query.get(
      'SELECT transaction_id FROM receipt_verification_tokens WHERE token = ?',
      [receiptMatch[1]]
    );
    if (receipt) receiptTransactionId = receipt.transaction_id;
  }

  // 1. Check if Transaction QR
  const tx = receiptTransactionId
    ? query.get(`
        SELECT t.*, u.name as operator_name
        FROM transactions t
        JOIN users u ON t.operator_id = u.id
        WHERE t.id = ?`,
        [receiptTransactionId]
      )
    : query.get(`
        SELECT t.*, u.name as operator_name
        FROM transactions t
        JOIN users u ON t.operator_id = u.id
        WHERE t.qr_token = ? OR t.transaction_code = ?`,
        [code, code]
      );

  if (tx) {
    const lines = query.all(`
      SELECT tl.*, it.name as item_name, au.asset_code, ak.name as kit_name
      FROM transaction_lines tl
      JOIN item_types it ON tl.item_type_id = it.id
      LEFT JOIN asset_units au ON tl.asset_unit_id = au.id
      LEFT JOIN asset_kits ak ON tl.asset_kit_id = ak.id
      WHERE tl.transaction_id = ?`,
      [tx.id]
    );

    const manifestItems = query.all(`
      SELECT kmi.*, au.asset_code
      FROM kit_manifest_items kmi
      LEFT JOIN asset_units au ON kmi.asset_unit_id = au.id
      WHERE kmi.transaction_id = ?`,
      [tx.id]
    );

    return res.json({
      success: true,
      type: 'transaction',
      data: { ...tx, lines, manifest_items: manifestItems }
    });
  }

  // 2. Check if Asset Unit QR
  const asset = query.get(`
    SELECT au.*, it.name as item_name, it.brand_model, it.specs, it.unit_of_measure,
           c.name as category_name, l.name as location_name
    FROM asset_units au
    JOIN item_types it ON au.item_type_id = it.id
    JOIN categories c ON it.category_id = c.id
    JOIN locations l ON au.location_id = l.id
    WHERE au.qr_code = ? OR au.asset_code = ?`,
    [code, code]
  );

  if (asset) {
    return res.json({
      success: true,
      type: 'asset',
      data: asset
    });
  }

  // 3. Check if Kit QR
  const kit = query.get(`
    SELECT ak.*, kt.name as template_name, l.name as location_name
    FROM asset_kits ak
    JOIN kit_templates kt ON ak.kit_template_id = kt.id
    JOIN locations l ON ak.location_id = l.id
    WHERE ak.qr_code = ? OR ak.kit_code = ?`,
    [code, code]
  );

  if (kit) {
    const components = query.all(`
      SELECT kc.*, au.asset_code, it.name as item_name
      FROM kit_components kc
      LEFT JOIN asset_units au ON kc.asset_unit_id = au.id
      LEFT JOIN item_types it ON kc.item_type_id = it.id
      WHERE kc.asset_kit_id = ?`,
      [kit.id]
    );

    return res.json({
      success: true,
      type: 'kit',
      data: { ...kit, components }
    });
  }

  return res.status(404).json({
    success: false,
    message: `Kode QR "${code}" tidak dikenali atau tidak terdaftar di sistem Nventori.`
  });
});

// GET /api/qr/image?text=... (Generates Data URL PNG QR Code)
router.get('/image', async (req, res) => {
  const { text } = req.query;
  if (!text) {
    return res.status(400).json({ success: false, message: 'Parameter text diperlukan.' });
  }

  try {
    const dataUrl = await QRCode.toDataURL(String(text), {
      width: 250,
      margin: 1,
      color: {
        dark: '#1B4332',
        light: '#FFFFFF'
      }
    });
    res.json({ success: true, dataUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat QR: ' + err.message });
  }
});

export default router;
