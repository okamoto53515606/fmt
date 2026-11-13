import type { ClassifierRule } from '../types.ts';
import type { Block } from '../types.ts';
import { clip, dl, result } from './_help.ts';
import { toTsv } from '../lib/logparse.ts';

/** 1 レコードを「キー = 短い文字列」に平坦化する（入れ子は 2 階層まで） */
function flatten(value: unknown, prefix = '', depth = 0, out: Record<string, string> = {}): Record<string, string> {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      // 配列は中身を 1 行の JSON にして、マスクが効くようにする
      out[prefix || 'value'] = clip(safeStringify(value), 200);
      return out;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out[prefix || 'value'] = '{}';
      return out;
    }
    for (const [k, v] of entries) {
      const key = prefix ? `${prefix}.${k}` : k;
      const isPlainObject = v !== null && typeof v === 'object' && !Array.isArray(v);
      if (isPlainObject && depth < 1) flatten(v, key, depth + 1, out);
      else if (v !== null && typeof v === 'object') out[key] = clip(safeStringify(v), 200);
      else out[key] = v === null ? '' : String(v);
    }
    return out;
  }
  out[prefix || 'value'] = value === null ? '' : String(value);
  return out;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '';
  }
}

/** 1 行 1 JSON（JSON Lines / NDJSON）かどうか */
function parseLines(text: string): Record<string, unknown>[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const out: Record<string, unknown>[] = [];
  for (const line of lines.slice(0, 5000)) {
    const t = line.trim();
    if (!/^[[{]/.test(t)) return null;
    try {
      const v: unknown = JSON.parse(t);
      if (v === null || typeof v !== 'object') return null;
      out.push(Array.isArray(v) ? { value: v } : (v as Record<string, unknown>));
    } catch {
      return null;
    }
  }
  return out;
}

export const jsonLinesRule: ClassifierRule = {
  id: 'jsonl',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'JSON（1 行 1 レコード）',
  weight: 18,
  detect(ctx) {
    if (ctx.text.length > 20_000_000) return null;
    const records = parseLines(ctx.text);
    if (!records) return null;
    const keys = [...new Set(records.flatMap((r) => Object.keys(flatten(r))))];
    return {
      score: 91,
      confidence: 'high',
      title: 'JSON（1 行 1 レコード）',
      summary: `1 行に 1 つずつ JSON が並んでいます（${records.length.toLocaleString('ja-JP')} 件）。表にしました。`,
      evidence: [
        `${records.length} 行すべてが JSON`,
        `${keys.length} 種類の項目`,
        keys.slice(0, 3).join(' / '),
      ],
    };
  },
  transform(ctx) {
    const records = parseLines(ctx.text)!;
    const flat = records.map((r) => flatten(r));
    const columns = [...new Set(flat.flatMap((o) => Object.keys(o)))].slice(0, 16);
    const rows = flat.slice(0, 200).map((o) => columns.map((c) => o[c] ?? ''));

    const blocks: Block[] = [
      {
        type: 'table',
        title: `1 行 1 レコードの JSON（${records.length.toLocaleString('ja-JP')} 件）`,
        columns,
        rows,
        note:
          records.length > 200
            ? '多いため先頭 200 行を表示しています。ダウンロードは全件です。'
            : '入れ子の項目は「親.子」の名前で並べています。',
      },
      {
        type: 'notice',
        level: 'info',
        title: 'この形式について',
        text: '1 行に 1 つの JSON を並べた形式です（JSON Lines / NDJSON）。WAF やアプリのログでよく使われます。',
      },
    ];
    if (columns.length >= 16) {
      blocks.push({
        type: 'notice',
        level: 'info',
        title: '項目が多いため一部だけ表示しています',
        text: `全 ${new Set(flat.flatMap((o) => Object.keys(o))).size} 項目のうち先頭 16 項目を表示しています。すべての項目はダウンロードした TSV に含まれます。`,
      });
    }

    return result(
      'jsonl',
      'JSON（1 行 1 レコード）',
      '表にしました',
      blocks,
      [
        dl('Excel 用（タブ区切り）', 'records.tsv', toTsv(columns, rows), 'text/tab-separated-values'),
        dl('JSON（整形）', 'records.json', JSON.stringify(records, null, 2), 'application/json'),
      ],
    );
  },
};
