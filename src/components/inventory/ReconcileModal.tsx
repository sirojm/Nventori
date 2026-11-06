import React, { useEffect, useState } from 'react';
import { X, RefreshCw, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
}

const statusLabel: Record<string, string> = { tersedia: 'Tersedia', dipesan: 'Dipesan', dipakai: 'Dipakai' };

export const ReconcileModal: React.FC<ReconcileModalProps> = ({ isOpen, onClose, onApplied }) => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<{ assetChanges: any[]; poolChanges: any[]; clean: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlan(null);
    setLoading(true);
    api
      .getReconcilePlan()
      .then((res) => res.success && setPlan(res))
      .catch((err) => error(err.message || 'Gagal memeriksa data inventaris.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const apply = async () => {
    setApplying(true);
    try {
      const res = await api.applyReconcile();
      if (res.success) {
        success(res.message);
        onApplied();
        onClose();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyinkronkan data.');
    } finally {
      setApplying(false);
    }
  };

  const total = plan ? plan.assetChanges.length + plan.poolChanges.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Sinkronkan Inventaris dengan Transaksi</h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Status aset dan angka stok dibandingkan dengan transaksi yang benar-benar masih aktif. Perubahan hanya
              diterapkan setelah Anda menyetujuinya.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Memeriksa data...
          </div>
        )}

        {plan && plan.clean && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Semua status aset dan angka stok sudah sesuai dengan transaksi.
          </div>
        )}

        {plan && !plan.clean && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-700">
              Ditemukan <strong>{total}</strong> data yang tidak sesuai dengan transaksi aktif.
            </p>

            {plan.poolChanges.length > 0 && (
              <div>
                <div className="font-bold text-slate-800 mb-1.5">Stok kuantitas ({plan.poolChanges.length})</div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {plan.poolChanges.map((change) => (
                    <div key={change.id} className="p-3 space-y-1">
                      <div className="font-semibold text-slate-900">{change.label}</div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600">
                        {(
                          [
                            ['Tersedia', 'available'],
                            ['Dipesan', 'reserved'],
                            ['Dipinjam', 'checked_out'],
                          ] as const
                        ).map(([label, key]) => (
                          <div key={key} className="flex items-center gap-1">
                            <span className="text-slate-400 font-sans">{label}:</span>
                            <span className={change.before[key] !== change.after[key] ? 'line-through text-rose-500' : ''}>
                              {change.before[key]}
                            </span>
                            {change.before[key] !== change.after[key] && (
                              <>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="font-bold text-emerald-700">{change.after[key]}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {change.note ? `Transaksi aktif: ${change.note}` : 'Tidak ada transaksi aktif untuk barang ini.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.assetChanges.length > 0 && (
              <div>
                <div className="font-bold text-slate-800 mb-1.5">Status unit aset ({plan.assetChanges.length})</div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {plan.assetChanges.map((change) => (
                    <div key={change.id} className="p-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900 truncate">{change.label}</span>
                      <span className="flex items-center gap-1.5 text-[11px] flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">{statusLabel[change.from] || change.from}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">{statusLabel[change.to] || change.to}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 text-xs">
          <button onClick={onClose} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer">
            Tutup
          </button>
          {plan && !plan.clean && (
            <button
              onClick={apply}
              disabled={applying}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-60 text-white font-semibold cursor-pointer"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Terapkan Perbaikan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
