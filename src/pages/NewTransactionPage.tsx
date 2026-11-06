import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Users,
  Calendar,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Search,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { BorrowerContact, ItemType, AssetUnit, AssetKit } from '../types';
import { useToast } from '../context/ToastContext';
import { QRScannerModal } from '../components/scanner/QRScannerModal';

interface NewTransactionPageProps {
  onBack: () => void;
  onSuccess: (txId: number) => void;
}

// Accepts "drive.google.com/..." or full URLs; returns a clean http(s) URL, or null if not valid/empty.
const normalizeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const NewTransactionPage: React.FC<NewTransactionPageProps> = ({
  onBack,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  // Contacts
  const [contacts, setContacts] = useState<BorrowerContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [borrowerForm, setBorrowerForm] = useState({
    full_name: '',
    institution: '',
    phone_wa: '',
    email: '',
  });

  // Transaction Info
  const [txType, setTxType] = useState<'internal_usage' | 'inter_unit_loan'>('internal_usage');
  const [eventName, setEventName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState('');

  // Inter-unit request letter info
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().slice(0, 10));
  const [senderUnit, setSenderUnit] = useState('');
  const [letterNotes, setLetterNotes] = useState('');

  // Catalog items & selected lines
  const [items, setItems] = useState<ItemType[]>([]);
  const [assets, setAssets] = useState<AssetUnit[]>([]);
  const [kits, setKits] = useState<AssetKit[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [isAssetScannerOpen, setIsAssetScannerOpen] = useState(false);

  interface SelectedLine {
    item_type_id: number;
    item_name: string;
    tracking_mode: 'unique_unit' | 'quantity_pool' | 'consumable';
    asset_unit_id?: number;
    asset_code?: string;
    asset_kit_id?: number;
    kit_name?: string;
    quantity: number;
  }

  const [selectedLines, setSelectedLines] = useState<SelectedLine[]>([]);

  // Item selector state
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<string>('');
  const [selectedKitId, setSelectedKitId] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);

  useEffect(() => {
    Promise.all([
      api.getContacts(),
      api.getItems(),
      api.getAssets({ status: 'tersedia' }),
      api.getKits(),
    ]).then(([cRes, iRes, aRes, kRes]) => {
      if (cRes.success) setContacts(cRes.contacts);
      if (iRes.success) setItems(iRes.items);
      if (aRes.success) setAssets(aRes.assets);
      if (kRes.success) setKits(kRes.kits);
    });
  }, []);

  const handleSelectContact = (id: string) => {
    setSelectedContactId(id);
    const found = contacts.find((c) => String(c.id) === id);
    if (found) {
      setBorrowerForm({
        full_name: found.full_name,
        institution: found.institution,
        phone_wa: found.phone_wa,
        email: found.email,
      });
      if (txType === 'inter_unit_loan' && !senderUnit) {
        setSenderUnit(found.institution);
      }
    }
  };

  const handleAddItemLine = () => {
    if (selectedKitId) {
      const kit = kits.find((k) => String(k.id) === selectedKitId);
      if (kit) {
        setSelectedLines((prev) => [
          ...prev,
          {
            item_type_id: kit.primary_asset_id ? 1 : 1, // mapped
            item_name: `Paket: ${kit.name}`,
            tracking_mode: 'unique_unit',
            asset_kit_id: kit.id,
            kit_name: kit.name,
            quantity: 1,
          },
        ]);
        setSelectedKitId('');
        return;
      }
    }

    if (!selectedItemTypeId) return;
    const it = items.find((i) => String(i.id) === selectedItemTypeId);
    if (!it) return;

    if (it.tracking_mode === 'unique_unit') return;
    setSelectedLines((prev) => [
      ...prev,
      {
        item_type_id: it.id,
        item_name: it.name,
        tracking_mode: it.tracking_mode,
        quantity: Math.max(1, inputQty),
      },
    ]);
    setSelectedItemTypeId('');
    setInputQty(1);
  };

  // Always-fresh view of the list: the scanner keeps callbacks from the render it started in,
  // so state captured in a closure would be stale and let duplicates through.
  const selectedLinesRef = useRef(selectedLines);
  selectedLinesRef.current = selectedLines;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const addAssetToSelection = (asset: AssetUnit): 'added' | 'duplicate' | 'unavailable' => {
    if (selectedLinesRef.current.some((line) => line.asset_unit_id === asset.id)) return 'duplicate';
    const availableAsset = assetsRef.current.find(
      (candidate) => candidate.id === asset.id && candidate.status === 'tersedia'
    );
    if (!availableAsset) return 'unavailable';
    const line = {
      item_type_id: availableAsset.item_type_id,
      item_name: availableAsset.item_name || 'Aset fisik',
      tracking_mode: 'unique_unit' as const,
      asset_unit_id: availableAsset.id,
      asset_code: availableAsset.asset_code,
      quantity: 1,
    };
    selectedLinesRef.current = [...selectedLinesRef.current, line as any];
    setSelectedLines((prev) =>
      prev.some((l) => l.asset_unit_id === line.asset_unit_id) ? prev : [...prev, line as any]
    );
    return 'added';
  };

  const toggleAssetSelection = (asset: AssetUnit, checked: boolean) => {
    setSelectedLines((prev) => {
      if (checked) {
        if (prev.some((line) => line.asset_unit_id === asset.id)) return prev;
        return [
          ...prev,
          {
            item_type_id: asset.item_type_id,
            item_name: asset.item_name || 'Aset fisik',
            tracking_mode: 'unique_unit',
            asset_unit_id: asset.id,
            asset_code: asset.asset_code,
            quantity: 1,
          },
        ];
      }
      return prev.filter((line) => line.asset_unit_id !== asset.id);
    });
  };

  const availableAssets = assets.filter((asset) => {
    const searchTerm = assetSearch.trim().toLowerCase();
    return !searchTerm || asset.asset_code.toLowerCase().includes(searchTerm) ||
      (asset.item_name || '').toLowerCase().includes(searchTerm) ||
      (asset.category_name || '').toLowerCase().includes(searchTerm);
  });
  const unselectedVisibleAssets = availableAssets.filter(
    (asset) => !selectedLines.some((line) => line.asset_unit_id === asset.id)
  );
  const allVisibleAssetsSelected = availableAssets.length > 0 &&
    availableAssets.every((asset) => selectedLines.some((line) => line.asset_unit_id === asset.id));

  const toggleVisibleAssets = (checked: boolean) => {
    setSelectedLines((prev) => {
      if (!checked) {
        const visibleIds = new Set(availableAssets.map((asset) => asset.id));
        return prev.filter((line) => !line.asset_unit_id || !visibleIds.has(line.asset_unit_id));
      }
      const selectedIds = new Set(prev.map((line) => line.asset_unit_id).filter(Boolean));
      const newLines = availableAssets
        .filter((asset) => !selectedIds.has(asset.id))
        .map((asset) => ({
          item_type_id: asset.item_type_id,
          item_name: asset.item_name || 'Aset fisik',
          tracking_mode: 'unique_unit' as const,
          asset_unit_id: asset.id,
          asset_code: asset.asset_code,
          quantity: 1,
        }));
      return [...prev, ...newLines];
    });
  };

  const removeLine = (idx: number) => {
    setSelectedLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (txType === 'inter_unit_loan' &&
      (!borrowerForm.full_name.trim() || !borrowerForm.institution.trim() ||
        !borrowerForm.email.trim() || !borrowerForm.phone_wa.trim())) {
      error('Harap lengkapi identitas peminjam/PIC.');
      return;
    }
    if (!eventName || !locationName) {
      error('Nama kegiatan dan lokasi acara wajib diisi.');
      return;
    }
    if (txType === 'inter_unit_loan' && !letterNumber) {
      error('Pinjaman antarunit wajib menyertakan nomor surat permohonan.');
      return;
    }
    if (txType === 'inter_unit_loan' && letterNotes.trim()) {
      const normalized = normalizeUrl(letterNotes);
      if (!normalized) {
        error('Tautan dokumen tidak valid. Gunakan alamat yang diawali http:// atau https://.');
        return;
      }
    }
    if (!selectedLines.length) {
      error('Harap pilih minimal satu barang/paket.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        transaction_type: txType,
        borrower_contact_id: txType === 'inter_unit_loan' && selectedContactId ? Number(selectedContactId) : null,
        borrower_name: txType === 'inter_unit_loan' ? borrowerForm.full_name : '',
        borrower_unit: txType === 'inter_unit_loan' ? borrowerForm.institution : '',
        borrower_phone: txType === 'inter_unit_loan' ? borrowerForm.phone_wa : '',
        borrower_email: txType === 'inter_unit_loan' ? borrowerForm.email : '',
        event_name: eventName,
        location_name: locationName,
        start_date: startDate,
        expected_return_date: expectedReturnDate,
        notes,
        letter_number: txType === 'inter_unit_loan' ? letterNumber : null,
        letter_date: txType === 'inter_unit_loan' ? letterDate : null,
        sender_unit: txType === 'inter_unit_loan' ? (senderUnit || borrowerForm.institution) : null,
        letter_notes: txType === 'inter_unit_loan' ? normalizeUrl(letterNotes) : null,
        lines: selectedLines.map((l) => ({
          item_type_id: l.item_type_id,
          asset_unit_id: l.asset_unit_id || null,
          asset_kit_id: l.asset_kit_id || null,
          tracking_mode: l.tracking_mode,
          quantity_requested: l.quantity,
        })),
      };

      const res = await api.createTransaction(payload);
      if (res.success) {
        success(res.message);
        onSuccess(res.transaction_id);
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find((i) => String(i.id) === selectedItemTypeId);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pencatatan Transaksi Baru</h2>
          <p className="text-xs text-slate-500">Konfirmasi reservasi dan penyerahan inventaris secara langsung</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Transaction type */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-forest-800" />
              1. Jenis Transaksi
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold">Tanpa Antrean Approval Aplikasi</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              onClick={() => setTxType('internal_usage')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                txType === 'internal_usage'
                  ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-500'
                  : 'border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-bold">Pemakaian Internal</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Penggunaan inventaris di dalam unit/kantor sendiri</div>
            </button>
            <button
              type="button"
              onClick={() => setTxType('inter_unit_loan')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                txType === 'inter_unit_loan'
                  ? 'border-purple-600 bg-purple-50/50 text-purple-950 ring-1 ring-purple-500'
                  : 'border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-bold">Pinjaman Antarunit</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Dengan referensi surat yang telah diterima di luar aplikasi</div>
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <p className="text-[11px] text-slate-500">
              Alat sudah disiapkan? Pindai QR untuk memasukkannya ke daftar, lalu lengkapi detail transaksi. Reservasi aset dilakukan saat transaksi disimpan.
            </p>
            <button
              type="button"
              onClick={() => setIsAssetScannerOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-700 text-forest-800 hover:bg-emerald-50 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4" />
              Scan alat yang disiapkan
            </button>
          </div>
        </div>

        {/* Step 2: Borrower identity, required only for inter-unit loans */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-forest-800" />
              2. Identitas Peminjam / Penanggung Jawab
            </span>
            <span className="text-[11px] text-slate-400">
              {txType === 'internal_usage' ? 'Tidak diperlukan untuk pemakaian internal' : 'Peminjam tidak perlu login'}
            </span>
          </div>

          {txType === 'inter_unit_loan' ? (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Dari Kontak Tersimpan:
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">-- Kontak Baru (Ketik Manual di Bawah) --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.institution}) - {c.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap PIC:</label>
                <input
                  type="text"
                  required
                  value={borrowerForm.full_name}
                  onChange={(e) => setBorrowerForm({ ...borrowerForm, full_name: e.target.value })}
                  placeholder="Contoh: Dr. Hendra Wijaya, M.T."
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Kerja / Instansi:</label>
                <input
                  type="text"
                  required
                  value={borrowerForm.institution}
                  onChange={(e) => setBorrowerForm({ ...borrowerForm, institution: e.target.value })}
                  placeholder="Contoh: Fakultas Teknik Elektro"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor HP / WhatsApp Aktif:</label>
                <input
                  type="tel"
                  required
                  value={borrowerForm.phone_wa}
                  onChange={(e) => setBorrowerForm({ ...borrowerForm, phone_wa: e.target.value })}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Aktif (Pengiriman Bukti):</label>
                <input
                  type="email"
                  required
                  value={borrowerForm.email}
                  onChange={(e) => setBorrowerForm({ ...borrowerForm, email: e.target.value })}
                  placeholder="peminjam@univ.ac.id"
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
          ) : (
            <p className="text-xs text-slate-600">
              Identitas PIC tidak perlu diisi untuk pemakaian internal. Petugas dapat langsung melanjutkan ke waktu dan barang yang digunakan.
            </p>
          )}
        </div>

        {/* Step 3: Supporting documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-forest-800" />
              3. Dokumen Pendukung
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold">Tanpa Antrean Approval Aplikasi</span>
          </div>

          <div className="space-y-3 text-xs">
            {txType === 'internal_usage' && (
              <p className="text-slate-600">
                Pemakaian internal tidak memerlukan surat pengantar.
              </p>
            )}
            {/* Reference letter fields if inter-unit */}
            {txType === 'inter_unit_loan' && (
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3 mt-3">
                <div className="text-[11px] font-bold text-purple-950">
                  Data Surat Permohonan Antarunit (Dokumen Telah Disetujui di Luar Aplikasi):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-purple-900 mb-1">Nomor Surat Resmi:</label>
                    <input
                      type="text"
                      required
                      value={letterNumber}
                      onChange={(e) => setLetterNumber(e.target.value)}
                      placeholder="042/FT-EL/UNDIP/XI/2026"
                      className="w-full px-3 py-2 border border-purple-200 rounded-xl font-mono focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-purple-900 mb-1">Tanggal Surat:</label>
                    <input
                      type="date"
                      value={letterDate}
                      onChange={(e) => setLetterDate(e.target.value)}
                      className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-purple-900 mb-1">Unit Pengirim Surat:</label>
                    <input
                      type="text"
                      value={senderUnit}
                      onChange={(e) => setSenderUnit(e.target.value)}
                      placeholder="Contoh: Dekanat Fakultas Teknik"
                      className="w-full px-3 py-2 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-purple-900 mb-1">Tautan Dokumen / Arsip:</label>
                    <input
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      value={letterNotes}
                      onChange={(e) => setLetterNotes(e.target.value)}
                      placeholder="https://drive.google.com/file/d/..."
                      className="w-full px-3 py-2 border border-purple-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                    <p className="mt-1 text-[10px] text-purple-800">
                      Opsional. Tempel link Google Drive, OneDrive, Dropbox, atau penyimpanan lain. Pastikan akses
                      berbagi sudah diatur.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Waktu, Lokasi & Kegiatan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-forest-800" />
              4. Waktu & Lokasi Keperluan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kegiatan / Keperluan:</label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Contoh: Liputan Udara & Dokumentasi Wisuda"
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lokasi Pemakaian / Tempat Acara:</label>
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Contoh: Auditorium Utama Kampus"
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jadwal Pengambilan / Mulai:</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Batas Waktu Pengembalian (Tenggat):</label>
              <input
                type="datetime-local"
                required
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Step 5: Pemilihan Peralatan & Paket */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-forest-800" />
              5. Pemilihan Peralatan & Paket
            </span>
            <span className="text-[11px] text-slate-500">{selectedLines.length} item dipilih</span>
          </div>

          <div className="space-y-4">
            <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800 block">Unit fisik satu per satu</span>
                  <span className="text-[11px] text-slate-500">Pilih dengan ceklis atau pindai QR setelah alat disiapkan.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssetScannerOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-semibold transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Pindai QR Aset
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="search"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Cari nama barang, kategori, atau kode aset..."
                    className="w-full pl-9 pr-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {availableAssets.length > 0 && (
                  <label className="inline-flex items-center gap-2 px-2 text-slate-600 font-semibold cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={allVisibleAssetsSelected}
                      onChange={(e) => toggleVisibleAssets(e.target.checked)}
                      className="rounded border-slate-300 text-forest-800 focus:ring-emerald-500"
                    />
                    Pilih semua ({availableAssets.length})
                  </label>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {availableAssets.length ? availableAssets.map((asset) => {
                  const checked = selectedLines.some((line) => line.asset_unit_id === asset.id);
                  return (
                    <label
                      key={asset.id}
                      className={`pick-row flex items-center gap-3 p-3 cursor-pointer ${checked ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleAssetSelection(asset, e.target.checked)}
                        className="rounded border-slate-300 text-forest-800 focus:ring-emerald-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-800">{asset.item_name}</span>
                        <span className="block font-mono text-[10px] text-slate-500">
                          {asset.asset_code} · {asset.condition} · {asset.location_name}
                        </span>
                      </span>
                      {checked && <Check className="w-4 h-4 text-emerald-700" />}
                    </label>
                  );
                }) : (
                  <p className="p-4 text-center text-slate-500">
                    {assetSearch ? 'Tidak ada aset tersedia yang cocok dengan pencarian.' : 'Tidak ada unit fisik tersedia.'}
                  </p>
                )}
              </div>
              {unselectedVisibleAssets.length > 0 && allVisibleAssetsSelected === false && (
                <p className="text-[10px] text-slate-500">
                  {selectedLines.filter((line) => line.asset_unit_id).length} unit fisik sudah dipilih.
                </p>
              )}
            </section>

            <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <span className="font-bold text-slate-800 block">Tambah stok kuantitas atau paket:</span>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <select
                  value={selectedKitId}
                  onChange={(e) => {
                    setSelectedKitId(e.target.value);
                    setSelectedItemTypeId('');
                  }}
                  className="px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- Pilih Paket Lengkap (opsional) --</option>
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.kit_code})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedItemTypeId}
                  onChange={(e) => {
                    setSelectedItemTypeId(e.target.value);
                    setSelectedKitId('');
                  }}
                  className="px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- Pilih Stok Kuantitas --</option>
                  {items.filter((item) => item.tracking_mode !== 'unique_unit').map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.tracking_mode === 'consumable' ? 'Habis Pakai' : item.unit_of_measure})
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(Number(e.target.value))}
                      className="w-24 px-3 py-2 border rounded-xl font-mono text-center"
                    />
                    <span className="text-slate-500 font-semibold">{selectedItem.unit_of_measure}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddItemLine}
                disabled={!selectedItemTypeId && !selectedKitId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-semibold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambahkan</span>
              </button>
            </section>
          </div>

          {/* Selected Lines List */}
          <div className="space-y-2">
            {selectedLines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{line.item_name}</div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {line.asset_code || line.kit_name || '(Stok Kuantitas)'}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-bold font-mono text-slate-800">
                    {line.quantity} unit
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Menyimpan...' : 'Konfirmasi & Catat Transaksi'}</span>
          </button>
        </div>
      </form>
      <QRScannerModal
        isOpen={isAssetScannerOpen}
        onClose={() => setIsAssetScannerOpen(false)}
        onSelectResult={() => {}}
        mode="asset-selection"
        onSelectAsset={addAssetToSelection}
      />
    </div>
  );
};
