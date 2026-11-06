import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Download, Loader2, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  ReportData,
  ReportSections,
  buildReportHtml,
  buildTransactionsCsv,
  buildAssetsCsv,
  printHtmlDocument,
  downloadTextFile,
} from '../utils/reportDocument';

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const presets = [
  { id: 'month', label: 'Bulan ini' },
  { id: '30d', label: '30 hari terakhir' },
  { id: 'year', label: 'Tahun ini' },
] as const;

const sectionLabels: [keyof ReportSections, string][] = [
  ['summary', 'Ringkasan'],
  ['activeLoans', 'Peminjaman aktif & reservasi'],
  ['assets', 'Daftar aset fisik'],
  ['pools', 'Stok kuantitas'],
  ['transactions', 'Riwayat transaksi periode'],
];

export const ReportsPage: React.FC = () => {
  const { error } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [sections, setSections] = useState<ReportSections>({
    summary: true,
    activeLoans: true,
    assets: true,
    pools: true,
    transactions: true,
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    api.getDashboardStats().then((res) => {
      if (res.success) setData(res);
      setLoading(false);
    });
  }, []);

  // Load the report data whenever the period changes
  useEffect(() => {
    if (!from || !to) return;
    const id = ++requestId.current;
    setReportLoading(true);
    const timer = setTimeout(() => {
      api
        .getFullReport(from, to)
        .then((res) => {
          if (id === requestId.current && res.success) setReport(res);
        })
        .catch((err) => id === requestId.current && error(err.message || 'Gagal memuat data laporan.'))
        .finally(() => id === requestId.current && setReportLoading(false));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const applyPreset = (id: (typeof presets)[number]['id']) => {
    const now = new Date();
    if (id === 'month') setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    if (id === '30d') setFrom(iso(new Date(now.getTime() - 29 * 86400000)));
    if (id === 'year') setFrom(iso(new Date(now.getFullYear(), 0, 1)));
    setTo(iso(now));
  };

  const html = useMemo(() => (report ? buildReportHtml(report, sections) : ''), [report, sections]);
  const anySection = Object.values(sections).some(Boolean);

  const handlePrint = async () => {
    if (!anySection) return;
    setPrinting(true);
    try {
      // Fetch fresh numbers right before printing
      const fresh = await api.getFullReport(from, to);
      if (fresh.success) await printHtmlDocument(buildReportHtml(fresh, sections));
    } catch (err: any) {
      error(err.message || 'Gagal menyiapkan dokumen laporan.');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat laporan...</div>;
  }

  const { stats, overdue_items } = data || {};

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Laporan & Rekapitulasi Inventaris</h2>
        <p className="text-xs text-slate-500">
          Laporan ketersediaan, peminjaman aktif, dan barang terlambat
        </p>
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

      {/* Printable report document */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-forest-800 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Dokumen Laporan</h3>
            <p className="text-xs text-slate-500">
              Dicetak sebagai dokumen A4 dengan kop, tabel, dan tanda tangan — bukan tangkapan halaman. Pilih
              <em> Simpan sebagai PDF</em> di dialog cetak untuk membuat file PDF.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-4 text-xs">
            <div>
              <div className="font-semibold text-slate-700 mb-1.5">Periode transaksi</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] text-slate-500 mb-0.5">Dari</span>
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] text-slate-500 mb-0.5">Sampai</span>
                  <input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-2.5 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="px-2.5 py-1 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-semibold text-slate-700 mb-1.5">Isi laporan</div>
              <div className="space-y-1.5">
                {sectionLabels.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={sections[key]}
                      onChange={(e) => setSections({ ...sections, [key]: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handlePrint}
                disabled={!anySection || printing || reportLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>Cetak / Simpan PDF</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => report && downloadTextFile(`transaksi-${from}_${to}.csv`, buildTransactionsCsv(report))}
                  disabled={!report}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV Transaksi
                </button>
                <button
                  onClick={() => report && downloadTextFile(`aset-${iso(new Date())}.csv`, buildAssetsCsv(report))}
                  disabled={!report}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV Aset
                </button>
              </div>
            </div>
          </div>

          {/* Live document preview */}
          <div className="lg:col-span-2">
            <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              Pratinjau dokumen
              {reportLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-200 p-2">
              {html && anySection ? (
                <iframe
                  title="Pratinjau laporan"
                  srcDoc={html}
                  className="w-full h-[520px] bg-white rounded-lg"
                />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-slate-500">
                  {anySection ? 'Memuat pratinjau...' : 'Pilih minimal satu bagian laporan.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Items Report Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
          Daftar Peralatan Melewati Batas Waktu Kembali:
        </h3>

        <div className="overflow-x-auto">
          <table className="rt w-full text-xs text-left">
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
