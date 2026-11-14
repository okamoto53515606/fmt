/**
 * AI アシスタント（GitHub Copilot Chat / Claude Code など）の会話ログを読み解く。
 *
 * 生ログは「話者の行」と「道具の実行行」が延々と並ぶだけで、人が読むには向かない。
 * ここでは発言ごとに区切り、何を頼まれて何をしたのかを一覧にする。
 * 解析だけを担当し、表示は src/rules/chatlog.ts が行う。
 */

export type Speaker = 'user' | 'assistant';

export interface ToolCall {
  /** 日本語の分類（コマンド実行 / ファイル読み取り など） */
  kind: string;
  /** 画面に出す補足（コマンドそのものなど）。無いこともある */
  detail: string;
}

export interface ChatTurn {
  speaker: Speaker;
  label: string;
  /** 発言の本文（道具の実行行も含む） */
  text: string;
  /** 一覧に出す 1 行（意味のある最初の行） */
  summary: string;
  tools: ToolCall[];
  lines: number;
  chars: number;
}

export interface ToolStat {
  kind: string;
  count: number;
  example: string;
}

export interface CommandEntry {
  /** 何番目の発言か（1 始まり） */
  n: number;
  text: string;
}

export interface ChatLog {
  copilot: boolean;
  speakerLines: number;
  toolCalls: number;
  turns: ChatTurn[];
  toolStats: ToolStat[];
  commands: CommandEntry[];
  lines: number;
  chars: number;
  truncated: boolean;
}

/** 解析する上限。これを超えたら先頭だけ見る（数MBのログで固まらないように） */
const MAX_CHARS = 2_000_000;

/**
 * 話者の行。行頭から始まるものだけを話者とみなす
 * （本文中に引用された "User:" を拾わないため、前後の空白は許さない）。
 */
const SPEAKER = /^(User|Human|You|GitHub Copilot|Copilot|Assistant)\s*[:：]\s?(.*)$/;

/** 話者ではないが、行の区切りとして扱うノイズ */
const NOISE = /^(?:\[Terminal |\[object Object\]|Terminal output:|To https?:|warning: LF will be replaced)/;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 道具の実行行かどうか。実行行なら分類を返す */
export function toolOf(line: string): ToolCall | null {
  const t = line.trim();
  if (!t) return null;
  const first = t.charCodeAt(0);
  // 速い足切り: 道具の行は必ず英大文字で始まる
  if (first < 65 || first > 90) return null;

  const colon = t.indexOf(':');
  const afterColon = colon >= 0 ? t.slice(colon + 1).trim() : '';

  if (t.startsWith('Ran terminal command')) return { kind: 'コマンド実行', detail: clip(afterColon, 160) };
  if (/^(Clicked|Navigated|Captured|Hovered|Typed|Dragged|Opened)\b/.test(t)) return { kind: 'ブラウザ操作', detail: '' };
  if (/^Ran (Playwright|Browser)\b/.test(t)) return { kind: 'ブラウザ操作', detail: '' };
  if (/^(Ran Brave|Ran Firecrawl|Ran .*(search|Search))/.test(t)) return { kind: 'Web 検索', detail: clip(t, 120) };
  if (t.startsWith('Fetched ')) return { kind: 'Web 取得', detail: clip(t, 120) };
  if (/^(Read|Viewing)\b/.test(t)) return { kind: 'ファイル読み取り', detail: '' };
  if (/^(Created|Wrote)\b/.test(t)) return { kind: 'ファイル作成', detail: '' };
  if (/^(Edited|Replacing|Replaced|Inserted|Removed|Made changes)/.test(t)) return { kind: 'ファイル編集', detail: '' };
  if (/^(Searched|Searching|Grep|Find)/.test(t)) return { kind: '検索', detail: '' };
  if (/^Viewed /.test(t)) return { kind: '画像の表示', detail: '' };
  if (/^(Checked terminal output|Tool execution failed|Tool execution failed with exit code)/.test(t))
    return { kind: '確認・失敗', detail: '' };
  if (t.startsWith('Ran ')) return { kind: 'その他の実行', detail: clip(t, 120) };
  if (/^Continue to iterate\?/.test(t)) return { kind: '継続の確認', detail: '' };
  return null;
}

/** 一覧に出す 1 行を選ぶ（道具の行・通知・空行は飛ばす） */
function summaryOf(lines: string[]): string {
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (NOISE.test(t)) continue;
    if (/^(Terminal|Output|Exit Code|Cwd|Last Command):/.test(t)) continue;
    if (toolOf(t)) continue;
    return clip(t.replace(/\s+/g, ' '), 160);
  }
  const first = lines.find((l) => l.trim())?.trim();
  return clip((first ?? '').replace(/\s+/g, ' '), 160);
}

