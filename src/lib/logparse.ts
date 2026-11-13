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
  if (rows.length < 1) return null;
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

/** IIS（W3C 拡張ログ）。空白区切りで、先頭に #Fields: がある。 */
function tryIis(lines: string[]): LogTable | null {
  const fieldLine = lines.find((l) => l.startsWith('#Fields:'));
  if (!fieldLine) return null;
  const fields = fieldLine.replace('#Fields:', '').trim().split(/\s+/);
  if (!fields.includes('cs-method') || !fields.includes('sc-status')) return null;
  if (!fields.includes('date') || !fields.includes('time')) return null;
  // CloudFront はタブ区切りなので、タブがあればそちらの担当
  const data = lines.filter((l) => l && !l.startsWith('#'));
  if (data.length < 1) return null;
  if (data[0]!.includes('\t')) return null;

  const JA: Record<string, string> = {
    'date': '日付（UTC）', 'time': '時刻（UTC）', 's-ip': 'サーバーIP', 'cs-method': 'メソッド',
    'cs-uri-stem': 'パス', 'cs-uri-query': 'クエリ', 's-port': 'ポート', 'cs-username': 'ユーザー',
    'c-ip': '接続元IP', 'cs(User-Agent)': 'ユーザーエージェント', 'cs(Referer)': 'リファラ',
    'sc-status': '状態', 'sc-substatus': '副状態', 'sc-win32-status': 'Win32状態', 'time-taken': '処理時間(ms)',
    'cs-host': 'ホスト', 'sc-bytes': '送信バイト', 'cs-bytes': '受信バイト',
  };
  const dateI = fields.indexOf('date');
  const timeI = fields.indexOf('time');
  const statusI = fields.indexOf('sc-status');

  const rows: string[][] = [];
  const errors: string[] = [];
  for (const line of data) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const row = parts.slice(0, fields.length);
    while (row.length < fields.length) row.push('');
    // 日時は UTC。JST に直して 1 列にまとめる
    const d = parseDateTime(`${row[dateI] ?? ''} ${row[timeI] ?? ''}`, { assume: 'UTC' });
    row[dateI] = d && !Number.isNaN(d.getTime()) ? toJst(d) : `${row[dateI]} ${row[timeI]}`;
    row[timeI] = '';
    // IIS の User-Agent は + 区切り
    const uaI = fields.indexOf('cs(User-Agent)');
    if (uaI >= 0) row[uaI] = (row[uaI] ?? '').replace(/\+/g, ' ');
    rows.push(row);
    if (statusI >= 0 && /^(?:4|5)\d{2}$/.test(row[statusI] ?? '')) errors.push(line);
  }
  if (rows.length < 1) return null;
  return {
    id: 'iis',
    label: 'IIS（Windows サーバー）のアクセスログ',
    columns: fields.map((f) => JA[f] ?? f),
    rows: rows.slice(0, MAX_ROWS),
    matched: rows.length,
    total: data.length,
    errors: errors.slice(0, 50),
    note: rows.length > MAX_ROWS ? `多いため先頭 ${MAX_ROWS} 行を表示しています（ダウンロードは全件）` : undefined,
  };
}

