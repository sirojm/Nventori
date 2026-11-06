import React, { useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, Warehouse, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface WarehouseRow {
  id: number;
  name: string;
  code: string;
  description?: string;
  asset_count?: number;
  pool_count?: number;
  kit_count?: number;
}

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after any add / edit / delete so the page can reload its lists. */
  onChanged: () => void;
}

const emptyForm = { name: '', code: '', description: '' };

export const WarehouseModal: React.FC<WarehouseModalProps> = ({ isOpen, onClose, onChanged }) => {
  const { success, error } = useToast();
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toDelete, setToDelete] = useState<WarehouseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getLocations();
      if (res.success) setRows(res.locations);
    } catch (err: any) {
      error(err.message || 'Gagal memuat daftar gudang.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setEditingId(null);
      setForm(emptyForm);
      setToDelete(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const startEdit = (row: WarehouseRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, code: row.code, description: row.description || '' });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      error('Nama dan kode gudang wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const res = editingId
        ? await api.updateLocation(editingId, form)
        : await api.createLocation(form);
      if (res.success) {
        success(res.message);
        reset();
        await load();
        onChanged();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan gudang.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await api.deleteLocation(toDelete.id);
      if (res.success) {
        success(res.message);
        setToDelete(null);
        if (editingId === toDelete.id) reset();
        await load();
        onChanged();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus gudang.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Kelola Gudang Penyimpanan</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Gudang dipakai sebagai lokasi aset, stok, dan paket. Gudang hanya bisa dihapus jika sudah kosong.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-800">{editingId ? 'Edit Gudang' : 'Tambah Gudang Baru'}</div>
            {editingId && (
              <button type="button" onClick={reset} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
                Batal edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nama Gudang:</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Gudang Perlengkapan Gedung A"
                className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode:</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="LOC-GDG-01"
                className="w-full px-3 py-2 border rounded-xl bg-white font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Keterangan (opsional):</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Contoh: Penyimpanan utama barang inventaris"
              className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-60 text-white font-semibold cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingId ? null : <Plus className="w-3.5 h-3.5" />}
              {editingId ? 'Simpan Perubahan' : 'Tambah Gudang'}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">Daftar Gudang ({rows.length})</div>
          {loading && <p className="text-xs text-slate-400">Memuat...</p>}
          {!loading && rows.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl">Belum ada gudang.</p>
          )}
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {rows.map((row) => {
              const holding = (row.asset_count || 0) + (row.pool_count || 0) + (row.kit_count || 0);
              return (
                <div key={row.id} className={`flex items-center gap-3 p-3 text-xs ${editingId === row.id ? 'bg-emerald-50' : ''}`}>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{row.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">
                      {row.code}
                      {row.description ? ` · ${row.description}` : ''}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {holding === 0
                        ? 'Kosong'
                        : [
                            row.asset_count ? `${row.asset_count} unit aset` : '',
                            row.pool_count ? `${row.pool_count} catatan stok` : '',
                            row.kit_count ? `${row.kit_count} paket` : '',
                          ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => startEdit(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-semibold text-[11px] cursor-pointer"
                      aria-label={`Edit ${row.name}`}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError('');
                        setToDelete(row);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-[11px] cursor-pointer"
                      aria-label={`Hapus ${row.name}`}
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {toDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">Hapus gudang ini?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-semibold">{toDelete.name}</span> ({toDelete.code}) akan dihapus dari daftar.
                  Riwayat transaksi dan pergerakan stok tidak berubah.
                </p>
              </div>
            </div>
            {deleteError && (
              <div role="alert" className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={() => setToDelete(null)} disabled={deleting} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer">
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
