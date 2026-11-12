/** 日時の表示（日本時間）と、英語表記の日時の解析。 */

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const TZ = 'Asia/Tokyo';

export function toJst(d: Date): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}年${get('month')}月${get('day')}日(${get('weekday')}) ${get('hour')}:${get('minute')}:${get('second')} JST`;
}

export function toIsoUtc(d: Date): string {
  return d.toISOString();
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * よくある日時表記を Date にする。
 * タイムゾーンの記載が無いものは assume（既定は日本時間）として扱う。
 * 例: RFC1123(GMT) / Apache / CloudFront / ISO8601 / EXIF / 日本式 / syslog
 */
export function parseDateTime(input: string, opts: { assume?: 'JST' | 'UTC'; nowYear?: number } = {}): Date | null {
  const t = input.trim();
  if (!t) return null;
  const offset = opts.assume === 'UTC' ? '+00:00' : '+09:00';
  const year = opts.nowYear ?? new Date().getFullYear();

  // RFC 1123 / HTTP-date: Wed, 12 Nov 2026 10:00:00 GMT
  let m = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|Z|[+-]\d{2}:?\d{2})$/i.exec(t);
  if (m) {
    const tzRaw = m[7]!.toUpperCase();
    const tz = tzRaw === 'GMT' || tzRaw === 'UTC' || tzRaw === 'Z' ? 'Z' : tzRaw.length === 5 ? `${tzRaw.slice(0, 3)}:${tzRaw.slice(3)}` : tzRaw;
    return new Date(
      `${m[3]}-${String(MONTH_INDEX[m[2]!.toLowerCase()]! + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}T${m[4]}:${m[5]}:${m[6] ?? '00'}${tz}`,
    );
  }

  // Apache error log / asctime: Wed Oct 11 14:32:52 2000
  m = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/.exec(t);
  if (m) {
    return new Date(`${m[6]}-${String(MONTH_INDEX[m[1]!.toLowerCase()]! + 1).padStart(2, '0')}-${m[2]!.padStart(2, '0')}T${m[3]}:${m[4]}:${m[5]}${offset}`);
  }

  // Apache access log: 12/Nov/2026:10:00:00 +0900
  m = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{2}:?\d{2})?$/.exec(t);
  if (m) {
    const tzRaw = m[7];
    const tz = tzRaw ? (tzRaw.length === 5 ? `${tzRaw.slice(0, 3)}:${tzRaw.slice(3)}` : tzRaw) : offset;
    return new Date(`${m[3]}-${String(MONTH_INDEX[m[2]!.toLowerCase()]! + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}T${m[4]}:${m[5]}:${m[6]}${tz}`);
  }

  // ISO 8601 / CloudFront / 日本式 / EXIF
  m = /^(\d{4})[-/:](\d{2})[-/:](\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(t);
  if (m) {
    const tzRaw = m[7];
    const tz = tzRaw ? (tzRaw.length === 5 ? `${tzRaw.slice(0, 3)}:${tzRaw.slice(3)}` : tzRaw) : offset;
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}${tz}`);
  }

  // syslog: Nov 12 10:00:00（年なし）
  m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(t);
  if (m) {
    return new Date(`${year}-${String(MONTH_INDEX[m[1]!.toLowerCase()]! + 1).padStart(2, '0')}-${m[2]!.padStart(2, '0')}T${m[3]}:${m[4]}:${m[5]}${offset}`);
  }

  return null;
}

/** 変換できたら日本時間の表示、できなければ元の文字列を返す */
export function toJstOrRaw(input: string, opts: { assume?: 'JST' | 'UTC' } = {}): string {
  const d = parseDateTime(input, opts);
  return d && !Number.isNaN(d.getTime()) ? toJst(d) : input;
}


/** 相対時間（「3日前」など） */
export function relative(d: Date, now = Date.now()): string {
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const units: [number, string][] = [
    [1000 * 60 * 60 * 24 * 365, '年'],
    [1000 * 60 * 60 * 24 * 30, 'か月'],
    [1000 * 60 * 60 * 24, '日'],
    [1000 * 60 * 60, '時間'],
    [1000 * 60, '分'],
    [1000, '秒'],
  ];
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      return future ? `${n}${label}後` : `${n}${label}前`;
    }
  }
  return 'たった今';
}

export interface FoundDate {
  raw: string;
  date: Date;
  kind: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** 本文から日時らしいものを拾う */
export function findDates(text: string): FoundDate[] {
  const out: FoundDate[] = [];
  const push = (raw: string, d: Date | null, kind: string) => {
    if (d && !Number.isNaN(d.getTime())) out.push({ raw, date: d, kind });
  };

  // ISO 8601（Z / +09:00）。タイムゾーンが無いものは JST とみなす
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g)) {
    const [, y, mo, d, h, mi, s, tz] = m;
    let iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${tz ?? '+09:00'}`;
    if (tz && /^[+-]\d{4}$/.test(tz)) iso = iso.replace(tz, `${tz.slice(0, 3)}:${tz.slice(3)}`);
    push(m[0], new Date(iso), tz ? 'ISO 8601' : 'ISO 8601（タイムゾーン無し＝日本時間とみなす）');
  }

  // RFC 1123 / HTTP-date: Sun, 06 Nov 1994 08:49:37 GMT
  for (const m of text.matchAll(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(GMT|UTC)/gi)) {
    const [, d, mon, y, h, mi, s] = m;
    const date = new Date(Date.UTC(Number(y), MONTHS[mon!.toLowerCase()]!, Number(d), Number(h), Number(mi), Number(s)));
    push(m[0], date, 'HTTP の日時（GMT）');
  }

  // Nov 12 10:00:00 2026（syslog 風）
  for (const m of text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})?\b/g)) {
    const [, mon, d, h, mi, s, y] = m;
    const year = Number(y ?? new Date().getFullYear());
    const date = new Date(Date.UTC(year, MONTHS[mon!.toLowerCase()]!, Number(d), Number(h), Number(mi), Number(s)));
    push(m[0], date, y ? '英語の日時' : '英語の日時（年が無いので今年とみなす）');
  }

  // 2026/11/12 10:00:00（日本式）
  for (const m of text.matchAll(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\b/g)) {
    const [, y, mo, d, h, mi, s] = m;
    push(m[0], new Date(`${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}T${h!.padStart(2, '0')}:${mi}:${s ?? '00'}+09:00`), '日本式の日時');
  }

  // 重複を除く
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = `${f.raw}|${f.date.toISOString()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const weekdayJa = (d: Date) => WD[new Date(d.toLocaleString('en-US', { timeZone: TZ })).getDay()] ?? '';
