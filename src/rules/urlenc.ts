import type { WrapperRule } from '../types.ts';

/** URL エンコード（%E3%81%82 など）を解除する */
export const urlEncodeRule: WrapperRule = {
  id: 'urlenc',
  layer: 'wrapper',
  appliesTo: 'text',
  label: 'URL エンコード',
  detect(ctx) {
    const t = ctx.text.trim();
    if (t.length < 6) return null;
    // URL そのものは URL ルールでパス・パラメータを分解する（ここで丸ごと剥がさない）
    if (/^https?:\/\//i.test(t)) return null;
    const hits = t.match(/%[0-9A-Fa-f]{2}/g)?.length ?? 0;
    if (hits < 3) return null;
    const ratio = (hits * 3) / t.length;
    if (ratio < 0.05) return null;
    return {
      score: 82,
      confidence: 'high',
      title: 'URL エンコード',
      summary: '%E3%81%82 のような形で符号化された文字列です。解除して表示します。',
      evidence: [`${hits} 個の %XX`, '日本語がバイト単位で並んでいる'],
    };
  },
  unwrap(ctx) {
    const t = ctx.text.trim();
    const tryDecode = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return null;
      }
    };
    let decoded = tryDecode(t);
    if (decoded === null) decoded = tryDecode(t.replace(/\+/g, ' '));
    if (decoded === null || decoded === t || decoded.includes('\uFFFD')) return null;
    return { bytes: new TextEncoder().encode(decoded), text: decoded, detail: '%XX を文字に戻しました' };
  },
};
