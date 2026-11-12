/**
 * 証明書・鍵の読み取り（ASN.1 DER の最小実装）。
 * 秘密鍵の中身は表示しない（アルゴリズムとビット数だけ）。
 */

export interface Tlv {
  tag: number;
  cls: number;
  constructed: boolean;
  start: number;
  valueStart: number;
  end: number;
}

export function readTlv(b: Uint8Array, off: number): Tlv | null {
  if (off >= b.length) return null;
  const tag = b[off]!;
  let p = off + 1;
  let tagNo = tag & 0x1f;
  if (tagNo === 0x1f) {
    while (p < b.length && (b[p]! & 0x80) !== 0) p++;
    p++;
    tagNo = 0x1f;
  }
  if (p >= b.length) return null;
  let len = b[p]!;
  p++;
  if ((len & 0x80) !== 0) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || p + n > b.length) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p + i]!;
    p += n;
  }
  if (p + len > b.length) return null;
  return { tag, cls: tag >> 6, constructed: (tag & 0x20) !== 0, start: off, valueStart: p, end: p + len };
}

export const valueOf = (b: Uint8Array, t: Tlv) => b.subarray(t.valueStart, t.end);

export function childrenOf(b: Uint8Array, t: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = t.valueStart;
  while (p < t.end) {
    const c = readTlv(b, p);
    if (!c || c.end <= p) break;
    out.push(c);
    p = c.end;
  }
  return out;
}

export function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const parts: number[] = [];
  let first = bytes[0]!;
  parts.push(Math.floor(first / 40), first % 40);
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i]!;
    v = v * 128 + (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join('.');
}

const OID_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.5': 'SHA1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA512 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.2.1': 'ECDSA',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA384',
  '1.2.840.10045.3.1.7': 'P-256',
  '1.3.132.0.34': 'P-384',
  '1.3.132.0.35': 'P-521',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.2.840.113549.1.1.4': 'MD5 with RSA',
  '1.2.840.113549.1.9.1': 'メールアドレス',
  '2.5.4.3': 'CN（コモンネーム）',
  '2.5.4.6': 'C（国）',
  '2.5.4.7': 'L（市区町村）',
  '2.5.4.8': 'ST（都道府県）',
  '2.5.4.10': 'O（組織）',
  '2.5.4.11': 'OU（部署）',
  '2.5.29.17': 'SAN（別名）',
  '2.5.29.19': 'Basic Constraints',
  '2.5.29.15': 'Key Usage',
  '2.5.29.37': 'Extended Key Usage',
};

export const oidName = (oid: string) => OID_NAMES[oid] ?? oid;

function decodeString(b: Uint8Array, t: Tlv): string {
  const v = valueOf(b, t);
  if (t.tag === 0x1e) {
    // BMPString (UTF-16BE)
    try {
      return new TextDecoder('utf-16be').decode(v);
    } catch {
      return '';
    }
  }
  if (t.tag === 0x1c) {
    // UniversalString (UTF-32BE)
    let s = '';
    for (let i = 0; i + 3 < v.length; i += 4) {
      s += String.fromCodePoint(((v[i]! << 24) | (v[i + 1]! << 16) | (v[i + 2]! << 8) | v[i + 3]!) >>> 0);
    }
    return s;
  }
  const bytes = new Uint8Array(v);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    let s = '';
    for (const c of bytes) s += String.fromCharCode(c);
    return s;
  }
}

function parseName(b: Uint8Array, t: Tlv): string {
  const parts: string[] = [];
  for (const rdn of childrenOf(b, t)) {
    for (const atv of childrenOf(b, rdn)) {
      const [oidTlv, valTlv] = childrenOf(b, atv);
      if (!oidTlv || !valTlv) continue;
      const oid = decodeOid(valueOf(b, oidTlv));
      const label = oid === '2.5.4.3' ? 'CN' : oid === '2.5.4.10' ? 'O' : oid === '2.5.4.11' ? 'OU' : oid === '2.5.4.6' ? 'C' : oid === '2.5.4.8' ? 'ST' : oid === '2.5.4.7' ? 'L' : oid === '1.2.840.113549.1.9.1' ? 'E' : oid;
      parts.push(`${label}=${decodeString(b, valTlv)}`);
    }
  }
  return parts.join(', ');
}

function parseAlgId(b: Uint8Array, t: Tlv): string {
  const kids = childrenOf(b, t);
  const oidTlv = kids[0];
  if (!oidTlv) return '';
  const oid = decodeOid(valueOf(b, oidTlv));
  return oidName(oid);
}

