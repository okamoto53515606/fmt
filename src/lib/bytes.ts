/** バイト列と文字列の相互変換、文字コード推定。 */

const encoder = new TextEncoder();

export function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}

export function toHex(bytes: Uint8Array, sep = ' '): string {
  const out: string[] = [];
  for (const b of bytes) out.push(b.toString(16).padStart(2, '0'));
  return out.join(sep);
}

export function fromHex(s: string): Uint8Array | null {
  const clean = s.replace(/[\s:_-]/g, '');
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** base64 / base64url をデコードする（パディング無し・URL-safe も可） */
export function fromBase64(s: string): Uint8Array | null {
  const clean = s.replace(/[\s\r\n]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (clean.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null;
  const padded = clean.replace(/=+$/, '') + '='.repeat((4 - (clean.replace(/=+$/, '').length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function base64OfBytes(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export const bytesToDataUrl = (bytes: Uint8Array, mime: string): string =>
  `data:${mime};base64,${base64OfBytes(bytes)}`;

export function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

export type BinaryKind =
  | 'png'
  | 'jpeg'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'avif'
  | 'heic'
  | 'pdf'
  | 'zip'
  | 'gzip'
  | 'wasm'
  | 'elf'
  | 'pe'
  | 'sqlite'
  | 'unknown';

/** 先頭バイト（マジックナンバー）から形式を判定する */
export function sniffBinary(b: Uint8Array): { kind: BinaryKind; mime: string } {
  const at = (i: number) => b[i] ?? -1;
  const ascii = (from: number, len: number) =>
    String.fromCharCode(...Array.from(b.subarray(from, from + len)));

  if (at(0) === 0x89 && ascii(1, 3) === 'PNG') return { kind: 'png', mime: 'image/png' };
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { kind: 'jpeg', mime: 'image/jpeg' };
  if (ascii(0, 3) === 'GIF') return { kind: 'gif', mime: 'image/gif' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { kind: 'webp', mime: 'image/webp' };
  if (ascii(0, 2) === 'BM') return { kind: 'bmp', mime: 'image/bmp' };
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    if (brand === 'avif' || brand === 'avis') return { kind: 'avif', mime: 'image/avif' };
    if (/^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(brand)) return { kind: 'heic', mime: 'image/heic' };
  }
  if (ascii(0, 4) === '%PDF') return { kind: 'pdf', mime: 'application/pdf' };
  if (at(0) === 0x50 && at(1) === 0x4b) return { kind: 'zip', mime: 'application/zip' };
  if (at(0) === 0x1f && at(1) === 0x8b) return { kind: 'gzip', mime: 'application/gzip' };
  if (at(0) === 0x00 && at(1) === 0x61 && at(2) === 0x73 && at(3) === 0x6d)
    return { kind: 'wasm', mime: 'application/wasm' };
  if (at(0) === 0x7f && ascii(1, 3) === 'ELF') return { kind: 'elf', mime: 'application/x-elf' };
  if (at(0) === 0x4d && at(1) === 0x5a) return { kind: 'pe', mime: 'application/x-msdownload' };
  if (ascii(0, 6) === 'SQLite') return { kind: 'sqlite', mime: 'application/vnd.sqlite3' };
  return { kind: 'unknown', mime: 'application/octet-stream' };
}

/** テキストとして読めそうか（制御文字が少なく、UTF-8 として妥当か） */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const head = bytes.subarray(0, Math.min(bytes.length, 4096));
  let bad = 0;
  for (const b of head) {
    if (b === 0x00) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20) || b === 0x7f) bad++;
  }
  if (bad / head.length > 0.02) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    // UTF-8 でなくても Shift_JIS なら読める
    try {
      new TextDecoder('shift_jis', { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }
}

export interface DecodedText {
  text: string;
  encoding: 'UTF-8' | 'UTF-16LE' | 'UTF-16BE' | 'Shift_JIS' | 'UTF-8(不正なバイト)' | '不明';
  bom: boolean;
}

/** BOM → UTF-8 → Shift_JIS の順で文字コードを推定してデコードする */
export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8', bom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE', bom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE', bom: true };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8', bom: false };
  } catch {
    /* fallthrough */
  }
  try {
    return {
      text: new TextDecoder('shift_jis', { fatal: true }).decode(bytes),
      encoding: 'Shift_JIS',
      bom: false,
    };
  } catch {
    /* fallthrough */
  }
  return {
    text: new TextDecoder('utf-8').decode(bytes),
    encoding: 'UTF-8(不正なバイト)',
    bom: false,
  };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} バイト`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB（${n.toLocaleString('ja-JP')} バイト）`;
  return `${(n / 1024 / 1024).toFixed(2)} MB（${n.toLocaleString('ja-JP')} バイト）`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', copy);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

/** ダウンロード用の Blob（Excel で文字化けしないよう BOM 付き UTF-8） */
export function textBlob(text: string, mime = 'text/plain'): Blob {
  return new Blob(['\uFEFF', text], { type: `${mime};charset=utf-8` });
}
