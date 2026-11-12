import type { ClassifierRule } from '../types.ts';
import { clip, dl, result } from './_help.ts';

/** 何にも当てはまらなかったときの受け皿。必ず一致する。 */
export const textRule: ClassifierRule = {
  id: 'text',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'テキスト',
  weight: -100,
  detect(ctx) {
    if (!ctx.text) return null;
    const lines = ctx.text.split(/\r?\n/).length;
    return {
      score: 30,
      confidence: 'low',
      title: 'テキスト（文字だけのデータ）',
      summary: `文字だけのデータです（${lines.toLocaleString('ja-JP')} 行）。`,
      evidence: ['特別な形式の目印が見つからない'],
    };
  },
  transform(ctx) {
    const shown = clip(ctx.text, 20_000);
    return result(
      'text',
      'テキスト（文字だけのデータ）',
      'そのまま表示しています',
      [{ type: 'text', text: shown }],
      [dl('テキストを保存', 'text.txt', ctx.text)],
    );
  },
};
