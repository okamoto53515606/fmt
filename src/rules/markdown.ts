import type { ClassifierRule } from '../types.ts';
import { dl, result } from './_help.ts';

export const markdownRule: ClassifierRule = {
  id: 'markdown',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'Markdown',
  weight: 18,
  detect(ctx) {
    const t = ctx.text;
    const heads = t.match(/^#{1,6}\s+\S/gm)?.length ?? 0;
    const fences = t.match(/^```/gm)?.length ?? 0;
    const bullets = t.match(/^\s*(?:[-*+]|\d+\.)\s+\S/gm)?.length ?? 0;
    const links = t.match(/\[[^\]]+\]\([^)]+\)/g)?.length ?? 0;
    if (heads + fences + bullets + links < 3) return null;
    return {
      score: 78,
      confidence: 'medium',
      title: 'Markdown（文章を手軽に書く記法）',
      summary: 'Markdown です。Web ページの形に変換して表示します。',
      evidence: [`見出し ${heads} 個`, `コードブロック ${fences / 2} 個`, `箇条書き ${bullets} 行`, `リンク ${links} 個`],
    };
  },
  transform(ctx) {
    return result(
      'markdown',
      'Markdown',
      'HTML に変換して表示しました',
      [
        {
          type: 'notice',
          level: 'info',
          title: '安全のため一部を無効にしています',
          text: 'スクリプト（<script>）と外部の画像は表示しません。リンクはクリックできますが、この画面から自動で通信することはありません。',
        },
        { type: 'markdown', text: ctx.text },
      ],
      [dl('Markdown を保存', 'document.md', ctx.text, 'text/markdown')],
    );
  },
  fixtures: [
    { name: '見出しと箇条書き', input: '# 見出し\n\n- 一つ目\n- 二つ目\n\n[リンク](https://example.com)', expect: { score: 78 } },
    { name: '文章', input: 'ただの文章です。', expect: { score: 0 } },
  ],
};
