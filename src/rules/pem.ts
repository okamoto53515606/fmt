import type { ClassifierRule } from '../types.ts';
import { describeKey, oidName, parseCertificate, parsePem } from '../lib/der.ts';
import { toJst } from '../lib/datetime.ts';
import { result } from './_help.ts';

export const pemRule: ClassifierRule = {
  id: 'pem',
  layer: 'classifier',
  appliesTo: 'text',
  label: '証明書 / 鍵',
  weight: 45,
  detect(ctx) {
    const t = ctx.text;
    if (!/-----BEGIN [A-Z0-9 ]+-----/.test(t)) return null;
    const isPrivate = /PRIVATE KEY/.test(t);
    const isCert = /BEGIN CERTIFICATE|BEGIN TRUSTED CERTIFICATE/.test(t);
    return {
      score: 96,
      confidence: 'high',
      title: isPrivate ? '秘密鍵（他人に見せてはいけません）' : isCert ? '証明書（X.509）' : '鍵ファイル',
      summary: isPrivate
        ? '秘密鍵です。この画面から外に出す必要はありませんが、絶対に共有しないでください。'
        : isCert
          ? '証明書です。有効期限・発行元・対象ホストを確認できます。'
          : '鍵ファイルです。種類とビット数を表示します。',
      evidence: ['-----BEGIN ...----- の形式', isPrivate ? 'PRIVATE KEY' : isCert ? 'CERTIFICATE' : 'PUBLIC KEY など'],
    };
  },
  transform(ctx) {
    const blocks: Parameters<typeof result>[3] = [];
    const pems = parsePem(ctx.text);
    if (!pems.length) {
      return result('pem', '鍵ファイル', '読み取れませんでした', [
        { type: 'notice', level: 'error', title: '読み取れませんでした', text: 'PEM の形式が壊れている可能性があります。' },
        { type: 'code', text: ctx.text.slice(0, 5000), lang: 'text' },
      ]);
    }

    for (const block of pems) {
      const isCert = /CERTIFICATE/.test(block.label);
      if (isCert) {
        const cert = parseCertificate(block.der);
        if (!cert) {
          blocks.push({ type: 'notice', level: 'warn', title: '証明書を読めませんでした', text: 'DER の解析に失敗しました。' });
          continue;
        }
        const expired = cert.notAfter.getTime() < Date.now();
        const notYet = cert.notBefore.getTime() > Date.now();
        blocks.push({
          type: 'kv',
          title: '証明書の中身',
          items: [
            { k: '対象（Subject）', v: cert.subject },
            { k: '発行元（Issuer）', v: cert.issuer },
            {
              k: '有効期間',
              v: `${toJst(cert.notBefore)} 〜 ${toJst(cert.notAfter)}`,
              note: expired ? '期限切れです' : notYet ? 'まだ有効になっていません' : '有効です',
            },
            { k: '署名の方式', v: cert.sigAlg },
            { k: '公開鍵', v: `${cert.pubAlg}${cert.keyBits ? ` ${cert.keyBits} bit` : ''}` },
            { k: 'シリアル番号', v: cert.serial },
            ...(cert.isCa ? [{ k: 'CA（認証局）', v: 'はい' }] : []),
          ],
        });
        if (cert.san.length) {
          blocks.push({ type: 'table', title: 'この証明書が有効な名前（SAN）', columns: ['名前'], rows: cert.san.map((s) => [s]) });
        }
        if (expired) {
          blocks.push({ type: 'notice', level: 'error', title: '有効期限が切れています', text: 'ブラウザに警告が出る原因です。証明書の更新が必要です。' });
        }
      } else {
        const info = describeKey(block.label, block.der);
        blocks.push({
          type: 'kv',
          title: `${block.label} の情報`,
          items: [
            { k: '種類', v: info.kind },
            { k: '方式', v: info.alg },
            ...(info.curve ? [{ k: '曲線', v: info.curve }] : []),
            ...(info.bits ? [{ k: '鍵長', v: `${info.bits} bit` }] : []),
            ...(info.note ? [{ k: '注意', v: info.note }] : []),
          ],
        });
        if (/PRIVATE KEY/.test(block.label)) {
          blocks.push({
            type: 'notice',
            level: 'error',
            title: '秘密鍵です',
            text: '秘密鍵はパスワードと同じです。チャット・メール・チケットに貼らないでください。この画面は通信しませんが、貼った先のサービスには残ります。',
          });
        }
      }
    }

    blocks.push({ type: 'notice', level: 'info', title: 'この画面でやっていないこと', text: '署名の検証、失効（CRL/OCSP）の確認、パスワード付き鍵の復号は行っていません。' });
    blocks.push({ type: 'code', text: ctx.text.slice(0, 20_000), lang: 'text' });

    // OID の凡例（読解の助け）
    const oids = [...new Set(ctx.text.match(/\b(?:1|2)(?:\.\d+){3,}\b/g) ?? [])].slice(0, 10);
    if (oids.length) {
      blocks.push({
        type: 'kv',
        title: 'OID（識別子）の意味',
        items: oids.map((o) => ({ k: o, v: oidName(o) })),
      });
    }

    return result('pem', '証明書 / 鍵', '中身を表示しました', blocks);
  },
  fixtures: [
    {
      name: '証明書（Let\'s Encrypt 風の短いダミーではなく実物が必要なため、形式のみ）',
      input: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
      expect: { score: 96 },
    },
  ],
};
