/** 解析エンジンの型定義。ルールはこの型だけに依存する。 */

export type Layer = 'wrapper' | 'classifier' | 'annotator';
export type Kind = 'text' | 'image';
export type Confidence = 'high' | 'medium' | 'low';

/** 画像1枚ぶんの情報。worker 側でデコードして詰める。 */
export interface ImageMeta {
  name: string;
  /** 実際にデコードした形式（HEIC は変換後） */
  mime: string;
  /** 元ファイルの形式（HEIC のままなら image/heic） */
  originalMime: string;
  /** 元ファイルのバイト数 */
  bytes: number;
  width: number;
  height: number;
  /** 表示・保存用。base64 から復元した画像でも入る */
  blob?: Blob;
  /** EXIF の抜粋（撮影日時・機材・GPS など） */
  exif?: { label: string; value: string }[];
  /** QR / バーコードの読み取り結果 */
  codes?: { format: string; text: string }[];
  note?: string;
}

export interface TraceStep {
  ruleId: string;
  label: string;
  detail: string;
}

export interface Ctx {
  /** 入力の種類（wrapper でデコードしても変わらない） */
  kind: Kind;
  /** 現在の解析対象テキスト（バイナリなら空文字） */
  text: string;
  /** 現在の解析対象バイト列 */
  bytes: Uint8Array;
  /** 元の入力テキスト（統計はこちらを対象にする） */
  originText: string;
  /** 元の入力バイト列 */
  originBytes: Uint8Array;
  name?: string;
  images: ImageMeta[];
  /** wrapper を何回かけたか */
  depth: number;
  trace: TraceStep[];
}

export interface Match {
  /** 0-100。60 以上で「主結果」候補、55 未満は「可能性」扱い */
  score: number;
  confidence: Confidence;
  /** 画面に出す型名（例: JWT（ログイン情報の一種）） */
  title: string;
  /** 一文の結論。非エンジニアがこれだけ読めば分かるように書く */
  summary: string;
  /** 判定の根拠。デバッグ表示と「なぜ？」欄に出す */
  evidence: string[];
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'kv'; items: { k: string; v: string; note?: string }[]; title?: string }
  | { type: 'table'; columns: string[]; rows: string[][]; title?: string; note?: string }
  | { type: 'html'; html: string }
  | { type: 'markdown'; text: string }
  | { type: 'image'; blob: Blob; alt: string; caption?: string }
  | { type: 'notice'; level: 'info' | 'warn' | 'error'; title?: string; text: string };

export interface Download {
  label: string;
  filename: string;
  blob: Blob;
}

export interface Result {
  ruleId: string;
  title: string;
  summary: string;
  blocks: Block[];
  downloads: Download[];
}

export interface Alternate {
  ruleId: string;
  title: string;
  score: number;
  confidence: Confidence;
  summary: string;
  result: Result;
}

export interface StatItem {
  label: string;
  value: string;
  warn?: boolean;
  note?: string;
}

export interface MaskCounts {
  emails: number;
  phones: number;
  keys: number;
  cards: number;
  mynumbers: number;
  addresses: number;
  ips: number;
  accounts: number;
  /** 利用者名を含むパス（C:\\Users\\名前 など） */
  paths: number;
}

export interface Analysis {
  /** 画面いちばん上の一文 */
  headline: string;
  confidence: Confidence;
  /** 主結果。判定できなかった場合は null */
  primary: Result | null;
  /** 主結果の判定根拠（なぜそう判断したか） */
  evidence: string[];
  alternates: Alternate[];
  /** 変換結果とは別欄に出す補足（エラーの意味・文字化け・注意喚起など） */
  notes: Block[];
  /** 別欄の統計情報 */
  stats: StatItem[];
  /** 適用したデコード手順 */
  trace: TraceStep[];
  maskCounts: MaskCounts;
  /** 元入力の SHA-256（サポート用。取得できなければ空） */
  sha256: string;
  /** 解析にかかった時間(ms) */
  elapsedMs: number;
}

export interface WrapperRule {
  id: string;
  layer: 'wrapper';
  appliesTo: Kind | 'both';
  /** 画面に出す日本語名 */
  label: string;
  detect(ctx: Ctx): Match | null;
  /** デコード結果。テキストにならない（画像など）場合は bytes だけ返す */
  unwrap(ctx: Ctx): { bytes: Uint8Array; text?: string; detail: string } | null;
}

export interface ClassifierRule {
  id: string;
  layer: 'classifier';
  appliesTo: Kind | 'both';
  label: string;
  /** 同点のときの優先度（大きいほど先） */
  weight?: number;
  detect(ctx: Ctx): Match | null;
  transform(ctx: Ctx, m: Match): Result | Promise<Result>;
  /** ルールの動作確認用。`npm test` が input を投げて expect を照合する */
  fixtures?: { name: string; input: string; expect: Partial<Match> }[];
}

export interface AnnotatorRule {
  id: string;
  layer: 'annotator';
  appliesTo: Kind | 'both';
  label: string;
  annotate(ctx: Ctx): Block[] | Promise<Block[]>;
}

export type Rule = WrapperRule | ClassifierRule | AnnotatorRule;

export const isWrapper = (r: Rule): r is WrapperRule => r.layer === 'wrapper';
export const isClassifier = (r: Rule): r is ClassifierRule => r.layer === 'classifier';
export const isAnnotator = (r: Rule): r is AnnotatorRule => r.layer === 'annotator';
