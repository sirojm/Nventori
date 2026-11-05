import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer } from 'lucide-react';
import { Transaction } from '../../types';
import { api } from '../../services/api';
import { RECEIPT_BRANDING } from '../../config/receiptBranding';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [logoAvailable, setLogoAvailable] = useState(true);
  const [proof, setProof] = useState<{
    verification_path: string;
    transaction_code: string;
    document_type: 'handover' | 'return';
    issued_by: string;
    issued_at: string;
  } | null>(null);
  const [proofError, setProofError] = useState('');
  const [proofLoading, setProofLoading] = useState(false);

  useEffect(() => {
    let active = true;
    contentRef.current?.scrollTo(0, 0);
    setQrUrl('');
    setProof(null);
    setProofError('');

    if (transaction && isOpen) {
      setProofLoading(true);
      api.getReceiptProof(transaction.id, receiptType)
        .then(async (response) => {
          const verificationUrl = new URL(response.proof.verification_path, window.location.origin).toString();
          const url = await QRCode.toDataURL(verificationUrl, {
            width: 256,
            margin: 4,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          if (active) {
            setProof(response.proof);
            setQrUrl(url);
          }
        })
        .catch((error: Error) => {
          if (active) setProofError(error.message || 'QR verifikasi tidak dapat dibuat.');
        })
        .finally(() => {
          if (active) setProofLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [transaction?.id, isOpen, receiptType]);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    if (!proof) return;
    const cleanup = () => document.body.classList.remove('receipt-printing');
    document.body.classList.add('receipt-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  const isReturn = receiptType === 'return';
  const title = isReturn ? 'BUKTI PENGEMBALIAN INVENTARIS' : 'BUKTI SERAH TERIMA INVENTARIS';
  const receiptReturn = isReturn ? transaction.returns?.[transaction.returns.length - 1] : null;
  const returnedForLine = (lineId: number) => receiptReturn?.lines
    ?.filter((returnLine: any) => returnLine.transaction_line_id === lineId)
    .reduce((total: number, returnLine: any) => total + returnLine.quantity_returned, 0) || 0;
  const returnedForManifest = (manifestId: number) => receiptReturn?.lines
    ?.filter((returnLine: any) => returnLine.kit_manifest_item_id === manifestId)
    .reduce((total: number, returnLine: any) => total + returnLine.quantity_returned, 0) || 0;

  return (
    <div className="receipt-print-root fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <style>{'@media print { @page { size: A4; margin: 12mm; } }'}</style>
      <div className="receipt-print-dialog relative w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Modal Controls (No print) */}
        <div className="no-print sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Dokumen Cetak Transaksi</h3>
            <p className="text-[11px] text-slate-500">Standar Format A4 Resmi Kantor</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!proof || proofLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{proofLoading ? 'Menyiapkan QR...' : 'Cetak Dokumen'}</span>
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
        <div ref={contentRef} className="receipt-print-content min-h-0 overflow-y-auto p-4 sm:p-8 bg-white text-slate-900 font-sans print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-4">
              {logoAvailable && (
                <img
                  src={RECEIPT_BRANDING.logoSrc}
                  alt={RECEIPT_BRANDING.logoAlt}
                  className="w-28 h-28 shrink-0 object-contain print:w-28 print:h-28"
                  onLoad={() => setLogoAvailable(true)}
                  onError={() => setLogoAvailable(false)}
                />
              )}
              
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">{RECEIPT_BRANDING.organizationName}</h1>
                <p className="text-xs text-slate-600">{RECEIPT_BRANDING.departmentName}</p>
                <p className="text-[11px] text-slate-500 mt-1">{RECEIPT_BRANDING.systemNote}</p>
              </div>
               
            </div>
            {qrUrl && proof && (
              <div className="flex shrink-0 flex-col items-center">
                <img src={qrUrl} alt="QR Validasi" className="h-24 w-24 border border-slate-300 p-0.5" />
                <span className="mt-0.5 text-[9px] font-mono text-slate-500">Pindai untuk verifikasi</span>
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
              {transaction.transaction_type === 'inter_unit_loan' ? (
                <>
                  <p className="text-slate-500">Nama Peminjam / PIC:</p>
                  <p className="font-bold text-slate-900">{transaction.borrower_name}</p>

                  <p className="text-slate-500 mt-2">Unit Kerja / Instansi:</p>
                  <p className="font-semibold text-slate-800">{transaction.borrower_unit}</p>

                  <p className="text-slate-500 mt-2">Kontak / Email:</p>
                  <p className="font-mono text-slate-700">{transaction.borrower_phone} • {transaction.borrower_email}</p>
                </>
              ) : (
                <>
                  <p className="text-slate-500">Jenis Pemakaian:</p>
                  <p className="font-bold text-slate-900">Pemakaian internal</p>
                  <p className="text-slate-500 mt-2">Identitas PIC tidak diperlukan.</p>
                </>
              )}
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
                  <th className="p-2 text-center w-24">{isReturn ? 'Jml Kembali*' : 'Jml Kembali'}</th>
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
                      {isReturn ? `${returnedForLine(line.id)} ${line.unit_of_measure}` : '-'}
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
                      Diserahkan: {m.quantity_handed_over}
                      {isReturn && ` | Kembali*: ${returnedForManifest(m.id)}`}
                      {' '}({m.condition_in || m.condition_out})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 text-xs mt-10 pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-slate-600">
                {transaction.transaction_type === 'internal_usage' ? 'Penanggung Jawab Internal,' : 'Peminjam / Penanggung Jawab,'}
              </p>
              <div className="h-16"></div>
              {transaction.transaction_type === 'internal_usage' ? (
                <p className="font-bold underline text-slate-900">Pemakaian Internal</p>
              ) : (
                <>
                  <p className="font-bold underline text-slate-900">{transaction.borrower_name}</p>
                  <p className="text-[10px] text-slate-500">{transaction.borrower_unit}</p>
                </>
              )}
            </div>

            <div className="text-center">
              <p className="text-slate-600">Petugas Operator Inventaris,</p>
              <div className="h-16"></div>
              <p className="font-bold underline text-slate-900">{proof?.issued_by || '-'}</p>
              <p className="text-[10px] text-slate-500">Unit Pengelola Inventaris</p>
              {proof && (
                <p className="text-[9px] text-slate-500 mt-1">
                  Dicatat {new Date(proof.issued_at.replace(' ', 'T')).toLocaleString('id-ID')}
                </p>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="text-[10px] text-slate-400 mt-8 text-center italic border-t pt-2">
            {isReturn && '*Jumlah kembali merujuk pada pengembalian yang dicatat dalam dokumen ini. '}
            QR memverifikasi catatan penerbitan dan petugas di server Nventori. Ini validasi sistem internal, bukan TTE tersertifikasi.
          </div>
        </div>
        {proofError && (
          <div className="no-print mx-8 mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
            {proofError}
          </div>
        )}
      </div>
    </div>
  );
};
