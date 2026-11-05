import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer, ZoomIn, ZoomOut, Info, Settings2, Sliders, Check } from 'lucide-react';
import { AssetUnit } from '../../types';

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetUnit | null;
}

type LabelPreset = '30x20' | '40x30' | '50x30' | '60x40' | '70x50' | 'custom' | 'a4_sheet';
type QrScale = 'auto' | 'small' | 'medium' | 'large';

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [preset, setPreset] = useState<LabelPreset>('30x20');
  const [customWidth, setCustomWidth] = useState<number>(30);
  const [customHeight, setCustomHeight] = useState<number>(20);
  const [copies, setCopies] = useState<number>(1);
  const [qrScale, setQrScale] = useState<QrScale>('auto');
  const [previewZoom, setPreviewZoom] = useState<number>(2.0); // 2x zoom by default for crisp on-screen inspection

  // Toggles for information fields
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [showCondition, setShowCondition] = useState<boolean>(false);
  const [showSerialNumber, setShowSerialNumber] = useState<boolean>(true);

  // Compute active dimensions in mm
  const getDimensions = (): { width: number; height: number } => {
    switch (preset) {
      case '30x20':
        return { width: 30, height: 20 };
      case '40x30':
        return { width: 40, height: 30 };
      case '50x30':
        return { width: 50, height: 30 };
      case '60x40':
        return { width: 60, height: 40 };
      case '70x50':
        return { width: 70, height: 50 };
      case 'custom':
        return { width: Math.max(20, customWidth), height: Math.max(15, customHeight) };
      case 'a4_sheet':
        return { width: 210, height: 297 };
      default:
        return { width: 30, height: 20 };
    }
  };

  const { width: printWidth, height: printHeight } = getDimensions();

  // Compute adaptive QR size in mm based on label size & user preference
  const getQrSizeMm = (): number => {
    if (preset === '30x20' || (printWidth <= 35 && printHeight <= 22)) {
      if (qrScale === 'small') return 9.5;
      if (qrScale === 'medium') return 11.0;
      if (qrScale === 'large') return 12.5;
      return 11.0; // Auto / optimal default: leaves 16mm for text!
    }

    if (preset === '40x30' || (printWidth <= 45 && printHeight <= 32)) {
      if (qrScale === 'small') return 13.0;
      if (qrScale === 'medium') return 15.5;
      if (qrScale === 'large') return 18.0;
      return 15.0;
    }

    // Larger labels (50x30, 60x40, etc.)
    const availableHeight = printHeight - 6;
    if (qrScale === 'small') return Math.min(availableHeight, printWidth * 0.30);
    if (qrScale === 'medium') return Math.min(availableHeight, printWidth * 0.38);
    if (qrScale === 'large') return Math.min(availableHeight, printWidth * 0.45);
    return Math.min(availableHeight, Math.max(16, printWidth * 0.36));
  };

  const qrSizeMm = getQrSizeMm();

  // Dynamic Typography Scaling
  const getTypography = () => {
    const isVerySmall = printWidth <= 35 || printHeight <= 22;
    const isSmall = (printWidth <= 45 && printHeight <= 35) && !isVerySmall;

    if (isVerySmall) {
      return {
        header: '5pt',
        code: '6.5pt',
        name: '5.2pt',
        sub: '4.5pt',
        padding: '1.2mm',
        gap: '1.2mm',
      };
    }

    if (isSmall) {
      return {
        header: '6pt',
        code: '8pt',
        name: '6.5pt',
        sub: '5.2pt',
        padding: '1.8mm',
        gap: '1.8mm',
      };
    }

    return {
      header: '7pt',
      code: '9.5pt',
      name: '7.5pt',
      sub: '6pt',
      padding: '2.5mm',
      gap: '2.5mm',
    };
  };

  const typo = getTypography();

  useEffect(() => {
    if (asset && isOpen) {
      QRCode.toDataURL(asset.asset_code, {
        width: 320,
        margin: 0,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      }).then((url) => setQrDataUrl(url));
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const handlePrint = () => {
    window.print();
  };

  const isSheetA4 = preset === 'a4_sheet';

  // Render Label Content
  const renderSingleLabel = (keySuffix: string | number = 0) => {
    return (
      <div
        key={keySuffix}
        className="label-item bg-white text-black font-sans box-border overflow-hidden border border-black/20 flex flex-col justify-between"
        style={{
          width: `${printWidth}mm`,
          height: `${printHeight}mm`,
          padding: typo.padding,
          pageBreakAfter: isSheetA4 ? 'auto' : 'always',
          breakAfter: isSheetA4 ? 'auto' : 'page',
        }}
      >
        {/* Top Header if enabled and height permits */}
        {showHeader && printHeight >= 24 && (
          <div className="flex items-center justify-between border-b border-black/25 pb-0.5 leading-none">
            <span style={{ fontSize: typo.header }} className="font-extrabold uppercase tracking-wider text-black">
              NVENTORI ASSET
            </span>
            <span style={{ fontSize: typo.sub }} className="font-semibold text-slate-700 truncate max-w-[22mm]">
              {asset.category_name || 'INVENTARIS'}
            </span>
          </div>
        )}

        {/* Center Section: QR + Metadata side-by-side */}
        <div className="flex items-center my-auto w-full overflow-hidden" style={{ gap: typo.gap }}>
          {/* QR Code */}
          {qrDataUrl && (
            <div
              className="flex-shrink-0 flex items-center justify-center bg-white"
              style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm` }}
            >
              <img
                src={qrDataUrl}
                alt={`QR ${asset.asset_code}`}
                style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm` }}
                className="block object-contain"
              />
            </div>
          )}

          {/* Text Metadata Column */}
          <div className="flex-1 min-w-0 flex flex-col justify-center text-left leading-tight overflow-hidden">
            {/* Ultra-compact Header tag for small labels where top header is hidden */}
            {showHeader && printHeight < 24 && (
              <div
                style={{ fontSize: typo.header }}
                className="font-extrabold uppercase text-slate-800 tracking-tight leading-none mb-0.5 truncate"
              >
                NVENTORI
              </div>
            )}

            {/* Asset Code (Full width, crisp, no clipping) */}
            <div
              style={{ fontSize: typo.code }}
              className="font-black font-mono tracking-tight text-black leading-tight whitespace-nowrap"
            >
              {asset.asset_code}
            </div>

            {/* Item Name */}
            <div
              style={{ fontSize: typo.name }}
              className="font-bold text-slate-900 leading-tight truncate mt-0.5"
              title={asset.item_name}
            >
              {asset.item_name}
            </div>

            {/* Serial Number if present & enabled */}
            {showSerialNumber && asset.serial_number && (
              <div
                style={{ fontSize: typo.sub }}
                className="font-mono text-slate-600 truncate leading-none mt-0.5"
              >
                SN: {asset.serial_number}
              </div>
            )}

            {/* Location if enabled */}
            {showLocation && (
              <div
                style={{ fontSize: typo.sub }}
                className="text-slate-600 truncate leading-none mt-0.5"
              >
                {asset.location_name || 'Gudang Pusat'}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Footer if height permits */}
        {printHeight >= 28 && (
          <div className="flex items-center justify-between border-t border-black/20 pt-0.5 text-slate-600 font-mono leading-none" style={{ fontSize: typo.sub }}>
            <span className="truncate max-w-[26mm]">{asset.location_name || 'Gudang Pusat'}</span>
            {showCondition && <span className="font-bold text-black uppercase">{asset.condition}</span>}
          </div>
        )}
      </div>
    );
  };

  const copiesArray = Array.from({ length: Math.max(1, copies) }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      {/* Injected Print Stylesheet specifically for Thermal Roll Printers */}
      <style>{`
        @media print {
          @page {
            size: ${isSheetA4 ? 'A4 portrait' : `${printWidth}mm ${printHeight}mm`};
            margin: 0mm !important;
          }
          html, body {
            margin: 0mm !important;
            padding: 0mm !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            width: ${isSheetA4 ? '210mm' : `${printWidth}mm`} !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area-wrapper {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .label-item {
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header (No print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-forest-800 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cetak Label QR (Thermal & Standar)</h3>
              <p className="text-[11px] text-slate-500">
                Data dan ukuran QR otomatis beradaptasi proporsional pada semua ukuran label
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

        {/* Modal Body (No print controls) */}
        <div className="no-print p-5 overflow-y-auto space-y-4 text-xs">
          {/* Preset Buttons */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Pilih Ukuran Label Kertas:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '30x20', label: '30 × 20 mm', desc: 'Mini Tag / Kabel' },
                { id: '40x30', label: '40 × 30 mm', desc: 'Termal Kecil' },
                { id: '50x30', label: '50 × 30 mm', desc: 'Termal Standar' },
                { id: '60x40', label: '60 × 40 mm', desc: 'Termal Menengah' },
                { id: '70x50', label: '70 × 50 mm', desc: 'Termal Besar' },
                { id: 'custom', label: 'Ukuran Bebas (mm)', desc: 'Kustomisasi Lebar/Tinggi' },
                { id: 'a4_sheet', label: 'Lembar A4 Stiker', desc: 'Printer Biasa / Laser' },
              ].map((p) => {
                const isSelected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id as any)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-forest-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{p.label}</div>
                    <div className="text-[10px] text-slate-500">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Size Inputs */}
          {preset === 'custom' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lebar Label (mm):</label>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tinggi Label (mm):</label>
                <input
                  type="number"
                  min="15"
                  max="150"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Advanced Adapters: QR Size Ratio & Information Toggles */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* QR Size Adapter */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ukuran QR Code: ({qrSizeMm} mm)
                </label>
                <div className="flex gap-1.5">
                  {[
                    { id: 'auto', label: 'Otomatis' },
                    { id: 'small', label: 'Kecil' },
                    { id: 'medium', label: 'Sedang' },
                    { id: 'large', label: 'Besar' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setQrScale(s.id as any)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                        qrScale === s.id
                          ? 'border-emerald-600 bg-white text-forest-800 shadow-xs'
                          : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copies */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Label (Copies):</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 border rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white text-center font-bold"
                />
              </div>
            </div>

            {/* Field Toggles */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => setShowHeader(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Header Aplikasi</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Lokasi Gudang</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSerialNumber}
                  onChange={(e) => setShowSerialNumber(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Nomor Seri</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCondition}
                  onChange={(e) => setShowCondition(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Kondisi Fisik</span>
              </label>
            </div>
          </div>

          {/* Thermal Printer Instructions Alert */}
          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Tips Cetak Printer Termal: </span>
              Di kotak dialog print peramban, pilih printer termal Anda, atur ukuran kertas (*Paper Size*) ke <strong>{printWidth} × {printHeight} mm</strong>, dan setel <strong>Margin ke "None" (Tanpa Margin)</strong> agar cetakan pas tanpa mengeluarkan kertas kosong.
            </div>
          </div>

          {/* Interactive Screen Preview with Zoom Controller */}
          <div>
            <div className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Pratinjau Hasil Cetak ({printWidth} × {printHeight} mm):</span>

              {/* Zoom Buttons for clear on-screen inspection */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                <span className="text-[10px] text-slate-600 px-1 font-medium">Zoom:</span>
                {[
                  { scale: 1.0, label: '1x' },
                  { scale: 1.5, label: '1.5x' },
                  { scale: 2.0, label: '2x' },
                  { scale: 2.5, label: '2.5x' },
                ].map((z) => (
                  <button
                    key={z.scale}
                    type="button"
                    onClick={() => setPreviewZoom(z.scale)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      previewZoom === z.scale
                        ? 'bg-white text-forest-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Box */}
            <div className="p-6 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-auto min-h-[160px]">
              <div
                style={{
                  transform: `scale(${previewZoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 150ms ease',
                }}
                className="shadow-md rounded-sm overflow-hidden ring-1 ring-black/10 my-4"
              >
                {renderSingleLabel('preview')}
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Printable Container on Screen, Visible on Print */}
        <div className="print-area-wrapper hidden print:block">
          {preset === 'a4_sheet' ? (
            <div className="p-8 grid grid-cols-4 gap-3 bg-white">
              {copiesArray.map((idx) => renderSingleLabel(`print-${idx}`))}
            </div>
          ) : (
            copiesArray.map((idx) => renderSingleLabel(`print-${idx}`))
          )}
        </div>

        {/* Modal Footer (No print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Total {copies} label • Ukuran: {printWidth} × {printHeight} mm • QR: {qrSizeMm} mm
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {copies} Label</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
