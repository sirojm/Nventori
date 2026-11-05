import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Phone, Mail, Building2, History, X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { BorrowerContact } from '../types';
import { useToast } from '../context/ToastContext';

export const ContactsPage: React.FC = () => {
  const { success, error } = useToast();
  const [contacts, setContacts] = useState<BorrowerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    institution: '',
    phone_wa: '',
    email: '',
    notes: '',
  });

  const loadContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({ search });
      if (res.success) {
        setContacts(res.contacts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.institution || !formData.phone_wa || !formData.email) {
      error('Harap lengkapi semua kolom wajib kontak peminjam.');
      return;
    }

    try {
      const res = await api.createContact(formData);
      if (res.success) {
        success(res.message);
        if (res.potential_duplicate) {
          alert(res.potential_duplicate);
        }
        setShowAddModal(false);
        setFormData({ full_name: '', institution: '', phone_wa: '', email: '', notes: '' });
        loadContacts();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan kontak.');
    }
  };

  const openContactDetail = async (contactId: number) => {
    try {
      const res = await api.getContactById(contactId);
      if (res.success) {
        setSelectedContact(res.contact);
      }
    } catch (e) {
      error('Gagal memuat riwayat kontak.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Buku Kontak Peminjam</h2>
          <p className="text-xs text-slate-500">
            Daftar kontak PIC & peminjam tanpa akun. Disimpan dan dipilih ulang pada setiap transaksi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kontak Baru</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama peminjam, unit/instansi, email, nomor HP/WA..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            onClick={() => openContactDetail(contact.id)}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{contact.full_name}</span>
                {contact.active_loans && contact.active_loans > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {contact.active_loans} Pinjaman Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Bebas Tanggungan
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{contact.institution}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1 text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{contact.phone_wa}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{contact.email}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Kontak Peminjam Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap PIC:</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Contoh: Dr. Hendra Wijaya, M.T."
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Kerja / Instansi:</label>
                <input
                  type="text"
                  required
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  placeholder="Contoh: Fakultas Teknik Elektro"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor HP / WhatsApp Aktif:</label>
                <input
                  type="tel"
                  required
                  value={formData.phone_wa}
                  onChange={(e) => setFormData({ ...formData, phone_wa: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Aktif (Pengiriman Bukti):</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="peminjam@univ.ac.id"
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan:</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Jabatan, ruangan kerja, keterangan..."
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
                  Simpan Kontak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedContact.full_name}</h3>
                <p className="text-xs text-slate-500">{selectedContact.institution}</p>
              </div>
              <button onClick={() => setSelectedContact(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono space-y-1">
              <div>HP/WA: <span className="font-semibold text-slate-800">{selectedContact.phone_wa}</span></div>
              <div>Email: <span className="font-semibold text-slate-800">{selectedContact.email}</span></div>
              {selectedContact.notes && <div className="text-slate-600 italic mt-1 font-sans">Catatan: {selectedContact.notes}</div>}
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">Riwayat Seluruh Peminjaman:</h4>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                {selectedContact.transactions?.length > 0 ? (
                  selectedContact.transactions.map((tx: any) => (
                    <div key={tx.id} className="p-3 flex justify-between items-center">
                      <div>
                        <div className="font-bold font-mono text-slate-900">{tx.transaction_code}</div>
                        <div className="text-slate-600">{tx.event_name}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold capitalize text-forest-800">{tx.status.replace('_', ' ')}</span>
                        <div className="text-[10px] text-slate-400">{new Date(tx.start_date).toLocaleDateString('id-ID')}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs">Belum ada riwayat transaksi.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
