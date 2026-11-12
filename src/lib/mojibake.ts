/**
 * Shift_JIS へのエンコード（文字化けの復元用）。
 * ブラウザの TextEncoder は UTF-8 しか作れないので、
 * TextDecoder('shift_jis') を総当たりして逆引き表を実行時に組み立てる。
 */

let table: Map<string, [number, number]> | null = null;

function buildTable(): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>();
  const dec = new TextDecoder('shift_jis', { fatal: true });
  const dec1 = new TextDecoder('shift_jis');
  // 半角カナ（0xA1-0xDF）
  for (let b = 0xa1; b <= 0xdf; b++) {
    const ch = dec1.decode(new Uint8Array([b]));
    if (ch && ch !== '\uFFFD' && !map.has(ch)) map.set(ch, [b, 0]);
  }
  // 全角（2バイト）
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead > 0x9f && lead < 0xe0) continue;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      try {
        const ch = dec.decode(new Uint8Array([lead, trail]));
        if (ch.length === 1 && !map.has(ch)) map.set(ch, [lead, trail]);
      } catch {
        /* 未定義の組み合わせ */
      }
    }
  }
  return map;
}

/** Shift_JIS に変換できなければ null */
export function encodeShiftJis(text: string): Uint8Array | null {
  if (!table) table = buildTable();
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code);
      continue;
    }
    const hit = table.get(ch);
    if (!hit) return null;
    out.push(hit[0]);
    if (hit[1]) out.push(hit[1]);
  }
  return new Uint8Array(out);
}

/** 「UTF-8 のバイト列を Shift_JIS として読んだ」文字化けを復元する */
export function repairMojibake(text: string): { text: string; from: string; to: string } | null {
  if (!/[\u0080-\u00FF]/.test(text)) return null;
  // ラテン1文字 = 1バイトとして戻し、UTF-8 として読み直す
  const bytes = new Uint8Array([...text].map((c) => c.codePointAt(0)! & 0xff));
  try {
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (fixed !== text) return { text: fixed, from: 'UTF-8 を別の文字コードで読んだ', to: 'UTF-8 として復元' };
  } catch {
    /* 次へ */
  }
  // 「UTF-8 のバイト列を Shift_JIS として読んだ」パターン
  const sjis = encodeShiftJis(text);
  if (sjis) {
    try {
      const fixed = new TextDecoder('utf-8', { fatal: true }).decode(sjis);
      if (fixed !== text) return { text: fixed, from: 'UTF-8 を Shift_JIS として読んだ', to: 'UTF-8 として復元' };
    } catch {
      /* 次へ */
    }
  }
  return null;
}

/** 文字化けしている可能性が高いか */
export function looksMojibake(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (sample.length < 2) return false;
  if ((sample.match(/\uFFFD/g)?.length ?? 0) > 0) return true;
  // 「ã」「â」「Ã」など、UTF-8 をラテン1で読んだときの典型
  const latin = sample.match(/[ÃÂãâ][\u0080-\u00BF\u2018-\u203A]/g)?.length ?? 0;
  // 「縺」「繧」「譁」など、UTF-8 を SJIS で読んだときの典型
  const sjis = sample.match(/[縺繧譁閠隶邵螟]/g)?.length ?? 0;
  return latin >= 2 || sjis >= 2;
}
