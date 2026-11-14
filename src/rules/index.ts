import type { Rule } from '../types.ts';

import { base64Rule } from './base64.ts';
import { urlEncodeRule } from './urlenc.ts';
import { hexdumpRule, hexStringRule, unicodeEscapeRule } from './hex.ts';

import { jwtRule } from './jwt.ts';
import { jsonRule } from './json.ts';
import { jsonLinesRule } from './jsonl.ts';
import { xmlRule, htmlRule } from './xml.ts';
import { codeRule } from './code.ts';
import { csvRule } from './csv.ts';
import { logRule } from './log.ts';
import { chatLogRule } from './chatlog.ts';
import { mailRule } from './mail.ts';
import { cookieRule } from './cookie.ts';
import { urlRule } from './url.ts';
import { hashRule } from './hash.ts';
import { pemRule } from './pem.ts';
import { datetimeRule } from './datetime.ts';
import { markdownRule } from './markdown.ts';
import { mojibakeRule } from './mojibake.ts';
import { imageRule } from './image.ts';
import { binaryRule } from './binary.ts';
import { textRule } from './text.ts';

import { errorAnnotator, errorRule } from './errors.ts';
import { sensitiveAnnotator } from './sensitive.ts';

/**
 * ルール一覧。
 * 追加するときは、ルール定義ファイルを作ってここに 1 行足す。
 *
 * 層の役割:
 *   wrapper    … デコードして解析しなおす（Base64 / URL エンコード / 16進 / エスケープ）
 *   classifier … 形式を見分けて整形する（JWT / JSON / ログ / 画像 など）
 *   annotator  … 結果とは別欄に補足を出す（エラーの意味 / 機密情報）
 */
export const rules: Rule[] = [
  // wrapper（先に剥がす）
  base64Rule,
  urlEncodeRule,
  hexdumpRule,
  hexStringRule,
  unicodeEscapeRule,

  // classifier（形式の判定。スコアが高いほど「主結果」になりやすい）
  jwtRule,
  pemRule,
  mailRule,
  jsonRule,
  jsonLinesRule,
  imageRule,
  logRule,
  chatLogRule,
  csvRule,
  xmlRule,
  htmlRule,
  urlRule,
  cookieRule,
  markdownRule,
  mojibakeRule,
  binaryRule,
  hashRule,
  datetimeRule,
  errorRule,
  codeRule,
  textRule,

  // annotator（出力は変えず、補足だけ足す）
  errorAnnotator,
  sensitiveAnnotator,
];

export { textRule };
