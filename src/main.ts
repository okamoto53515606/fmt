import type { Analysis } from './types.ts';
import type { WorkerRequest, WorkerResponse, WorkerImage } from './workers/analyze.worker.ts';
import { renderAnalysis, type RenderHandles } from './ui/render.ts';

const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`要素が見つかりません: #${id}`);
  return node as T;
};

const handles: RenderHandles = {
  verdict: $('verdict'),
  alternates: $('alternates'),
  output: $('output'),
  stats: $('stats'),
  notes: $('notes'),
};

const input = $<HTMLTextAreaElement>('input');
const dropzone = $('dropzone');
const imageList = $('imageList');
const fileInput = $<HTMLInputElement>('fileInput');
const optMask = $<HTMLInputElement>('optMask');
const optError = $<HTMLInputElement>('optError');
const status = $('status');
const maskBadge = $('maskBadge');

interface LocalImage extends WorkerImage {
  id: number;
}

const state = {
  images: [] as LocalImage[],
  mask: true,
  explain: true,
  selected: -1,
  seq: 0,
  analysis: null as Analysis | null,
  urls: [] as string[],
  imageId: 0,
};
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT = 4_000_000;

let thumbUrls: string[] = [];

/* ---------------- worker ---------------- */

const worker = new Worker(new URL('./workers/analyze.worker.ts', import.meta.url), { type: 'module' });

worker.addEventListener('message', (ev: MessageEvent<WorkerResponse>) => {
  const res = ev.data;
  if (res.id !== state.seq) return; // 古い結果は捨てる
  if (!res.ok) {
    status.textContent = '解析できませんでした';
    handles.output.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `解析中にエラーが起きました: ${res.error}`;
    handles.output.append(p);
    return;
  }
  state.analysis = res.analysis;
  state.selected = -1;
  status.textContent = '';
  paint();
});

/* ---------------- 描画 ---------------- */

function paint() {
  for (const u of state.urls) URL.revokeObjectURL(u);
  state.urls = [];

  const a = state.analysis;
  if (!a) {
    handles.verdict.innerHTML = '';
    handles.alternates.innerHTML = '';
    handles.output.innerHTML = '';
    handles.stats.innerHTML = '';
    handles.notes.innerHTML = '';
    status.textContent = '';
    return;
  }
  state.urls = renderAnalysis(handles, a, state.selected);

  const total = Object.values(a.maskCounts).reduce((x, y) => x + y, 0);
  maskBadge.textContent = total ? `${total} 件` : '';
  maskBadge.hidden = total === 0;
}

/* ---------------- 解析のスケジュール ---------------- */

let timer = 0;

function schedule(delay = 280) {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, delay);
}

function run() {
  const text = input.value;
  const big = text.length > MAX_TEXT;
  if (state.images.length === 0 && !text.trim()) {
    state.analysis = null;
    paint();
    return;
  }

  state.seq++;
  const req: WorkerRequest = {
    id: state.seq,
    kind: state.images.length ? 'image' : 'text',
    text: big ? text.slice(0, MAX_TEXT) : text,
    images: state.images.map(({ name, mime, originalMime, bytes }) => ({ name, mime, originalMime, bytes })),
    mask: state.mask,
    explain: state.explain,
    truncated: big,
  };
  status.textContent = state.images.length ? '画像を解析しています…' : '解析しています…';
  worker.postMessage(req);
  if (big) {
    status.textContent = '入力が大きいため、先頭 4MB だけを解析しています…';
  }
}

/* ---------------- 入力 ---------------- */

input.addEventListener('input', () => {
  if (state.images.length === 0) schedule(input.value.length > 200_000 ? 700 : 280);
});

dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') fileInput.click();
});

$('btnFile').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files) void addFiles([...fileInput.files]);
  fileInput.value = '';
});

function isImageFile(f: File): boolean {
  return f.type.startsWith('image/') || /\.(heic|heif|avif|webp|png|jpe?g|gif|bmp)$/i.test(f.name);
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heic',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function toImageInput(file: File): Promise<LocalImage | null> {
  if (file.size > MAX_IMAGE_BYTES) {
    status.textContent = `${file.name} は大きすぎます（25MB まで）`;
    return null;
  }
  const originalMime = file.type || guessMime(file.name);
  let bytes = new Uint8Array(await file.arrayBuffer());
  let mime = originalMime;

  if (/heic|heif/i.test(originalMime) || /\.(heic|heif)$/i.test(file.name)) {
    try {
      const heic2any = (await import('heic2any')).default;
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const blob = Array.isArray(out) ? out[0]! : out;
      bytes = new Uint8Array(await blob.arrayBuffer());
      mime = 'image/jpeg';
    } catch {
      status.textContent = `${file.name} を変換できませんでした（HEIC 非対応の環境かもしれません）`;
      return null;
    }
  }
  return { id: ++state.imageId, name: file.name, mime, originalMime, bytes };
}

