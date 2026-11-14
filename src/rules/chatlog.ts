import type { ClassifierRule } from '../types.ts';
import { detectChatLog, parseChatLog, toMarkdown, toTsv, toolSummary } from '../lib/chatlog.ts';
import { dl, result } from './_help.ts';

const MAX_TURN_ROWS = 80;
const MAX_COMMANDS = 40;

export const chatLogRule: ClassifierRule = {
  id: 'chatlog',
  layer: 'classifier',
  appliesTo: 'text',
  label: '会話ログ',
  // 会話ログは markdown / log / code にも当たりうるので、同点なら必ずこちらを採る
  weight: 45,
  detect(ctx) {
    const d = detectChatLog(ctx.text);
    if (!d) return null;
    const kinds = d.copilot ? 'GitHub Copilot の会話ログ' : 'AI アシスタントの会話ログ';
    return {
      score: d.score,
      confidence: d.score >= 86 ? 'high' : 'medium',
      title: kinds,
      summary: `会話の生ログです（発言 ${d.speakerLines} 件・道具の実行 ${d.toolCalls} 回）。発言ごとに区切って、何をしたかを一覧にしました。`,
      evidence: [
        `「User:」「${d.copilot ? 'GitHub Copilot' : 'Assistant'}:」の行が ${d.speakerLines} 件`,
        `道具の実行行が ${d.toolCalls} 件`,
        d.copilot ? 'GitHub Copilot Chat の書き出しと一致' : '会話の生ログの形と一致',
      ],
    };
  },
  transform(ctx) {
    const log = parseChatLog(ctx.text);
    const userN = log.turns.filter((t) => t.speaker === 'user').length;
    const aiN = log.turns.length - userN;

    const blocks: Parameters<typeof result>[3] = [
      {
        type: 'kv',
        title: '会話の概要',
        items: [
          { k: '形式', v: log.copilot ? 'GitHub Copilot Chat の生ログ' : 'AI アシスタントの会話ログ' },
          { k: '発言', v: `${log.turns.length} 件（あなた ${userN} / AI ${aiN}）` },
          { k: '道具の実行', v: `${log.toolCalls.toLocaleString('ja-JP')} 回` },
          {
            k: 'やったことの内訳',
            v: log.toolStats.length ? toolSummary(log.toolStats, 6) : 'なし',
          },
          { k: '分量', v: `${log.lines.toLocaleString('ja-JP')} 行 / ${log.chars.toLocaleString('ja-JP')} 文字` },
        ],
      },
    ];

    if (log.turns.length) {
      blocks.push({
        type: 'table',
        title: `発言の一覧（${log.turns.length} 件）`,
        columns: ['#', '話者', '内容', '道具'],
        rows: log.turns.slice(0, MAX_TURN_ROWS).map((t, i) => [
          String(i + 1),
          t.label,
          t.summary || '—',
          t.tools.length ? `${t.tools.length} 回（${[...new Set(t.tools.map((x) => x.kind))].join('・')}）` : '—',
        ]),
        note:
          log.turns.length > MAX_TURN_ROWS
            ? `多いため先頭 ${MAX_TURN_ROWS} 件だけ表示しています。全部は「発言一覧（Excel 用）」に含まれます。`
            : '「内容」は各発言の最初の 1 文です。',
      });
    }

    if (log.toolStats.length) {
      blocks.push({
        type: 'table',
        title: 'やったこと（道具の内訳）',
        columns: ['種類', '回数', '例'],
        rows: log.toolStats.map((s) => [s.kind, String(s.count), s.example || '—']),
        note: '「例」は最初に見つかった 1 件です。コマンドの中身は下の欄にまとめています。',
      });
    }

    if (log.commands.length) {
      const lines = log.commands
        .slice(0, MAX_COMMANDS)
        .map((c) => `#${c.n}  ${c.text}`)
        .join('\n');
      blocks.push({
        type: 'code',
        text: lines,
        lang: 'shell',
      });
      if (log.commands.length > MAX_COMMANDS) {
        blocks.push({
          type: 'notice',
          level: 'info',
          title: 'コマンドが多いため一部だけ表示しています',
          text: `全 ${log.commands.length} 件のうち先頭 ${MAX_COMMANDS} 件です。「整形した会話ログ」にはすべて含まれます。`,
        });
      }
    }

    // 本文（整形した会話）。大きすぎるときは画面に出さずダウンロードに任せる
    if (log.chars <= 200_000) {
      blocks.push({ type: 'markdown', text: toMarkdown(log, 2500) });
    } else {
      blocks.push({
        type: 'notice',
        level: 'info',
        title: '本文は画面に出していません',
        text: '長いログのため、整形した本文は「整形した会話ログ（Markdown）」から保存してください。上の一覧で流れは追えます。',
      });
    }

    blocks.push({
      type: 'notice',
      level: 'info',
      title: 'そのまま共有する前に',
      text: 'この種のログには、ファイルの場所（C:\\Users\\名前 など）・接続先・APIキー・メールアドレスが写りやすいです。「機密情報をマスク」をオンにすると、利用者名・メール・キー・IP などを伏せた状態で表示・コピー・保存できます。',
    });

    if (log.truncated) {
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: '長いため途中までを解析しました',
        text: `先頭 ${(2_000_000).toLocaleString('ja-JP')} 文字だけを見ています。全体は ${log.chars.toLocaleString('ja-JP')} 文字です。`,
      });
    }

    return result(
      'chatlog',
      log.copilot ? 'GitHub Copilot の会話ログ' : 'AI アシスタントの会話ログ',
      '発言ごとに区切り、やったことを一覧にしました',
      blocks,
      [
        dl('整形した会話ログ（Markdown）', 'chatlog.md', toMarkdown(log), 'text/markdown;charset=utf-8'),
        dl('発言一覧（Excel 用）', 'chatlog-turns.tsv', toTsv(log), 'text/tab-separated-values;charset=utf-8'),
      ],
    );
  },
  fixtures: [
    {
      name: 'GitHub Copilot Chat の生ログ',
      input: [
        'User: サーバーが重い原因を調べてください',
        '',
        'GitHub Copilot: まず状況を確認します。',
        '',
        'Ran terminal command:  systemctl status nginx',
        'Active: inactive (dead) でした。',
        'Read [](), lines 1 to 40',
        'Searched for regex `worker_processes` (`nginx.conf`), 1 result',
        'Created []()',
        'Made changes.',
        '',
        'User: ありがとう。設定も直して',
        '',
        'GitHub Copilot: 直しました。',
        'Ran terminal command:  sudo nginx -t',
        'Ran terminal command:  sudo systemctl restart nginx',
        'Checked terminal output',
      ].join('\n'),
      expect: { score: 96 },
    },
    {
      name: 'Copilot 以外の会話ログ（Human/Assistant）',
      input: [
        'Human: テストが落ちています。原因を教えて',
        '',
        'Assistant: 調べます。',
        'Read src/app.ts',
        'Searched for regex "timeout"',
        'Ran terminal command: npm test',
        '',
        'Human: 直してください',
        '',
        'Assistant: 直しました。',
        'Read src/app.ts',
        'Edited src/app.ts',
        'Ran terminal command: npm test',
      ].join('\n'),
      expect: { score: 86 },
    },
  ],
};
