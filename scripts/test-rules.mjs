#!/usr/bin/env node
/**
 * ルールのフィクスチャ検証。
 *   npm test
 * Node 24 の型ストリップ機能で .ts を直接読み込む（ビルド不要）。
 */
import assert from 'node:assert/strict';
import { rules } from '../src/rules/index.ts';
import { analyze } from '../src/engine.ts';
import { parseTime } from '../src/lib/der.ts';

const enc = new TextEncoder();
const ctxOf = (text) => ({
  kind: 'text',
  text,
  bytes: enc.encode(text),
  originText: text,
  originBytes: enc.encode(text),
  images: [],
  depth: 0,
  trace: [],
});

let pass = 0;
const failures = [];

for (const rule of rules) {
  if (!rule.fixtures?.length) continue;
  for (const f of rule.fixtures) {
    let got = 0;
    let err = null;
    try {
      const m = rule.detect(ctxOf(f.input));
      got = m?.score ?? 0;
    } catch (e) {
      err = e;
    }
    const want = f.expect.score ?? 0;
    if (err) {
      failures.push(`[${rule.id}] ${f.name}: 例外 ${err}`);
    } else if (got !== want) {
      failures.push(`[${rule.id}] ${f.name}: 期待 ${want} / 実際 ${got}`);
    } else {
      pass++;
    }
  }
}

