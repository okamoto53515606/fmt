#!/usr/bin/env node
/**
 * ビルド後の dist/ から、オフライン用の Service Worker を生成する。
 * 外部 URL は一切含めない（自ホストのファイルだけを列挙する）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
  // skipWaiting はしない。開いているタブが旧 SW のキャッシュを使い続けられるようにし、
  // 「旧ページ + 新キャッシュ（古いチャンクは消えている）」という壊れ方を避ける。
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

// どうしても即時に切り替えたい場合だけ、ページ側から明示的に送る
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      // 初回訪問でもオフラインにできるよう、制御下に置く（切り替えは skipWaiting 側で制御）
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 自ホスト以外には一切アクセスしない（そもそも発生しない）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          // 消えたアセットは index.html（HTML）で返ることがある。
          // それを JS/CSS としてキャッシュすると「Unexpected token '<'」になるため掴まない。
          const isHtml = /text\/html/i.test(res.headers.get('content-type') || '');
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
