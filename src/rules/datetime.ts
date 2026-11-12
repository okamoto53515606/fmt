import type { ClassifierRule } from '../types.ts';
import { findDates, relative, toIsoUtc, toJst } from '../lib/datetime.ts';
import { result } from './_help.ts';

export const datetimeRule: ClassifierRule = {
  id: 'datetime',
  layer: 'classifier',
  appliesTo: 'text',
  label: '日時',
  weight: 0,
  detect(ctx) {
    const t = ctx.text;
    if (t.length > 20_000) return null;
    const dates = findDates(t);
    if (!dates.length) return null;
    // 「日時そのもの」と言えるのは、短くて日時が主役のときだけ。
    // 長い文書（ログ・Markdown など）では補助的な判定にとどめる。
    const whole = t.trim().length <= 80 && dates.length <= 3;
    return {
      score: whole ? 84 : 60,
      confidence: whole ? 'high' : 'low',
      title: '日時（時刻の表記）',
      summary: whole
        ? '日時です。日本時間に直して表示します。'
        : `本文に日時が ${dates.length} 件あります。日本時間に直して一覧にします。`,
      evidence: dates.slice(0, 3).map((d) => `「${d.raw.trim()}」(${d.kind})`),
    };
  },
  transform(ctx) {
    const dates = findDates(ctx.text).slice(0, 50);
    return result(
      'datetime',
      '日時',
      '日本時間に直しました',
      [
        {
          type: 'table',
          columns: ['元の表記', '日本時間', 'UTC', 'いまから'],
          rows: dates.map((d) => [d.raw.trim(), toJst(d.date), toIsoUtc(d.date), relative(d.date)]),
          note: 'タイムゾーンの指定が無い日時は、日本時間とみなしています。',
        },
      ],
    );
  },
  fixtures: [
    { name: 'GMT', input: 'Sun, 06 Nov 1994 08:49:37 GMT', expect: { score: 84 } },
    { name: 'ISO', input: '2026-11-12T10:00:00Z', expect: { score: 84 } },
    { name: '日時でない', input: '特に日付はありません', expect: { score: 0 } },
  ],
};