// エンジン全体の配線チェック
const e2e = [
  {
    name: 'JSON が主結果になる',
    input: '{"name":"太郎","age":20,"tags":["a","b"]}',
    expect: (a) => a.primary?.ruleId === 'json',
  },
  {
    name: 'JWT が主結果になる',
    input:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    expect: (a) => a.primary?.ruleId === 'jwt',
  },
  {
    name: 'Base64 を剥がして JSON を表示する',
    input: Buffer.from(JSON.stringify({ name: '太郎', age: 20, memo: 'テスト用のデータです' })).toString('base64'),
    expect: (a) => a.primary?.ruleId === 'json' && a.trace.some((t) => t.ruleId === 'base64'),
  },
  {
    name: 'URL エンコードを剥がす',
    input: '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E3%80%81%E4%B8%96%E7%95%8C',
    expect: (a) => a.trace.some((t) => t.ruleId === 'urlenc') && a.primary?.ruleId === 'text',
  },
  {
    name: 'ログを表にする',
    input:
      '192.0.2.1 - - [12/Nov/2026:10:00:00 +0900] "GET /a HTTP/1.1" 200 123 "-" "Mozilla/5.0"\n192.0.2.2 - - [12/Nov/2026:10:00:01 +0900] "GET /b HTTP/1.1" 404 0 "-" "curl/8"\n192.0.2.3 - - [12/Nov/2026:10:00:02 +0900] "POST /c HTTP/1.1" 500 9 "-" "curl/8"',
    expect: (a) =>
      a.primary?.ruleId === 'log' &&
      a.notes.some((n) => n.title && /404/.test(n.title) && n.type === 'kv'),
  },
  {
    name: 'マスキングが出力に効く',
    input: '連絡先は taro.yamada@example.com、電話は 090-1234-5678 です。',
    opts: { mask: true },
    expect: (a) => a.primary?.blocks.some((b) => b.type === 'text' && b.text.includes('t***') && !b.text.includes('taro.yamada')),
  },
  {
    name: '空でないテキストは必ず何か返す',
    input: 'ただのメモです。',
    expect: (a) => a.primary !== null && a.headline.length > 0,
  },
  {
    name: 'IIS（W3C 拡張ログ）を表にする',
    input: [
      '#Software: Microsoft Internet Information Services 10.0',
      '#Fields: date time s-ip cs-method cs-uri-stem cs-uri-query s-port cs-username c-ip cs(User-Agent) cs(Referer) sc-status sc-substatus sc-win32-status time-taken',
      '2026-11-13 03:14:02 10.0.0.5 GET /health_check - 443 - 172.31.2.107 Mozilla/5.0+(Windows+NT+10.0) - 200 0 0 185',
      '2026-11-13 03:15:03 10.0.0.5 GET /apple-touch-icon.png - 443 - 172.31.1.38 Mozilla/5.0+(Windows+NT+10.0) - 404 0 2 4',
      '2026-11-13 03:15:03 10.0.0.5 POST /api/order - 443 - 172.31.1.38 curl/8.5.0 - 500 0 0 12',
    ].join('\n'),
    expect: (a) => {
      const t = a.primary?.blocks.find((b) => b.type === 'table');
      return (
        a.primary?.ruleId === 'log' &&
        t.columns.includes('状態') &&
        t.rows.some((r) => r.includes('404')) &&
        t.rows[0].some((v) => /2026年11月13日.*JST/.test(v))
      );
    },
  },
  {
    name: 'Squid（native）を表にする',
    input: [
      '1794287013.173   1064 3.115.104.61 TCP_TUNNEL/200 13621 CONNECT mirrors.fedoraproject.org:443 - HIER_DIRECT/152.2.23.104 -',
      '1794287013.787      0 3.115.104.61 TCP_DENIED/403 3491 GET http://ftp.iij.ad.jp/pub/linux/Fedora/epel/8/Everything/x86_64/repodata/repomd.xml - HIER_NONE/- text/html',
      '1794287013.814     22 3.115.104.61 TCP_MISS/200 4358 GET http://ftp.yz.yamagata-u.ac.jp/pub/linux/fedora-projects/epel/8/Everything/x86_64/repodata/repomd.xml - HIER_DIRECT/133.24.248.16 text/xml',
    ].join('\n'),
    expect: (a) => {
      const t = a.primary?.blocks.find((b) => b.type === 'table');
      return a.primary?.ruleId === 'log' && t.columns.includes('結果') && t.rows.some((r) => r.includes('TCP_DENIED'));
    },
  },
  {
    name: 'HAProxy を表にする',
    input: [
      'Nov 13 03:14:02 localhost haproxy[1228]: 172.31.2.107:35954 [13/Nov/2026:03:14:02.266] xxx_HTTPS_IN backend_https_8080/xxx-web01 0/0/2/183/185 200 1192 - - --NI 1/1/0/0/0 0/0 "GET /health_check HTTP/1.1"',
      'Nov 13 03:15:03 localhost haproxy[1228]: 172.31.1.38:15516 [13/Nov/2026:03:15:03.770] xxx_HTTPS_IN backend_https_49012/xxx-web01 0/0/3/1/4 404 412 - - --NI 3/3/2/2/0 0/0 "GET /apple-touch-icon.png HTTP/1.1"',
      'Nov 13 03:15:03 localhost haproxy[1228]: 172.31.1.38:15528 [13/Nov/2026:03:15:03.775] xxx_HTTPS_IN backend_https_49012/xxx-web01 0/0/0/2/2 404 412 - - --NI 4/4/1/1/0 0/0 "GET /favicon.ico HTTP/1.1"',
    ].join('\n'),
    expect: (a) => {
      const t = a.primary?.blocks.find((b) => b.type === 'table');
      return a.primary?.ruleId === 'log' && t.columns.includes('応答時間') && t.rows.some((r) => r.some((c) => c.includes('/apple-touch-icon.png')));
    },
  },
  {
    name: 'WAF の JSON Lines を表にする（CSV と誤認しない）',
    input: [
      '{"timestamp":1793584615217,"action":"ALLOW","httpRequest":{"clientIp":"20.222.121.96","uri":"/a.js","httpMethod":"GET"}}',
      '{"timestamp":1793584615219,"action":"BLOCK","httpRequest":{"clientIp":"20.222.121.96","uri":"/b.gif","httpMethod":"GET"}}',
    ].join('\n'),
    expect: (a) => {
      const t = a.primary?.blocks.find((b) => b.type === 'table');
      return (
        a.primary?.ruleId === 'jsonl' &&
        t.columns.includes('httpRequest.clientIp') &&
        t.rows.some((r) => r.includes('BLOCK'))
      );
    },
  },
  {
    name: '引用符付き CSV（カンマ入りのセル）を表にする',
    input: ['"注文ID","商品名","数量"', '"A-1001","ボールペン, 黒","3"', '"A-1002","ノート ""A5""","1"'].join('\n'),
    expect: (a) => {
      const t = a.primary?.blocks.find((b) => b.type === 'table');
      return (
        a.primary?.ruleId === 'csv' &&
        t.columns.length === 3 &&
        t.rows.some((r) => r.includes('ボールペン, 黒')) &&
        t.rows.some((r) => r.includes('ノート "A5"'))
      );
    },
  },
];

