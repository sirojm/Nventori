import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  Layers,
  ArrowLeftRight,
  Clock,
  Calendar,
  PlusCircle,
  QrCode,
  Users,
  CheckCircle2,
  Phone,
  ArrowRight,
  RotateCcw,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { Transaction } from '../types';

interface DashboardPageProps {
  onNavigate: (page: any) => void;
  onOpenScanner: () => void;
  onOpenReturnModal: (tx: Transaction) => void;
  onOpenReceiptModal: (tx: Transaction) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenScanner,
  onOpenReturnModal,
  onOpenReceiptModal,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats();
      if (res.success) {
        setData(res);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
          <div className="h-32 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const { stats, overdue_items, upcoming_activities, recent_transactions } = data || {};
  const assetStats = stats?.assets || {};
  const poolStats = stats?.pools || {};
  const txStats = stats?.transactions || {};

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* 1. Critical Overdue Alert Banner (Prioritas 1 per Blueprint) */}
      {overdue_items && overdue_items.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-xs md:text-sm text-rose-950">
                  Perhatian: Terdapat {overdue_items.length} Peminjaman Melewati Tenggat Kembali
                </h3>
                <p className="text-[11px] text-rose-700">
                  Peralatan harus segera ditindaklanjuti agar tidak mengganggu jadwal kegiatan berikutnya.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-bold text-rose-800 hover:text-rose-950 underline cursor-pointer hidden sm:block"
            >
              Lihat Semua
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {overdue_items.slice(0, 3).map((item: any) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-white border border-rose-200 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-mono font-bold text-slate-900">{item.transaction_code}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                      Terlambat {Math.max(1, Math.round(item.days_overdue || 1))} hari
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 mt-1 truncate">{item.borrower_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{item.borrower_unit}</div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <a
                    href={`https://wa.me/${item.borrower_phone.replace(/^0/, '62')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Hubungi WA</span>
                  </a>
                  <button
                    onClick={() => {
                      api.getTransactionById(item.id).then((res) => {
                        if (res.success) onOpenReturnModal(res.transaction);
                      });
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-800 hover:text-emerald-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Terima Kembali</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('new_transaction')}
          className="p-3.5 rounded-2xl bg-forest-800 hover:bg-forest-900 text-white shadow-sm flex items-center gap-3 transition cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs">Catat Pinjaman</div>
            <div className="text-[10px] text-emerald-200">Internal / Antarunit</div>
          </div>
        </button>

        <button
          onClick={onOpenScanner}
          className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center gap-3 transition cursor-pointer text-left text-slate-800"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-forest-800 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs">Pindai QR</div>
            <div className="text-[10px] text-slate-500">Aset & Bukti Pinjam</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('contacts')}
          className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center gap-3 transition cursor-pointer text-left text-slate-800"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs">Kontak Peminjam</div>
            <div className="text-[10px] text-slate-500">Buku Kontak Aktif</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('activities')}
          className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center gap-3 transition cursor-pointer text-left text-slate-800"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-xs">Saran Kebutuhan</div>
            <div className="text-[10px] text-slate-500">Template Acara</div>
          </div>
        </button>
      </div>

      {/* 3. Separated KPI Overview Cards per Blueprint Section 10 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Physical Unique Units Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-forest-800" />
              Unit Aset Fisik Unik
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              Barcode / Serial
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{assetStats.total_units || 0}</span>
            <span className="text-xs text-slate-500 font-medium">unit fisik terdaftar</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-emerald-50">
              <div className="text-[10px] text-emerald-800 font-semibold">Tersedia</div>
              <div className="text-sm font-bold text-emerald-900">{assetStats.available_units || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-blue-50">
              <div className="text-[10px] text-blue-800 font-semibold">Dipakai</div>
              <div className="text-sm font-bold text-blue-900">{assetStats.in_use_units || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50">
              <div className="text-[10px] text-rose-800 font-semibold">Perawatan</div>
              <div className="text-sm font-bold text-rose-900">{assetStats.maintenance_units || 0}</div>
            </div>
          </div>
        </div>

        {/* Quantity Pool Stock Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-700" />
              Stok Kuantitas & Habis Pakai
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              Kuantitas Pool
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{poolStats.total_quantity || 0}</span>
            <span className="text-xs text-slate-500 font-medium">item total di gudang</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-[10px] text-slate-600 font-semibold">Siap Digunakan</div>
              <div className="text-sm font-bold text-slate-900">{poolStats.available_quantity || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50">
              <div className="text-[10px] text-amber-800 font-semibold">Sedang Dipinjam</div>
              <div className="text-sm font-bold text-amber-900">{poolStats.checked_out_quantity || 0}</div>
            </div>
          </div>
        </div>

        {/* Transactions & Activities Status */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-amber-700" />
              Status Transaksi Aktif
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
              Operasional
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{txStats.active_loans || 0}</span>
            <span className="text-xs text-slate-500 font-medium">peminjaman di luar</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-blue-50">
              <div className="text-[10px] text-blue-800 font-semibold">Reservasi Dipesan</div>
              <div className="text-sm font-bold text-blue-900">{txStats.pending_reservations || 0}</div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50">
              <div className="text-[10px] text-rose-800 font-semibold">Terlambat Kembali</div>
              <div className="text-sm font-bold text-rose-900">{txStats.overdue_loans || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Upcoming Activities & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upcoming Events */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-forest-800" />
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Kegiatan & Agenda Mendatang
              </h3>
            </div>
            <button
              onClick={() => onNavigate('activities')}
              className="text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Lihat Agenda
            </button>
          </div>

          <div className="space-y-3">
            {upcoming_activities && upcoming_activities.length > 0 ? (
              upcoming_activities.map((act: any) => (
                <div key={act.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="font-bold text-slate-900">{act.name}</div>
                  <div className="text-slate-600 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(act.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {act.location}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">PIC: {act.pic_name}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                Tidak ada agenda kegiatan terjadwal.
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Transactions Table */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-forest-800" />
              <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                Transaksi Peminjaman Terbaru
              </h3>
            </div>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Kelola Semua Transaksi
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="rt w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-2">Kode / Jenis</th>
                  <th className="pb-2">Peminjam</th>
                  <th className="pb-2">Keperluan</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent_transactions && recent_transactions.length > 0 ? (
                  recent_transactions.map((tx: any) => {
                    const statusColors: Record<string, string> = {
                      draft: 'bg-slate-100 text-slate-700',
                      dipesan: 'bg-blue-100 text-blue-800',
                      diserahkan: 'bg-amber-100 text-amber-800',
                      kembali_sebagian: 'bg-orange-100 text-orange-800',
                      selesai: 'bg-emerald-100 text-emerald-800',
                    };

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 font-mono">
                          <div className="font-bold text-slate-900">{tx.transaction_code}</div>
                          <div className="text-[10px] text-slate-500 uppercase">
                            {tx.transaction_type === 'internal_usage' ? 'Internal' : 'Antarunit'}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="font-semibold text-slate-800">{tx.borrower_name}</div>
                        </td>
                        <td className="py-2.5 text-slate-600 truncate max-w-[140px]">
                          {tx.event_name}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[tx.status] || 'bg-slate-100'}`}>
                            {tx.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                          {['diserahkan', 'kembali_sebagian'].includes(tx.status) && (
                            <button
                              onClick={() => {
                                api.getTransactionById(tx.id).then((res) => {
                                  if (res.success) onOpenReturnModal(res.transaction);
                                });
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-forest-800 font-semibold text-[11px] transition cursor-pointer"
                            >
                              Checklist
                            </button>
                          )}
                          <button
                            onClick={() => {
                              api.getTransactionById(tx.id).then((res) => {
                                if (res.success) onOpenReceiptModal(res.transaction);
                              });
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer inline-flex items-center"
                            title="Cetak Bukti"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Belum ada transaksi yang dicatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
