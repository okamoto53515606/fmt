import type { Download, Result } from '../types.ts';
import { textBlob } from '../lib/bytes.ts';

export const result = (
  ruleId: string,
  title: string,
  summary: string,
  blocks: Result['blocks'],
  downloads: Download[] = [],
): Result => ({ ruleId, title, summary, blocks, downloads });

export const dl = (label: string, filename: string, text: string, mime = 'text/plain'): Download => ({
  label,
  filename,
  blob: textBlob(text, mime),
});

export const nonEmptyLines = (s: string) => s.split(/\r?\n/).filter((l) => l.trim().length > 0);

export const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d);

/** 解析対象を先頭 200KB に切る（正規表現の暴走と待ち時間を防ぐ） */
export const sample = (s: string, n = 200_000) => (s.length > n ? s.slice(0, n) : s);

/** 1行の要約（長い値を画面に出さない） */
export const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n)}…` : s);
