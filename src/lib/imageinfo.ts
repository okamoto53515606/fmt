import type { ImageMeta } from '../types.ts';
import { sniffBinary } from './bytes.ts';

const be32 = (b: Uint8Array, o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
const be16 = (b: Uint8Array, o: number) => ((b[o]! << 8) | b[o + 1]!) & 0xffff;
const le16 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8)) & 0xffff;
const le32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** ヘッダから画像の幅・高さを読む（デコードできない環境でも動く） */
export function imageSize(bytes: Uint8Array): { width: number; height: number; mime: string } | null {
  const { kind, mime } = sniffBinary(bytes);
  try {
    if (kind === 'png' && bytes.length > 24) return { width: be32(bytes, 16), height: be32(bytes, 20), mime };
    if (kind === 'gif' && bytes.length > 10) return { width: le16(bytes, 6), height: le16(bytes, 8), mime };
    if (kind === 'bmp' && bytes.length > 26) return { width: le32(bytes, 18), height: Math.abs(le32(bytes, 22)), mime };
    if (kind === 'jpeg') {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1]!;
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = be16(bytes, i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: be16(bytes, i + 7), height: be16(bytes, i + 5), mime };
        }
        i += 2 + len;
      }
      return null;
    }
    if (kind === 'webp' && bytes.length > 30) {
      const chunk = String.fromCharCode(...Array.from(bytes.subarray(12, 16)));
      if (chunk === 'VP8X') return { width: (le16(bytes, 24) | (bytes[26]! << 16)) + 1, height: (le16(bytes, 27) | (bytes[29]! << 16)) + 1, mime };
      if (chunk === 'VP8 ') return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff, mime };
      if (chunk === 'VP8L') {
        const b = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, mime };
      }
    }
    return null;
  } catch {
    return null;
  }
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * EXIF の日時はタイムゾーンを持たない「撮影地の現地時間」。
 * exifr は OffsetTime があれば UTC に直した Date を返すため、そのまま toISOString すると
 * 09:00 撮影の写真が 00:00 と表示される。オフセットを足し戻して壁時計に戻す。
 */
function exifWallClock(v: Date, offset: unknown): string {
  const m = typeof offset === 'string' ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (m) {
    const minutes = Number(m[2]) * 60 + Number(m[3]);
    const t = new Date(v.getTime() + (m[1] === '-' ? -minutes : minutes) * 60_000);
    return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}`;
  }
  // オフセットが無い写真は、exifr が実行環境のローカル時刻として解釈した値をそのまま使う
  return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())} ${pad2(v.getHours())}:${pad2(v.getMinutes())}:${pad2(v.getSeconds())}`;
}

/** 日時フィールドに対応するオフセットのフィールド名（Exif 2.31 以降） */
const DATE_OFFSET_KEY: Record<string, string> = {
  DateTimeOriginal: 'OffsetTimeOriginal',
  CreateDate: 'OffsetTimeDigitized',
  ModifyDate: 'OffsetTime',
};

function exifLabel(key: string, value: unknown, data: Record<string, unknown>): string | null {
  const map: Record<string, string> = {
    Make: 'メーカー',
    Model: '機種',
    LensModel: 'レンズ',
    DateTimeOriginal: '撮影日時（現地）',
    CreateDate: '作成日時（現地）',
    ModifyDate: '更新日時（現地）',
    Orientation: '向き',
    ExposureTime: 'シャッタースピード',
    FNumber: 'F値',
    ISO: 'ISO 感度',
    FocalLength: '焦点距離',
    Software: 'ソフトウェア',
    Artist: '作成者',
    Copyright: '著作権',
    Flash: 'フラッシュ',
  };
  const label = map[key];
  if (!label) return null;
  let v = value;
  // EXIF の日時はタイムゾーンを持たない（撮影地の現地時間）。UTC と誤記しない。
  if (v instanceof Date) v = exifWallClock(v, data[DATE_OFFSET_KEY[key] ?? '']);
  else if (Array.isArray(v)) v = v.join(', ');
  else if (typeof v === 'object' && v !== null) return null;
  return `${label}: ${String(v).slice(0, 200)}`;
}

