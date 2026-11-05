import bcrypt from 'bcryptjs';
import { db, initDatabase, query } from './database.js';

export function runSeeder() {
  console.log('[Seeder] Starting database seeding...');
  initDatabase();

  db.exec('PRAGMA foreign_keys = OFF;');

  const hashPassword = (pw) => bcrypt.hashSync(pw, 10);

  const seed = query.transaction(() => {
    // 1. Organizational Units
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM notification_outbox;
      DELETE FROM audit_logs;
      DELETE FROM stock_movements;
      DELETE FROM return_lines;
      DELETE FROM return_events;
      DELETE FROM handover_events;
      DELETE FROM kit_manifest_items;
      DELETE FROM transaction_lines;
      DELETE FROM request_letters;
      DELETE FROM transactions;
      DELETE FROM kit_components;
      DELETE FROM asset_kits;
      DELETE FROM kit_template_lines;
      DELETE FROM kit_templates;
      DELETE FROM stock_pools;
      DELETE FROM asset_units;
      DELETE FROM item_types;
      DELETE FROM locations;
      DELETE FROM categories;
      DELETE FROM borrower_contacts;
      DELETE FROM users;
      DELETE FROM organizational_units;
      DELETE FROM activity_template_lines;
      DELETE FROM activity_templates;
      DELETE FROM activities;
      PRAGMA foreign_keys = ON;
    `);

    // Units
    const u1 = query.run(`INSERT INTO organizational_units (name, code, description) VALUES (?, ?, ?)`,
      ['UTIPD', 'UTIPD', 'Unit Teknologi Informasi dan Pangkalan Data']).lastInsertRowid;

    // Users (Tepat 3 level pengguna)
    const pw = hashPassword('password123');
    query.run(`INSERT INTO users (name, username, email, password_hash, role, unit_id) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Budi Santoso, S.Kom', 'superadmin', 'superadmin@nventori.local', pw, 'super_admin', u1]);
    query.run(`INSERT INTO users (name, username, email, password_hash, role, unit_id) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Siti Rahmawati, A.Md', 'admin_inv', 'admin.inv@nventori.local', pw, 'admin_inventaris', u1]);
    query.run(`INSERT INTO users (name, username, email, password_hash, role, unit_id) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Ahmad Fauzi', 'operator1', 'operator@nventori.local', pw, 'operator', u1]);

    // Borrower Contacts
    const c1 = query.run(`INSERT INTO borrower_contacts (full_name, institution, phone_wa, email, notes) VALUES (?, ?, ?, ?, ?)`,
      ['Dr. Hendra Wijaya, M.T.', 'Fakultas Teknik Elektro', '081234567890', 'hendra.wijaya@univ.ac.id', 'Dosen Pembina Lab Robotika']).lastInsertRowid;
    const c2 = query.run(`INSERT INTO borrower_contacts (full_name, institution, phone_wa, email, notes) VALUES (?, ?, ?, ?, ?)`,
      ['Maya Anggraini, S.Kom', 'Biro Kemahasiswaan & Alumni', '081398765432', 'maya.anggraini@univ.ac.id', 'PIC Acara Sidang & Wisuda']).lastInsertRowid;
    const c3 = query.run(`INSERT INTO borrower_contacts (full_name, institution, phone_wa, email, notes) VALUES (?, ?, ?, ?, ?)`,
      ['Rizky Pratama', 'BEM Universitas (Panitia Dies Natalis)', '085712345678', 'rizky.pratama@student.univ.ac.id', 'Ketua Pelaksana Seminar Nasional']).lastInsertRowid;

    // Categories
    const catMM = query.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      ['Multimedia & Audio Visual', 'CAT-MM', 'Kamera, proyektor, mixer audio, mikrofon']).lastInsertRowid;
    const catIT = query.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      ['Komputer & TI', 'CAT-IT', 'Laptop, server mini, switch, monitor']).lastInsertRowid;
    const catDRN = query.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      ['Drone & Aerial', 'CAT-DRN', 'Pesawat nirawak, aksesoris penerbangan']).lastInsertRowid;
    const catFRN = query.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      ['Furnitur & Penunjang Acara', 'CAT-FRN', 'Kursi lipat, meja panggung, tenda']).lastInsertRowid;
    const catKBL = query.run(`INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`,
      ['Kabel & Kelistrikan', 'CAT-KBL', 'Kabel HDMI, roll kabel, konektor']).lastInsertRowid;

    // Locations
    const locPusat = query.run(`INSERT INTO locations (name, code, description) VALUES (?, ?, ?)`,
      ['Gudang Perlengkapan Pusat (Gedung A Lt. 1)', 'LOC-GPD-01', 'Penyimpanan utama barang inventaris kantor']).lastInsertRowid;
    const locStudio = query.run(`INSERT INTO locations (name, code, description) VALUES (?, ?, ?)`,
      ['Studio Multimedia (Gedung B Lt. 3)', 'LOC-STUDIO', 'Ruang simpan alat siaran dan kamera']).lastInsertRowid;

    // Item Types
    const itCam = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Kamera Mirrorless Sony A7 IV', 'IT-CAM-A74', catMM, 'Sony Alpha 7 IV', 'Unit', 'Sensor Full-frame 33MP, 4K 60p 10-bit', 'unique_unit']).lastInsertRowid;
    
    const itDrone = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['DJI Mavic 3 Enterprise Drone', 'IT-DRN-M3E', catDRN, 'DJI Mavic 3', 'Unit', 'Kamera Wide 4/3 CMOS, RTK module support', 'unique_unit']).lastInsertRowid;

    const itDroneRC = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['DJI RC Pro Enterprise Remote Control', 'IT-DRN-RC', catDRN, 'DJI RC Pro', 'Unit', 'Layar 5.5 inch FHD 1000 nits', 'unique_unit']).lastInsertRowid;

    const itDroneBatt = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Intelligent Flight Battery DJI M3', 'IT-DRN-BAT', catDRN, 'DJI 5000mAh', 'Unit', '5000 mAh LiPo 4S', 'unique_unit']).lastInsertRowid;

    const itLaptop = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Laptop Dell Latitude 5430', 'IT-LPT-DELL', catIT, 'Dell Latitude 5430', 'Unit', 'Intel Core i7-1265U, RAM 16GB, SSD 512GB', 'unique_unit']).lastInsertRowid;

    const itProjector = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Proyektor Epson EB-2250U', 'IT-PRJ-EPSON', catMM, 'Epson EB-2250U', 'Unit', '5000 Lumens WUXGA Full HD', 'unique_unit']).lastInsertRowid;

    const itChair = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Kursi Lipat Chitose', 'IT-FURN-CHAIR', catFRN, 'Chitose Yamato', 'Buah', 'Rangka pipa besi chrome, jok vinyl hitam', 'quantity_pool']).lastInsertRowid;

    const itHdmi = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Kabel HDMI Braided 15 Meter', 'IT-KBL-HDMI15', catKBL, 'Vention 4K 60Hz', 'Batang', 'Ultra High Speed HDMI 2.0 4K Gold Plated', 'quantity_pool']).lastInsertRowid;

    const itBatteryAA = query.run(`INSERT INTO item_types (name, code, category_id, brand_model, unit_of_measure, specs, tracking_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Baterai AA Alkaline Sekali Pakai', 'IT-BAT-AA', catMM, 'Panasonic Eneloop Pro / Alkaline', 'Pack', '1.5V Alkaline isi 4 butir', 'consumable']).lastInsertRowid;

    // Physical Asset Units
    const auCam1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itCam, 'NV-CAM-001', 'SN-SNY-883011', locStudio, u1, 'baik', 'tersedia', 'NV-CAM-001']).lastInsertRowid;
    const auCam2 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itCam, 'NV-CAM-002', 'SN-SNY-883012', locStudio, u1, 'baik', 'tersedia', 'NV-CAM-002']).lastInsertRowid;

    const auDrone1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itDrone, 'NV-DRN-001', 'SN-DJI-449102', locStudio, u1, 'baik', 'tersedia', 'NV-DRN-001']).lastInsertRowid;
    const auDroneRC1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itDroneRC, 'NV-RC-001', 'SN-DJI-RC-991', locStudio, u1, 'baik', 'tersedia', 'NV-RC-001']).lastInsertRowid;
    const auBatt1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itDroneBatt, 'NV-BAT-001', 'SN-BAT-001', locStudio, u1, 'baik', 'tersedia', 'NV-BAT-001']).lastInsertRowid;
    const auBatt2 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itDroneBatt, 'NV-BAT-002', 'SN-BAT-002', locStudio, u1, 'baik', 'tersedia', 'NV-BAT-002']).lastInsertRowid;
    const auBatt3 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itDroneBatt, 'NV-BAT-003', 'SN-BAT-003', locStudio, u1, 'baik', 'tersedia', 'NV-BAT-003']).lastInsertRowid;

    const auLaptop1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itLaptop, 'NV-LPT-001', 'SN-DELL-772911', locPusat, u1, 'baik', 'dipakai', 'NV-LPT-001']).lastInsertRowid;
    const auLaptop2 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itLaptop, 'NV-LPT-002', 'SN-DELL-772912', locPusat, u1, 'baik', 'tersedia', 'NV-LPT-002']).lastInsertRowid;

    const auPrj1 = query.run(`INSERT INTO asset_units (item_type_id, asset_code, serial_number, location_id, unit_id, condition, status, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itProjector, 'NV-PRJ-001', 'SN-EPSON-5510', locPusat, u1, 'baik', 'tersedia', 'NV-PRJ-001']).lastInsertRowid;

    // Stock Pools
    query.run(`INSERT INTO stock_pools (item_type_id, location_id, quantity_total, quantity_available, quantity_reserved, quantity_checked_out, condition) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itChair, locPusat, 120, 80, 0, 40, 'baik']);
    query.run(`INSERT INTO stock_pools (item_type_id, location_id, quantity_total, quantity_available, quantity_reserved, quantity_checked_out, condition) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itHdmi, locPusat, 25, 20, 0, 5, 'baik']);
    query.run(`INSERT INTO stock_pools (item_type_id, location_id, quantity_total, quantity_available, quantity_reserved, quantity_checked_out, condition) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [itBatteryAA, locPusat, 60, 60, 0, 0, 'baik']);

    // Kit Templates (Contoh Drone 01 per Blueprint Bagian 5)
    const ktDrone = query.run(`INSERT INTO kit_templates (name, code, description, item_type_id) VALUES (?, ?, ?, ?)`,
      ['Paket Drone Liputan Lapangan', 'TPL-DRN-01', 'Standar paket lengkap operasional drone liputan udara', itDrone]).lastInsertRowid;

    query.run(`INSERT INTO kit_template_lines (kit_template_id, item_type_id, component_name, standard_quantity, is_required, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)`,
      [ktDrone, itDrone, 'Drone DJI Mavic 3 Enterprise', 1, 1, 'unique_unit']);
    query.run(`INSERT INTO kit_template_lines (kit_template_id, item_type_id, component_name, standard_quantity, is_required, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)`,
      [ktDrone, itDroneRC, 'DJI RC Pro Remote Control', 1, 1, 'unique_unit']);
    query.run(`INSERT INTO kit_template_lines (kit_template_id, item_type_id, component_name, standard_quantity, is_required, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)`,
      [ktDrone, itDroneBatt, 'Baterai Drone 5000mAh', 3, 1, 'unique_unit']);
    query.run(`INSERT INTO kit_template_lines (kit_template_id, item_type_id, component_name, standard_quantity, is_required, tracking_mode) VALUES (?, ?, ?, ?, ?, ?)`,
      [ktDrone, null, 'Hardcase Safety Box Anti-Guncang', 1, 1, 'quantity_pool']);

    // Asset Kit Realization
    const kit1 = query.run(`INSERT INTO asset_kits (kit_template_id, name, kit_code, primary_asset_id, location_id, status, notes, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ktDrone, 'Paket Drone 01', 'NV-KIT-DRN-01', auDrone1, locStudio, 'siap_lengkap', 'Paket drone liputan utama studio multimedia', 'NV-KIT-DRN-01']).lastInsertRowid;

    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, itDrone, 'Drone DJI Mavic 3 Enterprise', auDrone1, 1, 'baik', 1]);
    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, itDroneRC, 'DJI RC Pro Remote Control', auDroneRC1, 1, 'baik', 1]);
    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, itDroneBatt, 'Baterai Drone 01', auBatt1, 1, 'baik', 1]);
    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, itDroneBatt, 'Baterai Drone 02', auBatt2, 1, 'baik', 1]);
    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, itDroneBatt, 'Baterai Drone 03', auBatt3, 1, 'baik', 1]);
    query.run(`INSERT INTO kit_components (asset_kit_id, item_type_id, component_name, asset_unit_id, quantity, condition, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [kit1, null, 'Hardcase Safety Box', null, 1, 'baik', 1]);

    // Activity Templates (Blueprint Bagian 8)
    const atWisuda = query.run(`INSERT INTO activity_templates (name, event_category, description) VALUES (?, ?, ?)`,
      ['Wisuda & Sidang Senat Terbuka', 'Seremonial', 'Kebutuhan standar siaran langsung, proyeksi layar besar, dan kursi peserta']).lastInsertRowid;
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atWisuda, itCam, 2, 1, 1.0, 'Kamera utama sudut podium dan wide audience']);
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atWisuda, itProjector, 2, 1, 1.0, 'Proyektor sayap kiri dan sayap kanan panggung']);
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atWisuda, itChair, 50, 1, 1.0, 'Kursi tamu VIP dan panitia']);
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atWisuda, itHdmi, 3, 1, 1.0, 'Kabel penghubung mixer ke proyektor']);

    const atSeminar = query.run(`INSERT INTO activity_templates (name, event_category, description) VALUES (?, ?, ?)`,
      ['Seminar Nasional / Workshop', 'Akademik', 'Kebutuhan presentasi audio visual ruang seminar']).lastInsertRowid;
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atSeminar, itLaptop, 1, 1, 1.0, 'Laptop kontrol operator slide']);
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atSeminar, itProjector, 1, 1, 1.0, 'Proyektor layar tengah']);
    query.run(`INSERT INTO activity_template_lines (activity_template_id, item_type_id, base_quantity, is_required, scale_factor, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [atSeminar, itHdmi, 2, 1, 1.0, 'Kabel HDMI presentasi']);

    // Activities
    query.run(`INSERT INTO activities (name, activity_type, location, start_time, end_time, pic_contact_id, pic_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Wisuda Sarjana & Magister Periode I 2026', 'Seremonial', 'Auditorium Gedung Prof. Soedarto', '2026-11-10 07:00:00', '2026-11-10 14:00:00', c2, 'Maya Anggraini, S.Kom', 'terjadwal']);
    query.run(`INSERT INTO activities (name, activity_type, location, start_time, end_time, pic_contact_id, pic_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Seminar Nasional AI dan Robotika Terapan', 'Akademik', 'Ruang Teater Gedung B Lt. 2', '2026-11-12 08:30:00', '2026-11-12 16:00:00', c1, 'Dr. Hendra Wijaya, M.T.', 'terjadwal']);

    // Sample Transaction 1: Active Inter-Unit Loan (Pinjaman Antarunit) with Surat Permohonan
    // Status: diserahkan (ready to test return!)
    const tx1 = query.run(`
      INSERT INTO transactions (
        transaction_code, transaction_type, status, borrower_contact_id,
        borrower_name, borrower_unit, borrower_phone, borrower_email,
        event_name, location_name, start_date, expected_return_date,
        operator_id, notes, qr_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'TRX-202611-001', 'inter_unit_loan', 'diserahkan', c1,
        'Dr. Hendra Wijaya, M.T.', 'Fakultas Teknik Elektro', '081234567890', 'hendra.wijaya@univ.ac.id',
        'Uji Lapangan Robotika Mandiri', 'Laboratorium Terpadu Tembalang',
        '2026-11-04 09:00:00', '2026-11-08 17:00:00',
        3, 'Peminjaman peralatan kendali dan kabel untuk demonstrasi robotika', 'QR-TRX-202611-001'
      ]
    ).lastInsertRowid;

    // Surat permohonan antarunit per blueprint Bagian 6
    query.run(`
      INSERT INTO request_letters (transaction_id, letter_number, letter_date, sender_unit, notes)
      VALUES (?, ?, ?, ?, ?)`,
      [tx1, '042/FT-EL/UNDIP/XI/2026', '2026-11-03', 'Fakultas Teknik Elektro', 'Surat fisik permohonan peminjaman inventaris ditandatangani Dekan']);

    // Transaction Lines
    const tl1 = query.run(`
      INSERT INTO transaction_lines (transaction_id, item_type_id, asset_unit_id, tracking_mode, quantity_requested, quantity_handed_over, quantity_returned)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tx1, itLaptop, auLaptop1, 'unique_unit', 1, 1, 0]).lastInsertRowid;

    const tl2 = query.run(`
      INSERT INTO transaction_lines (transaction_id, item_type_id, asset_unit_id, tracking_mode, quantity_requested, quantity_handed_over, quantity_returned)
      VALUES (?, ?, null, ?, ?, ?, ?)`,
      [tx1, itHdmi, 'quantity_pool', 2, 2, 0]).lastInsertRowid;

    const tl3 = query.run(`
      INSERT INTO transaction_lines (transaction_id, item_type_id, asset_unit_id, tracking_mode, quantity_requested, quantity_handed_over, quantity_returned)
      VALUES (?, ?, null, ?, ?, ?, ?)`,
      [tx1, itChair, 'quantity_pool', 10, 10, 0]).lastInsertRowid;

    // Handover Event
    query.run(`
      INSERT INTO handover_events (transaction_id, operator_id, handover_time, notes, recipient_name)
      VALUES (?, ?, ?, ?, ?)`,
      [tx1, 3, '2026-11-04 09:15:00', 'Serah terima peralatan dalam kondisi baik dan lengkap', 'Dr. Hendra Wijaya, M.T.']);

    // Sample Transaction 2: Internal Usage with Drone Kit (Draft/Dipesan)
    const tx2 = query.run(`
      INSERT INTO transactions (
        transaction_code, transaction_type, status, borrower_contact_id,
        borrower_name, borrower_unit, borrower_phone, borrower_email,
        event_name, location_name, start_date, expected_return_date,
        operator_id, notes, qr_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'TRX-202611-002', 'internal_usage', 'dipesan', c3,
        'Rizky Pratama', 'BEM Universitas (Panitia Dies Natalis)', '085712345678', 'rizky.pratama@student.univ.ac.id',
        'Dokumentasi Udara Dies Natalis', 'Stadion Utama Kampus',
        '2026-11-15 08:00:00', '2026-11-15 18:00:00',
        2, 'Pengambilan paket drone 01 lengkap dengan 3 baterai', 'QR-TRX-202611-002'
      ]
    ).lastInsertRowid;

    query.run(`
      INSERT INTO transaction_lines (transaction_id, item_type_id, asset_kit_id, tracking_mode, quantity_requested, quantity_handed_over, quantity_returned)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tx2, itDrone, kit1, 'unique_unit', 1, 0, 0]);

    // Initial audit log
    query.run(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Budi Santoso, S.Kom', 'super_admin', 'INITIALIZE', 'SYSTEM', 'BOOTSTRAP', 'Inisialisasi sistem Nventori dan master data awal']);

    console.log('[Seeder] Database seeded successfully with demo data!');
  });

  seed();
}

// Execute if run directly
if (process.argv[1]?.endsWith('seeder.js')) {
  runSeeder();
  process.exit(0);
}
