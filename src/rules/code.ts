import type { ClassifierRule } from '../types.ts';
import { dl, result } from './_help.ts';

/** 波括弧で組み立てられた言語（JS/TS/Java/C#/Go など）の簡易整形 */
function formatBraces(src: string, indent = '  '): string {
  let out = '';
  let depth = 0;
  let quote: string | null = null;
  let lineComment = false;
  let blockComment = false;
  let pendingSpace = false;

  const newline = () => {
    out = out.replace(/[ \t]+$/, '');
    out += '\n' + indent.repeat(Math.max(0, depth));
    pendingSpace = false;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    const next = src[i + 1];

    if (lineComment) {
      out += c;
      if (c === '\n') {
        lineComment = false;
        newline();
      }
      continue;
    }
    if (blockComment) {
      out += c;
      if (c === '*' && next === '/') {
        out += '/';
        i++;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && next === '/') {
      lineComment = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '*') {
      blockComment = true;
      out += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      pendingSpace = true;
      continue;
    }
    if (c === '\n') {
      newline();
      continue;
    }
    if (c === '{') {
      out = out.replace(/[ \t]+$/, '');
      out += ' {';
      depth++;
      newline();
      continue;
    }
    if (c === '}') {
      depth = Math.max(0, depth - 1);
      out = out.replace(/[ \t]+$/, '');
      out += '\n' + indent.repeat(depth) + '}';
      if (next !== ';' && next !== ',' && next !== ')' && next !== '}' && next !== '\n') newline();
      pendingSpace = false;
      continue;
    }
    if (c === ';') {
      out = out.replace(/[ \t]+$/, '') + ';';
      newline();
      continue;
    }
    if (pendingSpace) {
      const prev = out[out.length - 1] ?? '';
      if (prev && !'([{.,;'.includes(prev) && !')]}'.includes(c)) out += ' ';
      pendingSpace = false;
    }
    out += c;
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

const SQL_KEYWORDS =
  /\b(select|from|where|group\s+by|order\s+by|having|limit|offset|inner\s+join|left\s+join|right\s+join|outer\s+join|join|on|insert\s+into|values|update|set|delete\s+from|create\s+table|alter\s+table|union|and|or)\b/gi;

const SQL_BREAK = /\b(from|where|group\s+by|order\s+by|having|limit|inner\s+join|left\s+join|right\s+join|join|values|set|union)\b/gi;

function formatSql(src: string): string {
  const compact = src.replace(/\s+/g, ' ').trim();
  const upper = compact.replace(SQL_KEYWORDS, (m) => m.toUpperCase());
  return upper.replace(SQL_BREAK, (m) => `\n${m.toUpperCase()}`).trim();
}

export const codeRule: ClassifierRule = {
  id: 'code',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'ソースコード',
  weight: -10,
  detect(ctx) {
    const t = ctx.text;
    if (t.length < 20) return null;
    const ascii = (t.match(/[A-Za-z]/g)?.length ?? 0) / t.length;
    if (ascii < 0.35) return null;

    const sql = /\bselect\b[\s\S]{0,400}\bfrom\b/i.test(t);
    if (sql) {
      return {
        score: 78,
        confidence: 'medium',
        title: 'SQL（データベースへの命令）',
        summary: 'SQL です。命令ごとに改行して読みやすくしました。',
        evidence: ['SELECT ... FROM の形'],
      };
    }

    const braces = (t.match(/[{}]/g)?.length ?? 0) / 2;
    const kw =
      t.match(/\b(function|const|let|var|class|import|export|return|if|for|while|public|private|def|async|await)\b/g)
        ?.length ?? 0;
    const semi = (t.match(/;/g)?.length ?? 0) > 1;
    if (braces >= 2 && kw >= 2 && semi) {
      return {
        score: 72,
        confidence: 'medium',
        title: 'ソースコード',
        summary: 'プログラムのソースコードです。インデントを付けて読みやすくしました。',
        evidence: [`{ } が ${braces} 組`, `キーワード ${kw} 個`, 'セミコロンで区切られた行がある'],
      };
    }
    return null;
  },
  transform(ctx) {
    const isSql = /\bselect\b[\s\S]{0,400}\bfrom\b/i.test(ctx.text);
    const formatted = isSql ? formatSql(ctx.text) : formatBraces(ctx.text);
    return result(
      'code',
      isSql ? 'SQL' : 'ソースコード',
      '整形しました',
      [
        {
          type: 'notice',
          level: 'info',
          title: '簡易的な整形です',
          text: '言語を判定して自動で整形しているため、文字列の中の括弧などで崩れることがあります。元の内容は変わりません。',
        },
        { type: 'code', text: formatted.slice(0, 200_000), lang: isSql ? 'sql' : 'javascript' },
      ],
      [dl('整形したソースを保存', isSql ? 'formatted.sql' : 'formatted.txt', formatted)],
    );
  },
  fixtures: [
    { name: 'JavaScript', input: 'function f(a){if(a>0){return 1;}else{return 0;}}', expect: { score: 72 } },
    { name: 'SQL', input: 'select id, name from users where id = 1', expect: { score: 78 } },
    { name: '日本語の文章', input: 'これはただの文章です。特に何もありません。', expect: { score: 0 } },
  ],
};
