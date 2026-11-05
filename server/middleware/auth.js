import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'nventori-super-secret-jwt-key-2026';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = query.get('SELECT id, name, username, email, role, unit_id, is_active FROM users WHERE id = ?', [decoded.id]);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif atau tidak ditemukan.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid.' });
  }
}

export function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    }

    // Role hierarchy per blueprint: super_admin > admin_inventaris > operator
    const roleRank = {
      'operator': 1,
      'admin_inventaris': 2,
      'super_admin': 3
    };

    const userRank = roleRank[req.user.role] || 0;
    const isAllowed = allowedRoles.some(role => userRank >= roleRank[role]);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda tidak memiliki kewenangan untuk aksi ini.'
      });
    }

    next();
  };
}

export function logAudit(userId, userName, userRole, action, entityType, entityId, details) {
  try {
    query.run(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, userRole, action, entityType, String(entityId || ''), typeof details === 'object' ? JSON.stringify(details) : details]
    );
  } catch (e) {
    console.error('[AuditLog] Error writing audit log:', e);
  }
}
