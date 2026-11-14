#!/usr/bin/env node
/**
 * ビルド後の dist/ から、オフライン用の Service Worker を生成する。
 * 外部 URL は一切含めない（自ホストのファイルだけを列挙する）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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

const files = walk(distDir)
  .filter((f) => !f.endsWith(`${sep}sw.js`))
  .map((f) => `./${relative(distDir, f).split(sep).join('/')}`)
  .sort();

if (!files.includes('./index.html')) {
  console.error('dist/index.html がありません。先に vite build を実行してください。');
  process.exit(1);
}

const hash = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10);

const sw = `/* 自動生成: scripts/gen-sw.mjs（このファイルは編集しない） */
const CACHE = 'fmt-${hash}';
const ASSETS = ${JSON.stringify(files, null, 2)};

self.addEventListener('install', (event) => {
  // 新しい版はすぐ使える状態にする。
  // （待たせると、iOS のようにタブを閉じない環境で永久に旧版のままになる）
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // 初回訪問でもオフラインにできるよう、制御下に置く
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 自ホスト以外には一切アクセスしない（そもそも発生しない）
  if (url.origin !== self.location.origin) return;

  // 画面（HTML）はネットワーク優先。オンラインなら常に最新の HTML を使い、
  // オフラインのときだけキャッシュを使う（古い画面に固定されないように）。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || new Response('', { status: 504 }))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          // 消えたアセットは index.html（HTML）で返ることがある。
          // それを JS/CSS としてキャッシュすると「Unexpected token '<'」になるため掴まない。
          const isHtml = /text\\/html/i.test(res.headers.get('content-type') || '');
          const wantsHtml = req.mode === 'navigate' || /\.html?$/i.test(url.pathname);
          if (isHtml && !wantsHtml) return res;
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
    }),
  );
});
`;

writeFileSync(join(distDir, 'sw.js'), sw);

let total = 0;
for (const f of files) total += statSync(join(distDir, f.replace(/^\.\//, ''))).size;

console.log(
  `[sw] ${files.length} ファイル / ${(total / 1024 / 1024).toFixed(2)} MB をオフライン用に登録（cache: fmt-${hash}）`,
);

// 参考: 生成した sw.js が外部 URL を持たないことを確認
const written = readFileSync(join(distDir, 'sw.js'), 'utf8');
if (/https?:\/\//.test(written)) {
  console.error('[sw] 外部 URL が含まれています');
  process.exit(1);
}

// 構文チェック。壊れた sw.js を配信すると、ブラウザは登録をあきらめて
// 古い Service Worker が残り続ける（更新が届かなくなる）。
try {
  new vm.Script(written, { filename: 'sw.js' });
} catch (e) {
  console.error(`[sw] 構文エラー: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
