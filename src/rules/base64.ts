import type { WrapperRule } from '../types.ts';
import { fromBase64, looksLikeText, sniffBinary } from '../lib/bytes.ts';

/**
 * Base64 / data URI を剥がす。
 * 画像などのバイナリは bytes のまま後段（画像ルール）へ渡す。
 */
export const base64Rule: WrapperRule = {
  id: 'base64',
  layer: 'wrapper',
  appliesTo: 'text',
  label: 'Base64',
  detect(ctx) {
    const t = ctx.text.trim();
    if (!t) return null;

    if (/^data:[\w.+-]+\/[\w.+-]+;base64,/i.test(t)) {
      return {
        score: 96,
        confidence: 'high',
        title: 'data URI（Base64 埋め込み）',
        summary: 'data URI です。中身を取り出します。',
        evidence: ['data:形式;base64, で始まっている'],
      };
    }

    // 単体の base64。長すぎる行や、hex を誤認しないように条件を絞る
    if (t.length < 16 || t.length > 8_000_000) return null;
    if (/^[0-9a-fA-F\s]+$/.test(t) && t.replace(/\s/g, '').length % 2 === 0) return null;
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(t.replace(/\s/g, ''))) return null;
    if (!/[A-Za-z]/.test(t)) return null;

    const bytes = fromBase64(t);
    if (!bytes || bytes.length < 8) return null;
    const kind = sniffBinary(bytes).kind;
    if (kind !== 'unknown') {
      return {
        score: 95,
        confidence: 'high',
        title: `Base64（中身は ${kind.toUpperCase()}）`,
        summary: `Base64 を解除すると ${kind.toUpperCase()} ファイルでした。`,
        evidence: [`${t.length} 文字の Base64`, `解除すると ${bytes.length} バイト`, `先頭に ${kind.toUpperCase()} の印がある`],
      };
    }
    if (!looksLikeText(bytes)) {
      return {
        score: 72,
        confidence: 'medium',
        title: 'Base64（中身はバイナリ）',
        summary: `Base64 を解除すると ${bytes.length.toLocaleString('ja-JP')} バイトのバイナリでした。種類を推定します。`,
        evidence: [`${t.length} 文字の Base64`, '文字として読めないバイト列'],
      };
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (text.length < 4) return null;
    return {
      score: 78,
      confidence: 'medium',
      title: 'Base64',
      summary: 'Base64 で符号化されたテキストです。解除して表示します。',
      evidence: [`${t.length} 文字`, `解除すると ${bytes.length} バイトの文字列`],
    };
  },
  unwrap(ctx) {
    const t = ctx.text.trim();
    const m = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]*)$/i.exec(t);
    if (m) {
      const bytes = fromBase64(m[2]!);
      if (!bytes) return null;
      return { bytes, detail: `data URI から ${m[1]} を取り出しました` };
    }
    const bytes = fromBase64(t);
    if (!bytes) return null;
    return { bytes, detail: `${ctx.text.length} 文字の Base64 を解除しました` };
  },
};
