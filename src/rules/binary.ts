import type { ClassifierRule } from '../types.ts';
import { sniffBinary, toHex } from '../lib/bytes.ts';
import { result } from './_help.ts';

const IMAGE_KINDS = new Set(['png', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'heic']);

const LABELS: Record<string, { title: string; note: string }> = {
  pdf: { title: 'PDF ファイル', note: 'PDF の中身（文章）は表示していません。' },
  zip: { title: 'ZIP（圧縮ファイル）', note: '中のファイル一覧の展開はしていません。' },
  gzip: { title: 'gzip（圧縮ファイル）', note: '展開はしていません。' },
  wasm: { title: 'WebAssembly', note: 'プログラムのバイナリです。中身は表示していません。' },
  elf: { title: '実行ファイル（Linux / ELF）', note: 'プログラムのバイナリです。実行はしません。' },
  pe: { title: '実行ファイル（Windows / PE）', note: 'プログラムのバイナリです。実行はしません。' },
  sqlite: { title: 'SQLite データベース', note: 'テーブルの中身は表示していません。' },
  unknown: { title: 'バイナリデータ（文字ではありません）', note: '' },
};

function entropy(bytes: Uint8Array): number {
  const freq = new Array<number>(256).fill(0);
  for (const b of bytes) freq[b]!++;
  let h = 0;
  for (const f of freq) {
    if (!f) continue;
    const p = f / bytes.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function hexdump(bytes: Uint8Array, limit = 256): string {
  const lines: string[] = [];
  const n = Math.min(bytes.length, limit);
  for (let off = 0; off < n; off += 16) {
    const chunk = bytes.subarray(off, Math.min(off + 16, n));
    const hex = toHex(chunk).padEnd(47, ' ');
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  if (bytes.length > n) lines.push(`…（残り ${(bytes.length - n).toLocaleString('ja-JP')} バイト）`);
  return lines.join('\n');
}

/**
 * デコードした結果がバイナリだったときの説明。
 * 復号・展開はしない（できると言わない）。種類と手がかりだけ出す。
 */
export const binaryRule: ClassifierRule = {
  id: 'binary',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'バイナリ',
  weight: -20,
  detect(ctx) {
    if (ctx.kind !== 'text') return null;
    if (!ctx.bytes.length || ctx.text) return null;
    const { kind } = sniffBinary(ctx.bytes);
    if (IMAGE_KINDS.has(kind)) return null; // 画像ルールに任せる
    const h = entropy(ctx.bytes);
    const label = LABELS[kind] ?? LABELS.unknown!;
    return {
      score: kind === 'unknown' ? 68 : 78,
      confidence: 'medium',
      title: label.title,
      summary:
        kind === 'unknown'
          ? `${ctx.bytes.length.toLocaleString('ja-JP')} バイトのバイナリです。文字でも画像でもありません。`
          : `${label.title} です（${ctx.bytes.length.toLocaleString('ja-JP')} バイト）。`,
      evidence: [`先頭 ${toHex(ctx.bytes.subarray(0, 8))}`, `エントロピー ${h.toFixed(2)} bit/byte`],
    };
  },
  transform(ctx) {
    const { kind, mime } = sniffBinary(ctx.bytes);
    const h = entropy(ctx.bytes);
    const label = LABELS[kind] ?? LABELS.unknown!;
    const guess =
      h > 7.5
        ? '暗号化、または圧縮されたデータの可能性が高いです（パターンがほとんどありません）'
        : h > 6.5
          ? '圧縮・バイナリ形式の可能性があります'
          : '構造のあるバイナリ（独自形式やファイル形式）の可能性があります';

    return result(
      'binary',
      label.title,
      '種類を推定しました',
      [
        {
          type: 'kv',
          title: '推定',
          items: [
            { k: '大きさ', v: `${ctx.bytes.length.toLocaleString('ja-JP')} バイト` },
            { k: '形式の判定', v: kind === 'unknown' ? '不明（既知のファイル形式の印がない）' : kind.toUpperCase() },
            { k: 'MIME の推定', v: mime },
            { k: 'エントロピー', v: `${h.toFixed(2)} bit/byte`, note: guess },
          ],
        },
        { type: 'code', text: hexdump(ctx.bytes), lang: 'text' },
        {
          type: 'notice',
          level: 'warn',
          title: '復号・展開はしていません',
          text: '暗号化・圧縮されたデータを推測で開くと、誤った内容を表示して誤解のもとになります。この画面では「何らかのバイナリである」ことまでをお伝えします。元のアプリで開くか、管理者に確認してください。',
        },
      ],
    );
  },
};
