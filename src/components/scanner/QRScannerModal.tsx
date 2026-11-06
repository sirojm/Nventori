import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Search, ArrowRight, AlertCircle, CheckCircle2, Package, ArrowLeftRight } from 'lucide-react';
import { api } from '../../services/api';
import { AssetUnit } from '../../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: { type: 'transaction' | 'asset' | 'kit'; data: any }) => void;
  mode?: 'resolve' | 'asset-selection';
  onSelectAsset?: (asset: AssetUnit) => 'added' | 'duplicate' | 'unavailable';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
  mode = 'resolve',
  onSelectAsset,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ type: string; data: any } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [lastScannedAsset, setLastScannedAsset] = useState<AssetUnit | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lookupInProgressRef = useRef(false);
  // The camera callback outlives the render that created it; always call the latest handler.
  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanResult(null);
      setErrorMsg(null);
      setManualCode('');
      setSelectedCount(0);
      setLastScannedAsset(null);
    }
  }, [isOpen]);

  const startScanner = async () => {
    setErrorMsg(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const secureUrl = `https://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
      setErrorMsg(`Browser memblokir kamera karena halaman belum dibuka lewat HTTPS. Buka ${secureUrl} lalu izinkan sertifikat pengembangan di HP.`);
      return;
    }

    setCameraStarting(true);
    try {
      if (scannerRef.current) await stopScanner();
      const html5QrCode = new Html5Qrcode('qr-reader', {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // Native detector (same engine as the phone's camera app) when available: far more reliable
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = html5QrCode;

      // No qrbox => the whole camera frame is analysed, not just a small square.
      // High resolution + continuous autofocus are what make small/far QR codes decode.
      await html5QrCode.start(
        // html5-qrcode requires this first argument to have exactly ONE key
        { facingMode: 'environment' },
        {
          fps: 15,
          disableFlip: false,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as any],
          },
        },
        async (decodedText) => {
          if (lookupInProgressRef.current) return;
          lookupInProgressRef.current = true;
          await stopScanner();
          try {
            await handleLookup(decodedText, true);
          } finally {
            lookupInProgressRef.current = false;
          }
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera scan not started:', err);
      const errorName = err?.name || '';
      const errorMessage = err instanceof Error ? err.message : String(err || '');
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || /permission|denied|not allowed/i.test(errorMessage)) {
        setErrorMsg('Izin kamera ditolak. Aktifkan izin Kamera untuk situs ini di pengaturan browser, lalu coba lagi.');
      } else if (errorName === 'NotFoundError' || /no camera|camera.*not found/i.test(errorMessage)) {
        setErrorMsg('Kamera tidak ditemukan. Pastikan kamera HP berfungsi dan tidak sedang digunakan aplikasi lain.');
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError' || /could not start video source|device in use/i.test(errorMessage)) {
        setErrorMsg('Kamera sedang digunakan aplikasi lain atau tidak dapat dibuka. Tutup aplikasi kamera lain lalu coba lagi.');
      } else {
        setErrorMsg(`Kamera gagal dibuka${errorMessage ? `: ${errorMessage}` : '. Periksa izin kamera browser dan coba lagi.'}`);
      }
      const scanner = scannerRef.current;
      scannerRef.current = null;
      try {
        scanner?.clear();
      } catch (clearError) {
        console.warn('QR scanner could not be cleared after startup failure:', clearError);
      }
      setScannerActive(false);
    } finally {
      setCameraStarting(false);
    }
  };

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch (err) {
        console.warn('QR scanner could not be stopped cleanly:', err);
      }
    }
    setScannerActive(false);
  };

  const handleLookup = async (codeToLookup: string, resumeScanning = false) => {
    const code = codeToLookup.trim();
    if (!code) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.resolveQR(code);
      if (res.success) {
        if (mode === 'asset-selection') {
          if (res.type !== 'asset') {
            setScanResult({ type: res.type, data: res.data });
            setErrorMsg('QR ini bukan label aset fisik. Pindai QR aset yang sudah disiapkan.');
            return;
          }
          const asset = res.data as AssetUnit;
          const outcome = onSelectAssetRef.current?.(asset) ?? 'unavailable';
          if (outcome === 'duplicate') {
            setScanResult(null);
            setErrorMsg(`${asset.asset_code} (${asset.item_name}) sudah ada di daftar transaksi.`);
            if (resumeScanning) await startScanner();
            return;
          }
          if (outcome === 'unavailable' || asset.status !== 'tersedia') {
            setScanResult(null);
            setErrorMsg(`${asset.asset_code} tidak tersedia untuk dipinjam.`);
            if (resumeScanning) await startScanner();
            return;
          }
          setSelectedCount((count) => count + 1);
          setLastScannedAsset(asset);
          setScanResult(null);
          setManualCode('');
          if (resumeScanning) await startScanner();
          return;
        }
        setScanResult({ type: res.type, data: res.data });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Kode QR tidak dikenali pada basis data Nventori.');
    } finally {
      setLoading(false);
    }
    if (resumeScanning && mode === 'asset-selection') await startScanner();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96dvh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-forest-800 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Pemindai QR Nventori</h3>
              <p className="text-[11px] text-slate-500">
                {mode === 'asset-selection' ? 'Pindai label aset yang sudah disiapkan' : 'Scan QR Aset Fisik atau Bukti Transaksi'}
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Camera Frame */}
          <div className="flex flex-col items-center">
            <style>{`
              #qr-reader { border: none !important; padding: 0 !important; }
              #qr-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover;
                display: block;
              }
              #qr-reader canvas, #qr-reader #qr-shaded-region { display: none !important; }
            `}</style>
            <div
              className="relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[60vh] rounded-2xl bg-slate-900 overflow-hidden"
            >
              {/* html5-qrcode owns this element's children; keep React content outside it. */}
              <div id="qr-reader" className="h-full w-full" />
              {!scannerActive && !cameraStarting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 space-y-2 bg-slate-900">
                  <Camera className="w-10 h-10 text-slate-300" />
                  <p className="text-xs text-slate-200">Kamera siap diaktifkan</p>
                  <button
                    onClick={startScanner}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition cursor-pointer"
                  >
                    Buka Kamera
                  </button>
                </div>
              )}
              {cameraStarting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-slate-900">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <p className="text-xs text-white">Meminta izin dan menghubungkan kamera...</p>
                </div>
              )}
            </div>

            {scannerActive && (
              <button
                onClick={stopScanner}
                className="mt-2 text-xs text-rose-600 hover:underline font-medium cursor-pointer"
              >
                Hentikan Kamera
              </button>
            )}
          </div>

          {/* Manual Input Fallback */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Atau Masukkan Kode Secara Manual:
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Contoh: TRX-202611-001 atau NV-CAM-001"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !manualCode.trim()}
                className="px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer"
              >
                {loading ? 'Mencari...' : 'Cari'}
              </button>
            </form>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Result Card */}
          {scanResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-900 uppercase">
                  Data Ditemukan: {scanResult.type === 'transaction' ? 'Transaksi Peminjaman' : scanResult.type === 'asset' ? 'Aset Fisik' : 'Paket Kelengkapan'}
                </span>
              </div>

              {scanResult.type === 'transaction' && (
                <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-lg border border-emerald-100">
                  <div className="font-bold text-slate-900">{scanResult.data.transaction_code}</div>
                  <div>Peminjam: <span className="font-semibold">{scanResult.data.borrower_name}</span> ({scanResult.data.borrower_unit})</div>
                  <div>Kegiatan: {scanResult.data.event_name}</div>
                  <div>Status: <span className="font-bold capitalize">{scanResult.data.status}</span></div>
                  <div>Jumlah Barang: {scanResult.data.lines?.length || 0} jenis</div>
                </div>
              )}

              {scanResult.type === 'asset' && (
                <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-lg border border-emerald-100">
                  <div className="font-bold text-slate-900 font-mono">{scanResult.data.asset_code}</div>
                  <div>Nama Alat: <span className="font-semibold">{scanResult.data.item_name}</span></div>
                  <div>Kondisi: <span className="font-bold capitalize">{scanResult.data.condition}</span> • Status: <span className="capitalize">{scanResult.data.status}</span></div>
                  <div>Lokasi: {scanResult.data.location_name}</div>
                </div>
              )}

              {mode === 'asset-selection' ? (
                <p className="text-xs text-rose-700">QR ini bukan aset yang tersedia. Scan berikutnya tidak ditambahkan.</p>
              ) : (
                <button
                  onClick={() => {
                    onSelectResult(scanResult as any);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow transition cursor-pointer"
                >
                  <span>Buka Detail / Checklist Pengembalian</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          {mode === 'asset-selection' && (
            <p className="text-xs text-slate-600">
              {selectedCount
                ? `${selectedCount} aset hasil scan ditambahkan. ${lastScannedAsset ? `Terakhir: ${lastScannedAsset.asset_code} · ${lastScannedAsset.item_name}.` : ''} Scan aset berikutnya akan ditambahkan otomatis.`
                : 'Arahkan kamera ke label QR aset yang sudah disiapkan. Setiap scan menambahkan satu unit ke daftar transaksi.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
