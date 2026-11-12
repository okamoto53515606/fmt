import type { ClassifierRule, ImageMeta } from '../types.ts';
import { sniffBinary, bytesToBlob } from '../lib/bytes.ts';
import { inspectImage } from '../lib/imageinfo.ts';
import { result } from './_help.ts';

const IMAGE_KINDS = new Set(['png', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'heic']);

function summarize(images: ImageMeta[]): string {
  if (images.length > 1) return `画像が ${images.length} 枚あります。形式・サイズ・撮影情報を一覧にしました。`;
  const i = images[0]!;
  const exif = i.exif?.length ? '撮影情報（EXIF）も確認しました。' : '撮影情報（EXIF）は含まれていません。';
  return `画像です（${i.mime.replace('image/', '').toUpperCase()}、${i.width}×${i.height}）。${exif}`;
}

export const imageRule: ClassifierRule = {
  id: 'image',
  layer: 'classifier',
  appliesTo: 'both',
  label: '画像',
  weight: 40,
  detect(ctx) {
    if (ctx.kind === 'image') {
      if (ctx.images.length === 0) return null;
      const hasGps = ctx.images.some((i) => i.exif?.some((e) => e.label.includes('GPS')));
      return {
        score: 92,
        confidence: 'high',
        title: '画像（写真・スクリーンショット）',
        summary: summarize(ctx.images),
        evidence: [
          `${ctx.images.length} 枚`,
          ...ctx.images.slice(0, 3).map((i) => `${i.name}: ${i.mime.replace('image/', '')} ${i.width}×${i.height}`),
          ...(hasGps ? ['GPS（撮影場所）が含まれている'] : []),
        ],
      };
    }
    if (!ctx.bytes.length) return null;
    const kind = sniffBinary(ctx.bytes).kind;
    if (!IMAGE_KINDS.has(kind)) return null;
    return {
      score: 93,
      confidence: 'high',
      title: '画像（デコードした結果）',
      summary: `エンコードされたデータの中身は ${kind.toUpperCase()} 画像でした。`,
      evidence: [`先頭に ${kind.toUpperCase()} の印`, `${ctx.bytes.length.toLocaleString('ja-JP')} バイト`],
    };
  },
  async transform(ctx) {
    const extracted = ctx.kind !== 'image';
    let images = ctx.images;
    if (extracted) {
      const kind = sniffBinary(ctx.bytes);
      images = [
        await inspectImage(ctx.bytes, {
          name: ctx.name ?? `decoded.${kind.kind === 'jpeg' ? 'jpg' : kind.kind}`,
          mime: kind.mime,
          note: 'エンコードされたデータから復元した画像です',
        }),
      ];
    }

    const blocks: Parameters<typeof result>[3] = [];
    for (const img of images.slice(0, 4)) {
      if (img.blob) blocks.push({ type: 'image', blob: img.blob, alt: img.name, caption: `${img.name}（${img.width}×${img.height}）` });
    }

    const rows = images.slice(0, 50).map((i) => [
      i.name,
      i.mime.replace('image/', '').toUpperCase(),
      `${i.width}×${i.height}`,
      i.bytes.toLocaleString('ja-JP'),
      i.exif?.some((e) => e.label.includes('GPS')) ? 'あり' : 'なし',
      i.codes?.length ? `${i.codes[0]!.format}` : '—',
    ]);
    blocks.push({
      type: 'table',
      title: images.length > 1 ? `画像の一覧（${images.length} 枚）` : '画像の情報',
      columns: ['ファイル名', '形式', 'サイズ', 'バイト数', 'GPS', 'QR/バーコード'],
      rows,
    });

    for (const img of images.slice(0, 3)) {
      if (img.exif?.length) {
        blocks.push({ type: 'kv', title: `撮影情報（EXIF）: ${img.name}`, items: img.exif.map((e) => ({ k: e.label, v: e.value })) });
      }
    }

    const gps = images.filter((i) => i.exif?.some((e) => e.label.includes('GPS')));
    if (gps.length) {
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: '撮影場所（GPS）が入っています',
        text: `${gps.map((g) => g.name).join(', ')} に位置情報が含まれています。SNS 等に載せる前に、位置情報を削除してください。`,
      });
    }
    for (const img of images) {
      for (const code of img.codes ?? []) {
        const otp = /^otpauth:\/\//i.test(code.text);
        blocks.push({
          type: 'notice',
          level: otp ? 'error' : 'info',
          title: otp ? `${code.format}（2段階認証の設定情報）` : `${code.format} を読み取りました`,
          text: otp
            ? `2段階認証（MFA）に登録するための情報です。\n\n${code.text}\n\nこの中の秘密キー（secret）を知っている人は、あなたのワンタイムパスワードを作れます。画面共有やスクリーンショットに注意してください。`
            : code.text,
        });
      }
    }
    if (images.some((i) => i.originalMime !== i.mime)) {
      blocks.push({
        type: 'notice',
        level: 'info',
        title: '形式を変換して表示しています',
        text: 'iPhone の HEIC など、ブラウザが直接表示できない形式は JPEG に変換して表示しています。元のファイルは変更していません。',
      });
    }

    const downloads = extracted
      ? images.map((i) => ({
          label: `${i.name} を保存`,
          filename: i.name,
          blob: bytesToBlob(ctx.bytes, i.mime),
        }))
      : [];

    return result('image', '画像', '画像の情報を表示しました', blocks, downloads);
  },
};
