import type { ClassifierRule } from '../types.ts';
import type { JNode } from '../lib/json.ts';
import { formatJsonError, looksLikeJson, parseJson, renderJson, summarizeJson } from '../lib/json.ts';
import { clip, dl, result } from './_help.ts';

/** キー一覧に出す短いプレビュー */
function previewOf(node: JNode): string {
  switch (node.kind) {
    case 'obj':
      return `{ … }（${node.entries.length} 項目）`;
    case 'arr':
      return `[ … ]（${node.items.length} 件）`;
    case 'str': {
      try {
        return clip(JSON.parse(node.raw) as string, 80);
      } catch {
        return clip(node.raw, 80);
      }
    }
    case 'num':
    case 'lit':
      return node.raw;
  }
}

export const jsonRule: ClassifierRule = {
  id: 'json',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'JSON',
  weight: 20,
  detect(ctx) {
    if (!ctx.text.trim()) return null;
    const parsed = parseJson(ctx.text);
    if (parsed.ok) {
      const s = summarizeJson(parsed.root);
      const what = s.topLevel === 'object' ? `項目（キー）が ${s.topLevelCount} 個` : `要素が ${s.topLevelCount} 個`;
      return {
        score: 94,
        confidence: 'high',
        title: 'JSON（データの入れ物）',
        summary: `JSON です。${what}あります。整形して読みやすくしました。`,
        evidence: [
          s.topLevel === 'object' ? '全体が { } で囲まれている' : '全体が [ ] で囲まれている',
          `値の数 ${s.nodes} 個 / 入れ子の深さ ${s.maxDepth}`,
        ],
      };
    }
    if (looksLikeJson(ctx.text)) {
      return {
        score: 72,
        confidence: 'medium',
        title: 'JSON（書きかけ・エラーあり）',
        summary: 'JSON の形をしていますが、構文エラーがあります。場所を示します。',
        evidence: ['{ } や "キー": 値 の形が見える', '構文として読めない'],
      };
    }
    return null;
  },
  transform(ctx) {
    const parsed = parseJson(ctx.text);
    if (!parsed.ok) {
      const err = parsed.error;
      return result(
        'json',
        'JSON（エラーあり）',
        `構文エラー: ${err.message}`,
        [
          {
            type: 'notice',
            level: 'error',
            title: `${err.line}行目 ${err.col}文字目でエラー`,
            text: `${err.message}${err.hint ? `\n${err.hint}` : ''}`,
          },
          { type: 'code', text: formatJsonError(err), lang: 'text' },
          { type: 'code', text: ctx.text.slice(0, 20_000), lang: 'json' },
        ],
        [dl('元のテキストを保存', 'broken.json', ctx.text, 'application/json')],
      );
    }
    const s = summarizeJson(parsed.root);
    const blocks: Parameters<typeof result>[3] = [
      { type: 'code', text: renderJson(parsed.root), lang: 'json' },
    ];
    const bigNumbers = s.numbers.filter((n) => !n.safe);
    if (bigNumbers.length) {
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: '大きな数値があります',
        text: `とても大きな数値（${bigNumbers
          .slice(0, 3)
          .map((n) => n.raw)
          .join(', ')}）があります。表計算ソフトに貼ると桁が変わることがあるため、この画面では元の文字のまま表示しています。`,
      });
    }
    if (s.keys.length) {
      const items = parsed.root.kind === 'obj' ? parsed.root.entries.slice(0, 20) : [];
      blocks.push({
        type: 'kv',
        title: 'いちばん外側の項目',
        items: items.map((e) => ({ k: JSON.parse(e.key) as string, v: previewOf(e.value) })),
      });
    }
    return result(
      'json',
      'JSON',
      '整形しました',
      blocks,
      [dl('整形した JSON を保存', 'formatted.json', renderJson(parsed.root), 'application/json')],
    );
  },
  fixtures: [
    { name: 'オブジェクト', input: '{"a":1,"b":[1,2],"c":{"d":true}}', expect: { score: 94 } },
    { name: '末尾カンマ', input: '{"a":1,}', expect: { score: 72 } },
    { name: 'シングルクォート', input: "{'a':1}", expect: { score: 72 } },
    { name: '壊れた括弧', input: '{"a": [1,2}', expect: { score: 72 } },
    { name: 'JSONでない', input: 'hello world', expect: { score: 0 } },
  ],
};
