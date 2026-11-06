export interface ReportSections {
  summary: boolean;
  activeLoans: boolean;
  assets: boolean;
  pools: boolean;
  transactions: boolean;
}

export interface ReportData {
  generated_at: string;
  generated_by: string;
  period: { from: string; to: string };
  summary: {
    assets: Record<string, number>;
    pools: Record<string, number>;
    transactions: Record<string, number>;
  };
  assets: any[];
  pools: any[];
  active_loans: any[];
  transactions: any[];
}

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TZ = 'Asia/Jakarta';
// SQLite stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC; other values are ISO strings.
const parseDate = (value: string): Date => {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return new Date(`${value.replace(' ', 'T')}Z`);
  return new Date(value);
};
const fmtDate = (value?: string | null) => {
  if (!value) return '-';
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
};
const fmtDateTime = (value?: string | null) => {
  if (!value) return '-';
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: TZ })} WIB`;
};

const STATUS_TX: Record<string, string> = {
  draft: 'Draft',
  dipesan: 'Dipesan',
  diserahkan: 'Diserahkan',
  kembali_sebagian: 'Kembali Sebagian',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
const STATUS_ASSET: Record<string, string> = {
  tersedia: 'Tersedia',
  dipesan: 'Dipesan',
  dipakai: 'Dipakai',
  perawatan: 'Perawatan',
};
const CONDITION: Record<string, string> = {
  baik: 'Baik',
  rusak_ringan: 'Rusak Ringan',
  rusak_berat: 'Rusak Berat',
  perawatan: 'Perawatan',
  rusak: 'Rusak',
};

const table = (headers: string[], rows: string[][], opts: { widths?: string[]; align?: string[] } = {}) => {
  const head = headers
    .map((h, i) => `<th style="${opts.widths?.[i] ? `width:${opts.widths[i]};` : ''}${opts.align?.[i] ? `text-align:${opts.align[i]};` : ''}">${esc(h)}</th>`)
    .join('');
  const body = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, i) => `<td style="${opts.align?.[i] ? `text-align:${opts.align[i]};` : ''}">${cell}</td>`)
              .join('')}</tr>`
        )
        .join('')
    : `<tr><td colspan="${headers.length}" class="empty">Tidak ada data.</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
};

const kv = (pairs: [string, string | number][]) =>
  `<div class="kpis">${pairs
    .map(([label, value]) => `<div class="kpi"><div class="kpi-v">${esc(value)}</div><div class="kpi-l">${esc(label)}</div></div>`)
    .join('')}</div>`;

export const buildReportHtml = (data: ReportData, sections: ReportSections): string => {
  const { summary } = data;
  let n = 0;
  const heading = (title: string) => `<h2>${++n}. ${esc(title)}</h2>`;
  const parts: string[] = [];

  if (sections.summary) {
    parts.push(
      `<section>${heading('Ringkasan')}
      <h3>Aset fisik unik</h3>
      ${kv([
        ['Total unit aktif', summary.assets.total || 0],
        ['Tersedia', summary.assets.tersedia || 0],
        ['Dipesan', summary.assets.dipesan || 0],
        ['Sedang dipakai', summary.assets.dipakai || 0],
        ['Perlu perawatan', summary.assets.perlu_perawatan || 0],
      ])}
      <h3>Stok kuantitas</h3>
      ${kv([
        ['Total stok', summary.pools.total || 0],
        ['Tersedia', summary.pools.tersedia || 0],
        ['Dipesan', summary.pools.dipesan || 0],
        ['Dipinjam', summary.pools.dipinjam || 0],
      ])}
      <h3>Transaksi pada periode laporan</h3>
      ${kv([
        ['Total transaksi', summary.transactions.total || 0],
        ['Dipesan', summary.transactions.dipesan || 0],
        ['Sedang berjalan', summary.transactions.aktif || 0],
        ['Selesai', summary.transactions.selesai || 0],
        ['Dibatalkan', summary.transactions.dibatalkan || 0],
      ])}
      </section>`
    );
  }

  if (sections.activeLoans) {
    parts.push(
      `<section>${heading('Peminjaman Aktif dan Reservasi')}
      <p class="note">Seluruh transaksi yang belum selesai pada tanggal cetak. Baris bertanda <strong>terlambat</strong> telah melewati tenggat pengembalian.</p>
      ${table(
        ['No', 'Kode', 'Peminjam / Unit', 'Kegiatan', 'Barang', 'Tenggat', 'Status'],
        data.active_loans.map((tx, i) => [
          String(i + 1),
          `<span class="mono">${esc(tx.transaction_code)}</span>`,
          `<strong>${esc(tx.borrower_name)}</strong><br><span class="muted">${esc(tx.borrower_unit)}</span>`,
          esc(tx.event_name),
          (tx.items as string[]).map((item) => esc(item)).join('<br>') || '-',
          fmtDate(tx.expected_return_date),
          `${esc(STATUS_TX[tx.status] || tx.status)}${tx.is_overdue && tx.status !== 'dipesan' ? '<br><span class="late">terlambat</span>' : ''}`,
        ]),
        { widths: ['5%', '13%', '19%', '17%', '26%', '10%', '10%'], align: ['center'] }
      )}
      </section>`
    );
  }

  if (sections.assets) {
    parts.push(
      `<section>${heading('Daftar Aset Fisik')}
      ${table(
        ['No', 'Kode Aset', 'Nama Barang', 'Kategori', 'Gudang', 'Kondisi', 'Status'],
        data.assets.map((asset, i) => [
          String(i + 1),
          `<span class="mono">${esc(asset.asset_code)}</span>${asset.serial_number ? `<br><span class="muted">SN ${esc(asset.serial_number)}</span>` : ''}`,
          esc(asset.item_name),
          esc(asset.category_name),
          esc(asset.location_name),
          esc(CONDITION[asset.condition] || asset.condition),
          esc(STATUS_ASSET[asset.status] || asset.status),
        ]),
        { widths: ['5%', '17%', '24%', '13%', '19%', '11%', '11%'], align: ['center'] }
      )}
      </section>`
    );
  }

  if (sections.pools) {
    parts.push(
      `<section>${heading('Stok Kuantitas dan Habis Pakai')}
      ${table(
        ['No', 'Nama Barang', 'Gudang', 'Total', 'Tersedia', 'Dipesan', 'Dipinjam'],
        data.pools.map((pool, i) => [
          String(i + 1),
          `<strong>${esc(pool.item_name)}</strong>${pool.condition === 'rusak' ? ' <span class="late">(rusak)</span>' : ''}<br><span class="muted mono">${esc(pool.item_code)}</span>`,
          esc(pool.location_name),
          `${pool.quantity_total} ${esc(pool.unit_of_measure)}`,
          String(pool.quantity_available),
          String(pool.quantity_reserved),
          String(pool.quantity_checked_out),
        ]),
        { widths: ['5%', '32%', '21%', '12%', '10%', '10%', '10%'], align: ['center', 'left', 'left', 'right', 'right', 'right', 'right'] }
      )}
      </section>`
    );
  }

  if (sections.transactions) {
    parts.push(
      `<section>${heading('Riwayat Transaksi pada Periode')}
      <p class="note">Transaksi yang dibuat pada ${fmtDate(data.period.from)} sampai ${fmtDate(data.period.to)}.</p>
      ${table(
        ['No', 'Tanggal', 'Kode', 'Peminjam / Unit', 'Kegiatan', 'Barang', 'Status'],
        data.transactions.map((tx, i) => [
          String(i + 1),
          fmtDate(tx.created_at),
          `<span class="mono">${esc(tx.transaction_code)}</span>`,
          `<strong>${esc(tx.borrower_name)}</strong><br><span class="muted">${esc(tx.borrower_unit)}</span>`,
          esc(tx.event_name),
          (tx.items as string[]).map((item) => esc(item)).join('<br>') || '-',
          esc(STATUS_TX[tx.status] || tx.status),
        ]),
        { widths: ['5%', '11%', '14%', '19%', '16%', '25%', '10%'], align: ['center'] }
      )}
      </section>`
    );
  }

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Laporan Inventaris Nventori ${esc(data.period.from)} - ${esc(data.period.to)}</title>
<style>
  @page { size: A4 portrait; margin: 16mm 14mm 18mm 14mm; @bottom-center { content: "Halaman " counter(page) " dari " counter(pages); font: 8pt Arial, sans-serif; color: #64748b; } }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font: 9.5pt/1.45 Arial, Helvetica, sans-serif; }
  .kop { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 3px double #1b4332; margin-bottom: 14px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; background: #1b4332; color: #fff; font-weight: 800; font-size: 22px; display: flex; align-items: center; justify-content: center; }
  .kop-t { font-size: 15pt; font-weight: 800; letter-spacing: .5px; color: #1b4332; }
  .kop-s { font-size: 8.5pt; color: #475569; }
  h1 { text-align: center; font-size: 13pt; margin: 6px 0 2px; text-transform: uppercase; letter-spacing: .6px; }
  .meta { text-align: center; font-size: 9pt; color: #475569; margin-bottom: 14px; }
  h2 { font-size: 11pt; margin: 18px 0 6px; color: #1b4332; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; break-after: avoid; }
  h3 { font-size: 9.5pt; margin: 10px 0 4px; color: #334155; break-after: avoid; }
  section { break-inside: auto; }
  .note { font-size: 8.5pt; color: #475569; margin: 2px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 4px; }
  thead { display: table-header-group; }
  th { background: #e8efe9; color: #14352a; text-align: left; font-weight: 700; padding: 5px 6px; border: 1px solid #b6c4bb; }
  td { padding: 4px 6px; border: 1px solid #cbd5e1; vertical-align: top; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .mono { font-family: "Courier New", monospace; font-size: 8pt; }
  .muted { color: #64748b; font-size: 7.5pt; }
  .late { color: #b91c1c; font-weight: 700; font-size: 8pt; }
  .empty { text-align: center; color: #64748b; padding: 10px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; }
  .kpi { flex: 1 1 90px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; text-align: center; background: #f8fafc; }
  .kpi-v { font-size: 15pt; font-weight: 800; color: #1b4332; }
  .kpi-l { font-size: 7.5pt; color: #475569; text-transform: uppercase; letter-spacing: .3px; }
  .sign { margin-top: 28px; display: flex; justify-content: flex-end; break-inside: avoid; }
  .sign div { width: 62mm; text-align: center; font-size: 9pt; }
  .sign .space { height: 22mm; }
  .sign .name { border-top: 1px solid #0f172a; padding-top: 3px; font-weight: 700; }
  .foot { margin-top: 14px; font-size: 7.5pt; color: #64748b; text-align: center; }
</style></head>
<body>
  <div class="kop">
    <div class="logo">N</div>
    <div>
      <div class="kop-t">NVENTORI</div>
      <div class="kop-s">Sistem Manajemen Inventaris Alat Kantor</div>
    </div>
  </div>
  <h1>Laporan Inventaris dan Peminjaman</h1>
  <div class="meta">Periode ${fmtDate(data.period.from)} &ndash; ${fmtDate(data.period.to)}<br>Dicetak pada ${fmtDateTime(data.generated_at)} oleh ${esc(data.generated_by)}</div>
  ${parts.join('\n')}
  <div class="sign">
    <div>
      Petugas Inventaris,
      <div class="space"></div>
      <div class="name">${esc(data.generated_by)}</div>
    </div>
  </div>
  <div class="foot">Dokumen ini dihasilkan otomatis oleh sistem Nventori berdasarkan data pada saat pencetakan.</div>
</body></html>`;
};

