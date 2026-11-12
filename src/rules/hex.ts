import type { WrapperRule } from '../types.ts';
import { fromHex } from '../lib/bytes.ts';
import { nonEmptyLines } from './_help.ts';

const HEXDUMP_LINE = /^(?:0x)?([0-9a-fA-F]{4,8})\s*[:|]?\s+((?:[0-9a-fA-F]{2}\s+){2,})/;

/** 16進ダンプ（xxd / hexdump の出力）を元のバイト列に戻す */
export const hexdumpRule: WrapperRule = {
  id: 'hexdump',
  layer: 'wrapper',
  appliesTo: 'text',
  label: '16進ダンプ',
  detect(ctx) {
    const lines = nonEmptyLines(ctx.text).slice(0, 200);
    const hit = lines.filter((l) => HEXDUMP_LINE.test(l)).length;
    if (hit < 2) return null;
    return {
      score: 90,
      confidence: 'high',
      title: '16進ダンプ',
      summary: 'アドレス・16進・文字を並べたダンプです。元のデータに戻します。',
      evidence: [`${hit} 行がダンプの形`, '左にアドレス、中央に 16進、右に文字'],
    };
  },
  unwrap(ctx) {
    const bytes: number[] = [];
    for (const line of nonEmptyLines(ctx.text)) {
      const m = HEXDUMP_LINE.exec(line);
      if (!m) continue;
      const tail = line.slice(m[0].length);
      // 右側の文字欄（|....|）は使わず、16進のみを読む
      const hexPart = m[2]!.trim();
      const arr = fromHex(hexPart.replace(/\s+/g, ''));
      if (arr) bytes.push(...arr);
      if (tail.includes('|')) continue;
    }
    if (bytes.length < 4) return null;
    return { bytes: new Uint8Array(bytes), detail: `${bytes.length} バイトに戻しました` };
  },
};

/** 16進の文字列（1行）を元に戻す */
export const hexStringRule: WrapperRule = {
  id: 'hex',
  layer: 'wrapper',
  appliesTo: 'text',
  label: '16進文字列',
  detect(ctx) {
    const t = ctx.text.trim();
    if (t.length < 16 || t.length > 4_000_000) return null;
    if (!/^[0-9a-fA-F]+$/.test(t)) return null;
    // ハッシュ値（32/40/64/128桁）は別ルールで扱う
    if ([32, 40, 64, 128].includes(t.length)) return null;
    if (t.length % 2 !== 0) return null;
    return {
      score: 80,
      confidence: 'medium',
      title: '16進文字列',
      summary: '16進数で書かれたデータです。元のデータに戻します。',
      evidence: [`${t.length} 文字（${t.length / 2} バイト相当）`, '0-9 と a-f だけで構成'],
    };
  },
  unwrap(ctx) {
    const bytes = fromHex(ctx.text.trim());
    if (!bytes || bytes.length < 4) return null;
    return { bytes, detail: `${bytes.length} バイトに戻しました` };
  },
};

/** \u3042 や \x41 のようなエスケープを解除する */
export const unicodeEscapeRule: WrapperRule = {
  id: 'unicode-escape',
  layer: 'wrapper',
  appliesTo: 'text',
  label: 'Unicode エスケープ',
  detect(ctx) {
    const t = ctx.text;
    const u = t.match(/\\u[0-9a-fA-F]{4}/g)?.length ?? 0;
    const x = t.match(/\\x[0-9a-fA-F]{2}/g)?.length ?? 0;
    if (u + x < 3) return null;
    return {
      score: 78,
      confidence: 'medium',
      title: 'Unicode エスケープ',
      summary: '\\u3042 のような形で書かれた文字列です。実際の文字に戻します。',
      evidence: [`\\u が ${u} 個、\\x が ${x} 個`],
    };
  },
  unwrap(ctx) {
    let out = ctx.text.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)));
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
    out = out.replace(/\\x([0-9a-fA-F]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
    if (out === ctx.text) return null;
    return { bytes: new TextEncoder().encode(out), text: out, detail: 'エスケープを文字に戻しました' };
  },
};
