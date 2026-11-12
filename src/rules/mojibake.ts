import type { ClassifierRule } from '../types.ts';
import { looksMojibake, repairMojibake } from '../lib/mojibake.ts';
import { dl, result } from './_help.ts';

const jpCount = (s: string) => (s.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) ?? []).length;

export const mojibakeRule: ClassifierRule = {
  id: 'mojibake',
  layer: 'classifier',
  appliesTo: 'text',
  label: '文字化け',
  weight: 30,
  detect(ctx) {
    const t = ctx.text;
    if (!looksMojibake(t)) return null;
    const fixed = repairMojibake(t);
    if (!fixed) {
      return {
        score: 58,
        confidence: 'low',
        title: '文字化け（復元できませんでした）',
        summary: '文字化けしています。残念ながら、この形は元に戻せません（情報が失われています）。',
        evidence: ['置換文字（�）や、別の文字コードで読んだ跡がある'],
      };
    }
    const better = jpCount(fixed.text) > jpCount(t) + 2;
    return {
      score: better ? 84 : 66,
      confidence: better ? 'high' : 'medium',
      title: '文字化け（復元できます）',
      summary: '文字化けしています。元の文字に戻せました。',
      evidence: [fixed.from, `${fixed.to}すると日本語として読める`],
    };
  },
  transform(ctx) {
    const fixed = repairMojibake(ctx.text);
    if (!fixed) {
      return result('mojibake', '文字化け', '復元できませんでした', [
        {
          type: 'notice',
          level: 'error',
          title: 'この文字化けは復元できません',
          text: '「�」に置き換わっている場合、元のバイトが失われているため復元できません。送り直しが必要です。文字コード（UTF-8 / Shift_JIS）を確認してください。',
        },
        { type: 'code', text: ctx.text.slice(0, 20_000), lang: 'text' },
      ]);
    }
    return result(
      'mojibake',
      '文字化け',
      '元の文字に戻しました',
      [
        { type: 'notice', level: 'info', title: '原因', text: `${fixed.from}ためです。` },
        { type: 'kv', title: '復元', items: [{ k: '原因', v: fixed.from }, { k: '対応', v: fixed.to }] },
        { type: 'code', text: fixed.text.slice(0, 20_000), lang: 'text' },
      ],
      [dl('復元したテキストを保存', 'repaired.txt', fixed.text)],
    );
  },
  fixtures: [
    { name: 'UTF-8をLatin1で読んだ例', input: 'ã\u0081\u0093ã\u0082\u0093ã\u0081«ã\u0081¡ã\u0081¯', expect: { score: 84 } },
    { name: '正常な日本語', input: 'こんにちは', expect: { score: 0 } },
  ],
};
