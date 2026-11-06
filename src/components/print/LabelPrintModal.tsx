import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Info,
  Bluetooth,
  Usb,
  Cable,
  Smartphone,
  Monitor,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Unplug,
} from 'lucide-react';
import { AssetUnit } from '../../types';
import { renderLabelCanvas, getQrSizeMm, QrScale, LabelOptions } from '../../utils/labelRenderer';
import {
  PrinterSettings,
  PrinterLanguage,
  TransportKind,
  Connection,
  loadSettings,
  saveSettings,
  capabilities,
  connect,
  buildCommands,
  sendViaRawBT,
  printViaSystem,
} from '../../utils/labelPrinter';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetUnit | null;
}

type LabelPreset = '30x20' | '40x30' | '50x30' | '60x40' | '70x50' | 'custom';

// Keep the connection alive across modal opens (same session)
let sharedConnection: Connection | null = null;

const PRESETS: { id: LabelPreset; label: string; desc: string }[] = [
  { id: '30x20', label: '30 × 20 mm', desc: 'Mini Tag / Kabel' },
  { id: '40x30', label: '40 × 30 mm', desc: 'Termal Kecil' },
  { id: '50x30', label: '50 × 30 mm', desc: 'Termal Standar' },
  { id: '60x40', label: '60 × 40 mm', desc: 'Termal Menengah' },
  { id: '70x50', label: '70 × 50 mm', desc: 'Termal Besar' },
  { id: 'custom', label: 'Ukuran Bebas (mm)', desc: 'Lebar / Tinggi sendiri' },
];

const TRANSPORTS: { id: TransportKind; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth, hint: 'HP Android / PC (Chrome/Edge)' },
  { id: 'usb', label: 'USB', icon: Usb, hint: 'Kabel USB langsung (WebUSB)' },
  { id: 'serial', label: 'Serial / COM', icon: Cable, hint: 'PC: BT classic terpasang / USB-serial' },
  { id: 'rawbt', label: 'RawBT', icon: Smartphone, hint: 'Android, via aplikasi RawBT' },
  { id: 'system', label: 'Driver Sistem', icon: Monitor, hint: 'Dialog cetak OS (driver terpasang)' },
];

