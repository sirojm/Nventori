import { canvasToMono } from './labelRenderer';

export type PrinterLanguage = 'tspl' | 'zpl' | 'cpcl' | 'escpos';
export type TransportKind = 'bluetooth' | 'usb' | 'serial' | 'rawbt' | 'system';
export type MediaMode = 'gap' | 'continuous' | 'blackmark';

export interface PrinterSettings {
  transport: TransportKind;
  language: PrinterLanguage;
  dpi: 203 | 300;
  media: MediaMode;
  gapMm: number;
  density: number; // 0-15 (TSPL)
  threshold: number; // 1-bit threshold
}

export const DEFAULT_SETTINGS: PrinterSettings = {
  transport: 'bluetooth',
  language: 'tspl', // Clabel CT221B & most Chinese label printers speak TSPL
  dpi: 203,
  media: 'gap',
  gapMm: 2,
  density: 8,
  threshold: 160,
};

const SETTINGS_KEY = 'nventori.labelPrinter.v1';

export const loadSettings = (): PrinterSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveSettings = (s: PrinterSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------ */
/* Command generators                                                  */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();
const ascii = (s: string) => enc.encode(s);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

export interface LabelJob {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
  copies: number;
}

export const buildCommands = (job: LabelJob, s: PrinterSettings): Uint8Array => {
  const mono = canvasToMono(job.canvas, s.threshold);
  const { data, widthBytes, width, height } = mono;
  const copies = Math.max(1, job.copies);

  switch (s.language) {
    case 'tspl': {
      // TSPL BITMAP: bit 0 = black, so invert
      const inv = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) inv[i] = ~data[i] & 0xff;
      const media =
        s.media === 'continuous'
          ? 'GAP 0 mm,0 mm'
          : s.media === 'blackmark'
            ? `BLINE ${s.gapMm} mm,0 mm`
            : `GAP ${s.gapMm} mm,0 mm`;
      const head =
        `SIZE ${job.widthMm} mm,${job.heightMm} mm\r\n${media}\r\n` +
        `DIRECTION 0,0\r\nREFERENCE 0,0\r\nOFFSET 0 mm\r\nSET TEAR ON\r\n` +
        `DENSITY ${s.density}\r\nCLS\r\nBITMAP 0,0,${widthBytes},${height},0,`;
      return concat(ascii(head), inv, ascii(`\r\nPRINT 1,${copies}\r\n`));
    }
    case 'zpl': {
      let hex = '';
      for (let i = 0; i < data.length; i++) hex += data[i].toString(16).padStart(2, '0');
      const total = data.length;
      const mn = s.media === 'continuous' ? 'N' : s.media === 'blackmark' ? 'M' : 'Y';
      const z =
        `^XA^MN${mn}^PW${width}^LL${height}^LH0,0^PR4^MD${Math.round(s.density * 2)}\n` +
        `^FO0,0^GFA,${total},${total},${widthBytes},${hex}^FS\n^PQ${copies}^XZ\n`;
      return ascii(z);
    }
    case 'cpcl': {
      const head = `! 0 ${s.dpi} ${s.dpi} ${height} ${copies}\r\nPAGE-WIDTH ${width}\r\nCG ${widthBytes} ${height} 0 0 `;
      const tail = s.media === 'continuous' ? '\r\nFORM\r\nPRINT\r\n' : '\r\nFORM\r\nPRINT\r\n';
      return concat(ascii(head), data, ascii(tail));
    }
    case 'escpos': {
      const one = concat(
        new Uint8Array([0x1b, 0x40]), // init
        new Uint8Array([
          0x1d, 0x76, 0x30, 0x00,
          widthBytes & 0xff, (widthBytes >> 8) & 0xff,
          height & 0xff, (height >> 8) & 0xff,
        ]),
        data,
        new Uint8Array([0x0a, 0x0a])
      );
      const parts: Uint8Array[] = [];
      for (let i = 0; i < copies; i++) parts.push(one);
      return concat(...parts);
    }
  }
};

/* ------------------------------------------------------------------ */
/* Transports                                                          */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ff12-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000a002-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fe59-0000-1000-8000-00805f9b34fb',
  '0000fd00-0000-1000-8000-00805f9b34fb',
  '0000ffc0-0000-1000-8000-00805f9b34fb',
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000fe00-0000-1000-8000-00805f9b34fb',
];