/** 会話ログらしさを判定する。判定できなければ null */
export function detectChatLog(
  text: string,
): { score: number; copilot: boolean; speakerLines: number; toolCalls: number } | null {
  if (text.length < 60) return null;
  const head = text.length > MAX_CHARS * 2 ? text.slice(0, MAX_CHARS * 2) : text;
  const lines = head.split(/\r?\n/);

  let speakers = 0;
  let tools = 0;
  let copilot = false;

  for (const line of lines) {
    if (!line) continue;
    const m = SPEAKER.exec(line);
    if (m) {
      speakers++;
      if (/copilot/i.test(m[1]!)) copilot = true;
      // 十分な証拠が出たら打ち切る（巨大ログでもすぐ返す）
      if (speakers >= 6 && tools >= 4) break;
      continue;
    }
    if (toolOf(line)) {
      tools++;
      if (speakers >= 6 && tools >= 4) break;
    }
  }

  if (copilot && tools >= 2) return { score: 96, copilot, speakerLines: speakers, toolCalls: tools };
  if (copilot && speakers >= 2 && tools >= 1) return { score: 84, copilot, speakerLines: speakers, toolCalls: tools };
  if (copilot && speakers >= 3) return { score: 90, copilot, speakerLines: speakers, toolCalls: tools };
  if (speakers >= 4 && tools >= 3) return { score: 86, copilot, speakerLines: speakers, toolCalls: tools };
  if (speakers >= 5 && tools >= 1) return { score: 72, copilot, speakerLines: speakers, toolCalls: tools };
  return null;
}

/** 会話ログを発言ごとに分ける */
export function parseChatLog(input: string): ChatLog {
  const truncated = input.length > MAX_CHARS;
  const text = truncated ? input.slice(0, MAX_CHARS) : input;
  const lines = text.split(/\r?\n/);

  const turns: ChatTurn[] = [];
  let cur: { speaker: Speaker; label: string; lines: string[] } | null = null;

  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join('\n');
    const tools: ToolCall[] = [];
    for (const l of cur.lines) {
      const t = toolOf(l);
      if (t) tools.push(t);
    }
    turns.push({
      speaker: cur.speaker,
      label: cur.label,
      text: body,
      summary: summaryOf(cur.lines),
      tools,
      lines: cur.lines.length,
      chars: body.length,
    });
  };

  for (const line of lines) {
    const m = SPEAKER.exec(line);
    if (m) {
      flush();
      const who = m[1]!;
      const isUser = /^(user|human|you)$/i.test(who);
      cur = {
        speaker: isUser ? 'user' : 'assistant',
        label: isUser ? 'あなた（User）' : /copilot/i.test(who) ? 'GitHub Copilot' : 'AI アシスタント',
        lines: m[2] ? [m[2]] : [],
      };
      continue;
    }
    cur ??= { speaker: 'assistant', label: '（前置き）', lines: [] };
    cur.lines.push(line);
  }
  flush();

  // 道具の内訳
  const byKind = new Map<string, ToolStat>();
  const commands: CommandEntry[] = [];
  let toolCalls = 0;
  turns.forEach((t, i) => {
    for (const tool of t.tools) {
      toolCalls++;
      const s = byKind.get(tool.kind);
      if (s) s.count++;
      else byKind.set(tool.kind, { kind: tool.kind, count: 1, example: tool.detail });
      if (tool.kind === 'コマンド実行' && tool.detail) commands.push({ n: i + 1, text: tool.detail });
    }
  });

  const toolStats = [...byKind.values()].sort((a, b) => b.count - a.count);
  const copilot = turns.some((t) => t.label === 'GitHub Copilot');

  return {
    copilot,
    speakerLines: turns.length,
    toolCalls,
    turns,
    toolStats,
    commands,
    lines: lines.length,
    chars: input.length,
    truncated,
  };
}

/** 「コマンド実行 12 / ファイル読み取り 30」のような 1 行 */
export function toolSummary(tools: ToolStat[], limit = 4): string {
  return tools
    .slice(0, limit)
    .map((t) => `${t.kind} ${t.count}`)
    .join(' / ');
}

/** 人が読める形（Markdown）に組み直す。ダウンロード用 */
export function toMarkdown(log: ChatLog, maxPerTurn = 4000): string {
  const userN = log.turns.filter((t) => t.speaker === 'user').length;
  const out: string[] = [];
  out.push('# 会話ログ（整形）');
  out.push('');
  out.push(`- 発言: ${log.turns.length}（あなた ${userN} / AI ${log.turns.length - userN}）`);
  out.push(`- 道具の実行: ${log.toolCalls} 回`);
  if (log.toolStats.length) out.push(`- 内訳: ${toolSummary(log.toolStats, 8)}`);
  out.push(`- 元の分量: ${log.lines.toLocaleString('ja-JP')} 行 / ${log.chars.toLocaleString('ja-JP')} 文字`);
  out.push('');

  log.turns.forEach((t, i) => {
    out.push(`## ${i + 1}. ${t.label}`);
    out.push('');
    if (t.tools.length) {
      const kinds = [...new Set(t.tools.map((x) => x.kind))].join('・');
      out.push(`> やったこと（${t.tools.length} 回）: ${kinds}`);
      out.push('');
    }
    const body = t.text.trim();
    if (!body) {
      out.push('_（本文なし）_');
    } else if (body.length > maxPerTurn) {
      out.push(body.slice(0, maxPerTurn));
      out.push('');
      out.push(`_…以降 ${(body.length - maxPerTurn).toLocaleString('ja-JP')} 文字を省略_`);
    } else {
      out.push(body);
    }
    out.push('');
    out.push('---');
    out.push('');
  });
  return out.join('\n');
}

/** 発言一覧の TSV（Excel に貼れる） */
export function toTsv(log: ChatLog): string {
  const rows = [['#', '話者', '内容', '道具の回数', '道具の種類', '行数']];
  log.turns.forEach((t, i) => {
    rows.push([
      String(i + 1),
      t.label,
      t.summary,
      String(t.tools.length),
      [...new Set(t.tools.map((x) => x.kind))].join('・'),
      String(t.lines),
    ]);
  });
  return rows.map((r) => r.map((c) => c.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t')).join('\n');
}
