import type { ClassifierRule } from '../types.ts';
import { dl, nonEmptyLines, result } from './_help.ts';
import { toTsv, transpose } from '../lib/logparse.ts';

/** RFC4180 風の CSV パーサ（引用符・改行入りセルに対応） */
export function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') {
      quoted = true;
      continue;
    }
    if (c === delim) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function sniff(text: string): { delim: string; label: string; rows: string[][] } | null {
  const lines = nonEmptyLines(text).slice(0, 30);
  if (lines.length < 2) return null;
  // 1 行 1 JSON（WAF ログ・構造化ログ）を CSV と誤認しない
  const jsonish = lines.filter((l) => /^\s*[[{]/.test(l)).length;
  if (jsonish / lines.length >= 0.8) return null;

  const candidates = [
    { delim: '\t', label: 'タブ区切り（TSV）' },
    { delim: ',', label: 'カンマ区切り（CSV）' },
    { delim: ';', label: 'セミコロン区切り（CSV）' },
  ];
  for (const c of candidates) {
    // 引用符（"a,b" や "" のエスケープ）を考慮して列数を数える
    const rows = parseCsv(text, c.delim);
    if (rows.length < 2) continue;
    const widths = rows.slice(0, 30).map((r) => r.length);
    const first = widths[0] ?? 0;
    if (first < 2) continue;
    const consistent = widths.filter((n) => n === first).length;
    if (consistent / widths.length < 0.8) continue;
    return { ...c, rows };
  }
  return null;
}

export const csvRule: ClassifierRule = {
  id: 'csv',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'CSV / TSV',
  weight: 5,
  detect(ctx) {
    if (ctx.text.length > 5_000_000) return null;
    const hit = sniff(ctx.text);
    if (!hit) return null;
    const cols = hit.rows[0]?.length ?? 0;
    const wide = cols >= 7;
    return {
      score: hit.delim === '\t' ? 90 : 84,
      confidence: 'high',
      title: hit.label,
      summary: `表のデータです（${hit.rows.length} 行 × ${cols} 列）。${
        wide ? '横に長いので、項目を縦に並べ替えて表示します。' : '表として表示し、Excel に貼れる形でも出せます。'
      }`,
      evidence: [`${cols} 列がそろっている`, `区切り文字は「${hit.delim === '\t' ? 'タブ' : hit.delim}」`],
    };
  },
  transform(ctx) {
    const hit = sniff(ctx.text)!;
    const rows = hit.rows;
    const cols = Math.max(...rows.map((r) => r.length));
    const head = rows[0]!;
    const body = rows.slice(1);
    const columns =
      head.length > 1 && head.length === cols && body.length > 0
        ? head.map((h, i) => h || `列${i + 1}`)
        : Array.from({ length: cols }, (_, i) => `列${i + 1}`);

    const tableRows = (head.length === cols ? body : rows).slice(0, 200).map((r) => {
      const out = [...r];
      while (out.length < cols) out.push('');
      return out;
    });

    const wide = cols >= 7 && tableRows.length <= 40;
    const blocks: Parameters<typeof result>[3] = [];

    if (wide) {
      const transposedColumns = ['項目', ...tableRows.map((_, i) => `${i + 1}行目`)];
      const transposedRows = columns.map((c, ci) => [c, ...tableRows.map((r) => r[ci] ?? '')]);
      blocks.push({
        type: 'table',
        title: `表（${rows.length} 行 × ${cols} 列）を縦横変換`,
        columns: transposedColumns,
        rows: transposedRows,
        note: '横に長くて読みづらいため、項目を縦に並べ替えました。',
      });
      blocks.push({
        type: 'table',
        title: '元の向き',
        columns,
        rows: tableRows.slice(0, 10),
        note: tableRows.length > 10 ? '先頭 10 行を表示しています。' : undefined,
      });
    } else {
      blocks.push({
        type: 'table',
        title: `表（${rows.length} 行 × ${cols} 列）`,
        columns,
        rows: tableRows,
        note: rows.length > 201 ? '多いため先頭 200 行を表示しています。ダウンロードは全件です。' : undefined,
      });
    }

    blocks.push({
      type: 'notice',
      level: 'info',
      title: 'Excel に貼るには',
      text: wide
        ? '「Excel 用（タブ区切り）」は元の向き、「Excel 用ファイル（縦横変換）」は項目を縦にした形です。用途に合わせて選んでください（どちらも UTF-8 BOM 付き）。'
        : '下の「Excel 用（タブ区切り）」をコピーして、Excel のセルに貼り付けてください。文字化けする場合は「Excel 用ファイル」をダウンロードしてください（UTF-8 BOM 付き）。',
    });

    const tsv = toTsv(columns, tableRows);
    const transposed = toTsv(
      ['項目', ...tableRows.map((_, i) => `${i + 1}行目`)],
      transpose([columns, ...tableRows]),
    );
    return result(
      'csv',
      hit.label,
      '表として表示しました',
      blocks,
      [
        dl('Excel 用（タブ区切り）', 'table.tsv', toTsv(columns, rows), 'text/tab-separated-values'),
        dl('Excel 用ファイル（縦横変換）', 'table-transposed.tsv', transposed, 'text/tab-separated-values'),
        dl('CSV を保存', 'table.csv', [columns, ...rows].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n'), 'text/csv'),
        dl('コピー用テキスト', 'table.txt', tsv),
      ],
    );
  },
  fixtures: [
    { name: 'TSV', input: '名前\t年齢\t住所\n太郎\t20\t東京\n次郎\t30\t大阪', expect: { score: 90 } },
    { name: 'CSV', input: 'a,b,c\n1,2,3\n4,5,6', expect: { score: 84 } },
    { name: '文章', input: 'こんにちは。今日はいい天気ですね。', expect: { score: 0 } },
  ],
};