function parseIntTlv(b: Uint8Array, t: Tlv): bigint {
  const v = valueOf(b, t);
  let n = 0n;
  for (const x of v) n = (n << 8n) | BigInt(x);
  return n;
}

function parseTime(b: Uint8Array, t: Tlv): Date {
  const s = decodeString(b, t);
  if (t.tag === 0x17) {
    // UTCTime: YYMMDDHHMMSSZ
    const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s);
    if (!m) return new Date(NaN);
    const yy = Number(m[1]);
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)));
  }
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(s);
  if (!m) return new Date(s);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)));
}

export interface CertInfo {
  subject: string;
  issuer: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  sigAlg: string;
  pubAlg: string;
  keyBits?: number;
  san: string[];
  isCa: boolean;
}

export function parseCertificate(der: Uint8Array): CertInfo | null {
  try {
    const root = readTlv(der, 0);
    if (!root || root.tag !== 0x30) return null;
    const [tbs, sigAlg] = childrenOf(der, root);
    if (!tbs || !sigAlg) return null;
    const kids = childrenOf(der, tbs);
    let i = 0;
    if (kids[0]?.tag === 0xa0) i++;
    const serialTlv = kids[i++]!;
    i++; // signature
    const issuerTlv = kids[i++]!;
    const validityTlv = kids[i++]!;
    const subjectTlv = kids[i++]!;
    const spkiTlv = kids[i++]!;
    if (!serialTlv || !issuerTlv || !validityTlv || !subjectTlv || !spkiTlv) return null;

    const [nb, na] = childrenOf(der, validityTlv);
    const spkiKids = childrenOf(der, spkiTlv);
    const pubAlg = spkiKids[0] ? parseAlgId(der, spkiKids[0]) : '';
    let keyBits: number | undefined;
    const bitString = spkiKids[1];
    if (bitString) {
      const v = valueOf(der, bitString);
      keyBits = Math.max(0, (v.length - 1) * 8);
      if (pubAlg === 'RSA' && v.length > 2) {
        const inner = readTlv(v.subarray(1), 0);
        const ints = inner ? childrenOf(v.subarray(1), inner) : [];
        const mod = ints[0];
        if (mod) {
          const mv = valueOf(v.subarray(1), mod);
          let bits = (mv.length - 1) * 8;
          const top = mv[0] ?? 0;
          if (top) bits += 8 - Math.floor(Math.log2(top)) - 1;
          keyBits = bits;
        }
      }
    }

    const san: string[] = [];
    let isCa = false;
    const exts = kids.find((k) => k.tag === 0xa3);
    if (exts) {
      const seq = childrenOf(der, exts)[0];
      if (seq) {
        for (const ext of childrenOf(der, seq)) {
          const ek = childrenOf(der, ext);
          const oidTlv = ek[0];
          if (!oidTlv) continue;
          const oid = decodeOid(valueOf(der, oidTlv));
          const os = ek.find((x) => x.tag === 0x04);
          if (!os) continue;
          if (oid === '2.5.29.17') {
            const innerBuf = valueOf(der, os);
            const inner = readTlv(innerBuf, 0);
            if (inner) {
              for (const gn of childrenOf(innerBuf, inner)) {
                const v = valueOf(innerBuf, gn);
                if (gn.tag === 0x82) san.push(new TextDecoder().decode(v));
                else if (gn.tag === 0x81) san.push(new TextDecoder().decode(v));
                else if (gn.tag === 0x86) san.push(new TextDecoder().decode(v));
                else if (gn.tag === 0x87 && v.length === 4) san.push(`IP ${v.join('.')}`);
                else if (gn.tag === 0x87 && v.length === 16) san.push(`IPv6 ${Array.from(v).map((x) => x.toString(16)).join(':')}`);
              }
            }
          } else if (oid === '2.5.29.19') {
            const innerBuf = valueOf(der, os);
            const inner = readTlv(innerBuf, 0);
            if (inner) isCa = childrenOf(innerBuf, inner).some((x) => x.tag === 0x01 && x.end > x.valueStart && innerBuf[x.valueStart] !== 0);
          }
        }
      }
    }

    return {
      subject: parseName(der, subjectTlv),
      issuer: parseName(der, issuerTlv),
      serial: parseIntTlv(der, serialTlv).toString(16),
      notBefore: nb ? parseTime(der, nb) : new Date(NaN),
      notAfter: na ? parseTime(der, na) : new Date(NaN),
      sigAlg: parseAlgId(der, sigAlg),
      pubAlg,
      keyBits,
      san,
      isCa,
    };
  } catch {
    return null;
  }
}

