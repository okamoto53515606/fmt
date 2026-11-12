import type { ClassifierRule } from '../types.ts';
import type { JNode } from '../lib/json.ts';
import { fromBase64 } from '../lib/bytes.ts';
import { renderJson, parseJson } from '../lib/json.ts';
import { toJst } from '../lib/datetime.ts';
import { clip, dl, result } from './_help.ts';

const TIME_CLAIMS: Record<string, string> = {
  exp: '有効期限（この時刻を過ぎると無効）',
  nbf: '使用開始（この時刻より前は無効）',
  iat: '発行日時',
  auth_time: '認証した日時',
};

function decodeSegment(seg: string): { text: string; root?: JNode } | null {
  const bytes = fromBase64(seg);
  if (!bytes) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = parseJson(text);
    return { text, root: parsed.ok ? parsed.root : undefined };
  } catch {
    return null;
  }
}

const entriesOf = (root: JNode | undefined) => (root && root.kind === 'obj' ? root.entries : []);
const keyOf = (raw: string): string => {
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
};
const plainOf = (node: JNode): string => {
  if (node.kind === 'str') {
    try {
      return JSON.parse(node.raw) as string;
    } catch {
      return node.raw;
    }
  }
  if (node.kind === 'num' || node.kind === 'lit') return node.raw;
  return '';
};

export const jwtRule: ClassifierRule = {
  id: 'jwt',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'JWT',
  weight: 50,
  detect(ctx) {
    const t = ctx.text.trim();
    const m = /^(eyJ[A-Za-z0-9_-]{5,})\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*$/.exec(t);
    if (!m) return null;
    const header = decodeSegment(t.split('.')[0]!);
    if (!header) return null;
    return {
      score: 96,
      confidence: 'high',
      title: 'JWT（ログイン情報のトークン）',
      summary: 'JWT です。ログイン状態を表す札のようなもので、中身は誰でも読めます。',
      evidence: ['点（.）で3つに区切られている', '先頭が eyJ（JSON を base64 にした印）', 'ヘッダに alg がある'],
    };
  },
  transform(ctx) {
    const [h, p] = ctx.text.trim().split('.');
    const header = h ? decodeSegment(h) : null;
    const payload = p ? decodeSegment(p) : null;

    const blocks: Parameters<typeof result>[3] = [];
    const items: { k: string; v: string; note?: string }[] = [];

    if (header?.root && header.root.kind === 'obj') {
      for (const e of header.root.entries) {
        const key = keyOf(e.key);
        const value = plainOf(e.value);
        if (key === 'alg') items.push({ k: '署名の方式（alg）', v: value, note: 'HS256 は共通鍵、RS256 は公開鍵方式' });
        else if (key === 'typ') items.push({ k: '種類（typ）', v: value });
        else if (key === 'kid') items.push({ k: '鍵の ID（kid）', v: value });
      }
    }

    for (const e of entriesOf(payload?.root)) {
      const key = keyOf(e.key);
      const node = e.value;
      if (node.kind === 'num' && TIME_CLAIMS[key]) {
        const d = new Date(Number(node.raw) * 1000);
        if (!Number.isNaN(d.getTime())) {
          const expired = key === 'exp' && d.getTime() < Date.now();
          items.push({
            k: TIME_CLAIMS[key]!,
            v: toJst(d),
            note: expired ? '期限切れです（このトークンはもう使えません）' : undefined,
          });
          continue;
        }
      }
      const value = plainOf(node);
      if (value) items.push({ k: key, v: clip(value, 200) });
      else items.push({ k: key, v: node.kind === 'arr' ? '（配列）' : '（入れ子のデータ）' });
    }

    if (items.length) blocks.push({ type: 'kv', title: '中身（ヘッダと本文）', items });
    if (header?.text) {
      const parsedHeader = parseJson(header.text);
      blocks.push({ type: 'code', text: parsedHeader.ok ? renderJson(parsedHeader.root) : header.text, lang: 'json' });
    }
    if (payload?.text) {
      const parsedPayload = parseJson(payload.text);
      blocks.push({ type: 'code', text: parsedPayload.ok ? renderJson(parsedPayload.root) : payload.text, lang: 'json' });
    }
    blocks.push({
      type: 'notice',
      level: 'warn',
      title: '署名は確認していません',
      text: 'この画面は中身を「表示」しているだけで、本物かどうかの検証はしていません。他人のトークンを貼らないでください（持っているだけでログインできます）。',
    });

    return result('jwt', 'JWT', '中身を表示しました', blocks, [
      ...(payload?.text
        ? [{ label: '本文（Payload）を保存', filename: 'jwt-payload.json', blob: new Blob([payload.text], { type: 'application/json' }) }]
        : []),
      dl('トークンを保存', 'token.jwt', ctx.text.trim()),
    ]);
  },
  fixtures: [
    {
      name: '典型的な JWT',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      expect: { score: 96 },
    },
    { name: 'JWTでない3分割', input: 'abc.def.ghi', expect: { score: 0 } },
  ],
};