async function addFiles(files: File[]) {
  const images = files.filter(isImageFile);
  if (images.length === 0) {
    status.textContent = '画像ファイルを選んでください（テキストは上の欄に貼り付けてください）';
    return;
  }
  for (const f of images) {
    const img = await toImageInput(f);
    if (img) state.images.push(img);
  }
  renderImages();
  status.textContent = '';
  run();
}

function renderImages() {
  for (const u of thumbUrls) URL.revokeObjectURL(u);
  thumbUrls = [];
  const urls: string[] = [];
  imageList.innerHTML = '';
  for (const img of state.images) {
    const card = document.createElement('div');
    card.className = 'thumb';
    const url = URL.createObjectURL(new Blob([new Uint8Array(img.bytes)], { type: img.mime }));
    urls.push(url);    const preview = document.createElement('img');
    preview.src = url;
    preview.alt = img.name;
    const meta = document.createElement('div');
    meta.className = 'thumb-meta';
    const name = document.createElement('span');
    name.className = 'thumb-name';
    name.textContent = img.name;
    const size = document.createElement('span');
    size.className = 'thumb-size';
    size.textContent = `${Math.round(img.bytes.length / 1024).toLocaleString('ja-JP')} KB${
      img.originalMime !== img.mime ? '（変換して解析）' : ''
    }`;
    meta.append(name, size);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'thumb-del';
    del.textContent = '×';
    del.title = 'この画像を外す';
    del.addEventListener('click', () => {
      state.images = state.images.filter((x) => x.id !== img.id);
      renderImages();
      run();
    });
    card.append(preview, meta, del);
    imageList.append(card);
  }
  thumbUrls = urls;
}

/* ---------------- ドラッグ＆ドロップ / 貼り付け ---------------- */

// 画面のどこに落としても受け付ける。
// drop は document だけで処理する（body と dropzone の両方に付けると伝播して 2 回追加される）
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-over'));

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-over');
  const files = [...(e.dataTransfer?.files ?? [])];
  if (files.length) void addFiles(files);
});

document.addEventListener('paste', (e) => {
  const items = [...(e.clipboardData?.files ?? [])];
  if (items.length) {
    e.preventDefault();
    void addFiles(items);
  }
});

/* ---------------- オプション ---------------- */

optMask.addEventListener('change', () => {
  state.mask = optMask.checked;
  run();
});
optError.addEventListener('change', () => {
  state.explain = optError.checked;
  run();
});

handles.alternates.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.alt-chip');
  if (!btn) return;
  state.selected = Number(btn.dataset.index ?? '-1');
  paint();
});

/* ---------------- サンプル ---------------- */

const SAMPLES: { label: string; text: string }[] = [
  {
    label: 'JWT',
    text: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  },
  {
    label: 'JSON',
    text: '{"orderId":"A-10023","customer":{"name":"山田 太郎","email":"taro.yamada@example.com"},"items":[{"sku":"P-1","qty":2}],"total":3980,"paid":true}',
  },
  {
    label: 'アクセスログ',
    text: '203.0.113.5 - - [12/Nov/2026:10:00:00 +0900] "GET /index.html HTTP/1.1" 200 5120 "-" "Mozilla/5.0"\n203.0.113.7 - - [12/Nov/2026:10:00:02 +0900] "POST /api/order HTTP/1.1" 502 0 "-" "curl/8.5.0"\n203.0.113.9 - - [12/Nov/2026:10:00:03 +0900] "GET /logo.png HTTP/1.1" 404 0 "-" "Mozilla/5.0"',
  },
  {
    label: 'URL エンコード',
    text: '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E3%80%81%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E3%81%A7%E3%81%99%E3%80%82',
  },
  {
    label: '英語のエラー',
    text: 'Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect (node:net:1598:16)',
  },
];

let sampleIndex = 0;
$('btnSample').addEventListener('click', () => {
  const sample = SAMPLES[sampleIndex % SAMPLES.length]!;
  sampleIndex++;
  input.value = sample.text;
  state.images = [];
  renderImages();
  status.textContent = `例（${sample.label}）を入れました`;
  run();
});

$('btnClear').addEventListener('click', () => {
  input.value = '';
  state.images = [];
  renderImages();
  state.analysis = null;
  paint();
  status.textContent = '';
});

/* ---------------- 使い方 ---------------- */

const help = $('help');
$('btnHelp').addEventListener('click', () => {
  help.hidden = false;
});
help.addEventListener('click', (e) => {
  if (e.target === help || (e.target as HTMLElement).closest('.modal-close')) help.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') help.hidden = true;
});

/* ---------------- 起動 ---------------- */

$('version').textContent = `v${__APP_VERSION__}`;
paint();

// Service Worker は本番ビルドのみ（開発サーバーには sw.js が無い）
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* オフライン対応は無くても動く */
    });
  });
}