export interface PemBlock {
  label: string;
  der: Uint8Array;
}

export function parsePem(text: string): PemBlock[] {
  const out: PemBlock[] = [];
  const re = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;
  for (const m of text.matchAll(re)) {
    const b64 = m[2]!.replace(/[^A-Za-z0-9+/=]/g, '');
    try {
      const bin = atob(b64);
      const der = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
      out.push({ label: m[1]!, der });
    } catch {
      /* 壊れた base64 */
    }
  }
  return out;
}

export interface KeyInfo {
  kind: string;
  alg: string;
  bits?: number;
  curve?: string;
  note: string;
}

export function describeKey(label: string, der: Uint8Array): KeyInfo {
  const isPrivate = /PRIVATE KEY/.test(label);
  try {
    const root = readTlv(der, 0);
    if (!root) return { kind: label, alg: '不明', note: '読み取れませんでした' };

    if (label === 'RSA PRIVATE KEY') {
      const ints = childrenOf(der, root);
      const mod = ints[1];
      let bits: number | undefined;
      if (mod) {
        const mv = valueOf(der, mod);
        bits = (mv.length - 1) * 8;
        const top = mv[0] ?? 0;
        if (top) bits += 8 - Math.floor(Math.log2(top)) - 1;
      }
      return { kind: 'RSA 秘密鍵（PKCS#1）', alg: 'RSA', bits, note: 'この鍵は絶対に共有しないでください' };
    }
    if (label === 'EC PRIVATE KEY') {
      const kids = childrenOf(der, root);
      const params = kids.find((k) => k.tag === 0xa0);
      let curve: string | undefined;
      if (params) {
        const inner = childrenOf(der, params)[0];
        if (inner) curve = oidName(decodeOid(valueOf(der, inner)));
      }
      return { kind: 'EC 秘密鍵（SEC1）', alg: 'ECDSA', curve, note: 'この鍵は絶対に共有しないでください' };
    }
    if (label === 'PRIVATE KEY') {
      const kids = childrenOf(der, root);
      const algTlv = kids[1];
      const alg = algTlv ? parseAlgId(der, algTlv) : '不明';
      let curve: string | undefined;
      if (algTlv) {
        const params = childrenOf(der, algTlv)[1];
        if (params) curve = oidName(decodeOid(valueOf(der, params)));
      }
      const octet = kids.find((k) => k.tag === 0x04);
      let bits: number | undefined;
      if (octet) {
        const innerBuf = valueOf(der, octet);
        const inner = readTlv(innerBuf, 0);
        if (inner) {
          const ik = childrenOf(innerBuf, inner);
          const mod = ik[1];
          if (mod) {
            const mv = valueOf(innerBuf, mod);
            bits = (mv.length - 1) * 8;
            const top = mv[0] ?? 0;
            if (top) bits += 8 - Math.floor(Math.log2(top)) - 1;
          }
        }
      }
      return { kind: '秘密鍵（PKCS#8）', alg, bits, curve, note: 'この鍵は絶対に共有しないでください' };
    }
    if (label === 'PUBLIC KEY') {
      const kids = childrenOf(der, root);
      const alg = kids[0] ? parseAlgId(der, kids[0]) : '不明';
      const spki = parseCertificate(der);
      return { kind: '公開鍵（SPKI）', alg, bits: spki?.keyBits, note: '公開鍵は配布しても問題ありません' };
    }
    if (label === 'RSA PUBLIC KEY') {
      const ints = childrenOf(der, root);
      const mod = ints[0];
      let bits: number | undefined;
      if (mod) {
        const mv = valueOf(der, mod);
        bits = (mv.length - 1) * 8;
      }
      return { kind: 'RSA 公開鍵（PKCS#1）', alg: 'RSA', bits, note: '公開鍵は配布しても問題ありません' };
    }
    if (/CERTIFICATE/.test(label)) {
      const cert = parseCertificate(der);
      return {
        kind: '証明書（X.509）',
        alg: cert?.pubAlg ?? '不明',
        bits: cert?.keyBits,
        note: cert ? `有効期限: ${cert.notBefore.toISOString().slice(0, 10)} 〜 ${cert.notAfter.toISOString().slice(0, 10)}` : '',
      };
    }
    return { kind: label, alg: '不明', note: isPrivate ? '秘密鍵の可能性があります' : '' };
  } catch {
    return { kind: label, alg: '不明', note: '読み取れませんでした' };
  }
}

export { OID_NAMES };
