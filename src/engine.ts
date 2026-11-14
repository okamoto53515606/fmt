import type {
  Analysis,
  Block,
  ClassifierRule,
  Ctx,
  ImageMeta,
  Match,
  Result,
  StatItem,
  TraceStep,
  WrapperRule,
} from './types.ts';
import { isAnnotator, isClassifier, isWrapper } from './types.ts';
import { rules } from './rules/index.ts';
import { decodeText, looksLikeText, sha256Hex, utf8 } from './lib/bytes.ts';
import { emptyCounts, maskText } from './lib/mask.ts';
import { buildStats } from './lib/stats.ts';

const MAX_DEPTH = 3;
const PRIMARY_MIN = 55;
const ALTERNATE_MIN = 22;
/** これより大きい入力では「ほかの見方」を 1 つだけ作る（変換の作りすぎで数秒待たされるのを防ぐ） */
const BIG_INPUT = 100_000;
const MAX_BUILDS_BIG = 2;

export interface TextInput {
  kind: 'text';
  text: string;
  bytes?: Uint8Array;
  name?: string;
}

export interface ImageListInput {
  kind: 'image';
  images: ImageMeta[];
  originBytes: Uint8Array;
  name?: string;
}

export type Input = TextInput | ImageListInput;

export interface AnalyzeOptions {
  /** 機密情報のマスキングを適用する（表示・ダウンロードとも） */
  mask?: boolean;
  /** エラーの意味（辞書）を出す */
  explain?: boolean;
}

const wrappers = rules.filter(isWrapper) as WrapperRule[];
const classifiers = rules.filter(isClassifier) as ClassifierRule[];
const annotators = rules.filter(isAnnotator);

function baseCtx(input: Input): Ctx {
  if (input.kind === 'text') {
    const bytes = input.bytes ?? utf8(input.text);
    return {
      kind: 'text',
      text: input.text,
      bytes,
      originText: input.text,
      originBytes: bytes,
      name: input.name,
      images: [],
      depth: 0,
      trace: [],
    };
  }
  return {
    kind: 'image',
    text: '',
    bytes: input.originBytes,
    originText: '',
    originBytes: input.originBytes,
    name: input.name,
    images: input.images,
    depth: 0,
    trace: [],
  };
}

const applies = (rule: { appliesTo: string }, ctx: Ctx) =>
  rule.appliesTo === 'both' || rule.appliesTo === ctx.kind;

/** wrapper を可能な限り剥がす（最大 MAX_DEPTH 回） */
function unwrapAll(start: Ctx): { ctx: Ctx; trace: TraceStep[] } {
  const trace: TraceStep[] = [];
  let ctx = start;
  if (ctx.kind !== 'text') return { ctx, trace };

  for (let d = 0; d < MAX_DEPTH; d++) {
    let best: { rule: WrapperRule; match: Match } | null = null;
    for (const rule of wrappers) {
      if (!applies(rule, ctx)) continue;
      if (trace.some((t) => t.ruleId === rule.id)) continue;
      let m: Match | null = null;
      try {
        m = rule.detect(ctx);
      } catch {
        m = null;
      }
      if (!m || m.score < 65) continue;
      if (!best || m.score > best.match.score) best = { rule, match: m };
    }
    if (!best) break;
    let out: { bytes: Uint8Array; text?: string; detail: string } | null = null;
    try {
      out = best.rule.unwrap(ctx);
    } catch {
      out = null;
    }
    if (!out) break;
    trace.push({ ruleId: best.rule.id, label: best.match.title, detail: out.detail });
    const text = out.text ?? (looksLikeText(out.bytes) ? decodeText(out.bytes).text : '');
    ctx = { ...ctx, text, bytes: out.bytes, depth: d + 1, trace: [...trace] };
    if (!text && out.bytes.length === 0) break;
  }
  return { ctx, trace };
}

function headlineFor(primary: { match: Match } | null, alternates: { title: string; score: number }[], trace: TraceStep[]): string {
  const steps = trace.length ? `${trace.map((t) => t.label).join(' → ')} を解除しました。` : '';
  if (!primary) {
    const hint = alternates.find((a) => a.score >= 40);
    return `${steps}はっきりした形式ではありませんでした。テキストとして表示しています。${
      hint ? `（もしかすると ${hint.title} かもしれません）` : ''
    }`;
  }
  const { match } = primary;
  if (match.score >= 80) return `${steps}${match.summary}`;
  if (match.score >= PRIMARY_MIN) return `${steps}${match.summary}（推定）`;
  return `${steps}これといって特徴のないテキストです。そのまま表示しています。`;
}

