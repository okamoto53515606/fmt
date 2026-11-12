#!/usr/bin/env node
/**
 * SNS・画像検索用のメイン画像（1200×630）を生成する。
 *
 *   npm run og
 *
 * 出力: public/og.png
 * 日本語フォントはシステムの Noto Sans CJK JP を使用（無ければ IPAexGothic）。
 */
import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const W = 1200;
const H = 630;

const JP = [
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf',
  '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
];
const MONO = ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'];

for (const p of JP) {
  try {
    GlobalFonts.registerFromPath(p);
  } catch {
    /* 無いフォントはスキップ */
  }
}
for (const p of MONO) {
  try {
    GlobalFonts.registerFromPath(p);
  } catch {
    /* 同上 */
  }
}
const FAMILY = GlobalFonts.has('Noto Sans CJK JP') ? 'Noto Sans CJK JP' : 'IPAexGothic';
const MONOFAMILY = GlobalFonts.has('DejaVu Sans Mono') ? 'DejaVu Sans Mono' : FAMILY;

const C = {
  bgTop: '#00294f',
  bgBottom: '#000f22',
  panel: '#01305c',
  panel2: '#012a51',
  border: '#175f9e',
  text: '#eaf3ff',
  muted: '#9fbbd8',
  dim: '#7fa0c2',
  accent: '#6fc3ff',
  ok: '#45e0a0',
  warn: '#ffc44d',
  danger: '#ff8b8b',
};

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

const font = (size, weight = 'normal', family = FAMILY) => `${weight} ${size}px "${family}"`;

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pill(text, x, y, opts = {}) {
  const size = opts.size ?? 15;
  const padX = opts.padX ?? 14;
  const height = opts.height ?? size + 16;
  ctx.font = font(size, opts.weight ?? 'bold');
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = opts.bg ?? 'rgba(69, 224, 160, 0.12)';
  roundRect(x, y, w, height, height / 2);
  ctx.fill();
  if (opts.border !== false) {
    ctx.strokeStyle = opts.borderColor ?? 'rgba(69, 224, 160, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = opts.fg ?? C.ok;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + height / 2 + 1);
  return w;
}

function wrap(text, maxWidth, size, family = FAMILY, weight = 'normal') {
  ctx.font = font(size, weight, family);
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- 背景 ---------- */
const grad = ctx.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, C.bgTop);
grad.addColorStop(1, C.bgBottom);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);

// うっすらとしたひし形（右側）
ctx.save();
ctx.strokeStyle = 'rgba(111, 195, 255, 0.10)';
ctx.lineWidth = 2;
for (let i = 0; i < 3; i++) {
  const s = 260 + i * 120;
  ctx.beginPath();
  ctx.moveTo(1010, 315 - s / 2);
  ctx.lineTo(1010 + s / 2, 315);
  ctx.lineTo(1010, 315 + s / 2);
  ctx.lineTo(1010 - s / 2, 315);
  ctx.closePath();
  ctx.stroke();
}
ctx.restore();

/* ---------- ロゴ ---------- */
const lx = 76;
const ly = 66;
ctx.save();
ctx.fillStyle = '#00162e';
ctx.strokeStyle = C.accent;
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(lx + 26, ly);
ctx.lineTo(lx + 52, ly + 26);
ctx.lineTo(lx + 26, ly + 52);
ctx.lineTo(lx, ly + 26);
ctx.closePath();
ctx.fill();
ctx.stroke();
ctx.fillStyle = C.text;
ctx.font = font(16, 'bold');
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('fmt', lx + 26, ly + 27);
ctx.restore();

ctx.textAlign = 'left';
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = C.text;
ctx.font = font(34, 'bold');
ctx.fillText('fmt', lx + 66, ly + 38);
ctx.fillStyle = C.dim;
ctx.font = font(15);
ctx.fillText('decode & format', lx + 132, ly + 37);

/* ---------- 見出し ---------- */
ctx.fillStyle = C.text;
ctx.font = font(52, 'bold');
ctx.fillText('貼るだけで、', lx, 196);
ctx.fillStyle = C.accent;
ctx.fillText('「これ何？」がわかる', lx, 260);

ctx.fillStyle = C.muted;
ctx.font = font(21);
ctx.fillText('意味不明な文字列・ログ・画像を、日本語で説明します', lx, 308);

