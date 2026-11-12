#!/usr/bin/env node
/**
 * 「通信しない」ことの機械的な検査。
 *
 * - 通信 API（WebSocket / sendBeacon / EventSource / XHR）が dist に無いこと
 * - fetch は件数を表示（CSP で外部は遮断されるが、目視確認できるようにする）
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
];

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const where = relative(distDir, f).split(sep).join('/');

  for (const [name, re] of FORBIDDEN) {
    const hits = text.match(re);
    if (hits) problems.push(`${where}: ${name} が ${hits.length} 箇所あります`);
  }
  const fetches = text.match(/\bfetch\s*\(/g);
  if (fetches) warnings.push(`${where}: fetch( が ${fetches.length} 箇所`);
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

console.log('[net] OK: WebSocket / sendBeacon / EventSource / XMLHttpRequest はありません');