export interface Connection {
  kind: TransportKind;
  name: string;
  write(data: Uint8Array, onProgress?: (p: number) => void): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export const capabilities = () => ({
  secure: typeof window !== 'undefined' && window.isSecureContext,
  bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  usb: typeof navigator !== 'undefined' && 'usb' in navigator,
  serial: typeof navigator !== 'undefined' && 'serial' in navigator,
});

export const connectBluetooth = async (): Promise<Connection> => {
  const nav = navigator as any;
  if (!nav.bluetooth) throw new Error('Browser ini tidak mendukung Web Bluetooth (gunakan Chrome/Edge).');
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_SERVICES,
  });
  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();
  let target: any = null;
  const seen: string[] = [];
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    for (const c of chars) {
      seen.push(`${svc.uuid.slice(4, 8)}/${c.uuid.slice(4, 8)}`);
      if (!target && (c.properties.write || c.properties.writeWithoutResponse)) target = c;
    }
  }
  if (!target) {
    throw new Error(
      'Printer terhubung tetapi tidak ada karakteristik tulis BLE. ' +
        'Printer kemungkinan memakai Bluetooth Classic — gunakan mode "Serial (COM)" di PC atau "RawBT" di Android. ' +
        (seen.length ? `Ditemukan: ${seen.join(', ')}` : '')
    );
  }
  const noResp = !!target.properties.writeWithoutResponse;
  const conn: Connection = {
    kind: 'bluetooth',
    name: device.name || 'Printer Bluetooth',
    isConnected: () => !!device.gatt?.connected,
    async write(data, onProgress) {
      if (!device.gatt.connected) await device.gatt.connect();
      const chunk = 100;
      for (let i = 0; i < data.length; i += chunk) {
        const part = data.slice(i, i + chunk);
        if (noResp && target.writeValueWithoutResponse) await target.writeValueWithoutResponse(part);
        else await target.writeValue(part);
        if (noResp) await sleep(12);
        onProgress?.(Math.min(1, (i + chunk) / data.length));
      }
    },
    async disconnect() {
      device.gatt?.disconnect();
    },
  };
  return conn;
};

export const connectUsb = async (): Promise<Connection> => {
  const nav = navigator as any;
  if (!nav.usb) throw new Error('Browser ini tidak mendukung WebUSB (gunakan Chrome/Edge).');
  const device = await nav.usb.requestDevice({ filters: [] });
  await device.open();
  if (!device.configuration) await device.selectConfiguration(1);

  let ifaceNum = -1;
  let epNum = -1;
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
      if (out && (alt.interfaceClass === 7 || ifaceNum < 0)) {
        ifaceNum = iface.interfaceNumber;
        epNum = out.endpointNumber;
        if (alt.interfaceClass === 7) break;
      }
    }
  }
  if (ifaceNum < 0) throw new Error('Endpoint tulis USB tidak ditemukan pada perangkat ini.');
  try {
    await device.claimInterface(ifaceNum);
  } catch {
    throw new Error(
      'Gagal mengklaim printer USB. Di Windows driver bawaan printer menguasai perangkat — ' +
        'gunakan mode "Driver Sistem" atau ganti driver ke WinUSB (Zadig).'
    );
  }
  return {
    kind: 'usb',
    name: device.productName || 'Printer USB',
    isConnected: () => device.opened,
    async write(data, onProgress) {
      const chunk = 4096;
      for (let i = 0; i < data.length; i += chunk) {
        await device.transferOut(epNum, data.slice(i, i + chunk));
        onProgress?.(Math.min(1, (i + chunk) / data.length));
      }
    },
    async disconnect() {
      try {
        await device.close();
      } catch {
        /* ignore */
      }
    },
  };
};

export const connectSerial = async (): Promise<Connection> => {
  const nav = navigator as any;
  if (!nav.serial) throw new Error('Browser ini tidak mendukung Web Serial (gunakan Chrome/Edge di PC).');
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 115200, bufferSize: 4096 });
  return {
    kind: 'serial',
    name: 'Printer Serial / Bluetooth COM',
    isConnected: () => !!port.writable,
    async write(data, onProgress) {
      const writer = port.writable.getWriter();
      try {
        const chunk = 512;
        for (let i = 0; i < data.length; i += chunk) {
          await writer.write(data.slice(i, i + chunk));
          onProgress?.(Math.min(1, (i + chunk) / data.length));
        }
      } finally {
        writer.releaseLock();
      }
    },
    async disconnect() {
      try {
        await port.close();
      } catch {
        /* ignore */
      }
    },
  };
};

export const connect = (kind: TransportKind): Promise<Connection> => {
  if (kind === 'bluetooth') return connectBluetooth();
  if (kind === 'usb') return connectUsb();
  if (kind === 'serial') return connectSerial();
  return Promise.reject(new Error('Mode ini tidak memerlukan koneksi.'));
};

/** Android: hand raw bytes to the RawBT app (supports Bluetooth Classic/SPP printers). */
export const sendViaRawBT = (data: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
  const b64 = btoa(bin);
  window.location.href = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
};

/**
 * System/driver printing using an isolated iframe so the @page size is exactly the label size
 * (independent of the app's other print styles, which default to A4).
 */
export const printViaSystem = (
  canvases: HTMLCanvasElement[],
  widthMm: number,
  heightMm: number
): Promise<void> =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    const imgs = canvases
      .map(
        (c, i) =>
          `<div class="p" style="${i < canvases.length - 1 ? 'page-break-after:always;break-after:page' : ''}">` +
          `<img src="${c.toDataURL('image/png')}"/></div>`
      )
      .join('');
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Label</title><style>
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      html,body { margin:0; padding:0; background:#fff; }
      .p { width:${widthMm}mm; height:${heightMm}mm; overflow:hidden; }
      img { width:${widthMm}mm; height:${heightMm}mm; display:block; image-rendering:pixelated; }
    </style></head><body>${imgs}</body></html>`);
    doc.close();
    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 500);
    };
    const run = () => {
      const w = iframe.contentWindow!;
      w.addEventListener('afterprint', cleanup);
      w.focus();
      w.print();
      // Fallback for browsers that never fire afterprint on iframes
      setTimeout(cleanup, 60000);
    };
    const images = Array.from(doc.images);
    Promise.all(
      images.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => (im.onload = r))))
    ).then(() => setTimeout(run, 100));
  });
