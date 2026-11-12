import type { ClassifierRule } from '../types.ts';
import { parseLogs, toTsv } from '../lib/logparse.ts';
import { dl, result } from './_help.ts';

export const logRule: ClassifierRule = {
  id: 'log',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'ログ',
  weight: 30,
  detect(ctx) {
    if (ctx.text.length > 8_000_000) return null;
    const parsed = parseLogs(ctx.text);
    if (!parsed) return null;
    return {
      score: 90,
      confidence: 'high',
      title: parsed.label,
      summary: `ログです（${parsed.matched.toLocaleString('ja-JP')} 行）。表にして、エラー行を抜き出しました。`,
      evidence: [`${parsed.matched} 行が当てはまる`, `列は ${parsed.columns.length} 個`, `${parsed.errors.length} 行がエラーらしい`],
    };
  },
  transform(ctx) {
    const parsed = parseLogs(ctx.text)!;
    const shown = parsed.rows.slice(0, 200).map((r) => {
      const out = [...r];
      while (out.length < parsed.columns.length) out.push('');
      return out.slice(0, 20);
    });
    const columns = parsed.columns.slice(0, 20);

    const blocks: Parameters<typeof result>[3] = [
      {
        type: 'table',
        title: `${parsed.label}（${parsed.matched.toLocaleString('ja-JP')} 行）`,
        columns,
        rows: shown,
        note:
          parsed.rows.length > 200
            ? `多いため先頭 200 行を表示しています。ダウンロードは全件です。`
            : parsed.note,
      },
    ];

    if (parsed.errors.length) {
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: `エラーと思われる行が ${parsed.errors.length} 行あります`,
        text: '下の欄に「意味・原因・次にやること」をまとめています。該当行はこの表の状態（ステータス）列で確認できます。',
      });
      blocks.push({
        type: 'code',
        text: parsed.errors.slice(0, 20).join('\n').slice(0, 100_000),
        lang: 'text',
      });
    } else {
      blocks.push({ type: 'notice', level: 'info', title: 'エラーらしい行は見つかりませんでした', text: '4xx / 5xx や error / failed などの文字が含まれる行はありません。' });
    }
    if (parsed.columns.length > 20) {
      blocks.push({
        type: 'notice',
        level: 'info',
        title: '列が多いため一部だけ表示しています',
        text: `全 ${parsed.columns.length} 列のうち先頭 20 列を表示しています。すべての列はダウンロードした TSV に含まれます。`,
      });
    }

    return result(
      'log',
      parsed.label,
      '表にしました',
      blocks,
      [dl('Excel 用（タブ区切り）', 'log.tsv', toTsv(parsed.columns, parsed.rows), 'text/tab-separated-values')],
    );
  },
  fixtures: [
    {
      name: 'Apache combined',
      input:
        '192.0.2.1 - - [12/Nov/2026:10:00:00 +0900] "GET /a HTTP/1.1" 200 123 "-" "Mozilla/5.0"\n192.0.2.2 - - [12/Nov/2026:10:00:01 +0900] "GET /b HTTP/1.1" 404 0 "-" "curl/8"\n192.0.2.3 - - [12/Nov/2026:10:00:02 +0900] "POST /c HTTP/1.1" 500 9 "-" "curl/8"',
      expect: { score: 90 },
    },
    {
      name: 'syslog',
      input:
        'Nov 12 10:00:00 host postfix/smtp[123]: ABC: to=<a@example.com>, status=bounced\nNov 12 10:00:01 host postfix/qmgr[9]: ABC: removed\nNov 12 10:00:02 host sshd[10]: Accepted publickey for user',
      expect: { score: 90 },
    },
  ],
};
