import type { ClassifierRule } from '../types.ts';
import { result } from './_help.ts';

const HEX_LENGTHS: Record<number, string[]> = {
  32: ['MD5', 'NTLM ハッシュ', '（SHA-256 の先頭 32 桁の可能性も）'],
  40: ['SHA-1', 'RIPEMD-160'],
  56: ['SHA-224'],
  64: ['SHA-256', 'BLAKE2s-256', 'Keccak-256（Ethereum）'],
  96: ['SHA-384'],
  128: ['SHA-512', 'BLAKE2b-512', 'Whirlpool'],
};

const B64_LENGTHS: Record<number, string[]> = {
  24: ['160 bit（SHA-1 などを Base64 にしたもの）'],
  44: ['256 bit（SHA-256 などを Base64 にしたもの）'],
  88: ['512 bit（SHA-512 などを Base64 にしたもの）'],
};

export const hashRule: ClassifierRule = {
  id: 'hash',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'ハッシュ値',
  weight: 15,
  detect(ctx) {
    const t = ctx.text.trim();
    if (/\s/.test(t)) return null;
    if (/^[0-9a-fA-F]+$/.test(t) && HEX_LENGTHS[t.length]) {
      const candidates = HEX_LENGTHS[t.length]!;
      return {
        score: 80,
        confidence: 'medium',
        title: 'ハッシュ値（不可逆な要約）',
        summary: `ハッシュ値のようです。${t.length} 桁（${t.length * 4} bit）から、${candidates[0]} の可能性が高いです。`,
        evidence: [`16進数 ${t.length} 桁`, ...candidates.map((c) => `候補: ${c}`)],
      };
    }
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(t) && B64_LENGTHS[t.length] && /[A-Z]/.test(t) && /[+/]/.test(t)) {
      return {
        score: 62,
        confidence: 'low',
        title: 'ハッシュ値（Base64 表記の可能性）',
        summary: `${t.length} 文字の Base64 です。${B64_LENGTHS[t.length]![0]} の可能性があります。`,
        evidence: [`Base64 の長さ ${t.length}`],
      };
    }
    return null;
  },
  transform(ctx) {
    const t = ctx.text.trim();
    const isHex = /^[0-9a-fA-F]+$/.test(t);
    const candidates = isHex ? (HEX_LENGTHS[t.length] ?? []) : (B64_LENGTHS[t.length] ?? []);
    const bits = isHex ? t.length * 4 : Math.round((t.length * 6) / 8) * 8;
    return result(
      'hash',
      'ハッシュ値',
      'ハッシュ値の推定結果',
      [
        {
          type: 'kv',
          title: '推定',
          items: [
            { k: '長さ', v: `${t.length} 文字` },
            { k: 'ビット数', v: `${bits} bit` },
            { k: '表記', v: isHex ? '16進数' : 'Base64' },
            { k: '候補', v: candidates.join(' / ') || '不明' },
          ],
        },
        {
          type: 'notice',
          level: 'warn',
          title: '「推定」です',
          text: '同じ長さのハッシュは区別できません（例: SHA-256 の先頭 32 桁と MD5）。確定するには、元データが分かっている必要があります。パスワードのハッシュを元に戻すことはできません。',
        },
        { type: 'code', text: t, lang: 'text' },
      ],
    );
  },
  fixtures: [
    { name: 'MD5', input: 'd41d8cd98f00b204e9800998ecf8427e', expect: { score: 80 } },
    { name: 'SHA-256', input: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', expect: { score: 80 } },
    { name: '文章', input: 'これはハッシュではありません', expect: { score: 0 } },
  ],
};
