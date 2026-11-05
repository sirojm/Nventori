import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Search, ArrowRight, AlertCircle, CheckCircle2, Package, ArrowLeftRight } from 'lucide-react';
import { api } from '../../services/api';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (result: { type: 'transaction' | 'asset' | 'kit'; data: any }) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ type: string; data: any } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScanResult(null);
      setErrorMsg(null);
      setManualCode('');
    }
  }, [isOpen]);

  const startScanner = async () => {
    setErrorMsg(null);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        async (decodedText) => {
          stopScanner();
          handleLookup(decodedText);
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err: any) {
      console.warn('Camera scan not started:', err);
      setErrorMsg('Kamera tidak dapat diakses atau peramban tidak mendukung secure context. Silakan gunakan input manual kode di bawah.');
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        }
      } catch (e) {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  const handleLookup = async (codeToLookup: string) => {
    const code = codeToLookup.trim();
    if (!code) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.resolveQR(code);
      if (res.success) {
        setScanResult({ type: res.type, data: res.data });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Kode QR tidak dikenali pada basis data Nventori.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-forest-800 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Pemindai QR Nventori</h3>
              <p className="text-[11px] text-slate-500">Scan QR Aset Fisik atau Bukti Transaksi</p>
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
            <div
              id="qr-reader"
              className="w-full max-w-[280px] h-[220px] rounded-xl bg-slate-900 overflow-hidden relative flex items-center justify-center text-slate-400 border-2 border-slate-200"
            >
              {!scannerActive && (
                <div className="flex flex-col items-center text-center p-4 space-y-2">
                  <Camera className="w-10 h-10 text-slate-500" />
                  <p className="text-xs text-slate-400">Kamera siap diaktifkan</p>
                  <button
                    onClick={startScanner}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition cursor-pointer"
                  >
                    Buka Kamera
                  </button>
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
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-800">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
