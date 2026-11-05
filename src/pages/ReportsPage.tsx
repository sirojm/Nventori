import React, { useState, useEffect } from 'react';
import { FileBarChart, Printer, Download, Package, Layers, ArrowLeftRight, Clock } from 'lucide-react';
import { api } from '../services/api';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats().then((res) => {
      if (res.success) setData(res);
      setLoading(false);
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat laporan...</div>;
  }

  const { stats, overdue_items, recent_transactions } = data || {};

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Laporan & Rekapitulasi Inventaris</h2>
          <p className="text-xs text-slate-500">
            Laporan ketersediaan, peminjaman aktif, dan barang terlambat
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Laporan Lengkap</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Aset Fisik Unik</div>
          <div className="text-3xl font-extrabold text-slate-900">{stats?.assets?.total_units || 0} unit</div>
          <div className="text-xs text-emerald-700 font-semibold">{stats?.assets?.available_units || 0} unit siap digunakan</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stok Kuantitas Pool</div>
          <div className="text-3xl font-extrabold text-slate-900">{stats?.pools?.total_quantity || 0} item</div>
          <div className="text-xs text-slate-600 font-semibold">{stats?.pools?.available_quantity || 0} item tersedia di gudang</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peminjaman Berjalan</div>
          <div className="text-3xl font-extrabold text-slate-900">{stats?.transactions?.active_loans || 0} transaksi</div>
          <div className="text-xs text-rose-700 font-semibold">{stats?.transactions?.overdue_loans || 0} transaksi melewati tenggat</div>
        </div>
      </div>

      {/* Overdue Items Report Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
          Daftar Peralatan Melewati Batas Waktu Kembali:
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Kode Transaksi</th>
                <th className="p-3">Nama Peminjam / Unit</th>
                <th className="p-3">Kontak WA</th>
                <th className="p-3">Kegiatan</th>
                <th className="p-3">Tenggat Seharusnya</th>
                <th className="p-3">Status Keterlambatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overdue_items && overdue_items.length > 0 ? (
                overdue_items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{item.transaction_code}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{item.borrower_name}</div>
                      <div className="text-[11px] text-slate-500">{item.borrower_unit}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{item.borrower_phone}</td>
                    <td className="p-3 text-slate-700">{item.event_name}</td>
                    <td className="p-3 font-mono text-slate-600">
                      {new Date(item.expected_return_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Lewat {Math.max(1, Math.round(item.days_overdue || 1))} hari
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Tidak ada transaksi yang terlambat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
