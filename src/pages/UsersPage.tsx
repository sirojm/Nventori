import React, { useState, useEffect } from 'react';
import { UserCog, Plus, ShieldCheck, UserCheck, KeyRound, Edit, X, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { useToast } from '../context/ToastContext';

interface OrgUnit {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export const UsersPage: React.FC = () => {
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'operator' as 'super_admin' | 'admin_inventaris' | 'operator',
    unit_id: '',
  });

  const [editData, setEditData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'operator' as 'super_admin' | 'admin_inventaris' | 'operator',
    unit_id: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, unitRes] = await Promise.all([
        api.getUsers(),
        api.getUnits(),
      ]);
      if (userRes.success) setUsers(userRes.users);
      if (unitRes.success) setUnits(unitRes.units);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (userId: number) => {
    try {
      const res = await api.toggleUser(userId);
      if (res.success) {
        success(res.message);
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Gagal mengubah status pengguna.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      error('Harap lengkapi semua kolom wajib.');
      return;
    }

    try {
      const res = await api.createUser({
        ...formData,
        unit_id: formData.unit_id ? Number(formData.unit_id) : null,
      });
      if (res.success) {
        success(res.message);
        setShowAddModal(false);
        setFormData({ name: '', username: '', email: '', password: '', role: 'operator', unit_id: '' });
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan pengguna.');
    }
  };

  const handleOpenEdit = (user: User) => {
    setSelectedUserId(user.id);
    setEditData({
      name: user.name,
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      unit_id: user.unit_id ? String(user.unit_id) : '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!editData.name || !editData.username || !editData.email) {
      error('Nama, username, dan email wajib diisi.');
      return;
    }

    try {
      const payload: any = {
        name: editData.name,
        username: editData.username,
        email: editData.email,
        role: editData.role,
        unit_id: editData.unit_id ? Number(editData.unit_id) : null,
      };
      if (editData.password.trim()) {
        payload.password = editData.password.trim();
      }

      const res = await api.updateUser(selectedUserId, payload);
      if (res.success) {
        success(res.message);
        setShowEditModal(false);
        setSelectedUserId(null);
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Gagal memperbarui pengguna.');
    }
  };

  const roleBadgeMap: Record<string, { label: string; color: string }> = {
    super_admin: { label: 'SUPER ADMIN', color: 'bg-emerald-100 text-emerald-800' },
    admin_inventaris: { label: 'ADMIN INVENTARIS', color: 'bg-blue-100 text-blue-800' },
    operator: { label: 'OPERATOR', color: 'bg-amber-100 text-amber-800' },
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pengelolaan Akun Petugas</h2>
          <p className="text-xs text-slate-500">
            Tepat tiga level hak akses: Super Admin, Admin Inventaris, dan Operator beserta unit penugasan
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun Petugas</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3.5">Nama & Username</th>
                <th className="p-3.5">Email Petugas</th>
                <th className="p-3.5">Level Akses</th>
                <th className="p-3.5">Unit Penugasan</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const roleInfo = roleBadgeMap[u.role] || { label: u.role, color: 'bg-slate-100' };
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{u.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">@{u.username}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{u.email}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{u.unit_name || 'Kantor Pusat / Tanpa Unit'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-forest-800 font-semibold text-[11px] transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggle(u.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Akun Petugas Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Rahmat Hidayat, S.T."
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username:</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="rahmat_op"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Level Akses:</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="operator">Operator</option>
                    <option value="admin_inventaris">Admin Inventaris</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Penugasan / Unit Kerja:</label>
                <select
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium bg-white"
                >
                  <option value="">-- Kantor Pusat / Tanpa Unit Khusus --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Petugas:</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahmat@nventori.local"
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi Awal:</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  Buat Akun Petugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Edit Akun Petugas / Super Admin</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUserId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  required
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username:</label>
                  <input
                    type="text"
                    required
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Level Akses:</label>
                  <select
                    value={editData.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="operator">Operator</option>
                    <option value="admin_inventaris">Admin Inventaris</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Kerja:</label>
                <select
                  value={editData.unit_id}
                  onChange={(e) => setEditData({ ...editData, unit_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium bg-white"
                >
                  <option value="">-- Kantor Pusat / Tanpa Unit Khusus --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Petugas:</label>
                <input
                  type="email"
                  required
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ubah Kata Sandi (Kosongkan bila tidak diubah):
                </label>
                <input
                  type="password"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  placeholder="Masukkan kata sandi baru jika ingin reset"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUserId(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
