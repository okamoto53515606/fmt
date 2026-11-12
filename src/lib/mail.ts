/** メールのソース（.eml / ヘッダ＋本文）を読みやすくする。 */

export interface MailPart {
  contentType: string;
  filename?: string;
  text?: string;
}

export interface MailInfo {
  headers: { key: string; value: string }[];
  textBody: string;
  htmlBody?: string;
  parts: MailPart[];
}

const HEADER_KEYS =
  /^(from|to|cc|bcc|subject|date|reply-to|return-path|received|message-id|mime-version|content-type|content-transfer-encoding|dkim-signature|authentication-results|received-spf|list-unsubscribe):/i;

export function looksLikeMail(text: string): boolean {
  const head = text.slice(0, 4000).split(/\r?\n/);
  let hits = 0;
  for (const line of head) {
    if (HEADER_KEYS.test(line)) hits++;
    if (line.trim() === '') break;
  }
  return hits >= 3;
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  const str = s.replace(/=\r?\n/g, '');
  for (let i = 0; i < str.length; i++) {
    const c = str[i]!;
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(str.slice(i + 1, i + 3))) {
      bytes.push(parseInt(str.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(str.charCodeAt(i) & 0xff);
    }
  }
  return decodeWithCharset(new Uint8Array(bytes), 'utf-8');
}

function decodeWithCharset(bytes: Uint8Array, charset: string): string {
  const map: Record<string, string> = {
    'utf-8': 'utf-8', 'utf8': 'utf-8',
    'iso-2022-jp': 'iso-2022-jp',
    'shift_jis': 'shift_jis', 'shift-jis': 'shift_jis', 'sjis': 'shift_jis', 'windows-31j': 'shift_jis',
    'euc-jp': 'euc-jp', 'iso-8859-1': 'iso-8859-1', 'us-ascii': 'utf-8',
  };
  try {
    return new TextDecoder(map[charset.toLowerCase()] ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** =?ISO-2022-JP?B?...?= 形式のヘッダを復号する */
export function decodeHeader(value: string): string {
  return value
    .replace(/(\?=\s*=\?)/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset: string, enc: string, body: string) => {
      try {
        if (enc.toUpperCase() === 'B') {
          const bin = atob(body.replace(/\s/g, ''));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return decodeWithCharset(bytes, charset);
        }
        const text = body.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) =>
          String.fromCharCode(parseInt(h, 16)),
        );
        const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
        return decodeWithCharset(bytes, charset);
      } catch {
        return _m as string;
      }
    });
}

function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/);
}

export function parseMail(raw: string): MailInfo {
  const normalized = raw.replace(/\r\n/g, '\n');
  const sep = normalized.indexOf('\n\n');
  const headText = sep < 0 ? normalized : normalized.slice(0, sep);
  const bodyText = sep < 0 ? '' : normalized.slice(sep + 2);

  const headers: { key: string; value: string }[] = [];
  for (const line of unfold(headText)) {
    const m = /^([!\w-]+):\s*(.*)$/.exec(line);
    if (m) headers.push({ key: m[1]!, value: decodeHeader(m[2]!) });
  }

  const get = (k: string) => headers.find((h) => h.key.toLowerCase() === k)?.value ?? '';
  const ctype = get('content-type') || 'text/plain';
  const cte = get('content-transfer-encoding').toLowerCase();
  const boundary = /boundary="?([^";]+)"?/i.exec(ctype)?.[1];
  const charset = /charset="?([^";]+)"?/i.exec(ctype)?.[1] ?? 'utf-8';

  const parts: MailPart[] = [];
  let textBody = '';
  let htmlBody: string | undefined;

  const decodeBody = (body: string, enc: string, cs: string): string => {
    if (enc === 'base64') {
      try {
        const bin = atob(body.replace(/\s/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return decodeWithCharset(bytes, cs);
      } catch {
        return body;
      }
    }
    if (enc === 'quoted-printable') {
      const bytes: number[] = [];
      const str = body.replace(/=\n/g, '');
      for (let i = 0; i < str.length; i++) {
        const c = str[i]!;
        if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(str.slice(i + 1, i + 3))) {
          bytes.push(parseInt(str.slice(i + 1, i + 3), 16));
          i += 2;
        } else bytes.push(str.charCodeAt(i) & 0xff);
      }
      return decodeWithCharset(new Uint8Array(bytes), cs);
    }
    return body;
  };

  if (boundary) {
    const chunks = bodyText.split(`--${boundary}`);
    for (const chunk of chunks) {
      const trimmed = chunk.replace(/^\n/, '');
      if (!trimmed.trim() || trimmed.startsWith('--')) continue;
      const s = trimmed.indexOf('\n\n');
      const partHead = s < 0 ? trimmed : trimmed.slice(0, s);
      const partBody = s < 0 ? '' : trimmed.slice(s + 2);
      const ptype = /content-type:\s*([^;\n]+)/i.exec(partHead)?.[1]?.trim() ?? 'text/plain';
      const penc = /content-transfer-encoding:\s*(\S+)/i.exec(partHead)?.[1]?.toLowerCase() ?? '';
      const pcs = /charset="?([^";]+)"?/i.exec(partHead)?.[1] ?? 'utf-8';
      const filename = /filename\*?=(?:"([^"]+)"|([^;\n]+))/i.exec(partHead);
      const name = filename ? decodeHeader((filename[1] ?? filename[2] ?? '').trim()) : undefined;
      const decoded = decodeBody(partBody, penc, pcs);
      parts.push({ contentType: ptype, filename: name, text: decoded });
      if (ptype === 'text/plain' && !name) textBody ||= decoded;
      else if (ptype === 'text/html' && !name) htmlBody ??= decoded;
    }
  } else {
    const decoded = decodeBody(bodyText, cte, charset);
    parts.push({ contentType: ctype.split(';')[0]!.trim(), text: decoded });
    if (/html/i.test(ctype)) htmlBody = decoded;
    else textBody = decoded;
  }

  if (!textBody && htmlBody) {
    textBody = htmlBody
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return { headers, textBody, htmlBody, parts };
}

export { decodeQuotedPrintable };