/* ---------- 機能チップ ---------- */
const chips = ['JWT', 'JSON', 'ログ', '画像・QR', 'CSV', '証明書', '文字化け', 'エラー解説'];
let cx = lx;
let cy = 344;
for (const label of chips) {
  ctx.font = font(16, 'bold');
  const w = ctx.measureText(label).width + 26;
  if (cx + w > 430) {
    cx = lx;
    cy += 44;
  }
  ctx.fillStyle = 'rgba(111, 195, 255, 0.12)';
  roundRect(cx, cy, w, 34, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 195, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.accent;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx + 13, cy + 18);
  ctx.textBaseline = 'alphabetic';
  cx += w + 8;
}

/* ---------- 右：before → after パネル ---------- */
const px = 640;
const py = 72;
const pw = 486;
const ph = 470;

ctx.fillStyle = C.panel;
roundRect(px, py, pw, ph, 20);
ctx.fill();
ctx.strokeStyle = C.border;
ctx.lineWidth = 1.5;
ctx.stroke();

const innerX = px + 30;
const innerW = pw - 60;

ctx.fillStyle = C.dim;
ctx.font = font(12, 'bold');
ctx.fillText('入力（before）', innerX, py + 40);

const jwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

ctx.save();
ctx.beginPath();
roundRect(innerX - 8, py + 54, innerW + 16, 92, 10);
ctx.clip();
ctx.fillStyle = C.panel2;
roundRect(innerX - 8, py + 54, innerW + 16, 92, 10);
ctx.fill();
ctx.fillStyle = C.muted;
ctx.font = font(12.5, 'normal', MONOFAMILY);
const jwtLines = wrap(jwt, innerW, 12.5, MONOFAMILY).slice(0, 3);
jwtLines.forEach((line, i) => {
  const text = i === jwtLines.length - 1 ? `${line.slice(0, 46)}…` : line;
  ctx.fillText(text, innerX, py + 78 + i * 20);
});
ctx.restore();

// 矢印
ctx.fillStyle = C.accent;
ctx.font = font(24, 'bold');
ctx.textAlign = 'center';
ctx.fillText('↓', px + pw / 2, py + 182);
ctx.textAlign = 'left';

ctx.fillStyle = C.dim;
ctx.font = font(12, 'bold');
ctx.fillText('結果（after）', innerX, py + 216);

ctx.fillStyle = C.accent;
ctx.font = font(18, 'bold');
ctx.fillText('JWT（ログイン情報のトークン）', innerX, py + 250);

ctx.fillStyle = C.text;
ctx.font = font(14.5);
wrap('JWT です。ログイン状態を表す札のようなもので、中身は誰でも読めます。', innerW, 14.5).forEach((line, i) => {
  ctx.fillText(line, innerX, py + 280 + i * 24);
});

// 有効期限（日本時間）
const rowY = py + 348;
ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
roundRect(innerX - 8, rowY, innerW + 16, 58, 10);
ctx.fill();

ctx.fillStyle = C.muted;
ctx.font = font(13);
ctx.fillText('有効期限', innerX, rowY + 24);

ctx.fillStyle = C.text;
ctx.font = font(15, 'bold');
ctx.fillText('2023年11月15日(水) 07:13:20 JST', innerX, rowY + 46);

// 期限切れの札
ctx.font = font(12, 'bold');
const tagW = ctx.measureText('期限切れ').width + 18;
const tagX = innerX + innerW - tagW + 8;
ctx.fillStyle = 'rgba(255, 139, 139, 0.16)';
roundRect(tagX, rowY + 10, tagW, 24, 12);
ctx.fill();
ctx.strokeStyle = 'rgba(255, 139, 139, 0.5)';
ctx.lineWidth = 1;
ctx.stroke();
ctx.fillStyle = C.danger;
ctx.fillText('期限切れ', tagX + 9, rowY + 27);

ctx.fillStyle = C.muted;
ctx.font = font(13);
ctx.fillText('署名は確認していません（表示のみ）', innerX, py + 436);

/* ---------- 下：バッジとドメイン ---------- */
let bx = lx;
bx += pill('通信しません', bx, 540) + 10;
bx += pill('AIは使っていません', bx, 540) + 10;
pill('オフラインで動きます', bx, 540);

ctx.fillStyle = C.dim;
ctx.font = font(16);
ctx.textAlign = 'right';
ctx.fillText('fmt.okamomedia.tokyo', W - 76, 566);
ctx.textAlign = 'left';

/* ---------- 保存 ---------- */
const png = await canvas.encode('png');
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log(`public/og.png を生成しました（${W}×${H}, ${(png.length / 1024).toFixed(0)} KB）`);
