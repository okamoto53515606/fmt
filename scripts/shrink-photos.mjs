#!/usr/bin/env node
/**
 * サンプル写真を縮小する（EXIF は元の APP1 をそのまま移植して残す）。
 * 依存を増やさないため、@napi-rs/canvas で縮小し、EXIF セグメントだけ差し替える。
 *
 *   node scripts/shrink-photos.mjs docs/iphone-photo/*.jpeg
 *
 * 注意: 画素は回転せず、元の EXIF（Orientation を含む）をそのまま移植する。
 *       ブラウザは Orientation を見て表示するので、見た目は元と同じになる。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const MAX_EDGE = 1600;
const QUALITY = 80;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('使い方: node scripts/shrink-photos.mjs <file.jpeg>...');
  process.exit(1);
}

/** APP1(Exif) セグメントを取り出す */
function findExifSegment(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) return null;
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2;
      continue;
    }
    if (marker === 0xda) return null; // SOS より前にあるはず
    const len = buf.readUInt16BE(p + 2);
    if (marker === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\u0000\u0000') {
      return buf.subarray(p, p + 2 + len);
    }
    p += 2 + len;
  }
  return null;
}

/** APP1 の中の Orientation(0x0112) を 1 に書き換える（画素は読み込み時に回転済みのため） */
function normalizeOrientation(app1) {
  const tiff = app1.subarray(10); // marker(2) + len(2) + "Exif\0\0"(6)
  if (tiff.length < 8) return;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  if (u16(2) !== 0x2a) return;
  const ifd0 = u32(4);
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) === 0x0112) {
      if (little) tiff.writeUInt16LE(1, entry + 8);
      else tiff.writeUInt16BE(1, entry + 8);
      return;
    }
  }
}

/** SOI の直後（APP0 があればその後ろ）に APP1 を差し込む */
function insertExif(jpeg, app1) {
  if (!app1) return jpeg;
  let at = 2;
  if (jpeg[at] === 0xff && jpeg[at + 1] === 0xe0) {
    at += 2 + jpeg.readUInt16BE(at + 2);
  }
  return Buffer.concat([jpeg.subarray(0, at), app1, jpeg.subarray(at)]);
}

for (const file of files) {
  const original = readFileSync(file);
  const before = original.length;
  const exif = findExifSegment(original);

  const img = await loadImage(original);
  // 画素は向きが適用された状態になるので、出力 EXIF の Orientation を 1 にそろえる
  if (exif) normalizeOrientation(exif);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const encoded = await canvas.encode('jpeg', QUALITY);
  writeFileSync(file, insertExif(encoded, exif));

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`${file}: ${w}x${h} / ${kb(before)} → ${kb(readFileSync(file).length)}`);
}
