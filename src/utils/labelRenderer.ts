import QRCode from 'qrcode';
import { AssetUnit } from '../types';

export type QrScale = 'auto' | 'small' | 'medium' | 'large';

export interface LabelOptions {
  widthMm: number;
  heightMm: number;
  qrScale: QrScale;
  showHeader: boolean;
  showLocation: boolean;
  showSerialNumber: boolean;
  showCondition: boolean;
  marginTop: number; // mm
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  offsetX: number; // mm, shifts the whole content (printer calibration)
  offsetY: number;
  textScale: number; // 0.7 - 1.4
}

export const getQrSizeMm = (w: number, h: number, scale: QrScale): number => {
  if (w <= 35 && h <= 22) {
    return { small: 9.5, medium: 11, large: 12.5, auto: 11 }[scale];
  }
  if (w <= 45 && h <= 32) {
    return { small: 13, medium: 15.5, large: 18, auto: 15 }[scale];
  }
  const avail = h - 6;
  if (scale === 'small') return Math.min(avail, w * 0.3);
  if (scale === 'medium') return Math.min(avail, w * 0.38);
  if (scale === 'large') return Math.min(avail, w * 0.45);
  return Math.min(avail, Math.max(16, w * 0.36));
};

const getTypography = (w: number, h: number) => {
  if (w <= 35 || h <= 22) return { header: 5, code: 6.5, name: 5.2, sub: 4.5, gap: 1.2 };
  if (w <= 45 && h <= 35) return { header: 6, code: 8, name: 6.5, sub: 5.2, gap: 1.8 };
  return { header: 7, code: 9.5, name: 7.5, sub: 6, gap: 2.5 };
};

export const defaultMargin = (w: number, h: number) => (w <= 35 || h <= 22 ? 1.5 : w <= 45 ? 2 : 2.5);

/** Draw text shrinking the font until it fits maxW; ellipsis as last resort. */
const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  sizePx: number,
  weight: string,
  family: string
) => {
  let size = sizePx;
  const minSize = sizePx * 0.7;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > minSize) {
    size -= 0.5;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  let out = text;
  while (ctx.measureText(out).width > maxW && out.length > 1) {
    out = out.slice(0, -1);
  }
  if (out !== text) out = out.slice(0, -1) + '…';
  ctx.fillText(out, x, y);
};

/**
 * Renders one label to a canvas at the given DPI.
 * Pure black on white so it can be thresholded to 1-bit for thermal printers.
 */
export const renderLabelCanvas = async (
  asset: AssetUnit,
  opt: LabelOptions,
  dpi: number
): Promise<HTMLCanvasElement> => {
  const mm = dpi / 25.4;
  const W = Math.round(opt.widthMm * mm);
  const H = Math.round(opt.heightMm * mm);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  ctx.translate(Math.round(opt.offsetX * mm), Math.round(opt.offsetY * mm));

  const t = getTypography(opt.widthMm, opt.heightMm);
  const pt = (dpi / 72) * (opt.textScale || 1);
  const gap = t.gap * mm;
  const mL = opt.marginLeft * mm;
  const mR = opt.marginRight * mm;
  const mT = opt.marginTop * mm;
  const mB = opt.marginBottom * mm;
  const left = mL;
  const right = W - mR;
  const contentW = right - left;
  const SANS = 'Arial, Helvetica, sans-serif';
  const MONO = '"Courier New", Consolas, monospace';

  const showTopHeader = opt.showHeader && opt.heightMm >= 24;
  const showFooter = opt.heightMm >= 28;
  let top = mT;
  let bottom = H - mB;

  if (showTopHeader) {
    const hs = t.header * pt;
    ctx.font = `800 ${hs}px ${SANS}`;
    ctx.fillText('NVENTORI ASSET', left, top);
    const cat = (asset.category_name || 'INVENTARIS').toUpperCase();
    ctx.font = `600 ${t.sub * pt}px ${SANS}`;
    const cw = Math.min(ctx.measureText(cat).width, contentW * 0.4);
    fitText(ctx, cat, right - cw, top, cw, t.sub * pt, '600', SANS);
    top += hs * 1.25;
    ctx.fillRect(left, top, contentW, Math.max(1, dpi / 200));
    top += 0.8 * mm;
  }

  if (showFooter) {
    const fs = t.sub * pt;
    bottom -= fs * 1.2;
    ctx.fillRect(left, bottom - 0.6 * mm, contentW, Math.max(1, dpi / 200));
    ctx.font = `500 ${fs}px ${MONO}`;
    const loc = asset.location_name || 'Gudang Pusat';
    const condW = opt.showCondition ? contentW * 0.3 : 0;
    fitText(ctx, loc, left, bottom, contentW - condW - gap, fs, '500', MONO);
    if (opt.showCondition) {
      const c = String(asset.condition || '').toUpperCase();
      ctx.font = `700 ${fs}px ${MONO}`;
      ctx.fillText(c, right - ctx.measureText(c).width, bottom);
    }
    bottom -= 0.6 * mm;
  }

  // QR
  const qrMm = Math.min(
    getQrSizeMm(opt.widthMm, opt.heightMm, opt.qrScale),
    ((bottom - top) / mm)
  );
  const qrPx = Math.floor(qrMm * mm);
  const qrY = top + (bottom - top - qrPx) / 2;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, asset.asset_code, {
    margin: 0,
    errorCorrectionLevel: 'M',
    width: qrPx,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrCanvas, left, Math.round(qrY), qrPx, qrPx);

  // Text column
  const tx = left + qrPx + gap;
  const tw = right - tx;
  const lines: { text: string; size: number; weight: string; family: string }[] = [];
  if (opt.showHeader && !showTopHeader) {
    lines.push({ text: 'NVENTORI', size: t.header * pt, weight: '800', family: SANS });
  }
  lines.push({ text: asset.asset_code, size: t.code * pt, weight: '900', family: MONO });
  lines.push({ text: asset.item_name || '', size: t.name * pt, weight: '700', family: SANS });
  if (opt.showSerialNumber && asset.serial_number) {
    lines.push({ text: `SN: ${asset.serial_number}`, size: t.sub * pt, weight: '500', family: MONO });
  }
  if (opt.showLocation && !showFooter) {
    lines.push({ text: asset.location_name || 'Gudang Pusat', size: t.sub * pt, weight: '500', family: SANS });
  }
  const lineGap = 0.35 * mm;
  const totalH = lines.reduce((s, l) => s + l.size * 1.1, 0) + lineGap * (lines.length - 1);
  let y = top + (bottom - top - totalH) / 2;
  for (const l of lines) {
    fitText(ctx, l.text, tx, y, tw, l.size, l.weight, l.family);
    y += l.size * 1.1 + lineGap;
  }

  return canvas;
};

/** Convert canvas to packed 1-bit bitmap. Bit = 1 for BLACK pixels, MSB first. */
export const canvasToMono = (
  canvas: HTMLCanvasElement,
  threshold = 160
): { data: Uint8Array; widthBytes: number; width: number; height: number } => {
  const { width, height } = canvas;
  const px = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (px[i + 3] > 127 && lum < threshold) {
        data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { data, widthBytes, width, height };
};
