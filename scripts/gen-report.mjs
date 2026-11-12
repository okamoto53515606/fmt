#!/usr/bin/env node
/**
 * docs/report.md を生成する。
 *
 *   npm run report          # 生成（失敗があれば exit 1）
 *   npm run test:samples    # 生成結果が現在のファイルと一致するか確認
 *
 * サンプルは scripts/sample-cases.mjs。画像とメールは docs/ 配下の実ファイルを使う。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { marked } from 'marked';
import './node-canvas-shim.mjs';
import { analyze } from '../src/engine.ts';
import { inspectImage } from '../src/lib/imageinfo.ts';
import { cases } from './sample-cases.mjs';

const REPORT_PATH = new URL('../docs/report.md', import.meta.url);
const CHECK = process.argv.includes('--check');

/* ---------- markdown helpers ---------- */

// 本文中の <script> などを生 HTML として解釈させない（プレビューが途切れる原因）
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cell = (s) => escHtml(s).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

function fence(text, lang = '') {
  let ticks = '```';
  while (text.includes(ticks)) ticks += '`';
  return `${ticks}${lang}\n${text}\n${ticks}`;
}

function clipText(text, maxLines = 22, maxChars = 1500) {
  const lines = text.split('\n');
  let out = lines.slice(0, maxLines).join('\n');
  let cut = lines.length > maxLines;
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars)}`;
    cut = true;
  }
  return cut ? `${out}\n…（以下省略）` : out;
}

function quote(text, maxLines = 9) {
  const lines = text.split('\n').slice(0, maxLines);
  const cut = text.split('\n').length > maxLines || text.length > 900;
  let out = lines.join('\n');
  if (out.length > 900) out = `${out.slice(0, 900)}…`;
  else if (cut) out += '\n…';
  return escHtml(out)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}

function renderBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        out.push(fence(clipText(b.text, 18), 'text'), '');
        break;
      case 'code':
        out.push(fence(clipText(b.text, 24), b.lang ?? ''), '');
        break;
      case 'kv': {
        if (b.title) out.push(`**${escHtml(b.title)}**`, '');
        const rows = b.items.slice(0, 14);
        out.push('| 項目 | 内容 |', '|---|---|');
        for (const i of rows) out.push(`| ${cell(i.k)} | ${cell(i.v)}${i.note ? `<br><sub>${cell(i.note)}</sub>` : ''} |`);
        if (b.items.length > rows.length) out.push(`| … | ほか ${b.items.length - rows.length} 項目 |`);
        out.push('');
        break;
      }
      case 'table': {
        if (b.title) out.push(`**${escHtml(b.title)}**`, '');
        const cols = b.columns.slice(0, 8);
        out.push(`| ${cols.map(cell).join(' | ')} |`);
        out.push(`|${cols.map(() => '---').join('|')}|`);
        for (const r of b.rows.slice(0, 12)) {
          out.push(`| ${cols.map((_, i) => cell(r[i] ?? '')).join(' | ')} |`);
        }
        if (b.rows.length > 12) out.push(`| … | ほか ${b.rows.length - 12} 行 |`);
        if (b.note) out.push('', `_${escHtml(b.note)}_`);
        out.push('');
        break;
      }
      case 'notice':
        out.push(quote(`**${b.title ?? '補足'}**\n\n${b.text}`));
        out.push('');
        break;
      case 'markdown': {
        out.push(fence(clipText(b.text, 18), 'markdown'), '');
        const html = String(marked.parse(b.text, { gfm: true, async: false }));
        out.push('**生成される HTML**', '', fence(clipText(html, 26), 'html'), '');
        break;
      }
      case 'html':
        out.push(fence(clipText(b.html, 10), 'html'), '');
        break;
      case 'image':
        // 入力画像はセクション冒頭でリンク/プレビュー済みなので、ここでは省略する
        break;
    }
  }
  return out.join('\n');
}

/* ---------- image helpers ---------- */

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' };
const mimeOf = (f) => MIME[f.toLowerCase().split('.').pop()] ?? 'application/octet-stream';

async function runCase(c) {
  const opts = c.mask ? { mask: true } : {};
  if (c.kind === 'text') return analyze({ kind: 'text', text: c.input }, opts);

  if (c.kind === 'textFile') {
    return analyze(
      { kind: 'text', text: readFileSync(new URL(`../${c.file}`, import.meta.url), 'utf8'), name: basename(c.file) },
      opts,
    );
  }

  if (c.kind === 'dataUri') {
    const b64 = readFileSync(new URL(`../${c.file}`, import.meta.url)).toString('base64');
    return analyze({ kind: 'text', text: `data:${mimeOf(c.file)};base64,${b64}` }, opts);
  }

  if (c.kind === 'imageFiles') {
    const images = [];
    let originBytes = new Uint8Array();
    for (const f of c.files) {
      const bytes = new Uint8Array(readFileSync(new URL(`../${f}`, import.meta.url)));
      if (!originBytes.length) originBytes = bytes;
      const meta = await inspectImage(bytes, { name: basename(f), mime: mimeOf(f) });
      images.push(meta);
    }
    return analyze({ kind: 'image', images, originBytes }, opts);
  }

  throw new Error(`未知の kind: ${c.kind}`);
}

/* ---------- 本文の組み立て ---------- */

const CONF = { high: '高', medium: '中', low: '低' };

function sectionFor(c, analysis, index) {
  const out = [];
  out.push(`### ${index}. ${c.title}${c.mask ? '（マスク ON）' : ''}`, '');
  out.push(`**こういうとき**：${c.story}`, '');

  if (c.inlineImage) {
    out.push(`![QR コード](./${c.inlineImage.replace(/^docs\//, '')})`, '');
  }
  if (c.kind === 'imageFiles') {
    out.push(
      `**入力**: ${c.files.map((f) => `[${escHtml(basename(f))}](./${f.replace(/^docs\//, '')})`).join(' / ')}`,
      '',
    );
    if (c.beforeNote) out.push(`_${c.beforeNote}_`, '');
  } else {
    const before =
      c.kind === 'text'
        ? c.input
        : c.kind === 'dataUri'
          ? `data:${mimeOf(c.file)};base64,${readFileSync(new URL(`../${c.file}`, import.meta.url)).toString('base64')}`
          : readFileSync(new URL(`../${c.file}`, import.meta.url), 'utf8');
    const shown =
      c.kind === 'dataUri'
        ? `${before.slice(0, 120)}…（${before.length.toLocaleString('ja-JP')} 文字）`
        : clipText(before, c.maxLines ?? 20);
    out.push('**before**', '', fence(shown, c.kind === 'textFile' ? 'text' : ''), '');
    if (c.beforeNote) out.push(`_${c.beforeNote}_`, '');
  }

  out.push(`**after${c.mask ? '（機密情報をマスク ON）' : ''}**`, '');
  const p = analysis.primary;
  if (p) {
    out.push(`> **${p.title}**（確度 ${CONF[analysis.confidence] ?? analysis.confidence}）`, '>', quote(analysis.headline));
    out.push('');
    out.push(renderBlocks(p.blocks));
  } else {
    out.push(quote(analysis.headline), '');
  }

  if (analysis.trace.length) {
    out.push(`**解除した手順**: ${analysis.trace.map((t) => t.label).join(' → ')}`, '');
  }
  if (analysis.notes.length) {
    out.push('**補足欄に出るもの**', '');
    for (const n of analysis.notes.slice(0, 3)) {
      if (n.type === 'notice') out.push(quote(`**${n.title ?? '補足'}**\n\n${n.text}`, 9), '');
      else out.push(renderBlocks([n]));
    }
  }
  if (p?.downloads.length) {
    out.push(`**保存できるもの**: ${p.downloads.map((d) => d.label).join(' / ')}`, '');
  }
  if (analysis.evidence.length) {
    out.push(`<sub>判定の根拠: ${analysis.evidence.map((e) => cell(e)).join(' / ')}</sub>`, '');
  }
  return out.join('\n');
}

/* ---------- 実行 ---------- */

const results = [];
let failed = 0;

for (const c of cases) {
  let analysis;
  try {
    analysis = await runCase(c);
  } catch (e) {
    console.error(`✗ ${c.id}: 解析に失敗 ${e.message}`);
    failed++;
    continue;
  }
  const text =
    (analysis.primary?.title ?? '') +
    (analysis.primary?.summary ?? '') +
    JSON.stringify(analysis.primary?.blocks ?? []) +
    analysis.headline +
    JSON.stringify(analysis.notes);
  const primaryId = analysis.primary?.ruleId;
  if (c.expectPrimary && primaryId !== c.expectPrimary) {
    console.error(`✗ ${c.id}: 主結果が ${primaryId}（期待 ${c.expectPrimary}）`);
    failed++;
  }
  for (const needle of c.mustInclude ?? []) {
    if (!text.includes(needle)) {
      console.error(`✗ ${c.id}: 「${needle}」が出力に含まれていません`);
      failed++;
    }
  }
  for (const needle of c.mustNotInclude ?? []) {
    if (text.includes(needle)) {
      console.error(`✗ ${c.id}: 「${needle}」が出力に残っています（マスク漏れ）`);
      failed++;
    }
  }
  results.push({ c, analysis });
}

const groups = [...new Set(results.map((r) => r.c.group))];
const lines = [];

lines.push('# fmt 動作レポート（before → after）', '');
lines.push(
  '> このファイルは `npm run report` で自動生成しています（手で編集しないでください）。',
  '> サンプルは公開して問題ないものだけを使っています（実在の秘密・個人情報・位置情報は含みません）。',
  '',
);
lines.push('**貼る前（before）→ 貼った後（after）** を、実際の出力そのままで並べたものです。', '');
lines.push('## 一覧', '');
lines.push('| # | 貼ったもの | 主結果 | 確度 |');
lines.push('|---|---|---|---|');
results.forEach((r, i) => {
  const conf = CONF[r.analysis.confidence] ?? r.analysis.confidence;
  lines.push(`| ${i + 1} | ${cell(r.c.title)}${r.c.mask ? ' 🔒' : ''} | ${cell(r.analysis.primary?.title ?? '—')} | ${conf} |`);
});
lines.push('');

let n = 0;
for (const g of groups) {
  lines.push(`## ${g}`, '');
  for (const r of results.filter((x) => x.c.group === g)) {
    n++;
    lines.push(sectionFor(r.c, r.analysis, n));
  }
}

lines.push('---', '', '## このレポートについて', '');
lines.push(
  '- 生成: `npm run report`（`tsc` などは不要。Node の型ストリップで `.ts` を直接読み込みます）',
  '- 検証: `npm run test:samples` は生成結果が現在のファイルと一致するか確認します',
  '- サンプルの追加: `scripts/sample-cases.mjs` に 1 件足すと、レポートと検証の両方に反映されます',
  '- 画像の QR 読み取りだけは Node では `@napi-rs/canvas` を使っています（ブラウザでは `OffscreenCanvas`）',
  '',
);

const report = `${lines.join('\n')}\n`;

if (failed) {
  console.error(`\n${failed} 件の検証に失敗しました`);
  process.exit(1);
}

if (CHECK) {
  const current = readFileSync(REPORT_PATH, 'utf8');
  if (current !== report) {
    console.error('docs/report.md が最新の出力と一致しません。`npm run report` を実行してください。');
    process.exit(1);
  }
  console.log(`OK: ${results.length} 件（docs/report.md は最新）`);
} else {
  writeFileSync(REPORT_PATH, report);
  console.log(`docs/report.md を更新しました（${results.length} 件）`);
}
