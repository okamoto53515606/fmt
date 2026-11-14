import type { ClassifierRule } from '../types.ts';
import { parseDateTime, toJst } from '../lib/datetime.ts';
import { clip, nonEmptyLines, result } from './_help.ts';

interface CookieRow {
  name: string;
  value: string;
  attrs: string[];
}

function parseCookieLine(line: string): CookieRow[] {
  const isCookieHeader = /^cookie:/i.test(line);
  const head = line.replace(/^(set-)?cookie:\s*/i, '');
  const parts = head.split(';').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return [];

  if (isCookieHeader) {
    // Cookie: a=1; b=2 / a=1; b=2 のどちらでも、すべて 名前=値
    const rows: CookieRow[] = [];
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq > 0) rows.push({ name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim(), attrs: [] });
    }
    return rows;
  }

  // Set-Cookie: 最初だけ 名前=値、残りは属性
  const first = parts.shift()!;
  const eq = first.indexOf('=');
  if (eq < 0) return [];
  return [{ name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim(), attrs: parts }];
}

export const cookieRule: ClassifierRule = {
  id: 'cookie',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'Cookie',
  weight: 8,
  detect(ctx) {
    const t = ctx.text.trim();
    if (!t) return null;
    const lines = nonEmptyLines(t);
    const headerLines = lines.filter((l) => /^(set-)?cookie:/i.test(l)).length;
    const isHeader = headerLines > 0;

    // 会話ログや手順書に 1 行だけ混ざっている場合を Cookie とみなさない
    // （巨大な表を作ってしまい、解析も遅くなる）
    if (isHeader && (headerLines / lines.length < 0.1 || (headerLines < 2 && lines.length > 20))) {
      return null;
    }

    // ヘッダが無い場合は「1 行に ; 区切りで 3 つ以上」のときだけ Cookie とみなす
    // （複数行の key=value 設定ファイルを Cookie と誤判定しないため）
    let inlinePairs = 0;
    if (!isHeader) {
      const line = lines.find((l) => l.includes('=')) ?? '';
      if (lines.length > 3) return null;
      inlinePairs = line
        .split(';')
        .filter((p) => /^\s*[A-Za-z0-9_.-]+=\s*\S/.test(p)).length;
      if (inlinePairs < 3) return null;
    }
    if (lines.length > 10 && !isHeader) return null;
    return {
      score: isHeader ? 90 : 80,
      confidence: 'high',
      title: 'Cookie（サイトが保存する小さなデータ）',
      summary: 'Cookie です。名前と値を分けて表示します。',
      evidence: [isHeader ? 'Cookie: / Set-Cookie: で始まっている' : `${inlinePairs} 個の 名前=値`, 'セミコロンで区切られている'],
    };
  },
  transform(ctx) {
    const rows: CookieRow[] = [];
    for (const line of nonEmptyLines(ctx.text)) rows.push(...parseCookieLine(line));

    const attrNames = [...new Set(rows.flatMap((r) => r.attrs.map((a) => a.split('=')[0]!.trim())))];
    const table = {
      type: 'table' as const,
      title: `Cookie の内容（${rows.length} 個）`,
      columns: ['名前', '値', ...attrNames],
      rows: rows.map((r) => {
        const map = new Map(
          r.attrs.map((a) => {
            const i = a.indexOf('=');
            return i < 0 ? [a.trim(), ''] : [a.slice(0, i).trim(), a.slice(i + 1).trim()];
          }),
        );
        return [
          r.name,
          clip(r.value, 200),
          ...attrNames.map((n) => {
            const v = map.get(n) ?? '';
            if (/^expires$/i.test(n) && v) {
              const d = parseDateTime(v);
              if (d) return toJst(d);
            }
            return v;
          }),
        ];
      }),
    };

    const blocks: Parameters<typeof result>[3] = [table];

    const setCookie = /^set-cookie:/im.test(ctx.text);
    if (setCookie) {
      const missing: string[] = [];
      if (!/\bHttpOnly\b/i.test(ctx.text)) missing.push('HttpOnly（JavaScript から読めなくする）');
      if (!/\bSecure\b/i.test(ctx.text)) missing.push('Secure（HTTPS のときだけ送る）');
      if (!/\bSameSite=/i.test(ctx.text)) missing.push('SameSite（他のサイトからの送信を制限）');
      if (missing.length) {
        blocks.push({
          type: 'notice',
          level: 'warn',
          title: 'セキュリティ設定が不足しています',
          text: `次の属性がありません: ${missing.join('、')}。ログイン情報を含む Cookie では特に重要です。`,
        });
      }
      const exp = /Expires=([^;]+)/i.exec(ctx.text)?.[1];
      if (exp) {
        const raw = exp.trim();
        const d = parseDateTime(raw);
        blocks.push({
          type: 'notice',
          level: 'info',
          title: '有効期限',
          text: d ? `${toJst(d)}\n（元の表記: ${raw}）` : raw,
        });
      }
    }

    return result('cookie', 'Cookie', '名前と値に分けました', blocks);
  },
  fixtures: [
    { name: 'Cookieヘッダ', input: 'Cookie: session=abc123; theme=dark; lang=ja', expect: { score: 90 } },
    { name: 'Set-Cookie', input: 'Set-Cookie: sid=xyz; Path=/; HttpOnly; Secure; SameSite=Lax', expect: { score: 90 } },
  ],
};
