import type { Ctx, StatItem } from '../types.ts';
import { decodeText, formatBytes, sha256Hex } from './bytes.ts';
import { findCharIssues } from './chars.ts';

const countCodePoints = (s: string) => [...s].length;

export async function buildStats(ctx: Ctx): Promise<StatItem[]> {
  const stats: StatItem[] = [];

  if (ctx.kind === 'image') {
    const n = ctx.images.length;
    const totalBytes = ctx.images.reduce((a, i) => a + i.bytes, 0);
    stats.push({ label: '画像の枚数', value: `${n} 枚` });
    stats.push({ label: '合計サイズ', value: formatBytes(totalBytes) });
    if (n === 1) {
      const img = ctx.images[0]!;
      stats.push({ label: '形式', value: img.mime.replace('image/', '').toUpperCase() });
      stats.push({ label: 'サイズ（幅×高さ）', value: `${img.width} × ${img.height} px` });
      stats.push({ label: '総画素数', value: `${(img.width * img.height).toLocaleString('ja-JP')} px` });
      stats.push({ label: 'ファイルサイズ', value: formatBytes(img.bytes) });
      const hasGps = img.exif?.some((e) => e.label.includes('GPS') || e.label.includes('緯度') || e.label.includes('経度'));
      stats.push({
        label: 'GPS 情報',
        value: hasGps ? 'あり（撮影場所が含まれています）' : 'なし',
        warn: Boolean(hasGps),
        note: hasGps ? 'SNS に載せる前に削除を検討してください' : undefined,
      });
      stats.push({
        label: 'EXIF',
        value: img.exif?.length ? `${img.exif.length} 項目` : 'なし',
      });
    }
    const sha = await sha256Hex(ctx.originBytes);
    if (sha) stats.push({ label: 'SHA-256（元データ）', value: sha });
    return stats;
  }

  const text = ctx.originText;
  const bytes = ctx.originBytes;
  const decoded = decodeText(bytes);
  const lines = text.split(/\r\n|\r|\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);

  stats.push({ label: '文字数', value: `${countCodePoints(text).toLocaleString('ja-JP')} 文字` });
  stats.push({ label: '行数', value: `${nonEmpty.length.toLocaleString('ja-JP')} 行（空行を除く）` });
  stats.push({
    label: 'バイト数',
    value: `${formatBytes(bytes.length)}／UTF-8 では ${formatBytes(new TextEncoder().encode(text).length)}`,
  });

  const bom = decoded.bom ? '（BOM あり）' : '';
  stats.push({
    label: '文字コード',
    value: `${decoded.encoding}${bom}`,
    warn: decoded.encoding === 'Shift_JIS' || decoded.encoding === 'UTF-8(不正なバイト)',
    note:
      decoded.encoding === 'Shift_JIS'
        ? 'Excel やメールでは文字化けの原因になります。UTF-8 への変換を検討してください'
        : decoded.encoding === 'UTF-8(不正なバイト)'
          ? '一部のバイトが UTF-8 として不正です（途中で切れている可能性）'
          : 'UTF-8 は現在の標準です。Shift_JIS は Excel や古いメールで多く使われます',
  });

  const crlf = (text.match(/\r\n/g) ?? []).length;
  const loneCr = (text.match(/\r(?!\n)/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  const kinds = [crlf && 'CRLF', lf && 'LF', loneCr && 'CR'].filter(Boolean);
  stats.push({
    label: '改行コード',
    value: kinds.length === 0 ? '改行なし' : kinds.join(' + '),
    warn: kinds.length > 1,
    note:
      kinds.length > 1
        ? '改行が混在しています（プログラムの誤動作の原因になることがあります）'
        : 'LF は Mac/Linux、CRLF は Windows で多い形式です',
  });

  const maxLine = lines.reduce((a, l) => Math.max(a, countCodePoints(l)), 0);
  stats.push({
    label: '最長の行（文字数）',
    value: `${maxLine.toLocaleString('ja-JP')} 文字`,
    note: '横に長すぎる行は、表やログが崩れて見える原因になります',
  });

  const trailing = lines.filter((l) => /[ \t]+$/.test(l)).length;
  if (trailing > 0) stats.push({ label: '行末の余分な空白', value: `${trailing} 行`, warn: true });

  const tabs = lines.filter((l) => l.includes('\t')).length;
  if (tabs > 0) stats.push({ label: 'タブを含む行', value: `${tabs} 行` });

  const control = [...text].filter((c) => {
    const code = c.codePointAt(0)!;
    return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
  });
  if (control.length > 0)
    stats.push({
      label: '制御文字',
      value: `${control.length} 個`,
      warn: true,
      note: '目に見えない文字が混ざっています（コピー貼り付けのトラブルの原因）',
    });

  const zeroWidth = [...text].filter((c) => ['\u200b', '\u200c', '\u200d', '\ufeff', '\u2060'].includes(c));
  if (zeroWidth.length > 0)
    stats.push({
      label: 'ゼロ幅文字',
      value: `${zeroWidth.length} 個`,
      warn: true,
      note: '見えない文字です。検索やログインで一致しない原因になります',
    });

  for (const issue of findCharIssues(text)) {
    stats.push({
      label: `環境依存文字: ${issue.label}`,
      value: `${issue.count} 個（${issue.chars}）`,
      warn: true,
      note: issue.note,
    });
  }

  const sha = await sha256Hex(bytes);
  if (sha)
    stats.push({
      label: 'SHA-256（この入力の指紋）',
      value: sha,
      note: '同じ内容かどうかを確かめるための値です。「入力がハッシュ値かどうか」は、上の判定（ハッシュ値）で調べています',
    });

  return stats;
}
