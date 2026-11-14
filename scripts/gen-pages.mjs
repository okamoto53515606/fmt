#!/usr/bin/env node
/**
 * 機能別ランディングページと、検索/AI 向けのメタファイルを生成する。
 *
 *   npm run pages          … 生成
 *   npm run pages -- --check … 生成物が最新かだけ確認（CI / npm test）
 *
 * 生成物（リポジトリにコミットする）:
 *   <slug>/index.html   public/robots.txt   public/sitemap.xml   public/llms.txt
 *
 * 目的:
 *   - 1 クエリ = 1 URL にする（検索結果で「URLエンコード」等のページとして出る）
 *   - JavaScript を実行しないクローラ（AI 検索の多く）にも本文が読めるようにする
 *   - 各ページに固有の解説・表・FAQ を持たせ、薄いページの量産にしない
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HONESTY_BLOCK, SAFETY_BLOCK, SITE, hub, pages } from './tool-pages.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const checkOnly = process.argv.includes('--check');

const srcHtml = readFileSync(join(root, 'index.html'), 'utf8');
const shellStart = srcHtml.indexOf('<body>');
const shellEnd = srcHtml.lastIndexOf('</body>');
if (shellStart < 0 || shellEnd < 0) throw new Error('index.html の <body> を認識できません');

/** ホームの h1 ブロックは LP では差し替えるので、目印で囲っておく。 */
const shell = srcHtml
  .slice(shellStart + '<body>'.length, shellEnd)
  .replace(/<!--\s*hero:start\s*-->[\s\S]*?<!--\s*hero:end\s*-->/g, '')
  // LP は 1 階層下に出力されるため、相対パスを 1 つ上へずらす
  .replace(/(href|src)="\.\/(src\/|favicon\.svg)/g, '$1="../$2')
  // ロゴのリンク（ホームへ戻る）も 1 つ上へ
  .replace('href="./"', 'href="../"');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

const abs = (slug) => `${SITE.origin}/${slug ? `${slug}/` : ''}`;
const ogImage = `${SITE.origin}/og.png`;

/* ---------------- 構造化データ ---------------- */

function structuredData(page) {
  const url = abs(page.slug);
  const graph = [
    {
      '@type': 'WebApplication',
      '@id': `${url}#app`,
      name: page.h1,
      url,
      description: page.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'JavaScript が有効なブラウザ',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      featureList: page.featureList ?? [],
      isPartOf: { '@id': `${SITE.origin}/#website` },
      publisher: { '@id': `${SITE.origin}/#publisher` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'fmt', item: abs('') },
        { '@type': 'ListItem', position: 2, name: 'ツール一覧', item: abs('tools') },
        { '@type': 'ListItem', position: 3, name: page.nav, item: url },
      ],
    },
  ];

  if (page.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function hubStructuredData() {
  const url = abs('tools');
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        name: hub.title,
        description: hub.description,
        url,
        isPartOf: { '@id': `${SITE.origin}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: pages.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.h1,
            url: abs(p.slug),
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'fmt', item: abs('') },
          { '@type': 'ListItem', position: 2, name: 'ツール一覧', item: url },
        ],
      },
    ],
  })}</script>`;
}

/* ---------------- 共通パーツ ---------------- */

function head(title, description, url, extra = '') {
  // タイトルは 70 文字程度までに収める（長すぎると検索結果で切れる）
  const withBrand = `${title} | ${SITE.name}`;
  const fullTitle = withBrand.length <= 72 ? withBrand : title;
  return `    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#001f3f" />
    <meta name="description" content="${attr(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE.name}" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:title" content="${attr(title)}" />
    <meta property="og:description" content="${attr(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${attr(title)}" />
    <meta name="twitter:description" content="${attr(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <title>${esc(fullTitle)}</title>
    <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../src/style.css" />
${extra}`;
}

const FOOTER = `
      <footer class="lp-footer">
        <p>
          <a href="../">fmt（トップ）</a> ・
          <a href="../tools/">ツール一覧</a> ・
          <a href="${SITE.repo}" rel="noreferrer">ソースコード（MIT）</a>
        </p>
        <p class="lp-muted">
          fmt は「貼るだけで何なのかが分かる」ブラウザ完結のツールです。サーバーを持たず、入力した内容を送信しません。
          結果は決まったルールで判定しており、AI（LLM）は使っていません。
        </p>
      </footer>`;

function sectionsHtml(page) {
  return page.sections
    .map((s) => `        <section class="lp-section">\n          <h2>${s.h2}</h2>\n${s.html}\n        </section>`)
    .join('\n');
}

function faqHtml(page) {
  if (!page.faq?.length) return '';
  const items = page.faq
    .map(
      (f) => `          <details class="lp-faq-item">
            <summary>${esc(f.q)}</summary>
            <p>${esc(f.a)}</p>
          </details>`,
    )
    .join('\n');
  return `        <section class="lp-section">
          <h2>よくある質問</h2>
${items}
        </section>`;
}

function relatedHtml(page) {
  const links = page.related
    .map((slug) => pages.find((p) => p.slug === slug))
    .filter(Boolean)
    .map((p) => `          <li><a href="../${p.slug}/">${p.h1}</a> — ${esc(p.description.slice(0, 46))}…</li>`)
    .join('\n');
  return `        <section class="lp-section">
          <h2>関連するツール</h2>
          <ul class="lp-related">
${links}
            <li><a href="../tools/">ツール一覧（すべて見る）</a></li>
          </ul>
        </section>`;
}

/* ---------------- ページ生成 ---------------- */

function buildPage(page) {
  const url = abs(page.slug);
  const hero = `<div class="lp-hero">
        <nav class="lp-crumb" aria-label="パンくず">
          <a href="../">fmt</a><span aria-hidden="true">›</span><a href="../tools/">ツール一覧</a><span aria-hidden="true">›</span><span>${esc(page.nav)}</span>
        </nav>
        <h1>${page.h1}</h1>
        <p class="lp-lead">${page.lead}</p>
        <p class="lp-jump"><a href="#guide">このページの解説とよくある質問を読む</a></p>
      </div>`;

  const body = shell
    .replace('</header>', `</header>\n${hero}`)
    .replace(
      '</main>',
      `</main>

      <div class="lp-body" id="guide">
${sectionsHtml(page)}
        <section class="lp-section">
          <h2>このツールの安全性</h2>
${SAFETY_BLOCK}
${HONESTY_BLOCK}
        </section>
${faqHtml(page)}
${relatedHtml(page)}
${FOOTER}
      </div>`,
    );

  return `<!doctype html>
<html lang="ja">
  <head>
${head(page.title, page.description, url, structuredData(page))}  </head>
  <body class="lp" data-tool="${page.slug}">${body}
  </body>
</html>
`;
}

function buildHub() {
  const url = abs('tools');
  const cards = pages
    .map(
      (p) => `            <li class="lp-card">
              <a href="../${p.slug}/"><strong>${p.h1}</strong></a>
              <span>${esc(p.description)}</span>
            </li>`,
    )
    .join('\n');

  // 一覧ページは「読むページ」。アプリの2ペイン（入力欄と結果欄）は置かない。
  // 置くとファーストビューが空のツールで埋まり、目的の一覧が見えなくなる。
  return `<!doctype html>
<html lang="ja">
  <head>
${head(hub.title, hub.description, url, hubStructuredData())}  </head>
  <body class="lp lp-hub">
    <header class="topbar">
      <a class="brand" href="../">
        <img src="../favicon.svg" alt="" width="28" height="28" />
        <span>fmt</span>
      </a>
      <span class="badge">通信しません</span>
      <span class="badge badge-secondary">AIは使っていません</span>
      <span class="badge badge-optional">オフラインで動きます</span>
      <div class="spacer"></div>
      <a class="link" href="../">なんでも貼れる画面へ</a>
    </header>

    <div class="lp-hero">
      <nav class="lp-crumb" aria-label="パンくず">
        <a href="../">fmt</a><span aria-hidden="true">›</span><span>ツール一覧</span>
      </nav>
      <h1>${hub.h1}</h1>
      <p class="lp-lead">${hub.lead}</p>
    </div>

    <div class="lp-body">
      <section class="lp-section">
        <h2>目的から探す</h2>
        <ul class="lp-cards">
${cards}
        </ul>
      </section>

      <section class="lp-section">
        <h2>どのページでも同じように使えます</h2>
        <ol>
          <li>文字列を貼り付ける（画像はドラッグ＆ドロップ）</li>
          <li>結果・統計・補足が自動で出ます</li>
          <li>必要なら「機密情報をマスク」を確認してからコピー・保存します</li>
        </ol>
${SAFETY_BLOCK}
${HONESTY_BLOCK}
      </section>
${FOOTER}
    </div>
  </body>
</html>
`;
}

/* ---------------- メタファイル ---------------- */

function buildRobots() {
  const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended'];
  return `# fmt — 貼るだけでわかる、データの中身
# 全ページを歓迎します（AI 検索のクローラも含む）
User-agent: *
Allow: /

${aiBots.map((b) => `User-agent: ${b}\nAllow: /\n`).join('\n')}
Sitemap: ${SITE.origin}/sitemap.xml
`;
}

function buildSitemap() {
  const urls = [
    { loc: abs(''), priority: '1.0' },
    { loc: abs('tools'), priority: hub.priority },
    ...pages.map((p) => ({ loc: abs(p.slug), priority: p.priority })),
  ];
  const body = urls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${pages[0].lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * AI 検索向けの索引。llms.txt はまだ非標準で、Google は読んでいない。
 * 「機能と URL の対応を 1 枚で示す」目的で置く（過度な期待はしない）。
 */
function buildLlms() {
  const list = [hub, ...pages]
    .map((p) => `- [${p.h1}](${abs(p.slug)}): ${p.description}`)
    .join('\n');
  return `# ${SITE.name}

> 貼るだけで「これ何？」がわかる、ブラウザ完結のデコード＆整形ツール。
> 入力はサーバーへ送信しません（CSP の connect-src 'none' で外部通信を禁止、サーバーが存在しない）。
> 判定は決まったルールで行い、LLM は使っていません。オフラインでも動作します。

## ツール

${list}

## 事実

- 料金: 無料（MIT ライセンスのオープンソース）
- 実行場所: ブラウザ内（Web Worker）。入力は保存しない（localStorage も使わない）
- 対応形式: JWT / JSON / XML / HTML / CSV / TSV / ログ / メール(.eml) / Cookie / URL / PEM / 画像(EXIF・QR) / Base64 / URLエンコード / 16進 / Unicodeエスケープ / Markdown / 文字化け / ハッシュ / 日時 / エラーメッセージ
- 上限: テキスト 4MB、画像 25MB・1枚
- できないこと: 復号（暗号化データの中身）、ハッシュの逆算、JWT の署名検証、証明書の失効確認、EXIF の削除
- ソースコード: ${SITE.repo}

## 問い合わせ

- 不具合報告・要望: ${SITE.repo}/issues
`;
}

/* ---------------- 404 ---------------- */

/**
 * CloudFront の CustomErrorResponses から返す 404。
 * public/ に置くとビルドを通らないため、CSS はインラインで持たせる
 * （CSP の style-src には 'unsafe-inline' が入っている）。
 */
function build404() {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>ページが見つかりません | fmt</title>
    <style>
      body { margin: 0; padding: 48px 20px; background: #001f3f; color: #e6f0fa;
             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif;
             line-height: 1.7; }
      main { max-width: 620px; margin: 0 auto; }
      h1 { font-size: 22px; }
      a { color: #6cc4ff; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <h1>ページが見つかりません</h1>
      <p>URL が変わったか、まだ存在しません。</p>
      <ul>
        ${pages.map((p) => `<li><a href="/${p.slug}/">${p.h1}</a></li>`).join('\n        ')}
        <li><a href="/">fmt（トップ）</a></li>
      </ul>
    </main>
  </body>
</html>
`;
}

/* ---------------- 書き出し ---------------- */

const outputs = [
  [join(root, 'tools/index.html'), buildHub()],
  ...pages.map((p) => [join(root, p.slug, 'index.html'), buildPage(p)]),
  [join(root, 'public/robots.txt'), buildRobots()],
  [join(root, 'public/sitemap.xml'), buildSitemap()],
  [join(root, 'public/llms.txt'), buildLlms()],
  [join(root, 'public/404.html'), build404()],
];

let stale = 0;
for (const [file, content] of outputs) {
  const rel = file.slice(root.length).split('\\').join('/');
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;

  if (checkOnly) {
    if (current !== content) {
      console.error(`  ✗ ${rel} が最新ではありません（npm run pages で再生成してください）`);
      stale++;
    }
    continue;
  }
  if (current === content) continue;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`  · ${rel} を更新`);
}

if (checkOnly) {
  if (stale) process.exit(1);
  console.log(`[pages] OK: ${outputs.length} ファイルは最新です`);
} else {
  console.log(`[pages] ${outputs.length} ファイルを生成しました（${pages.length + 1} ページ）`);
}
