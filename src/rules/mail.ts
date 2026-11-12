import type { ClassifierRule } from '../types.ts';
import { looksLikeMail, parseMail } from '../lib/mail.ts';
import { parseDateTime, toJst } from '../lib/datetime.ts';
import { dl, result } from './_help.ts';

const IMPORTANT = ['from', 'to', 'cc', 'subject', 'date', 'reply-to', 'return-path', 'message-id', 'content-type'];

export const mailRule: ClassifierRule = {
  id: 'mail',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'メールのソース',
  weight: 35,
  detect(ctx) {
    const t = ctx.text;
    if (t.length < 40) return null;
    if (!looksLikeMail(t)) return null;
    return {
      score: 94,
      confidence: 'high',
      title: 'メールのソース（.eml）',
      summary: 'メールのソースです。ヘッダと本文を分けて表示します。',
      evidence: ['From / Subject / Date などのヘッダが並んでいる', '空行のあとに本文が続く'],
    };
  },
  transform(ctx) {
    const mail = parseMail(ctx.text);
    const get = (k: string) => mail.headers.find((h) => h.key.toLowerCase() === k)?.value ?? '';

    const items: { k: string; v: string; note?: string }[] = [];
    const dateRaw = get('date');
    const dateParsed = dateRaw ? parseDateTime(dateRaw) : null;
    if (get('from')) items.push({ k: '差出人（From）', v: get('from') });
    if (get('to')) items.push({ k: '宛先（To）', v: get('to') });
    if (get('cc')) items.push({ k: 'CC', v: get('cc') });
    if (get('subject')) items.push({ k: '件名（Subject）', v: get('subject') });
    if (dateRaw)
      items.push({
        k: '日時（Date）',
        v: dateParsed ? toJst(dateParsed) : dateRaw,
        note: dateParsed ? `元の表記: ${dateRaw}` : undefined,
      });
    if (get('reply-to')) items.push({ k: '返信先（Reply-To）', v: get('reply-to') });
    if (get('return-path')) items.push({ k: '返信先（Return-Path）', v: get('return-path') });
    if (get('message-id')) items.push({ k: 'メッセージID', v: get('message-id') });

    const blocks: Parameters<typeof result>[3] = [{ type: 'kv', title: '要点', items }];

    const att = mail.parts.filter((p) => p.filename);
    if (att.length) {
      blocks.push({
        type: 'table',
        title: `添付ファイル（${att.length} 個）`,
        columns: ['ファイル名', '種類'],
        rows: att.map((a) => [a.filename ?? '', a.contentType]),
      });
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: '添付ファイルは開きません',
        text: 'この画面は添付の中身を表示しません（ウイルスの可能性があるため）。必要なら、いったん保存してからウイルス対策ソフトで確認してください。',
      });
    }

    blocks.push({
      type: 'code',
      text: mail.textBody.slice(0, 100_000) || '（本文が空です）',
      lang: 'text',
    });

    if (mail.htmlBody) {
      blocks.push({
        type: 'notice',
        level: 'info',
        title: 'HTML メールです',
        text: 'HTML 形式の本文がありました。安全のため、HTML としては表示せず、文字だけを取り出しています。',
      });
    }

    const rest = mail.headers.filter((h) => !IMPORTANT.includes(h.key.toLowerCase()));
    if (rest.length) {
      blocks.push({
        type: 'table',
        title: `その他のヘッダ（${rest.length} 個）`,
        columns: ['名前', '値'],
        rows: rest.map((h) => [h.key, h.value]),
      });
    }

    return result('mail', 'メールのソース', 'ヘッダと本文に分けました', blocks, [
      dl('本文を保存', 'body.txt', mail.textBody),
    ]);
  },
  fixtures: [
    {
      name: '最小のメール',
      input:
        'From: taro@example.com\nTo: hanako@example.com\nSubject: =?UTF-8?B?44GT44KT44Gr44Gh44Gv?=\nDate: Thu, 12 Nov 2026 10:00:00 +0900\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\nこんにちは。\nテストです。',
      expect: { score: 94 },
    },
    { name: 'メールでない', input: 'From: A\nTo: B\n\n短い', expect: { score: 0 } },
  ],
};