const LANGS: { id: PrinterLanguage; label: string }[] = [
  { id: 'tspl', label: 'TSPL (Clabel, TSC, Xprinter, HPRT)' },
  { id: 'zpl', label: 'ZPL (Zebra)' },
  { id: 'cpcl', label: 'CPCL (printer mobile)' },
  { id: 'escpos', label: 'ESC/POS (printer struk)' },
];

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, asset }) => {
  const [preset, setPreset] = useState<LabelPreset>('50x30');
  const [customWidth, setCustomWidth] = useState<number>(50);
  const [customHeight, setCustomHeight] = useState<number>(30);
  const [copies, setCopies] = useState<number>(1);
  const [qrScale, setQrScale] = useState<QrScale>('auto');
  const [previewZoom, setPreviewZoom] = useState<number>(2.0);

  const [showHeader, setShowHeader] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCondition, setShowCondition] = useState(false);
  const [showSerialNumber, setShowSerialNumber] = useState(true);

  const [settings, setSettings] = useState<PrinterSettings>(loadSettings);
  const [conn, setConn] = useState<Connection | null>(sharedConnection);
  const [busy, setBusy] = useState<'connect' | 'print' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const renderId = useRef(0);

  const caps = capabilities();

  const dims = (() => {
    if (preset === 'custom') {
      return { width: Math.max(15, customWidth || 15), height: Math.max(10, customHeight || 10) };
    }
    const [w, h] = preset.split('x').map(Number);
    return { width: w, height: h };
  })();
  const printWidth = dims.width;
  const printHeight = dims.height;
  const qrSizeMm = Math.round(getQrSizeMm(printWidth, printHeight, qrScale) * 10) / 10;

  const labelOptions: LabelOptions = {
    widthMm: printWidth,
    heightMm: printHeight,
    qrScale,
    showHeader,
    showLocation,
    showSerialNumber,
    showCondition,
  };

  const updateSettings = (patch: Partial<PrinterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Live preview = exactly the bitmap that gets printed
  useEffect(() => {
    if (!asset || !isOpen) return;
    const id = ++renderId.current;
    renderLabelCanvas(asset, labelOptions, settings.dpi).then((c) => {
      if (id === renderId.current) setPreviewUrl(c.toDataURL('image/png'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, isOpen, printWidth, printHeight, qrScale, showHeader, showLocation, showSerialNumber, showCondition, settings.dpi]);

  // Drop stale connection reference if the device went away
  useEffect(() => {
    if (conn && !conn.isConnected()) {
      sharedConnection = null;
      setConn(null);
    }
  }, [conn, isOpen]);

  const needsConnection = settings.transport === 'bluetooth' || settings.transport === 'usb' || settings.transport === 'serial';

  const doConnect = useCallback(async (): Promise<Connection | null> => {
    setError('');
    setOkMsg('');
    setBusy('connect');
    try {
      if (sharedConnection) await sharedConnection.disconnect();
      const c = await connect(settings.transport);
      sharedConnection = c;
      setConn(c);
      setOkMsg(`Terhubung ke ${c.name}`);
      return c;
    } catch (e: any) {
      if (e?.name === 'NotFoundError' || /cancel/i.test(e?.message || '')) {
        // user closed the chooser
      } else {
        setError(e?.message || 'Gagal terhubung ke printer.');
      }
      return null;
    } finally {
      setBusy(null);
    }
  }, [settings.transport]);

  const doDisconnect = async () => {
    await sharedConnection?.disconnect();
    sharedConnection = null;
    setConn(null);
    setOkMsg('');
  };

  const handlePrint = async () => {
    if (!asset) return;
    setError('');
    setOkMsg('');
    try {
      let active = conn && conn.kind === settings.transport && conn.isConnected() ? conn : null;
      if (needsConnection && !active) {
        active = await doConnect();
        if (!active) return;
      }
      setBusy('print');
      setProgress(0);
      const canvas = await renderLabelCanvas(asset, labelOptions, settings.dpi);

      if (settings.transport === 'system') {
        await printViaSystem(
          Array.from({ length: Math.max(1, copies) }, () => canvas),
          printWidth,
          printHeight
        );
        return;
      }

      const bytes = buildCommands(
        { canvas, widthMm: printWidth, heightMm: printHeight, copies },
        settings
      );

      if (settings.transport === 'rawbt') {
        sendViaRawBT(bytes);
        setOkMsg('Data dikirim ke aplikasi RawBT.');
        return;
      }

      await active!.write(bytes, setProgress);
      setOkMsg(`${copies} label terkirim ke ${active!.name}.`);
    } catch (e: any) {
      setError(e?.message || 'Gagal mencetak.');
      if (needsConnection) {
        sharedConnection = null;
        setConn(null);
      }
    } finally {
      setBusy(null);
    }
  };

  if (!isOpen || !asset) return null;

  const transportUnsupported =
    (settings.transport === 'bluetooth' && !caps.bluetooth) ||
    (settings.transport === 'usb' && !caps.usb) ||
    (settings.transport === 'serial' && !caps.serial);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-forest-800 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cetak Label QR</h3>
              <p className="text-[11px] text-slate-500">
                Cetak langsung ke printer label (Bluetooth / USB) atau lewat driver sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Label size */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Ukuran Label:</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                    preset === p.id
                      ? 'border-emerald-600 bg-emerald-50 text-forest-800 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">{p.label}</div>
                  <div className="text-[10px] text-slate-500">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lebar (mm):</label>
                <input
                  type="number"
                  min="15"
                  max="110"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tinggi (mm):</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Content options */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ukuran QR: ({qrSizeMm} mm)</label>
                <div className="flex gap-1.5">
                  {(
                    [
                      ['auto', 'Otomatis'],
                      ['small', 'Kecil'],
                      ['medium', 'Sedang'],
                      ['large', 'Besar'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setQrScale(id)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                        qrScale === id
                          ? 'border-emerald-600 bg-white text-forest-800 shadow-xs'
                          : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Label:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white text-center font-bold"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
              {(
                [
                  ['Header Aplikasi', showHeader, setShowHeader],
                  ['Lokasi Gudang', showLocation, setShowLocation],
                  ['Nomor Seri', showSerialNumber, setShowSerialNumber],
                  ['Kondisi Fisik', showCondition, setShowCondition],
                ] as const
              ).map(([label, val, set]) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => set(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Printer connection */}
          <div className="p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="font-semibold text-slate-700">Koneksi Printer</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TRANSPORTS.map((t) => {
                const Icon = t.icon;
                const active = settings.transport === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      updateSettings({ transport: t.id });
                      setError('');
                      setOkMsg('');
                    }}
                    title={t.hint}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition cursor-pointer ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-forest-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              {TRANSPORTS.find((t) => t.id === settings.transport)?.hint}
            </p>

            {settings.transport !== 'system' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bahasa Printer</label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value as PrinterLanguage })}
                    className="w-full px-2 py-1.5 border rounded-lg bg-white text-[11px]"
                  >
                    {LANGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Resolusi</label>
                  <select
                    value={settings.dpi}
                    onChange={(e) => updateSettings({ dpi: Number(e.target.value) as 203 | 300 })}
                    className="w-full px-2 py-1.5 border rounded-lg bg-white text-[11px]"
                  >
                    <option value={203}>203 dpi</option>
                    <option value={300}>300 dpi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jenis Kertas</label>
                  <select
                    value={settings.media}
                    onChange={(e) => updateSettings({ media: e.target.value as PrinterSettings['media'] })}
                    className="w-full px-2 py-1.5 border rounded-lg bg-white text-[11px]"
                  >
                    <option value="gap">Label bercelah (gap)</option>
                    <option value="continuous">Menerus</option>
                    <option value="blackmark">Black mark</option>
                  </select>
                </div>
              </div>
            )}

            {settings.transport === 'rawbt' && (
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2">
                Pasang aplikasi <strong>RawBT</strong> dari Play Store, pasangkan printer di Bluetooth HP, lalu pilih
                printer di RawBT. Cocok untuk printer yang memakai Bluetooth Classic.
              </div>
            )}

            {needsConnection && !caps.secure && (
              <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Bluetooth/USB/Serial hanya berfungsi di halaman <strong>HTTPS</strong> atau <strong>localhost</strong>.
                  Halaman ini diakses lewat HTTP biasa. Gunakan HTTPS, atau sementara pakai mode RawBT / Driver Sistem.
                </span>
              </div>
            )}
            {needsConnection && caps.secure && transportUnsupported && (
              <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Browser ini tidak mendukung mode tersebut. Gunakan Chrome/Edge (Android atau PC). iPhone/Safari
                  tidak mendukung Bluetooth/USB web — gunakan mode Driver Sistem.
                </span>
              </div>
            )}

            {needsConnection && (
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-600 flex items-center gap-1.5 min-w-0">
                  {conn && conn.kind === settings.transport ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate font-semibold">{conn.name}</span>
                    </>
                  ) : (
                    <span>Belum terhubung</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {conn && conn.kind === settings.transport && (
                    <button
                      type="button"
                      onClick={doDisconnect}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                    >
                      <Unplug className="w-3.5 h-3.5" /> Putuskan
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null || transportUnsupported || !caps.secure}
                    onClick={doConnect}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {conn && conn.kind === settings.transport ? 'Ganti Printer' : 'Hubungkan Printer'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="break-words min-w-0">{error}</span>
              </div>
            )}
            {okMsg && !error && (
              <div className="flex items-start gap-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{okMsg}</span>
              </div>
            )}
          </div>

          {settings.transport === 'system' && (
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                Dialog cetak akan memakai ukuran kertas{' '}
                <strong>
                  {printWidth} × {printHeight} mm
                </strong>
                . Jika pratinjau masih A4, pilih printer label Anda lalu atur <em>Paper size</em> ke ukuran tersebut
                (atau buat ukuran kustom di <em>Printing Preferences</em> driver). Mode Bluetooth/USB langsung tidak
                memerlukan pengaturan ini.
              </div>
            </div>
          )}

          {/* Preview */}
          <div>
            <div className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>
                Pratinjau ({printWidth} × {printHeight} mm):
              </span>
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                <span className="text-[10px] text-slate-600 px-1 font-medium">Zoom:</span>
                {[1, 1.5, 2, 2.5].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setPreviewZoom(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      previewZoom === z ? 'bg-white text-forest-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-auto min-h-[160px]">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Pratinjau label"
                  style={{
                    width: `${printWidth * previewZoom * 3.78}px`,
                    height: `${printHeight * previewZoom * 3.78}px`,
                    maxWidth: 'none',
                    imageRendering: 'auto',
                  }}
                  className="bg-white shadow-md ring-1 ring-black/10 flex-shrink-0"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:block">
            {copies} label • {printWidth} × {printHeight} mm • QR {qrSizeMm} mm
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              disabled={busy !== null || (needsConnection && (transportUnsupported || !caps.secure))}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>
                {busy === 'print' && progress > 0
                  ? `Mengirim ${Math.round(progress * 100)}%`
                  : `Cetak ${copies} Label`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
