/**
 * JSON の整形。非エンジニア向けに、構文エラーの位置と「よくある原因」を日本語で返す。
 * 数値は生の文字列のまま保持する（64bit 超の ID が壊れないように）。
 */

export type JNode =
  | { kind: 'obj'; entries: { key: string; value: JNode }[] }
  | { kind: 'arr'; items: JNode[] }
  | { kind: 'str'; raw: string }
  | { kind: 'num'; raw: string }
  | { kind: 'lit'; raw: string };

export interface JsonError {
  message: string;
  hint?: string;
  offset: number;
  line: number;
  col: number;
  /** エラー行の前後（最大3行）と、その行の中での位置 */
  snippet: { line: number; text: string }[];
}

export type JsonParseResult = { ok: true; root: JNode } | { ok: false; error: JsonError };

class Err extends Error {
  offset: number;
  hint?: string;
  constructor(message: string, offset: number, hint?: string) {
    super(message);
    this.offset = offset;
    this.hint = hint;
  }
}

function locate(src: string, offset: number): { line: number; col: number; snippet: { line: number; text: string }[] } {
  const before = src.slice(0, offset);
  const line = before.split('\n').length;
  const col = offset - (before.lastIndexOf('\n') + 1) + 1;
  const lines = src.split('\n');
  const from = Math.max(0, line - 2);
  const to = Math.min(lines.length, line + 1);
  const snippet: { line: number; text: string }[] = [];
  for (let i = from; i < to; i++) snippet.push({ line: i + 1, text: lines[i] ?? '' });
  return { line, col, snippet };
}

const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\uFEFF';

class Parser {
  s: string;
  i = 0;
  constructor(s: string) {
    this.s = s;
  }
  skipWs() {
    while (this.i < this.s.length && isWs(this.s[this.i]!)) this.i++;
  }
  fail(msg: string, hint?: string): never {
    throw new Err(msg, this.i, hint);
  }
  parse(): JNode {
    this.skipWs();
    const v = this.value();
    this.skipWs();
    if (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === ',') this.fail('値のあとに余分なカンマ（,）があります', 'カンマは値と値の間だけに書けます');
      this.fail(`想定していない文字「${c}」があります`, '括弧（{ } [ ]）やカンマの対応を確認してください');
    }
    return v;
  }
  value(): JNode {
    this.skipWs();
    if (this.i >= this.s.length) this.fail('値が途中で終わっています', '閉じ括弧や閉じ引用符が足りない可能性があります');
    const c = this.s[this.i]!;
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === '"') return { kind: 'str', raw: this.string() };
    if (c === "'") this.fail('文字列は「"」で囲みます', "シングルクォート（'）は JSON では使えません");
    if (c === '/' && (this.s[this.i + 1] === '/' || this.s[this.i + 1] === '*'))
      this.fail('JSON にコメントは書けません', '「//」や「/* */」を削除してください');
    if (c === '-' || (c >= '0' && c <= '9')) return { kind: 'num', raw: this.number() };
    if (this.s.startsWith('true', this.i)) return this.lit('true');
    if (this.s.startsWith('false', this.i)) return this.lit('false');
    if (this.s.startsWith('null', this.i)) return this.lit('null');
    if (this.s.startsWith('True', this.i) || this.s.startsWith('False', this.i) || this.s.startsWith('None', this.i))
      this.fail('JSON では true / false / null と書きます', 'Python の True / False / None は使えません');
    this.fail(`「${c}」は値として読めません`, '文字列は「"」で囲む必要があります');
  }
  lit(word: string): JNode {
    this.i += word.length;
    return { kind: 'lit', raw: word };
  }
  string(): string {
    const start = this.i;
    this.i++; // "
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === '\\') {
        this.i += 2;
        continue;
      }
      if (c === '"') {
        this.i++;
        return this.s.slice(start, this.i);
      }
      if (c === '\n') this.fail('文字列が改行で終わっています', '閉じ引用符（"）が足りません');
      this.i++;
    }
    this.fail('文字列が閉じていません', '閉じ引用符（"）を追加してください');
  }
  number(): string {
    const start = this.i;
    if (this.s[this.i] === '-') this.i++;
    while (this.i < this.s.length && /[0-9.eE+-]/.test(this.s[this.i]!)) this.i++;
    const raw = this.s.slice(start, this.i);
    if (!/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(raw))
      this.fail(`数値「${raw}」の書き方が不正です`, '先頭の 0 や、小数点の位置を確認してください');
    return raw;
  }
  object(): JNode {
    const entries: { key: string; value: JNode }[] = [];
    this.i++; // {
    this.skipWs();
    if (this.s[this.i] === '}') {
      this.i++;
      return { kind: 'obj', entries };
    }
    for (;;) {
      this.skipWs();
      if (this.s[this.i] !== '"')
        this.fail('項目名（キー）は「"」で囲んだ文字列で書きます', 'キーの後ろに「:」が必要です');
      const key = this.string();
      this.skipWs();
      if (this.s[this.i] !== ':') this.fail('キーのあとに「:」がありません', `「${key.slice(1, -1)}」の後ろに : を追加してください`);
      this.i++;
      entries.push({ key, value: this.value() });
      this.skipWs();
      const c = this.s[this.i];
      if (c === ',') {
        this.i++;
        this.skipWs();
        const n = this.s[this.i];
        if (n === '}' || n === ']')
          this.fail('最後の項目のあとにカンマ（,）が残っています', '末尾のカンマを削除してください');
        continue;
      }
      if (c === '}') {
        this.i++;
        return { kind: 'obj', entries };
      }
      if (c === undefined) this.fail('オブジェクトが閉じていません', '閉じ波括弧（}）を追加してください');
      this.fail('項目のあとにカンマ（,）が必要です', '次の項目を追加するか、} で閉じてください');
    }
  }
  array(): JNode {
    const items: JNode[] = [];
    this.i++; // [
    this.skipWs();
    if (this.s[this.i] === ']') {
      this.i++;
      return { kind: 'arr', items };
    }
    for (;;) {
      items.push(this.value());
      this.skipWs();
      const c = this.s[this.i];
      if (c === ',') {
        this.i++;
        this.skipWs();
        const n = this.s[this.i];
        if (n === ']' || n === '}')
          this.fail('最後の要素のあとにカンマ（,）が残っています', '末尾のカンマを削除してください');
        continue;
      }
      if (c === ']') {
        this.i++;
        return { kind: 'arr', items };
      }
      if (c === undefined) this.fail('配列が閉じていません', '閉じ角括弧（]）を追加してください');
      this.fail('要素のあとにカンマ（,）が必要です', '次の要素との間に , を入れてください');
    }
  }
}

