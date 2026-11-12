#!/usr/bin/env node
/**
 * 公開用サンプルの安全チェック。
 *
 * docs/ 配下の画像に「2段階認証の設定情報（otpauth://）」が写っていないか調べる。
 * 公開リポジトリに実物の TOTP シークレットを入れないための歯止め。
 *
 *   npm run check:samples
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import './node-canvas-shim.mjs';
import { decodeBarcodes } from '../src/lib/imageinfo.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const docsDir = join(root, 'docs');
const MAX_BYTES = 2 * 1024 * 1024; // QR は小さい。大きい写真は対象外（時間優先）

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(png|jpe?g|webp|gif)$/i.test(name)) out.push(full);
  }
  return out;
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const problems = [];

// レポート用に、公開サンプル値（Google 認証器の解説などで使われる値）だけは許可する
const ALLOWED_SECRETS = new Set(['JBSWY3DPEHPK3PXP']);

for (const file of walk(docsDir)) {
  const size = statSync(file).size;
  if (size > MAX_BYTES) continue;
  const ext = file.toLowerCase().split('.').pop();
  const bytes = new Uint8Array(readFileSync(file));
  const codes = await decodeBarcodes(new Blob([bytes], { type: MIME[ext] ?? 'application/octet-stream' }));
  for (const c of codes) {
    if (/^otpauth:\/\//i.test(c.text)) {
      const secret = /[?&]secret=([A-Z2-7]+)/i.exec(c.text)?.[1]?.toUpperCase();
      if (secret && ALLOWED_SECRETS.has(secret)) continue;
      problems.push(`${relative(root, file).split(sep).join('/')} に 2段階認証のシークレットが含まれています`);
      continue;
    }
    if (/\bsecret=[A-Z2-7]{8,}/i.test(c.text)) {
      problems.push(`${relative(root, file).split(sep).join('/')} に secret= が含まれています`);
    }
  }
}

if (problems.length) {
  console.error('公開しないでください:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\n対処: その画像をリポジトリから外し、AWS 等の MFA デバイスを再登録してください。');
  console.error('デモ用の QR は `docs/bar-code/qr-sample.png`（ただの URL）を使ってください。');
  process.exit(1);
}

console.log('OK: docs/ の画像に 2段階認証のシークレットはありません');
