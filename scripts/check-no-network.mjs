#!/usr/bin/env node
/**
 * 「通信しない」ことの機械的な検査（補助）。
 *
 * 主たる防御は CloudFront の CSP（connect-src 'none'）で、これはその補助。
 * 正規表現ベースなので `navigator['send' + 'Beacon']()` のような書き方には追随できず、
 * 「主要な送信 API が混入していないか」をビルド時に見張るためのもの、という位置づけ。
 *
 * - 通信 API（WebSocket / sendBeacon / EventSource / XHR）が dist に無いこと
 * - 宛先がコードに直書きされた送信（外部 URL への fetch / .src 代入 / SW 登録 / http モジュール読み込み）が無いこと
 * - index.html にインライン script が無いこと（CSP と矛盾しないように）
 * - index.html の参照が相対パスだけであること
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(distDir).filter((f) => /\.(js|mjs|css|html)$/.test(f));
const problems = [];
const warnings = [];

const FORBIDDEN = [
  ['WebSocket', /\bnew\s+WebSocket\s*\(/g],
  ['sendBeacon', /\bsendBeacon\s*\(/g],
  ['EventSource', /\bnew\s+EventSource\s*\(/g],
  ['XMLHttpRequest', /\bnew\s+XMLHttpRequest\s*\(/g],
  // ↓ 宛先がコードに直書きされている送信。CSP 以前に、そもそも書かない。
  ['外部 URL への fetch', /\bfetch\s*\(\s*(['"`])(?:https?:)?\/\//g],
  ['外部 URL への .src 代入', /\.src\s*=\s*(['"`])(?:https?:)?\/\//g],
  ['外部 URL の Worker 生成', /\bnew\s+Worker\s*\(\s*(['"`])(?:https?:)?\/\//g],
  ['外部 URL の SW 登録', /serviceWorker\s*\.\s*register\s*\(\s*(['"`])(?:https?:)?\/\//g],
  ['http/https モジュールの読み込み', /\b(?:import|require)\s*\(\s*(['"`])node:https?\1\s*\)/g],
];

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const where = relative(distDir, f).split(sep).join('/');

  for (const [name, re] of FORBIDDEN) {
    const hits = text.match(re);
    if (hits) problems.push(`${where}: ${name} が ${hits.length} 箇所あります`);
  }
  const fetches = text.match(/\bfetch\s*\(/g);
  if (fetches) warnings.push(`${where}: fetch( が ${fetches.length} 箇所（宛先は実行時に決まる。CSP の connect-src 'none' が防ぐ）`);
}

const html = readFileSync(join(distDir, 'index.html'), 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
  problems.push('index.html: インライン <script> があります（CSP と矛盾します）');
}
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (/^(https?:)?\/\//i.test(ref)) problems.push(`index.html: 外部参照があります: ${ref}`);
}
if (!/connect-src/.test(html)) {
  // CSP はレスポンスヘッダで付けるため、HTML に無いのは正常。念のため記録だけ。
  warnings.push('index.html: CSP は CloudFront のレスポンスヘッダで付与します（template.yaml）');
}

console.log(`[net] 検査したファイル: ${files.length}`);
for (const w of warnings) console.log(`  · ${w}`);

if (problems.length) {
  console.error('\n通信の可能性があるコードが見つかりました:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log('[net] OK: WebSocket / sendBeacon / EventSource / XMLHttpRequest / 外部 URL 直書きの送信はありません');