for (const t of e2e) {
  try {
    const a = await analyze({ kind: 'text', text: t.input }, t.opts ?? {});
    assert.ok(t.expect(a), `${t.name}: 条件を満たしません（primary=${a.primary?.ruleId}, trace=${a.trace
      .map((x) => x.ruleId)
      .join('>')}）`);
    pass++;
  } catch (e) {
    failures.push(`[e2e] ${t.name}: ${e.message}`);
  }
}

// 証明書の時刻表記（RFC 5280 の 2 桁年の解釈）を固定する
// UTCTime: 50〜99 は 19YY、00〜49 は 20YY。ここを外すと有効期限が 100 年ずれる。
const asn1Time = (tag, s) => {
  const bytes = new TextEncoder().encode(s);
  return [bytes, { tag, cls: 0, constructed: false, start: 0, valueStart: 0, end: bytes.length }];
};
const timeCases = [
  ['UTCTime 49 → 2049', 0x17, '491231235959Z', '2049-12-31T23:59:59.000Z'],
  ['UTCTime 50 → 1950', 0x17, '500101000000Z', '1950-01-01T00:00:00.000Z'],
  ['UTCTime 99 → 1999', 0x17, '990101000000Z', '1999-01-01T00:00:00.000Z'],
  ['UTCTime 00 → 2000', 0x17, '000101000000Z', '2000-01-01T00:00:00.000Z'],
  ['GeneralizedTime 2050', 0x18, '20501231235959Z', '2050-12-31T23:59:59.000Z'],
];
for (const [name, tag, raw, want] of timeCases) {
  try {
    const [bytes, tlv] = asn1Time(tag, raw);
    const got = parseTime(bytes, tlv).toISOString();
    assert.equal(got, want, `${name}: ${got}`);
    pass++;
  } catch (e) {
    failures.push(`[der] ${name}: ${e.message}`);
  }
}

// 確認用に、代表的な入力の見え方を出す
const samples = [
  ['JWT', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'],
  ['JSON', '{"a":1,"b":[1,2,3]}'],
  ['TSV', '名前\t年齢\n太郎\t20\n次郎\t30'],
  ['英語エラー', 'Error: connect ECONNREFUSED 127.0.0.1:5432'],
  ['証明書ヘッダのみ', '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'],
];
if (process.argv.includes('--verbose')) {
  for (const [label, input] of samples) {
    const a = await analyze({ kind: 'text', text: input });
    console.log(`\n== ${label} ==`);
    console.log(`  ${a.headline}`);
    console.log(`  primary=${a.primary?.ruleId} confidence=${a.confidence}`);
    console.log(`  notes=${a.notes.length} stats=${a.stats.length} trace=${a.trace.map((t) => t.ruleId).join('>') || '-'}`);
  }
}

if (failures.length) {
  console.error(`\n失敗 ${failures.length} 件 / 成功 ${pass} 件\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`成功 ${pass} 件（失敗 0）`);
