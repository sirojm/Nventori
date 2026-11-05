import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer } from 'lucide-react';
import { Transaction } from '../../types';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  receiptType: 'handover' | 'return';
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  transaction,
  receiptType,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (transaction && isOpen) {
      QRCode.toDataURL(transaction.qr_token || transaction.transaction_code, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      }).then((url) => setQrUrl(url));
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const isReturn = receiptType === 'return';
  const title = isReturn ? 'BUKTI PENGEMBALIAN INVENTARIS' : 'BUKTI SERAH TERIMA INVENTARIS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-8">
        {/* Modal Controls (No print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Dokumen Cetak Transaksi</h3>
            <p className="text-[11px] text-slate-500">Standar Format A4 Resmi Kantor</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Content Area */}
        <div className="p-8 bg-white text-slate-900 font-sans print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">NVENTORI INDONESIA</h1>
              <p className="text-xs text-slate-600">Unit Manajemen Sarana, Prasarana & Peralatan Kantor</p>
              <p className="text-[11px] text-slate-500 mt-1">Zona Waktu: Asia/Jakarta • Sistem Inventaris Terpadu</p>
            </div>
            {qrUrl && (
              <div className="flex flex-col items-center">
                <img src={qrUrl} alt="QR Validasi" className="w-16 h-16 border border-slate-300 p-0.5" />
                <span className="text-[9px] font-mono text-slate-500 mt-0.5">{transaction.transaction_code}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h2 className="text-base font-bold tracking-wider underline uppercase text-slate-900">
              {title}
            </h2>
            <p className="text-xs font-mono text-slate-600 mt-0.5">Nomor: {transaction.transaction_code}</p>
          </div>

          {/* Metadata Section */}
          <div className="grid grid-cols-2 gap-4 text-xs my-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-slate-500">Nama Peminjam / PIC:</p>
              <p className="font-bold text-slate-900">{transaction.borrower_name}</p>

              <p className="text-slate-500 mt-2">Unit Kerja / Instansi:</p>
              <p className="font-semibold text-slate-800">{transaction.borrower_unit}</p>

              <p className="text-slate-500 mt-2">Kontak / Email:</p>
              <p className="font-mono text-slate-700">{transaction.borrower_phone} • {transaction.borrower_email}</p>
            </div>

            <div>
              <p className="text-slate-500">Nama Kegiatan / Keperluan:</p>
              <p className="font-semibold text-slate-900">{transaction.event_name}</p>

              <p className="text-slate-500 mt-2">Lokasi Kegiatan:</p>
              <p className="text-slate-800">{transaction.location_name}</p>

              <p className="text-slate-500 mt-2">Jadwal Pinjam & Batas Kembali:</p>
              <p className="font-mono text-slate-700">
                {new Date(transaction.start_date).toLocaleDateString('id-ID')} s/d {new Date(transaction.expected_return_date).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>

          {/* Reference Letter if Inter-unit */}
          {transaction.transaction_type === 'inter_unit_loan' && transaction.letter_number && (
            <div className="text-xs p-3 mb-4 rounded-lg bg-blue-50/70 border border-blue-200">
              <span className="font-bold text-blue-900">Referensi Surat Permohonan Antarunit: </span>
              <span className="font-mono text-blue-800">{transaction.letter_number}</span> (Tanggal: {transaction.letter_date || '-'}, Pengirim: {transaction.sender_unit || '-'})
            </div>
          )}

          {/* Items Table */}
          <div className="my-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Daftar Peralatan / Barang:</h3>
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 w-8 text-center">No</th>
                  <th className="p-2 border-r border-slate-300">Nama Barang / Peralatan</th>
                  <th className="p-2 border-r border-slate-300">Identitas / Kode Aset</th>
                  <th className="p-2 border-r border-slate-300 text-center w-20">Jml Serah</th>
                  <th className="p-2 text-center w-24">Jml Kembali</th>
                </tr>
              </thead>
              <tbody>
                {transaction.lines?.map((line, idx) => (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-200 font-medium">
                      {line.item_name} {line.brand_model && `(${line.brand_model})`}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-mono text-[11px]">
                      {line.asset_code || line.kit_code || '(Stok Kuantitas)'}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center font-bold">
                      {line.quantity_handed_over || line.quantity_requested} {line.unit_of_measure}
                    </td>
                    <td className="p-2 text-center font-bold">
                      {line.quantity_returned} {line.unit_of_measure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kit Manifest components if present */}
          {transaction.manifest_items && transaction.manifest_items.length > 0 && (
            <div className="my-4">
              <h4 className="text-[11px] font-bold text-slate-700 mb-1">Rincian Komponen Paket Kelengkapan:</h4>
              <div className="border border-slate-200 rounded p-2 text-[11px] bg-slate-50 space-y-1">
                {transaction.manifest_items.map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span>• {m.component_name} {m.asset_code && `(${m.asset_code})`}</span>
                    <span className="font-mono">
                      Keluar: {m.quantity_handed_over} | Kembali: {m.quantity_returned} ({m.condition_in || m.condition_out})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 text-xs mt-10 pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-slate-600">Peminjam / Penanggung Jawab,</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{transaction.borrower_name}</p>
              <p className="text-[10px] text-slate-500">{transaction.borrower_unit}</p>
            </div>

            <div className="text-center">
              <p className="text-slate-600">Petugas Operator Inventaris,</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{transaction.operator_name || 'Petugas Nventori'}</p>
              <p className="text-[10px] text-slate-500">Unit Pengelola Inventaris</p>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-[10px] text-slate-400 mt-8 text-center italic border-t pt-2">
            Dokumen sah ini diterbitkan otomatis oleh Sistem Nventori. Verifikasi keaslian dapat dipindai melalui QR Code di atas.
          </div>
        </div>
      </div>
    </div>
  );
};
