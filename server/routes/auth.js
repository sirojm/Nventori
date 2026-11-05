import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';
import { authenticate, authorize, JWT_SECRET, logAudit } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }

  const user = query.get(`
    SELECT u.id, u.name, u.username, u.email, u.password_hash, u.role, u.is_active, u.unit_id,
           ou.name as unit_name
    FROM users u
    LEFT JOIN organizational_units ou ON u.unit_id = ou.id
    WHERE u.username = ? OR u.email = ?`,
    [username, username]
  );

  if (!user || !user.is_active) {
    return res.status(401).json({ success: false, message: 'Username atau password salah, atau akun dinonaktifkan.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  logAudit(user.id, user.name, user.role, 'LOGIN', 'USER', user.id, 'Petugas berhasil login ke sistem');

  return res.json({
    success: true,
    message: 'Login berhasil.',
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      unit_id: user.unit_id,
      unit_name: user.unit_name || 'Kantor Pusat'
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = query.get(`
    SELECT u.id, u.name, u.username, u.email, u.role, u.is_active, u.unit_id,
           ou.name as unit_name
    FROM users u
    LEFT JOIN organizational_units ou ON u.unit_id = ou.id
    WHERE u.id = ?`,
    [req.user.id]
  );

  res.json({ success: true, user });
});

// GET /api/auth/units (List organizational units)
router.get('/units', authenticate, (req, res) => {
  const units = query.all('SELECT * FROM organizational_units ORDER BY name ASC');
  res.json({ success: true, units });
});

// GET /api/auth/users (Super Admin only)
router.get('/users', authenticate, authorize(['super_admin']), (req, res) => {
  const users = query.all(`
    SELECT u.id, u.name, u.username, u.email, u.role, u.unit_id, u.is_active, u.created_at,
           ou.name as unit_name
    FROM users u
    LEFT JOIN organizational_units ou ON u.unit_id = ou.id
    ORDER BY u.id ASC`
  );
  res.json({ success: true, users });
});

// POST /api/auth/users (Super Admin only)
router.post('/users', authenticate, authorize(['super_admin']), (req, res) => {
  const { name, username, email, password, role, unit_id } = req.body;

  if (!name || !username || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  if (!['super_admin', 'admin_inventaris', 'operator'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role harus salah satu dari: super_admin, admin_inventaris, operator.' });
  }

  const existing = query.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Username atau email sudah digunakan.' });
  }

  const pwHash = bcrypt.hashSync(password, 10);
  const result = query.run(`
    INSERT INTO users (name, username, email, password_hash, role, unit_id)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [name, username, email, pwHash, role, unit_id || null]
  );

  logAudit(req.user.id, req.user.name, req.user.role, 'CREATE_USER', 'USER', result.lastInsertRowid, { username, role });

  res.json({ success: true, message: 'Pengguna berhasil dibuat.' });
});

// PUT /api/auth/users/:id (Super Admin only - Edit user details & password)
router.put('/users/:id', authenticate, authorize(['super_admin']), (req, res) => {
  const { id } = req.params;
  const { name, username, email, password, role, unit_id } = req.body;

  const user = query.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  if (role && !['super_admin', 'admin_inventaris', 'operator'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role tidak valid.' });
  }

  // Check unique username & email excluding current user
  if (username && username !== user.username) {
    const dup = query.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
    if (dup) return res.status(400).json({ success: false, message: 'Username sudah digunakan.' });
  }
  if (email && email !== user.email) {
    const dup = query.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (dup) return res.status(400).json({ success: false, message: 'Email sudah digunakan.' });
  }

  const newName = name || user.name;
  const newUsername = username || user.username;
  const newEmail = email || user.email;
  const newRole = role || user.role;
  const newUnitId = unit_id !== undefined ? (unit_id === '' || unit_id === null ? null : Number(unit_id)) : user.unit_id;
  const newPwHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  query.run(`
    UPDATE users
    SET name = ?, username = ?, email = ?, password_hash = ?, role = ?, unit_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [newName, newUsername, newEmail, newPwHash, newRole, newUnitId, id]
  );

  logAudit(req.user.id, req.user.name, req.user.role, 'UPDATE_USER', 'USER', id, {
    username: newUsername,
    role: newRole,
    password_changed: !!password
  });

  res.json({ success: true, message: 'Data pengguna berhasil diperbarui.' });
});

// PUT /api/auth/users/:id/toggle (Super Admin only)
router.put('/users/:id/toggle', authenticate, authorize(['super_admin']), (req, res) => {
  const { id } = req.params;
  const user = query.get('SELECT id, is_active, username FROM users WHERE id = ?', [id]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
  }

  if (Number(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan akun sendiri.' });
  }

  const newStatus = user.is_active ? 0 : 1;
  query.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

  logAudit(req.user.id, req.user.name, req.user.role, 'TOGGLE_STATUS', 'USER', id, { newStatus: newStatus ? 'aktif' : 'nonaktif' });

  res.json({ success: true, message: `Status pengguna berhasil diubah menjadi ${newStatus ? 'aktif' : 'nonaktif'}.` });
});

export default router;
