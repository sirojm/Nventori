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
  Ruler,
  RotateCcw,
  Link2,
  Link2Off,
} from 'lucide-react';
import { AssetUnit } from '../../types';
import { renderLabelCanvas, getQrSizeMm, defaultMargin, QrScale, LabelOptions } from '../../utils/labelRenderer';
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

type LabelPreset = '30x20' | '35x20' | '40x30' | '50x30' | '60x40' | '70x50' | 'custom';
type Side = 'top' | 'right' | 'bottom' | 'left';

const PREFS_KEY = 'nventori.labelPrefs.v2';
interface LabelPrefs {
  preset: LabelPreset;
  customWidth: number;
  customHeight: number;
  qrScale: QrScale;
  showHeader: boolean;
  showLocation: boolean;
  showCondition: boolean;
  showSerialNumber: boolean;
  margins: Record<Side, number | null>; // null = automatic
  marginLinked: boolean;
  offsetX: number;
  offsetY: number;
  textScale: number;
}
const DEFAULT_PREFS: LabelPrefs = {
  preset: '50x30',
  customWidth: 35,
  customHeight: 20,
  qrScale: 'auto',
  showHeader: true,
  showLocation: true,
  showCondition: false,
  showSerialNumber: true,
  margins: { top: null, right: null, bottom: null, left: null },
  marginLinked: true,
  offsetX: 0,
  offsetY: 0,
  textScale: 1,
};
function loadLabelPrefs(): LabelPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

// Keep the connection alive across modal opens (same session)
let sharedConnection: Connection | null = null;

