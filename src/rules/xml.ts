import type { ClassifierRule } from '../types.ts';
import { dl, result } from './_help.ts';

type Tok =
  | { type: 'open'; raw: string; name: string; line: number }
  | { type: 'close'; raw: string; name: string; line: number }
  | { type: 'self'; raw: string; name: string; line: number }
  | { type: 'text'; raw: string; line: number }
  | { type: 'other'; raw: string; line: number };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  const advance = (n: number) => {
    for (let k = 0; k < n; k++) if (src[i + k] === '\n') line++;
    i += n;
  };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      const to = end < 0 ? src.length : end + 3;
      toks.push({ type: 'other', raw: src.slice(i, to), line });
      advance(to - i);
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i);
      const to = end < 0 ? src.length : end + 3;
      toks.push({ type: 'other', raw: src.slice(i, to), line });
      advance(to - i);
      continue;
    }
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i);
      const to = end < 0 ? src.length : end + 2;
      toks.push({ type: 'other', raw: src.slice(i, to), line });
      advance(to - i);
      continue;
    }
    if (src[i] === '<') {
      if (src[i + 1] === '!') {
        const end = src.indexOf('>', i);
        const to = end < 0 ? src.length : end + 1;
        toks.push({ type: 'other', raw: src.slice(i, to), line });
        advance(to - i);
        continue;
      }
      // 属性値の ">" を誤認しないように引用符を考慮
      let j = i + 1;
      let quote: string | null = null;
      while (j < src.length) {
        const c = src[j]!;
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
        j++;
      }
      const raw = src.slice(i, j + 1);
      const startLine = line;
      advance(j + 1 - i);
      const close = /^<\s*\/\s*([^\s>]+)/.exec(raw);
      const open = /^<\s*([^\s/>]+)/.exec(raw);
      if (close) toks.push({ type: 'close', raw, name: close[1]!, line: startLine });
      else if (/\/\s*>$/.test(raw)) toks.push({ type: 'self', raw, name: open?.[1] ?? '?', line: startLine });
      else if (open) toks.push({ type: 'open', raw, name: open[1]!, line: startLine });
      else toks.push({ type: 'other', raw, line: startLine });
      continue;
    }
    const next = src.indexOf('<', i);
    const to = next < 0 ? src.length : next;
    toks.push({ type: 'text', raw: src.slice(i, to), line });
    advance(to - i);
  }
  return toks;
}

export interface XmlFormat {
  text: string;
  errors: string[];
  tags: number;
  maxDepth: number;
}

export function formatMarkup(src: string, kind: 'xml' | 'html', indent = '  '): XmlFormat {
  const toks = tokenize(src);
  const out: string[] = [];
  const stack: { name: string; line: number }[] = [];
  const errors: string[] = [];
  let depth = 0;
  let maxDepth = 0;
  let tags = 0;

  const VOID = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);
  const RAW = new Set(['script', 'style', 'pre', 'textarea']);
  let rawDepth = 0;

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const pad = indent.repeat(depth);
    switch (t.type) {
      case 'open': {
        tags++;
        const lower = t.name.toLowerCase();
        const next = toks[i + 1];
        const after = toks[i + 2];
        const isRaw = kind === 'html' && RAW.has(lower);

        // 中身が「文字だけ」なら 1 行にまとめる（<name>山田 太郎</name>）
        if (!isRaw && next?.type === 'text' && next.raw.trim() && after?.type === 'close' && after.name.toLowerCase() === lower) {
          out.push(`${pad}${t.raw}${next.raw.trim()}${after.raw}`);
          tags++;
          i += 2;
          break;
        }
        // 中身が空なら <name></name> のまま 1 行に
        if (!isRaw && next?.type === 'close' && next.name.toLowerCase() === lower) {
          out.push(`${pad}${t.raw}${next.raw}`);
          tags++;
          i += 1;
          break;
        }

        out.push(pad + t.raw);
        stack.push({ name: lower, line: t.line });
        if (!(kind === 'html' && VOID.has(lower))) {
          depth++;
          maxDepth = Math.max(maxDepth, depth);
          if (kind === 'html' && RAW.has(lower)) rawDepth++;
        }
        break;
      }
      case 'close': {
        tags++;
        const want = t.name.toLowerCase();
        const top = stack[stack.length - 1];
        if (top && top.name === want) {
          stack.pop();
          if (depth > 0) depth--;
        } else {
          const idx = [...stack].reverse().findIndex((s) => s.name === want);
          if (idx >= 0) {
            const unclosed = stack.splice(stack.length - idx - 1).map((s) => `<${s.name}>（${s.line}行目）`);
            errors.push(`${t.line}行目: </${t.name}> の前に閉じ忘れがあります: ${unclosed.join(', ')}`);
            depth = stack.length;
          } else {
            errors.push(`${t.line}行目: </${t.name}> に対応する開始タグがありません`);
          }
        }
        if (kind === 'html' && RAW.has(want) && rawDepth > 0) rawDepth--;
        out.push(indent.repeat(depth) + t.raw);
        break;
      }
      case 'self':
        tags++;
        out.push(pad + t.raw);
        break;
      case 'other':
        out.push(pad + t.raw.trim());
        break;
      case 'text': {
        if (rawDepth > 0) {
          out.push(t.raw);
        } else {
          const trimmed = t.raw.trim();
          if (trimmed) out.push(indent.repeat(depth) + trimmed);
        }
        break;
      }
    }
  }
  for (const s of stack) errors.push(`<${s.name}>（${s.line}行目）が閉じられていません`);

  return { text: out.join('\n'), errors, tags, maxDepth };
}