/** EXIF と GPS、QR/バーコードを読む（ブラウザでも Node でも落ちないように） */
export async function inspectImage(
  bytes: Uint8Array,
  opts: { name: string; mime: string; originalMime?: string; note?: string },
): Promise<ImageMeta> {
  const blob = new Blob([new Uint8Array(bytes)], { type: opts.mime });
  let width = 0;
  let height = 0;

  const hasBitmap = typeof createImageBitmap === 'function';
  if (hasBitmap) {
    try {
      const bmp = await createImageBitmap(blob);
      width = bmp.width;
      height = bmp.height;
      bmp.close?.();
    } catch {
      /* ヘッダから読む */
    }
  }
  if (!width || !height) {
    const sz = imageSize(bytes);
    if (sz) {
      width = sz.width;
      height = sz.height;
    }
  }

  const exif: { label: string; value: string }[] = [];
  const gps: string[] = [];
  try {
    const exifr = (await import('exifr')).default;
    const data = (await exifr.parse(new Uint8Array(bytes), {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: true,
      interop: false,
      translateValues: true,
      reviveValues: true,
    } as never)) as Record<string, unknown> | undefined;
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        const line = exifLabel(k, v, data);
        if (line) exif.push({ label: line.split(':')[0]!, value: line.slice(line.indexOf(':') + 1).trim() });
      }
      const lat = typeof data.GPSLatitude === 'number' ? data.GPSLatitude : undefined;
      const lon = typeof data.GPSLongitude === 'number' ? data.GPSLongitude : undefined;
      if (lat !== undefined && lon !== undefined) {
        exif.push({ label: 'GPS 緯度', value: lat.toFixed(6) });
        exif.push({ label: 'GPS 経度', value: lon.toFixed(6) });
        gps.push(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
      }
    }
  } catch {
    /* EXIF が無い・読めない */
  }

  const codes = hasBitmap ? await decodeBarcodes(blob) : [];

  return {
    name: opts.name,
    mime: opts.mime,
    originalMime: opts.originalMime ?? opts.mime,
    bytes: bytes.length,
    width,
    height,
    blob,
    exif: [...exif, ...gps.map((g) => ({ label: 'GPS 位置', value: g }))],
    codes,
    note: opts.note,
  };
}

/** QR コード・バーコードを読む（ZXing を遅延読み込み） */
export async function decodeBarcodes(blob: Blob): Promise<{ format: string; text: string }[]> {
  try {
    if (typeof createImageBitmap !== 'function') return [];
    const bmp = await createImageBitmap(blob);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    let data: Uint8ClampedArray | null = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, 0, 0, w, h);
        data = ctx.getImageData(0, 0, w, h).data;
      }
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, 0, 0, w, h);
        data = ctx.getImageData(0, 0, w, h).data;
      }
    }
    bmp.close?.();
    if (!data) return [];

    // RGBA → 輝度（ZXing の RGBLuminanceSource は 1 バイト/画素を期待する）
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
      lum[i] = (data[p]! * 299 + data[p + 1]! * 587 + data[p + 2]! * 114) / 1000;
    }

    return decodeBarcodePixels(lum, w, h);
  } catch {
    return [];
  }
}

/** 輝度データ（1 バイト/画素）から QR・バーコードを読む。Node（レポート生成）からも使う */
export async function decodeBarcodePixels(
  lum: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<{ format: string; text: string }[]> {
  try {
    const zx = await import('@zxing/library');
    const hints = new Map();
    hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
      zx.BarcodeFormat.QR_CODE,
      zx.BarcodeFormat.DATA_MATRIX,
      zx.BarcodeFormat.AZTEC,
      zx.BarcodeFormat.PDF_417,
      zx.BarcodeFormat.CODE_128,
      zx.BarcodeFormat.CODE_39,
      zx.BarcodeFormat.EAN_13,
      zx.BarcodeFormat.ITF,
    ]);
    hints.set(zx.DecodeHintType.TRY_HARDER, true);
    const reader = new zx.MultiFormatReader();
    reader.setHints(hints);
    const source = new zx.RGBLuminanceSource(lum, w, h);
    const bitmap = new zx.BinaryBitmap(new zx.HybridBinarizer(source));
    // 読み取れないときに ZXing が大量に console.warn を出すので、この呼び出しの間だけ止める
    const originalWarn = console.warn;
    console.warn = () => {};
    let result;
    try {
      result = reader.decode(bitmap);
    } finally {
      console.warn = originalWarn;
    }
    const format = zx.BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN';
    return [{ format, text: result.getText() }];
  } catch {
    return [];
  }
}
