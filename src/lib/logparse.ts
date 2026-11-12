/** ログの解析（web / CDN / syslog / メール）。表にできる形にそろえる。 */

import { parseDateTime, toJst, toJstOrRaw } from './datetime.ts';

export interface LogTable {
  id: string;
  label: string;
  columns: string[];
  rows: string[][];
  matched: number;
  total: number;
  errors: string[];
  note?: string;
}

const MAX_ROWS = 500;

/** Combined / Common Log Format */
function tryAccessLog(lines: string[]): LogTable | null {
  const re = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?(?:\s+(\S+))?/;
  const rows: string[][] = [];
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const [, ip, user, , time, req, status, size, ref, ua, extra] = m;
    const [method = '', ...rest] = (req ?? '').split(' ');
    const path = rest.join(' ');
    rows.push([
      toJstOrRaw(time ?? ''),
      ip ?? '',
      method,
      path,
      status ?? '',
      size ?? '',
      ref ?? '',
      ua ?? '',
      extra ?? '',
      user && user !== '-' ? user : '',
    ]);
  }
  if (rows.length < 3) return null;
  return {
    id: 'access',
    label: 'Web サーバーのアクセスログ',
    columns: ['日時', '接続元IP', 'メソッド', 'パス', '状態', 'バイト数', 'リファラ', 'ユーザーエージェント', '応答時間', 'ユーザー'],
    rows,
    matched: rows.length,
    total: lines.length,
    errors: lines.filter((l) => /"\s(?:4|5)\d{2}\s/.test(l)).slice(0, 50),
  };
}

/** CloudFront 標準ログ（タブ区切り） */
function tryCloudFront(lines: string[]): LogTable | null {
  const fieldLine = lines.find((l) => l.startsWith('#Fields:'));
  const data = lines.filter((l) => l && !l.startsWith('#'));
  if (data.length < 3) return null;
  const first = data[0]!.split('\t');
  if (first.length < 10) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first[0] ?? '')) return null;

  const fields = fieldLine
    ? fieldLine.replace('#Fields:', '').trim().split(/\s+/)
    : ['date', 'time', 'x-edge-location', 'sc-bytes', 'c-ip', 'cs-method', 'cs-host', 'cs-uri-stem', 'sc-status', 'cs-referer', 'cs-user-agent', 'cs-uri-query', 'cs-cookie', 'x-edge-result-type', 'x-edge-request-id', 'x-host-header', 'cs-protocol', 'cs-bytes', 'time-taken'];
  const JA: Record<string, string> = {
    'date': '日付', 'time': '時刻', 'x-edge-location': '配信拠点', 'sc-bytes': '送信バイト', 'c-ip': '接続元IP',
    'cs-method': 'メソッド', 'cs-host': 'ホスト', 'cs-uri-stem': 'パス', 'sc-status': '状態', 'cs-referer': 'リファラ',
    'cs-user-agent': 'ユーザーエージェント', 'cs-uri-query': 'クエリ', 'x-edge-result-type': '結果', 'time-taken': '処理時間(秒)',
    'cs-protocol': 'プロトコル', 'cs-bytes': '受信バイト',
  };
  const rows = data.map((l) => l.split('\t').map((v) => (v === '-' ? '' : v)));
  const idx = (name: string) => fields.indexOf(name);
  const statusI = idx('sc-status');
  const dateI = idx('date');
  const timeI = idx('time');
  if (dateI >= 0) {
    // CloudFront の日時は UTC
    for (const row of rows) {
      const d = parseDateTime(`${row[dateI] ?? ''} ${row[timeI] ?? ''}`, { assume: 'UTC' });
      if (d && !Number.isNaN(d.getTime())) {
        row[dateI] = toJst(d);
        if (timeI >= 0) row[timeI] = '';
      }
    }
  }
  return {
    id: 'cloudfront',
    label: 'CloudFront（CDN）のログ',
    columns: fields.map((f) => JA[f] ?? f),
    rows: rows.slice(0, MAX_ROWS),
    matched: rows.length,
    total: data.length,
    errors:
      statusI >= 0
        ? data.filter((l) => /^(?:4|5)\d{2}$/.test(l.split('\t')[statusI] ?? '')).slice(0, 50)
        : [],
    note: rows.length > MAX_ROWS ? `多いため先頭 ${MAX_ROWS} 行を表示しています（ダウンロードは全件）` : undefined,
  };
}

