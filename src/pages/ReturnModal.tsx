import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, AlertCircle, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { Transaction } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSuccess: () => void;
}

interface ReturnItemState {
  type: 'line' | 'manifest';
  id: number;
  name: string;
  ident: string;
  max_qty: number;
  qty_to_return: number;
  condition: 'baik' | 'rusak';
  notes: string;
  selected: boolean;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [items, setItems] = useState<ReturnItemState[]>([]);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transaction && isOpen) {
      const returnableItems: ReturnItemState[] = [];

      // Add regular lines (excluding kits which have manifest items)
      if (transaction.lines) {
        for (const line of transaction.lines) {
          if (!line.asset_kit_id && line.tracking_mode !== 'consumable') {
            const remaining = line.quantity_handed_over - line.quantity_returned;
            if (remaining > 0) {
              returnableItems.push({
                type: 'line',
                id: line.id,
                name: line.item_name,
                ident: line.asset_code || '(Stok Kuantitas)',
                max_qty: remaining,
                qty_to_return: remaining,
                condition: 'baik',
                notes: '',
                selected: false, // Rule: starts UNCHECKED
              });
            }
          }
        }
      }

      // Add kit manifest components
      if (transaction.manifest_items) {
        for (const m of transaction.manifest_items) {
          const remaining = m.quantity_handed_over - m.quantity_returned;
          if (remaining > 0) {
            returnableItems.push({
              type: 'manifest',
              id: m.id,
              name: `Komponen: ${m.component_name}`,
              ident: m.asset_code || '(Komponen Paket)',
              max_qty: remaining,
              qty_to_return: remaining,
              condition: 'baik',
              notes: '',
              selected: false, // Rule: starts UNCHECKED
            });
          }
        }
      }

      setItems(returnableItems);
      setOperatorNotes('');
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const toggleSelect = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItem = (index: number, updates: Partial<ReturnItemState>) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const selectAll = () => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  };

  const selectedItems = items.filter((i) => i.selected);
  const remainingCountAfterThis = items.reduce((acc, curr) => {
    if (!curr.selected) return acc + curr.max_qty;
    return acc + (curr.max_qty - curr.qty_to_return);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItems.length) {
      error('Harap centang minimal 1 barang yang fisik aslinya telah diterima kembali.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        notes: operatorNotes.trim() || 'Penerimaan pengembalian barang',
        returned_items: selectedItems.map((item) => ({
          type: item.type,
          id: item.id,
          quantity_returned: item.qty_to_return,
          condition: item.condition,
          notes: item.notes,
        })),
      };

      const res = await api.returnTransaction(transaction.id, payload);
      if (res.success) {
        success(res.message);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan pengembalian.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-6 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Checklist Pengembalian Barang</h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {transaction.transaction_code} • {transaction.borrower_name}
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

        {/* Notice */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between text-xs text-amber-900">
          <span>
            Periksa fisik barang secara langsung. Centang hanya barang yang benar-benar telah diterima.
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="font-bold underline text-amber-800 hover:text-amber-950 cursor-pointer"
          >
            Pilih Semua
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={`${item.type}-${item.id}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  item.selected
                    ? 'border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelect(idx)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-700 transition cursor-pointer focus:outline-none"
                  >
                    {item.selected ? (
                      <CheckSquare className="w-5 h-5 text-emerald-700" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">{item.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        Sisa: {item.max_qty}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{item.ident}</div>

                    {item.selected && (
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Quantity */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Jumlah Diterima:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={item.max_qty}
                            value={item.qty_to_return}
                            onChange={(e) =>
                              updateItem(idx, {
                                qty_to_return: Math.min(item.max_qty, Math.max(1, Number(e.target.value))),
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                          />
                        </div>

                        {/* Condition */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Kondisi Fisik:
                          </label>
                          <select
                            value={item.condition}
                            onChange={(e) => updateItem(idx, { condition: e.target.value as any })}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="baik">Kondisi Baik</option>
                            <option value="rusak">Rusak (Perlu Servis)</option>
                          </select>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Catatan Pemeriksaan:
                          </label>
                          <input
                            type="text"
                            placeholder="Opsional..."
                            value={item.notes}
                            onChange={(e) => updateItem(idx, { notes: e.target.value })}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* General Notes */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Pengembalian Operator:
            </label>
            <textarea
              rows={2}
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Catatan tambahan hasil serah terima kembali barang..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between font-medium text-slate-700">
              <span>Item Dipilih untuk Diterima:</span>
              <span className="font-bold text-slate-900">{selectedItems.length} item</span>
            </div>
            <div className="flex justify-between font-medium text-slate-700">
              <span>Sisa Tanggungan Masih di Luar:</span>
              <span className={`font-bold ${remainingCountAfterThis > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {remainingCountAfterThis > 0 ? `${remainingCountAfterThis} unit (Pengembalian Parsial)` : '0 unit (Selesai Penuh)'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || selectedItems.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Menyimpan...' : 'Konfirmasi Pengembalian'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