/** Prints an HTML document in an isolated hidden iframe (no app UI, real A4 pages). */
export const printHtmlDocument = (html: string): Promise<void> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 500);
    };
    setTimeout(() => {
      const w = iframe.contentWindow!;
      w.addEventListener('afterprint', cleanup);
      w.focus();
      w.print();
      setTimeout(cleanup, 60000);
    }, 150);
  });

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildTransactionsCsv = (data: ReportData): string => {
  const header = ['Kode', 'Tanggal Dibuat', 'Jenis', 'Peminjam', 'Unit', 'Kegiatan', 'Barang', 'Tenggat Kembali', 'Status', 'Petugas'];
  const rows = data.transactions.map((tx) => [
    tx.transaction_code,
    tx.created_at,
    tx.transaction_type === 'internal_usage' ? 'Pemakaian Internal' : 'Pinjaman Antarunit',
    tx.borrower_name,
    tx.borrower_unit,
    tx.event_name,
    (tx.items as string[]).join(' | '),
    tx.expected_return_date,
    STATUS_TX[tx.status] || tx.status,
    tx.operator_name,
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
};

export const buildAssetsCsv = (data: ReportData): string => {
  const header = ['Kode Aset', 'Nomor Seri', 'Nama Barang', 'Kategori', 'Gudang', 'Kondisi', 'Status'];
  const rows = data.assets.map((a) => [
    a.asset_code,
    a.serial_number || '',
    a.item_name,
    a.category_name,
    a.location_name,
    CONDITION[a.condition] || a.condition,
    STATUS_ASSET[a.status] || a.status,
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
};

export const downloadTextFile = (filename: string, content: string, mime = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