/** syslog / postfix などのメールログ */
function trySyslog(lines: string[]): LogTable | null {
  const re = /^([A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (\S+) ([^\s:\[]+)(?:\[(\d+)\])?: (.*)$/;
  const rows: string[][] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const [, time, host, proc, pid, msg] = m;
    rows.push([toJstOrRaw(time!), host!, proc!, pid ?? '', msg!]);
    if (/(error|fatal|failed|rejected|denied|timeout|bounce|status=(?:bounced|deferred)|warning)/i.test(msg!))
      errors.push(line);
  }
  if (rows.length < 3) return null;
  return {
    id: 'syslog',
    label: 'システムログ（syslog / メールログ）',
    columns: ['日時', 'ホスト', 'プロセス', 'PID', 'メッセージ'],
    rows: rows.slice(0, MAX_ROWS),
    matched: rows.length,
    total: lines.length,
    errors: errors.slice(0, 50),
    note: '日時に年がありません（syslog の仕様）。表示はログのままです',
  };
}

/** Apache / nginx のエラーログ */
function tryErrorLog(lines: string[]): LogTable | null {
  const re = /^\[([^\]]+)\] \[([a-z]+)\](?: \[(?:client|pid) ([^\]]+)\])? (.*)$/;
  const rows: string[][] = [];
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    rows.push([toJstOrRaw(m[1]!), m[2]!, m[3] ?? '', m[4]!]);
  }
  if (rows.length < 3) return null;
  return {
    id: 'errorlog',
    label: 'Web サーバーのエラーログ',
    columns: ['日時', 'レベル', 'クライアント', 'メッセージ'],
    rows: rows.slice(0, MAX_ROWS),
    matched: rows.length,
    total: lines.length,
    errors: rows.filter((r) => /error|crit|alert|emerg/i.test(r[1]!)).map((r) => r.join(' | ')).slice(0, 50),
  };
}

/** key=value 形式（logfmt） */
function tryLogfmt(lines: string[]): LogTable | null {
  const parsed: Record<string, string>[] = [];
  for (const line of lines) {
    if (!/=/.test(line)) continue;
    const obj: Record<string, string> = {};
    for (const m of line.matchAll(/([A-Za-z_][\w.-]*)=("([^"]*)"|\S+)/g)) {
      obj[m[1]!] = m[3] ?? m[2]!;
    }
    if (Object.keys(obj).length < 2) continue;
    parsed.push(obj);
  }
  if (parsed.length < 3) return null;
  const columns = [...new Set(parsed.flatMap((o) => Object.keys(o)))].slice(0, 16);
  return {
    id: 'logfmt',
    label: 'アプリケーションログ（key=value 形式）',
    columns,
    rows: parsed.slice(0, MAX_ROWS).map((o) => columns.map((c) => o[c] ?? '')),
    matched: parsed.length,
    total: lines.length,
    errors: lines.filter((l) => /\b(level|severity)=(error|fatal|warn)|\b(error|fatal):/.test(l)).slice(0, 50),
  };
}

export function parseLogs(text: string): LogTable | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 3) return null;
  return tryCloudFront(lines) ?? tryAccessLog(lines) ?? tryErrorLog(lines) ?? trySyslog(lines) ?? tryLogfmt(lines);
}

/** TSV 用にタブ・改行をエスケープ */
export function toTsv(columns: string[], rows: string[][]): string {
  const esc = (v: string) => v.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  return [columns, ...rows].map((r) => r.map(esc).join('\t')).join('\n');
}

/** 配列を縦横変換する（行と列を入れ替える） */
export function transpose(rows: string[][]): string[][] {
  const width = Math.max(...rows.map((r) => r.length), 0);
  const out: string[][] = [];
  for (let c = 0; c < width; c++) out.push(rows.map((r) => r[c] ?? ''));
  return out;
}