const PRESETS: { id: LabelPreset; label: string; desc: string }[] = [
  { id: '30x20', label: '30 × 20 mm', desc: 'Mini Tag / Kabel' },
  { id: '35x20', label: '35 × 20 mm', desc: 'Label Kecil' },
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
  const saved = useRef(loadLabelPrefs()).current;
  const [tab, setTab] = useState<'label' | 'printer'>('label');
  const [preset, setPreset] = useState<LabelPreset>(saved.preset);
  const [customWidth, setCustomWidth] = useState<number>(saved.customWidth);
  const [customHeight, setCustomHeight] = useState<number>(saved.customHeight);
  const [copies, setCopies] = useState<number>(1);
  const [qrScale, setQrScale] = useState<QrScale>(saved.qrScale);
  const [previewZoom, setPreviewZoom] = useState<number>(3);
  const [showGuides, setShowGuides] = useState(true);

  const [showHeader, setShowHeader] = useState(saved.showHeader);
  const [showLocation, setShowLocation] = useState(saved.showLocation);
  const [showCondition, setShowCondition] = useState(saved.showCondition);
  const [showSerialNumber, setShowSerialNumber] = useState(saved.showSerialNumber);

  // Margins (mm). `marginLinked` keeps all four sides equal.
  const [margins, setMargins] = useState<Record<Side, number | null>>(saved.margins);
  const [marginLinked, setMarginLinked] = useState(saved.marginLinked);
  const [offsetX, setOffsetX] = useState(saved.offsetX);
  const [offsetY, setOffsetY] = useState(saved.offsetY);
  const [textScale, setTextScale] = useState(saved.textScale);

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
      return { width: clamp(customWidth, 15, 110), height: clamp(customHeight, 10, 200) };
    }
    const [w, h] = preset.split('x').map(Number);
    return { width: w, height: h };
  })();
  const printWidth = dims.width;
  const printHeight = dims.height;
  const qrSizeMm = Math.round(getQrSizeMm(printWidth, printHeight, qrScale) * 10) / 10;

  const autoMargin = defaultMargin(printWidth, printHeight);
  const m = (side: Side) => margins[side] ?? autoMargin;
  const hasCustomMargin = (Object.values(margins) as (number | null)[]).some((v) => v !== null);

  const labelOptions: LabelOptions = {
    widthMm: printWidth,
    heightMm: printHeight,
    qrScale,
    showHeader,
    showLocation,
    showSerialNumber,
    showCondition,
    marginTop: m('top'),
    marginRight: m('right'),
    marginBottom: m('bottom'),
    marginLeft: m('left'),
    offsetX,
    offsetY,
    textScale,
  };

  const setMargin = (side: Side, value: number) => {
    const v = clamp(value, 0, 10);
    setMargins((prev) =>
      marginLinked ? { top: v, right: v, bottom: v, left: v } : { ...prev, [side]: v }
    );
  };
  const resetLayout = () => {
    setMargins({ top: null, right: null, bottom: null, left: null });
    setOffsetX(0);
    setOffsetY(0);
    setTextScale(1);
    setQrScale('auto');
  };

  // Remember label preferences
  useEffect(() => {
    try {
      const prefs: LabelPrefs = {
        preset, customWidth, customHeight, qrScale, showHeader, showLocation, showCondition,
        showSerialNumber, margins, marginLinked, offsetX, offsetY, textScale,
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [preset, customWidth, customHeight, qrScale, showHeader, showLocation, showCondition,
      showSerialNumber, margins, marginLinked, offsetX, offsetY, textScale]);

  const updateSettings = (patch: Partial<PrinterSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Live preview = exactly the bitmap that gets printed
  const optionsKey = JSON.stringify(labelOptions);
  useEffect(() => {
    if (!asset || !isOpen) return;
    const id = ++renderId.current;
    renderLabelCanvas(asset, labelOptions, settings.dpi).then((c) => {
      if (id === renderId.current) setPreviewUrl(c.toDataURL('image/png'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, isOpen, optionsKey, settings.dpi]);

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

  const numField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts: { min: number; max: number; step: number; unit?: string }
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-slate-600">{label}</label>
        <span className="text-[11px] font-mono text-slate-500">
          {Number(value.toFixed(2))}
          {opts.unit ?? ' mm'}
        </span>
      </div>
      <input
        type="range"
        min={opts.min}
        max={opts.max}
        step={opts.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-700"
      />
    </div>
  );

  const guideStyle = {
    top: `${(m('top') / printHeight) * 100}%`,
    right: `${(m('right') / printWidth) * 100}%`,
    bottom: `${(m('bottom') / printHeight) * 100}%`,
    left: `${(m('left') / printWidth) * 100}%`,
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96dvh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-forest-800 flex items-center justify-center flex-shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">Cetak Label QR</h3>
              <p className="text-[11px] text-slate-500 truncate font-mono">{asset.asset_code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live preview (always visible) */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2 text-[11px] text-slate-600">
            <span className="font-semibold">
              Pratinjau • {printWidth} × {printHeight} mm
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                Garis margin
              </label>
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg">
                {[2, 3, 4].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setPreviewZoom(z)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      previewZoom === z ? 'bg-white text-forest-800 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center overflow-auto min-h-[110px] py-2">
            {previewUrl && (
              <div
                className="relative flex-shrink-0 bg-white shadow-md ring-1 ring-black/10"
                style={{
                  width: `min(100%, ${printWidth * previewZoom * 3.78}px)`,
                  aspectRatio: `${printWidth} / ${printHeight}`,
                }}
              >
                <img src={previewUrl} alt="Pratinjau label" className="absolute inset-0 w-full h-full" />
                {showGuides && (
                  <div
                    className="absolute border border-dashed border-emerald-500/80 pointer-events-none"
                    style={guideStyle}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-2 gap-1 border-b border-slate-100">
          {(
            [
              ['label', 'Label & Margin', Ruler],
              ['printer', 'Printer', Printer],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition cursor-pointer ${
                tab === id
                  ? 'border-emerald-600 text-forest-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {tab === 'label' && (
            <>
              {/* Size */}
              <div>
                <div className="font-semibold text-slate-700 mb-1.5">Ukuran Label</div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreset(p.id)}
                      title={p.desc}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition cursor-pointer ${
                        preset === p.id
                          ? 'border-emerald-600 bg-emerald-50 text-forest-800 ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {p.id === 'custom' ? 'Kustom' : p.label}
                    </button>
                  ))}
                </div>
                {preset === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">Lebar (mm)</span>
                      <input
                        type="number"
                        min="15"
                        max="110"
                        step="0.5"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">Tinggi (mm)</span>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        step="0.5"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Margins */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-700">
                    Margin {!hasCustomMargin && <span className="font-normal text-slate-400">(otomatis {autoMargin} mm)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMarginLinked((v) => !v)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        marginLinked
                          ? 'border-emerald-600 bg-white text-forest-800'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {marginLinked ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
                      {marginLinked ? 'Semua sisi' : 'Per sisi'}
                    </button>
                    <button
                      type="button"
                      onClick={resetLayout}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>
                </div>

                {marginLinked ? (
                  numField('Semua sisi', m('top'), (v) => setMargin('top', v), { min: 0, max: 6, step: 0.25 })
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {numField('Atas', m('top'), (v) => setMargin('top', v), { min: 0, max: 8, step: 0.25 })}
                    {numField('Bawah', m('bottom'), (v) => setMargin('bottom', v), { min: 0, max: 8, step: 0.25 })}
                    {numField('Kiri', m('left'), (v) => setMargin('left', v), { min: 0, max: 8, step: 0.25 })}
                    {numField('Kanan', m('right'), (v) => setMargin('right', v), { min: 0, max: 8, step: 0.25 })}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200">
                  <div className="text-[11px] text-slate-500 mb-2">
                    Geser posisi — dipakai jika hasil cetak terpotong atau tidak sejajar dengan label fisik.
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {numField('Geser horizontal (kanan +)', offsetX, setOffsetX, { min: -5, max: 5, step: 0.25 })}
                    {numField('Geser vertikal (bawah +)', offsetY, setOffsetY, { min: -5, max: 5, step: 0.25 })}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Ukuran QR ({qrSizeMm} mm)</div>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ['auto', 'Auto'],
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
                  {numField('Ukuran teks', textScale, setTextScale, { min: 0.7, max: 1.4, step: 0.05, unit: '×' })}
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
            </>
          )}

          {tab === 'printer' && (
            <>
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
                    Dialog cetak memakai ukuran kertas{' '}
                    <strong>
                      {printWidth} × {printHeight} mm
                    </strong>
                    . Jika pratinjau masih A4, pilih printer label lalu atur <em>Paper size</em> ke ukuran tersebut
                    dan <em>Margins</em> ke <em>None</em>.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline">Jumlah</span>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="w-8 h-8 text-slate-600 hover:bg-slate-50 rounded-l-lg cursor-pointer"
                aria-label="Kurangi"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(clamp(Math.round(Number(e.target.value)), 1, 100))}
                className="w-12 h-8 text-center text-xs font-bold font-mono border-x border-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setCopies((c) => Math.min(100, c + 1))}
                className="w-8 h-8 text-slate-600 hover:bg-slate-50 rounded-r-lg cursor-pointer"
                aria-label="Tambah"
              >
                +
              </button>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={busy !== null || (needsConnection && (transportUnsupported || !caps.secure))}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer"
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
    </div>,
    document.body
  );
};
