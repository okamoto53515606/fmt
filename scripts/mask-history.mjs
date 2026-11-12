#!/usr/bin/env node
// prompt_history/*.txt を公開できる状態にするスクリプト。
//
// 方針:
//   - 消すのは「認証情報」と「アカウント固有の識別子」だけ。文章は一切変えない。
//   - 伏せ字は REDACTED（読み手が「ここは伏せた」と分かるように）。
//   - 置換パターンに実際の値は書かない（書いたら本末転倒なので、汎用パターンで判定する）。
//
// 使い方:
//   node scripts/mask-history.mjs          # 置換して書き戻す
//   node scripts/mask-history.mjs --check  # 置換せず、残っている機密候補を報告（CI / 公開前チェック用）

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'prompt_history';

// 置換してよい「もともと公開前提」の値（サンプル用のダミー）
const PUBLIC_VALUES = new Set([
  '123456789012', // AWS のドキュメントで使われる例示アカウントID
  'JBSWY3DPEHPK3PXP', // 公開サンプルの TOTP シークレット（レポートの QR と同値）
  'AKIAIOSFODNN7EXAMPLE', // AWS 公式ドキュメントの例示アクセスキー
  'REDACTED', // 置換後の文字列（再実行しても数えない）
]);

const HEADER = [
  '※ 公開にあたり、認証情報・アカウント固有の識別子・個人名だけを "REDACTED" に置き換えています。',
  '   それ以外は原文のままです（置換ルール: scripts/mask-history.mjs）。',
  '',
  '',
].join('\n');

/** 置換ルール。上から順に適用する。 */
const RULES = [
  {
    name: 'AWS アカウントID（12桁の数字）',
    re: /\b\d{12}\b/g,
    to: 'REDACTED',
    allow: (m) => PUBLIC_VALUES.has(m),
  },
  {
    name: 'AWS の一意 ID（IAM ユーザー / ロールなど）',
    re: /\b(?:AIDA|AROA|AGPA|ANPA|APKA|ASCA)[A-Z0-9]{12,}\b/g,
    to: 'REDACTED',
  },
  {
    name: 'ACM 証明書の ID',
    re: /(?<==|certificate\/)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
    to: 'REDACTED',
  },
  {
    name: 'GitHub のアカウント名（URL 内）',
    re: /(?<=(?:github\.com|githubusercontent\.com)\/)[A-Za-z0-9][A-Za-z0-9._-]*/g,
    to: 'REDACTED',
    allow: (m) => m === 'REDACTED',
  },
  {
    name: '端末のホスト名',
    re: /\bubuntu@[A-Za-z0-9][A-Za-z0-9._-]*/g,
    to: 'ubuntu@localhost',
    allow: (m) => m === 'ubuntu@localhost',
  },
  {
    name: 'Gmail の Message-ID',
    re: /<[A-Za-z0-9._%+=~-]{12,}@mail\.gmail\.com>/g,
    to: '<REDACTED@mail.gmail.com>',
  },
  {
    // TOTP シークレットの先頭8文字が grep の検索パターンとして残っていたため
    name: '8文字の base32（TOTP シークレットの断片）',
    re: /(['"`])([A-Z2-7]{8})\1/g,
    to: null, // 下の replace 関数で組み立てる
    allow: (m) => PUBLIC_VALUES.has(m),
    replace: (whole, q, body) => (PUBLIC_VALUES.has(body) ? whole : `${q}REDACTED${q}`),
    matchBody: (_whole, _q, body) => body,
  },
];

/** --check 用: 「まだ残っているかも」を検出するパターン */
const SUSPICIOUS = [
  { name: '12桁の数字（アカウントID の可能性）', re: /\b\d{12}\b/g },
  { name: 'AWS アクセスキー', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'GitHub トークン', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'Slack トークン', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { name: '秘密鍵ブロック', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: '長い base32（TOTP シークレットの可能性）', re: /\b[A-Z2-7]{16,}\b/g },
  { name: 'AWS の一意 ID', re: /\b(?:AIDA|AROA|AGPA|ANPA|APKA|ASCA)[A-Z0-9]{12,}\b/g },
  { name: 'amexec/ARN を含む行', re: /arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:/g },
];

// 人名など、個別に伏せたい語は環境変数で渡す（スクリプト本体に実名を書かないため）
//   MASK_NAMES='Yamada Taro,山田 太郎' node scripts/mask-history.mjs
const extraNames = (process.env.MASK_NAMES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (extraNames.length > 0) {
  RULES.push({
    name: '指定した語（人名など）',
    re: new RegExp(extraNames.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'),
    to: 'REDACTED',
    allow: (m) => m === 'REDACTED',
  });
}

function applyRules(text) {
  const counts = [];
  let out = text;
  for (const rule of RULES) {
    let n = 0;
    out = out.replace(rule.re, (...args) => {
      const whole = args[0];
      const body = rule.matchBody ? rule.matchBody(...args) : whole;
      if (rule.allow && rule.allow(body)) return whole;
      n += 1;
      return rule.replace ? rule.replace(...args) : rule.to;
    });
    counts.push({ name: rule.name, n });
  }
  return { out, counts };
}

function scan(text) {
  const found = [];
  for (const s of SUSPICIOUS) {
    for (const m of text.matchAll(s.re)) {
      const v = m[0];
      if (PUBLIC_VALUES.has(v)) continue;
      found.push({ rule: s.name, value: v });
    }
  }
  return found;
}

const checkOnly = process.argv.includes('--check');
const files = readdirSync(DIR).filter((f) => f.endsWith('.txt') && !f.startsWith('.'));

if (files.length === 0) {
  console.error(`${DIR}/ に .txt がありません`);
  process.exit(1);
}

let problems = 0;

for (const file of files) {
  const path = join(DIR, file);
  const src = readFileSync(path, 'utf8');
  const { out, counts } = applyRules(src);
  const remaining = scan(out);

  console.log(`\n[${file}]`);
  for (const c of counts) {
    if (c.n > 0) console.log(`  置換 ${String(c.n).padStart(3)} 件  ${c.name}`);
  }
  if (counts.every((c) => c.n === 0)) console.log('  置換対象なし（マスク済み）');

  if (remaining.length > 0) {
    problems += remaining.length;
    console.log(`  ⚠ 未処理の可能性 ${remaining.length} 件`);
    const seen = new Set();
    for (const r of remaining) {
      const key = `${r.rule}:${r.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`    - ${r.rule}: ${r.value.slice(0, 40)}`);
    }
  }

  if (!checkOnly && out !== src) {
    // 先頭に「伏せ字にしました」の注記を足す（2 回目以降は足さない）
    const withHeader = out.startsWith(HEADER) ? out : HEADER + out;
    writeFileSync(path, withHeader, 'utf8');
    console.log('  → 書き換えました');
  }
}

if (checkOnly) {
  if (problems > 0) {
    console.error(`\n✗ 公開前に確認が必要な値が ${problems} 件あります`);
    process.exit(1);
  }
  console.log('\n✓ 公開してよい状態です');
}
