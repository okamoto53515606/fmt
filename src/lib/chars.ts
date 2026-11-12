/** 環境依存文字（昔の「機種依存文字」）の検出。 */

export interface CharIssue {
  label: string;
  chars: string;
  count: number;
  note: string;
}

const GROUPS: { label: string; re: RegExp; note: string }[] = [
  {
    label: '半角カナ',
    re: /[\uFF61-\uFF9F]/g,
    note: 'メールや古いシステムで文字化けの原因になります',
  },
  {
    label: '丸数字・括弧数字',
    re: /[\u2460-\u24FF]/g,
    note: '環境によって「?」になります。1. 2. や (1) が安全です',
  },
  {
    label: 'ローマ数字',
    re: /[\u2160-\u217F]/g,
    note: 'I, II, III と書くか、英字で代用できます',
  },
  {
    label: '単位・略号',
    re: /[\u3300-\u33FF\u2116\u2121\u2116\u2122]/g,
    note: '㈱ ㌔ ℡ など。展開して書くのが安全です',
  },
  {
    label: '外字・異体字',
    re: /[髙﨑邊邉瀨榮禮德惠愼卍]/g,
    note: '人によっては表示できないことがあります（氏名で注意）',
  },
  {
    label: '環境依存の記号',
    re: /[\uF860-\uF8FF\uE000-\uF8FF]/g,
    note: '外字領域の文字です。PDF にすると欠けることがあります',
  },
];

export function findCharIssues(text: string): CharIssue[] {
  const out: CharIssue[] = [];
  for (const g of GROUPS) {
    const hits = text.match(g.re);
    if (!hits?.length) continue;
    out.push({
      label: g.label,
      chars: [...new Set(hits)].slice(0, 12).join(' '),
      count: hits.length,
      note: g.note,
    });
  }
  return out;
}
