import type { AnnotatorRule, Block } from '../types.ts';
import { maskText } from '../lib/mask.ts';

/** マスキング対象の件数を補足欄に出す（自動では隠さない） */
export const sensitiveAnnotator: AnnotatorRule = {
  id: 'sensitive',
  layer: 'annotator',
  appliesTo: 'text',
  label: '機密情報',
  annotate(ctx) {
    if (!ctx.text) return [];
    const { counts, found } = maskText(ctx.text);
    const parts: string[] = [];
    if (counts.keys) parts.push(`APIキー・秘密鍵 ${counts.keys}`);
    if (counts.emails) parts.push(`メールアドレス ${counts.emails}`);
    if (counts.phones) parts.push(`電話番号 ${counts.phones}`);
    if (counts.cards) parts.push(`カード番号 ${counts.cards}`);
    if (counts.mynumbers) parts.push(`マイナンバーらしき12桁 ${counts.mynumbers}`);
    if (counts.addresses) parts.push(`住所 ${counts.addresses}`);
    if (counts.accounts) parts.push(`AWS アカウントID ${counts.accounts}`);
    if (counts.paths) parts.push(`利用者名を含むパス ${counts.paths}`);
    if (counts.ips) parts.push(`IPアドレス ${counts.ips}`);
    if (!parts.length) return [];

    const total = parts.length;
    const blocks: Block[] = [
      {
        type: 'notice',
        level: 'warn',
        title: `機密情報らしきものが見つかりました（${total} 種類）`,
        text: `${parts.join('、')}${
          found.length ? `\n\n種類: ${found.join('、')}` : ''
        }\n\n「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。`,
      },
    ];
    return blocks;
  },
};