const VOID_HINT = /<(?:br|hr|img|input|meta|link|div|span|p|a|table|tr|td|ul|li|h[1-6])\b/i;
const HTML_HINT = /<(?:div|span|br|img|input|meta|link|table|tr|td|ul|li|h[1-6]|body|html|form|button)\b/i;

export const xmlRule: ClassifierRule = {
  id: 'xml',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'XML',
  weight: 10,
  detect(ctx) {
    const t = ctx.text.trim();
    if (!t.startsWith('<')) return null;
    const isXml = /^<\?xml\b/i.test(t) || /^<[A-Za-z][\w:.-]*(\s|>)/.test(t);
    if (!isXml) return null;
    if (!/^<\?xml/i.test(t) && HTML_HINT.test(t)) return null;
    const closes = t.match(/<\/[^\s>]+>/g)?.length ?? 0;
    const opens = t.match(/<[^\s/!?][^>]*>/g)?.length ?? 0;
    if (opens < 2 || closes < 1) return null;
    return {
      score: /^<\?xml/i.test(t) ? 92 : 84,
      confidence: 'high',
      title: 'XML（タグで囲まれたデータ）',
      summary: 'XML です。入れ子（階層）が分かるように整形しました。',
      evidence: [`${opens} 個のタグ`, `${closes} 個の終了タグ`],
    };
  },
  transform(ctx) {
    const f = formatMarkup(ctx.text, 'xml');
    const blocks: Parameters<typeof result>[3] = [{ type: 'code', text: f.text, lang: 'xml' }];
    if (f.errors.length) {
      blocks.unshift({
        type: 'notice',
        level: 'error',
        title: 'タグの対応に問題があります',
        text: f.errors.slice(0, 8).join('\n'),
      });
    } else {
      blocks.push({ type: 'notice', level: 'info', title: 'タグの対応', text: 'すべてのタグが正しく閉じられています。' });
    }
    return result('xml', 'XML', '整形しました', blocks, [dl('整形した XML を保存', 'formatted.xml', f.text, 'application/xml')]);
  },
  fixtures: [
    { name: '単純なXML', input: '<?xml version="1.0"?><a><b>1</b><c/></a>', expect: { score: 92 } },
    { name: 'タグでない', input: '<これは文章です>', expect: { score: 0 } },
  ],
};

export const htmlRule: ClassifierRule = {
  id: 'html',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'HTML',
  weight: 5,
  detect(ctx) {
    const t = ctx.text.trim();
    if (!t.startsWith('<')) return null;
    const hint = VOID_HINT.test(t);
    if (!hint) return null;
    const opens = t.match(/<[A-Za-z][^>]*>/g)?.length ?? 0;
    if (opens < 3) return null;
    const doctype = /^<!doctype\s+html/i.test(t);
    return {
      score: doctype ? 95 : 82,
      confidence: doctype ? 'high' : 'medium',
      title: 'HTML（Web ページのソース）',
      summary: 'HTML です。構造が分かるように整形しました（ページとしては表示しません）。',
      evidence: [`${opens} 個のタグ`, doctype ? '<!doctype html> がある' : 'div / p などのタグがある'],
    };
  },
  transform(ctx) {
    const f = formatMarkup(ctx.text, 'html');
    return result(
      'html',
      'HTML',
      '整形しました',
      [
        {
          type: 'notice',
          level: 'info',
          title: '安全のため、ページとしては表示しません',
          text: 'HTML をそのまま表示すると、外部への通信やスクリプトが動く可能性があります。ここではソースとして表示しています。',
        },
        { type: 'code', text: f.text.slice(0, 200_000), lang: 'html' },
      ],
      [dl('整形した HTML を保存', 'formatted.html', f.text, 'text/html')],
    );
  },
};
