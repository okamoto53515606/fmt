import type { AnnotatorRule, Block, ClassifierRule } from '../types.ts';
import { englishRatio, explainErrors } from '../lib/errors.ts';
import { result } from './_help.ts';

function explainBlocks(found: ReturnType<typeof explainErrors>): Block[] {
  return found.map((e) => ({
    type: 'kv' as const,
    title: e.title,
    items: [
      { k: 'どういうこと', v: e.meaning },
      { k: 'よくある原因', v: e.cause },
      { k: '次にやること', v: e.action },
    ],
  }));
}

/**
 * 英語のエラーを「意味・原因・次にやること」に変換する。
 * 機械翻訳ではなく、パターン辞書に当てる方式。辞書に無いものは訳さない。
 */
export const errorRule: ClassifierRule = {
  id: 'error',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'エラーメッセージ',
  weight: -5,
  detect(ctx) {
    const t = ctx.text;
    if (!t || t.length > 200_000) return null;
    const found = explainErrors(t);
    if (!found.length) return null;
    return {
      score: found.length >= 2 ? 68 : 60,
      confidence: 'medium',
      title: 'エラーメッセージ',
      summary: `エラーが ${found.length} 件あります。意味と、次にやることを日本語で説明します。`,
      evidence: found.map((e) => e.code),
    };
  },
  transform(ctx) {
    const found = explainErrors(ctx.text);
    const blocks: Block[] = explainBlocks(found);
    if (found.length === 1) {
      blocks.push({ type: 'notice', level: 'info', title: '原文', text: ctx.text.slice(0, 4000) });
    }
    return result('error', 'エラーメッセージ', 'エラーの意味を説明します', blocks);
  },
  fixtures: [
    { name: 'ECONNREFUSED', input: 'Error: connect ECONNREFUSED 127.0.0.1:5432', expect: { score: 60 } },
    { name: 'HTTP 502', input: 'HTTP/1.1 502 Bad Gateway', expect: { score: 60 } },
  ],
};

/** 同じ説明を「補足」欄にも出す（ログや JSON の中のエラーを説明するため） */
export const errorAnnotator: AnnotatorRule = {
  id: 'error-dict',
  layer: 'annotator',
  appliesTo: 'text',
  label: 'エラーの意味',
  annotate(ctx) {
    const t = ctx.text;
    if (!t) return [];
    const found = explainErrors(t);
    if (found.length) return explainBlocks(found);

    const words = t.trim().split(/\s+/);
    if (t.length < 4000 && words.length >= 3 && englishRatio(t) > 0.65 && /[A-Za-z]{4,}/.test(t)) {
      return [
        {
          type: 'notice',
          level: 'info',
          title: '英語のメッセージです',
          text: 'よくあるエラーの辞書には見つかりませんでした。機械的に翻訳すると意味を取り違えることがあるため、原文のまま表示しています。',
        },
      ];
    }
    return [];
  },
};