/** マスキングを出力（表示用ブロックとテキスト系ダウンロード）に適用する */
async function applyMaskBlocks(blocks: Block[], accounts: ReadonlySet<string>): Promise<Block[]> {
  // 別のブロックで判明したアカウントIDを、断片的なセルにも効かせる
  const m = (s: string) => (accounts.size ? maskText(s, accounts).text : maskText(s).text);
  const out: Block[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
      case 'code':
      case 'markdown':
        out.push({ ...b, text: m(b.text) });
        break;
      case 'kv':
        out.push({
          ...b,
          title: b.title === undefined ? undefined : m(b.title),
          items: b.items.map((i) => ({ ...i, v: m(i.v) })),
        });
        break;
      case 'table':
        out.push({
          ...b,
          title: b.title === undefined ? undefined : m(b.title),
          columns: b.columns.map(m),
          rows: b.rows.map((r) => r.map(m)),
        });
        break;
      case 'notice':
        out.push({ ...b, title: b.title === undefined ? undefined : m(b.title), text: m(b.text) });
        break;
      default:
        out.push(b);
    }
  }
  return out;
}

async function applyMaskResult(result: Result, accounts: ReadonlySet<string>): Promise<Result> {
  const blocks = await applyMaskBlocks(result.blocks, accounts);
  const downloads = await Promise.all(
    result.downloads.map(async (d) => {
      if (!/^text\/|json|xml|csv|tab-separated|html/i.test(d.blob.type)) return d;
      try {
        const text = await d.blob.text();
        return { ...d, blob: new Blob([maskText(text, accounts).text], { type: d.blob.type }) };
      } catch {
        return d;
      }
    }),
  );
  return { ...result, blocks, downloads };
}

export async function analyze(input: Input, opts: AnalyzeOptions = {}): Promise<Analysis> {
  const started = Date.now();
  const base = baseCtx(input);
  const { ctx, trace } = unwrapAll(base);

  const scored: { rule: ClassifierRule; match: Match }[] = [];
  for (const rule of classifiers) {
    if (!applies(rule, ctx)) continue;
    let m: Match | null = null;
    try {
      m = rule.detect(ctx);
    } catch {
      m = null;
    }
    if (m && m.score > 0) scored.push({ rule, match: m });
  }
  scored.sort((a, b) => b.match.score - a.match.score || (b.rule.weight ?? 0) - (a.rule.weight ?? 0));

  const built: { rule: ClassifierRule; match: Match; result: Result }[] = [];
  const maxBuilds = ctx.text.length > BIG_INPUT ? MAX_BUILDS_BIG : 6;
  for (const s of scored.slice(0, maxBuilds)) {
    try {
      built.push({ ...s, result: await s.rule.transform(ctx, s.match) });
    } catch (e) {
      built.push({
        ...s,
        result: {
          ruleId: s.rule.id,
          title: s.match.title,
          summary: s.match.summary,
          blocks: [{ type: 'notice', level: 'error', title: '表示できませんでした', text: String(e) }],
          downloads: [],
        },
      });
    }
  }

  const primaryBuilt = built[0] ?? null;
  const alternates = built
    .slice(1)
    .filter((b) => b.match.score >= ALTERNATE_MIN)
    .filter((b) => !(b.rule.id === 'text' && (built[0]?.match.score ?? 0) >= PRIMARY_MIN))
    .slice(0, 5)
    .map((b) => ({
      ruleId: b.rule.id,
      title: b.match.title,
      score: b.match.score,
      confidence: b.match.confidence,
      summary: b.match.summary,
      result: b.result,
    }));

  const notes: Block[] = [];
  for (const rule of annotators) {
    if (!applies(rule, ctx)) continue;
    if (opts.explain === false && rule.id === 'error-dict') continue;
    // 主結果がエラー解説のときは、同じ内容を補足に繰り返さない
    if (primaryBuilt?.rule.id === 'error' && rule.id === 'error-dict') continue;
    try {
      const blocks = await rule.annotate(ctx);
      notes.push(...blocks);
    } catch {
      /* 1つのルールが落ちても解析は続ける */
    }
  }

  const firstMask = ctx.kind === 'text' ? maskText(ctx.text) : null;
  const maskCounts = firstMask?.counts ?? emptyCounts();
  const accountIds = new Set(firstMask?.accounts ?? []);
  const stats: StatItem[] = await buildStats(base);
  const sha256 = await sha256Hex(base.originBytes);

  let primary = primaryBuilt?.result ?? null;
  if (primary && opts.mask) primary = await applyMaskResult(primary, accountIds);
  if (opts.mask) {
    for (let i = 0; i < alternates.length; i++) {
      const alt = alternates[i]!;
      alternates[i] = { ...alt, result: await applyMaskResult(alt.result, accountIds) };
    }
  }

  return {
    headline: headlineFor(
      primaryBuilt ? { match: primaryBuilt.match } : null,
      alternates.map((a) => ({ title: a.title, score: a.score })),
      trace,
    ),
    confidence: primaryBuilt?.match.confidence ?? 'low',
    primary,
    evidence: primaryBuilt?.match.evidence ?? [],
    alternates,
    notes,
    stats,
    trace,
    maskCounts,
    sha256,
    elapsedMs: Date.now() - started,
  };
}

export { applyMaskBlocks, applyMaskResult };