/** Squid（プロキシ）のログ。native 形式と combined 形式の両方。 */
function trySquid(lines: string[]): LogTable | null {
  const native =
    /^(\d{10}(?:\.\d+)?)\s+(\d+)\s+(\S+)\s+([A-Z_]+)\/(\d{3})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/;
  const combined = /^(\S+) (\S+) (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+) "([^"]*)" "([^"]*)" (\S+)/;

  const nativeRows: string[][] = [];
  const nativeErrors: string[] = [];
  for (const line of lines) {
    const m = native.exec(line);
    if (!m) continue;
    const [, ts, elapsed, client, result, status, bytes, method, url, user, peer, type] = m;
    const d = new Date(Math.round(Number(ts) * 1000));
    nativeRows.push([
      Number.isNaN(d.getTime()) ? ts! : toJst(d),
      elapsed!,
      client!,
      result!,
      status!,
      bytes!,
      method!,
      url!,
      user && user !== '-' ? user : '',
      peer!,
      type ?? '',
    ]);
    if (/^(?:4|5)\d{2}$/.test(status!) || /DENIED/.test(result!)) nativeErrors.push(line);
  }
  if (nativeRows.length >= 1) {
    return {
      id: 'squid',
      label: 'Squid（プロキシ）のログ',
      columns: ['日時', '処理時間(ms)', '接続元IP', '結果', '状態', 'バイト数', 'メソッド', 'URL', 'ユーザー', '転送先', '種類'],
      rows: nativeRows.slice(0, MAX_ROWS),
      matched: nativeRows.length,
      total: lines.length,
      errors: nativeErrors.slice(0, 50),
    };
  }

  const combinedRows: string[][] = [];
  const combinedErrors: string[] = [];
  for (const line of lines) {
    const m = combined.exec(line);
    if (!m) continue;
    const [, ip, user, , time, req, status, bytes, ref, ua, result] = m;
    if (!/^TCP_/.test(result!)) continue;
    const [method = '', ...rest] = (req ?? '').split(' ');
    combinedRows.push([
      toJstOrRaw(time ?? ''),
      ip ?? '',
      user && user !== '-' ? user : '',
      method,
      rest.join(' '),
      status ?? '',
      bytes ?? '',
      ref && ref !== '-' ? ref : '',
      ua ?? '',
      result!,
    ]);
    if (/^(?:4|5)\d{2}$/.test(status ?? '')) combinedErrors.push(line);
  }
  if (combinedRows.length < 1) return null;
  return {
    id: 'squid',
    label: 'Squid（プロキシ）のログ',
    columns: ['日時', '接続元IP', 'ユーザー', 'メソッド', 'URL', '状態', 'バイト数', 'リファラ', 'ユーザーエージェント', '結果'],
    rows: combinedRows.slice(0, MAX_ROWS),
    matched: combinedRows.length,
    total: lines.length,
    errors: combinedErrors.slice(0, 50),
  };
}

/** HAProxy の HTTP ログ */
function tryHaproxy(lines: string[]): LogTable | null {
  const re =
    /^([A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (\S+) haproxy\[(\d+)\]: (\S+?):(\d+) \[([^\]]+)\] (\S+) (\S+) ([\d/]+) (\d{3}) (\d+) (.*)$/;
  const rows: string[][] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const m = re.exec(line);
    if (!m) continue;
    const [, time, , , client, port, reqTime, front, backend, timers, status, bytes, rest] = m;
    const reqMatch = /"([^"]*)"/.exec(rest ?? '');
    const req = reqMatch?.[1] ?? '';
    const [method = '', ...pathRest] = req.split(' ');
    const t = (timers ?? '').split('/');
    // Tq/Tw/Tc/Tr/Ta の最後（合計に近い値）
    const total = t[t.length - 1] ?? '';
    rows.push([
      toJstOrRaw(time!),
      `${client}:${port}`,
      front!,
      backend!,
      total ? `${total} ms` : '',
      status!,
      bytes!,
      method,
      pathRest.join(' '),
      reqTime ?? '',
    ]);
    if (/^(?:4|5)\d{2}$/.test(status!)) errors.push(line);
  }
  if (rows.length < 1) return null;
  return {
    id: 'haproxy',
    label: 'HAProxy（ロードバランサー）のログ',
    columns: ['日時', '接続元', '受付', '転送先', '応答時間', '状態', 'バイト数', 'メソッド', 'パス', '受付日時'],
    rows: rows.slice(0, MAX_ROWS),
    matched: rows.length,
    total: lines.length,
    errors: errors.slice(0, 50),
    note: '日時は syslog の部分（年なし）を補って表示しています。正確な日時は「受付日時」列を見てください',
  };
}

/** CloudFront 標準ログ（タブ区切り） */
function tryCloudFront(lines: string[]): LogTable | null {
  const fieldLine = lines.find((l) => l.startsWith('#Fields:'));
  const data = lines.filter((l) => l && !l.startsWith('#'));
  if (data.length < 1) return null;
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
  if (rows.length < 1) return null;
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
  if (rows.length < 1) return null;
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
  if (lines.length < 1) return null;
  return (
    tryIis(lines) ??
    tryCloudFront(lines) ??
    trySquid(lines) ??
    tryHaproxy(lines) ??
    tryAccessLog(lines) ??
    tryErrorLog(lines) ??
    trySyslog(lines) ??
    tryLogfmt(lines)
  );
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
