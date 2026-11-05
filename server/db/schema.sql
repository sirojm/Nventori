-- Nventori Database Schema (SQLite / Node 24 DatabaseSync)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizational_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin_inventaris', 'operator')),
  unit_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES organizational_units(id)
);

CREATE TABLE IF NOT EXISTS borrower_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  phone_wa TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL,
  brand_model TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'Unit',
  specs TEXT,
  tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('unique_unit', 'quantity_pool', 'consumable')),
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS asset_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type_id INTEGER NOT NULL,
  asset_code TEXT NOT NULL UNIQUE,
  serial_number TEXT,
  location_id INTEGER NOT NULL,
  unit_id INTEGER,
  condition TEXT NOT NULL DEFAULT 'baik' CHECK(condition IN ('baik', 'rusak_ringan', 'rusak_berat', 'perawatan')),
  status TEXT NOT NULL DEFAULT 'tersedia' CHECK(status IN ('tersedia', 'dipesan', 'dipakai', 'nonaktif')),
  qr_code TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (location_id) REFERENCES locations(id),
  FOREIGN KEY (unit_id) REFERENCES organizational_units(id)
);

CREATE TABLE IF NOT EXISTS stock_pools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_checked_out INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'baik' CHECK(condition IN ('baik', 'rusak')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_type_id, location_id, condition),
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS kit_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  item_type_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id)
);

CREATE TABLE IF NOT EXISTS kit_template_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_template_id INTEGER NOT NULL,
  item_type_id INTEGER,
  component_name TEXT NOT NULL,
  standard_quantity INTEGER NOT NULL DEFAULT 1,
  is_required INTEGER NOT NULL DEFAULT 1,
  tracking_mode TEXT NOT NULL DEFAULT 'unique_unit',
  FOREIGN KEY (kit_template_id) REFERENCES kit_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id)
);

CREATE TABLE IF NOT EXISTS asset_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kit_template_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kit_code TEXT NOT NULL UNIQUE,
  primary_asset_id INTEGER,
  location_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'siap_lengkap' CHECK(status IN ('siap_lengkap', 'tidak_lengkap', 'dipakai', 'perawatan')),
  notes TEXT,
  qr_code TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kit_template_id) REFERENCES kit_templates(id),
  FOREIGN KEY (primary_asset_id) REFERENCES asset_units(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS kit_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_kit_id INTEGER NOT NULL,
  item_type_id INTEGER,
  component_name TEXT NOT NULL,
  asset_unit_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'baik' CHECK(condition IN ('baik', 'rusak')),
  is_required INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (asset_kit_id) REFERENCES asset_kits(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (asset_unit_id) REFERENCES asset_units(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_code TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('internal_usage', 'inter_unit_loan')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'dipesan', 'diserahkan', 'kembali_sebagian', 'selesai', 'dibatalkan')),
  borrower_contact_id INTEGER,
  borrower_name TEXT NOT NULL,
  borrower_unit TEXT NOT NULL,
  borrower_phone TEXT NOT NULL,
  borrower_email TEXT NOT NULL,
  event_name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  start_date DATETIME NOT NULL,
  expected_return_date DATETIME NOT NULL,
  actual_return_date DATETIME,
  operator_id INTEGER NOT NULL,
  notes TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrower_contact_id) REFERENCES borrower_contacts(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS request_letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL UNIQUE,
  letter_number TEXT NOT NULL,
  letter_date DATE NOT NULL,
  sender_unit TEXT NOT NULL,
  notes TEXT,
  attachment_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transaction_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  item_type_id INTEGER NOT NULL,
  asset_unit_id INTEGER,
  asset_kit_id INTEGER,
  tracking_mode TEXT NOT NULL,
  quantity_requested INTEGER NOT NULL DEFAULT 1,
  quantity_handed_over INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (asset_unit_id) REFERENCES asset_units(id),
  FOREIGN KEY (asset_kit_id) REFERENCES asset_kits(id)
);

CREATE TABLE IF NOT EXISTS kit_manifest_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  asset_kit_id INTEGER NOT NULL,
  component_name TEXT NOT NULL,
  asset_unit_id INTEGER,
  quantity_handed_over INTEGER NOT NULL DEFAULT 1,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  condition_out TEXT NOT NULL DEFAULT 'baik',
  condition_in TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_kit_id) REFERENCES asset_kits(id),
  FOREIGN KEY (asset_unit_id) REFERENCES asset_units(id)
);

CREATE TABLE IF NOT EXISTS handover_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  handover_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  recipient_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS return_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  return_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_partial INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS return_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_event_id INTEGER NOT NULL,
  transaction_line_id INTEGER,
  asset_unit_id INTEGER,
  kit_manifest_item_id INTEGER,
  quantity_returned INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'baik' CHECK(condition IN ('baik', 'rusak')),
  notes TEXT,
  FOREIGN KEY (return_event_id) REFERENCES return_events(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_line_id) REFERENCES transaction_lines(id),
  FOREIGN KEY (asset_unit_id) REFERENCES asset_units(id),
  FOREIGN KEY (kit_manifest_item_id) REFERENCES kit_manifest_items(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type_id INTEGER NOT NULL,
  asset_unit_id INTEGER,
  movement_type TEXT NOT NULL CHECK(movement_type IN ('masuk', 'keluar', 'kembali', 'penyesuaian', 'mutasi')),
  quantity INTEGER NOT NULL,
  source_location_id INTEGER,
  destination_location_id INTEGER,
  reference_transaction_id INTEGER,
  operator_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (asset_unit_id) REFERENCES asset_units(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  location TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  pic_contact_id INTEGER,
  pic_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'terjadwal' CHECK(status IN ('terjadwal', 'berlangsung', 'selesai', 'batal')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pic_contact_id) REFERENCES borrower_contacts(id)
);

CREATE TABLE IF NOT EXISTS activity_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  event_category TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS activity_template_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_template_id INTEGER NOT NULL,
  item_type_id INTEGER NOT NULL,
  base_quantity INTEGER NOT NULL DEFAULT 1,
  is_required INTEGER NOT NULL DEFAULT 1,
  scale_factor REAL NOT NULL DEFAULT 1.0,
  alternative_item_type_id INTEGER,
  notes TEXT,
  FOREIGN KEY (activity_template_id) REFERENCES activity_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (item_type_id) REFERENCES item_types(id),
  FOREIGN KEY (alternative_item_type_id) REFERENCES item_types(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_asset_code ON asset_units(asset_code);
CREATE INDEX IF NOT EXISTS idx_asset_status ON asset_units(status);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_dates ON transactions(start_date, expected_return_date);
CREATE INDEX IF NOT EXISTS idx_borrower_contacts ON borrower_contacts(full_name, phone_wa, email);
