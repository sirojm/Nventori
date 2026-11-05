import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RotateCcw,
  Printer,
  ChevronRight,
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Transaction } from '../types';
import { useToast } from '../context/ToastContext';

interface TransactionsPageProps {
  onNavigateNew: () => void;
  onOpenReturnModal: (tx: Transaction) => void;
  onOpenReceiptModal: (tx: Transaction, type: 'handover' | 'return') => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  onNavigateNew,
  onOpenReturnModal,
  onOpenReceiptModal,
}) => {
  const { success, error } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Selected Detail Drawer
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getTransactions({
        status: statusFilter,
        type: typeFilter,
        search,
      });
      if (res.success) {
        setTransactions(res.transactions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [statusFilter, typeFilter, search]);

  const openDrawer = async (txId: number) => {
    setDrawerLoading(true);
    try {
      const res = await api.getTransactionById(txId);
      if (res.success) {
        setSelectedTx(res.transaction);
      }
    } catch (err: any) {
      error(err.message || 'Gagal memuat detail transaksi.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleHandover = async (txId: number) => {
    if (!window.confirm('Konfirmasi serah terima barang ke peminjam? Stok barang akan tercatat keluar.')) return;
    try {
      const res = await api.handoverTransaction(txId, {
        notes: 'Serah terima diselesaikan operator inventaris',
      });
      if (res.success) {
        success(res.message);
        loadTransactions();
        openDrawer(txId);
      }
    } catch (err: any) {
      error(err.message || 'Gagal serah terima.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transaksi Peminjaman Alat</h2>
          <p className="text-xs text-slate-500">
            Kelola pemakaian internal dan pinjaman antarunit tanpa antrean persetujuan
          </p>
        </div>

        <button
          onClick={onNavigateNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Transaksi Baru</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor transaksi, nama peminjam, kegiatan..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Semua Status</option>
            <option value="dipesan">Dipesan (Reservasi)</option>
            <option value="diserahkan">Diserahkan (Aktif)</option>
            <option value="kembali_sebagian">Kembali Sebagian</option>
            <option value="selesai">Selesai</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Semua Jenis</option>
            <option value="internal_usage">Pemakaian Internal</option>
            <option value="inter_unit_loan">Pinjaman Antarunit</option>
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3.5">Kode Transaksi</th>
                <th className="p-3.5">Jenis Transaksi</th>
                <th className="p-3.5">Peminjam / Unit</th>
                <th className="p-3.5">Kegiatan & Batas Kembali</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const statusColors: Record<string, string> = {
                    draft: 'bg-slate-100 text-slate-700',
                    dipesan: 'bg-blue-100 text-blue-800',
                    diserahkan: 'bg-amber-100 text-amber-800',
                    kembali_sebagian: 'bg-orange-100 text-orange-800',
                    selesai: 'bg-emerald-100 text-emerald-800',
                  };

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => openDrawer(tx.id)}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-slate-900">{tx.transaction_code}</div>
                        <div className="text-[10px] text-slate-400">Petugas: {tx.operator_name}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.transaction_type === 'inter_unit_loan'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {tx.transaction_type === 'inter_unit_loan' ? 'Antarunit' : 'Internal'}
                        </span>
                        {tx.letter_number && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Surat: {tx.letter_number}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{tx.borrower_name}</div>
                        <div className="text-[11px] text-slate-500">{tx.borrower_unit}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-800">{tx.event_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Tenggat: {new Date(tx.expected_return_date).toLocaleDateString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusColors[tx.status] || 'bg-slate-100'}`}>
                          {tx.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {tx.status === 'dipesan' && (
                            <button
                              onClick={() => handleHandover(tx.id)}
                              className="px-2.5 py-1 rounded-lg bg-forest-800 hover:bg-forest-900 text-white font-semibold text-[11px] transition cursor-pointer"
                            >
                              Serah Terima
                            </button>
                          )}

                          {['diserahkan', 'kembali_sebagian'].includes(tx.status) && (
                            <button
                              onClick={() => {
                                api.getTransactionById(tx.id).then((res) => {
                                  if (res.success) onOpenReturnModal(res.transaction);
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-forest-800 font-semibold text-[11px] transition cursor-pointer"
                            >
                              Checklist Kembali
                            </button>
                          )}

                          <button
                            onClick={() => {
                              api.getTransactionById(tx.id).then((res) => {
                                if (res.success) onOpenReceiptModal(res.transaction, tx.status === 'selesai' ? 'return' : 'handover');
                              });
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                            title="Cetak Bukti"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Tidak ada data transaksi yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-mono font-bold text-forest-800 bg-emerald-50 px-2 py-0.5 rounded">
                  {selectedTx.transaction_code}
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">{selectedTx.event_name}</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Borrower Snapshot Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Snapshot Kontak Peminjam</div>
                <div className="font-bold text-sm text-slate-900">{selectedTx.borrower_name}</div>
                <div className="text-slate-700">{selectedTx.borrower_unit}</div>
                <div className="font-mono text-slate-500">{selectedTx.borrower_phone} • {selectedTx.borrower_email}</div>
              </div>

              {/* Inter-unit Letter Info */}
              {selectedTx.transaction_type === 'inter_unit_loan' && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-blue-800 tracking-wider">Referensi Surat Permohonan Antarunit</div>
                  <div className="font-mono font-bold text-blue-950">Nomor: {selectedTx.letter_number || '-'}</div>
                  <div className="text-blue-900">Tanggal Surat: {selectedTx.letter_date || '-'}</div>
                  <div className="text-blue-900">Pengirim: {selectedTx.sender_unit || '-'}</div>
                  {selectedTx.letter_notes && <div className="text-[11px] text-blue-700 mt-1 italic">Catatan: {selectedTx.letter_notes}</div>}
                </div>
              )}

              {/* Items Manifest */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">Daftar Peralatan Keluar:</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedTx.lines?.map((line) => (
                    <div key={line.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{line.item_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {line.asset_code || line.kit_name || '(Stok Kuantitas)'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">
                          {line.quantity_handed_over || line.quantity_requested} {line.unit_of_measure}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          Kembali: {line.quantity_returned} {line.unit_of_measure}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kit Components Breakdown if present */}
              {selectedTx.manifest_items && selectedTx.manifest_items.length > 0 && (
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
                    Checklist Komponen Paket Kelengkapan:
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                    {selectedTx.manifest_items.map((m) => (
                      <div key={m.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800">{m.component_name}</span>
                          {m.asset_code && <span className="font-mono text-slate-400 block text-[10px]">{m.asset_code}</span>}
                        </div>
                        <div className="text-right font-mono">
                          <span className={m.is_completed ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {m.quantity_returned} / {m.quantity_handed_over} unit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => onOpenReceiptModal(selectedTx, 'handover')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bukti Serah Terima</span>
                </button>
                <button
                  onClick={() => onOpenReceiptModal(selectedTx, 'return')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Bukti Kembali</span>
                </button>
              </div>

              {['diserahkan', 'kembali_sebagian'].includes(selectedTx.status) && (
                <button
                  onClick={() => {
                    setSelectedTx(null);
                    onOpenReturnModal(selectedTx);
                  }}
                  className="px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Checklist Pengembalian</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