export function parseJson(src: string): JsonParseResult {
  try {
    const root = new Parser(src).parse();
    return { ok: true, root };
  } catch (e) {
    if (e instanceof Err) {
      const { line, col, snippet } = locate(src, e.offset);
      return { ok: false, error: { message: e.message, hint: e.hint, offset: e.offset, line, col, snippet } };
    }
    return {
      ok: false,
      error: { message: 'JSON として読めませんでした', offset: 0, line: 1, col: 1, snippet: [] },
    };
  }
}

export function renderJson(node: JNode, indent = 2): string {
  const pad = (n: number) => ' '.repeat(n * indent);
  const walk = (n: JNode, depth: number): string => {
    switch (n.kind) {
      case 'str':
      case 'num':
      case 'lit':
        return n.raw;
      case 'arr': {
        if (n.items.length === 0) return '[]';
        // 数値・文字列だけの短い配列は1行にまとめる（読みやすさ優先）
        const simple = n.items.every((x) => x.kind !== 'obj' && x.kind !== 'arr');
        const oneLine = simple && n.items.length <= 8;
        if (oneLine) return `[${n.items.map((x) => walk(x, depth)).join(', ')}]`;
        return `[\n${n.items.map((x) => pad(depth + 1) + walk(x, depth + 1)).join(',\n')}\n${pad(depth)}]`;
      }
      case 'obj': {
        if (n.entries.length === 0) return '{}';
        return `{\n${n.entries
          .map((e) => `${pad(depth + 1)}${e.key}: ${walk(e.value, depth + 1)}`)
          .join(',\n')}\n${pad(depth)}}`;
      }
    }
  };
  return walk(node, 0);
}

export interface JsonSummary {
  topLevel: 'object' | 'array' | 'value';
  topLevelCount: number;
  keys: string[];
  nodes: number;
  maxDepth: number;
  numbers: { raw: string; safe: boolean }[];
}

export function summarizeJson(root: JNode): JsonSummary {
  let nodes = 0;
  let maxDepth = 0;
  const numbers: { raw: string; safe: boolean }[] = [];
  const walk = (n: JNode, depth: number) => {
    nodes++;
    maxDepth = Math.max(maxDepth, depth);
    if (n.kind === 'num') {
      const asNum = Number(n.raw);
      numbers.push({ raw: n.raw, safe: Number.isSafeInteger(asNum) || !Number.isInteger(asNum) });
    } else if (n.kind === 'obj') {
      for (const e of n.entries) walk(e.value, depth + 1);
    } else if (n.kind === 'arr') {
      for (const i of n.items) walk(i, depth + 1);
    }
  };
  walk(root, 1);
  const topLevel = root.kind === 'obj' ? 'object' : root.kind === 'arr' ? 'array' : 'value';
  return {
    topLevel,
    topLevelCount: root.kind === 'obj' ? root.entries.length : root.kind === 'arr' ? root.items.length : 1,
    keys: root.kind === 'obj' ? root.entries.map((e) => JSON.parse(e.key) as string) : [],
    nodes,
    maxDepth,
    numbers,
  };
}

/** JSON らしい見た目か（壊れていても判定できるように、緩く見る） */
export function looksLikeJson(s: string): boolean {
  const t = s.trim();
  if (t.length < 2) return false;
  const starts = /^[{[]/.test(t);
  if (!starts) return false;
  if (/[:]/.test(t)) return true;
  return /^\s*\[\s*[{["\d-]/.test(t);
}

export function formatJsonError(err: JsonError): string {
  const lines = err.snippet.map((s) => `${String(s.line).padStart(4, ' ')} | ${s.text}`).join('\n');
  const caretPad = ' '.repeat(Math.max(0, err.col - 1));
  return `${lines}\n     | ${caretPad}^\n\n${err.line}行目の ${err.col} 文字目: ${err.message}${
    err.hint ? `\nヒント: ${err.hint}` : ''
  }`;
}
