import type { ClassifierRule } from '../types.ts';
import { clip, result } from './_help.ts';

const TRACKING = /^(utm_|fbclid$|gclid$|yclid$|msclkid$|mc_eid$|_ga$|ref$|source$)/i;

export const urlRule: ClassifierRule = {
  id: 'url',
  layer: 'classifier',
  appliesTo: 'text',
  label: 'URL',
  weight: 25,
  detect(ctx) {
    const t = ctx.text.trim();
    if (/^otpauth:\/\//i.test(t)) {
      return {
        score: 93,
        confidence: 'high',
        title: '2段階認証の設定情報（otpauth）',
        summary: '2段階認証アプリに登録するための情報です。中に「秘密キー」が入っています。',
        evidence: ['otpauth:// で始まる', 'secret= に秘密キーがある'],
      };
    }
    if (/\s/.test(t)) return null;
    if (!/^https?:\/\/[^\s]+$/i.test(t)) return null;
    try {
      const u = new URL(t);
      if (!u.hostname) return null;
      return {
        score: 86,
        confidence: 'high',
        title: 'URL（Web ページの住所）',
        summary: `URL です。接続先は「${u.hostname}」、開くページは「${clip(u.pathname, 60)}」です。`,
        evidence: [`スキーム ${u.protocol.replace(':', '')}`, `ホスト ${u.hostname}`, `${u.searchParams.size} 個のパラメータ`],
      };
    } catch {
      return null;
    }
  },
  transform(ctx) {
    const raw = ctx.text.trim();
    if (/^otpauth:\/\//i.test(raw)) {
      let u: URL;
      try {
        u = new URL(raw);
      } catch {
        return result('url', '2段階認証の設定情報', '読み取れませんでした', [
          { type: 'notice', level: 'error', title: '読み取れませんでした', text: 'otpauth:// の形式が壊れています。' },
        ]);
      }
      const secret = u.searchParams.get('secret') ?? '';
      const label = decodeURIComponent(u.pathname.replace(/^\//, ''));
      const items = [
        { k: '種類', v: u.host.toUpperCase(), note: 'totp は時間ベースの6桁コード' },
        { k: '名前（ラベル）', v: label },
        { k: '発行元（issuer）', v: u.searchParams.get('issuer') ?? '' },
        ...(secret ? [{ k: '秘密キー（secret）', v: `secret=${secret}` }] : []),
        ...(u.searchParams.get('algorithm') ? [{ k: '方式', v: u.searchParams.get('algorithm')! }] : []),
        ...(u.searchParams.get('digits') ? [{ k: '桁数', v: u.searchParams.get('digits')! }] : []),
        ...(u.searchParams.get('period') ? [{ k: '切り替え秒', v: u.searchParams.get('period')! }] : []),
      ];
      return result(
        'url',
        '2段階認証の設定情報',
        '設定情報を分解しました',
        [
          {
            type: 'notice',
            level: 'error',
            title: '秘密キーです。誰にも見せないでください',
            text: 'この secret を知っている人は、あなたのワンタイムパスワードを作れます。画面共有・スクリーンショット・チャットへの貼り付けに注意してください。共有が必要なら「機密情報をマスク」をオンにしてください。',
          },
          { type: 'kv', title: '中身', items },
          { type: 'code', text: raw, lang: 'text' },
        ],
      );
    }
    const u = new URL(ctx.text.trim());
    const params = [...u.searchParams.entries()];
    let doubleDecoded = 0;

    const rows = params.map(([k, v]) => {
      // URLSearchParams が 1 回デコード済み。%XX が残っていればもう 1 回戻す。
      let value = v;
      let note = '';
      if (/%[0-9A-Fa-f]{2}/.test(v)) {
        try {
          const twice = decodeURIComponent(v);
          if (twice !== v) {
            value = twice;
            note = '二重エンコードを解除';
            doubleDecoded++;
          }
        } catch {
          /* 壊れた % はそのまま */
        }
      }
      const kind = TRACKING.test(k) ? '追跡用（消してよいことが多い）' : '';
      return [k, clip(value, 300), [kind, note].filter(Boolean).join(' / ')];
    });

    let path = u.pathname || '/';
    let pathNote: string | undefined;
    try {
      const decodedPath = decodeURI(path);
      if (decodedPath !== path) {
        pathNote = `元の表記: ${path}`;
        path = decodedPath;
      }
    } catch {
      /* そのまま */
    }

    const blocks: Parameters<typeof result>[3] = [
      {
        type: 'kv',
        title: 'URL の構成',
        items: [
          { k: '方式（スキーム）', v: u.protocol.replace(':', ''), note: u.protocol === 'http:' ? '暗号化されていません（https を推奨）' : undefined },
          { k: '接続先（ホスト）', v: u.hostname },
          ...(u.port ? [{ k: 'ポート', v: u.port }] : []),
          { k: 'ページ（パス）', v: path, note: pathNote },
          ...(u.hash ? [{ k: 'ページ内の位置', v: decodeURI(u.hash) }] : []),
          ...(u.username ? [{ k: 'ユーザー名', v: u.username, note: 'URL にログイン情報が入っています。共有しないでください' }] : []),
        ],
      },
    ];

    if (params.length) {
      blocks.push({
        type: 'table',
        title: `パラメータ（${params.length} 個）`,
        columns: ['名前', '値（URL デコード後）', '種類'],
        rows,
      });
      if (doubleDecoded > 0) {
        blocks.push({
          type: 'notice',
          level: 'info',
          title: '二重にエンコードされていました',
          text: `${doubleDecoded} 個の値は、URL エンコードが 2 回かかっていました（例: %25E3 → %E3 → あ）。表示は最後まで戻した結果です。`,
        });
      }
      const tracking = params.filter(([k]) => TRACKING.test(k));
      if (tracking.length) {
        blocks.push({
          type: 'notice',
          level: 'info',
          title: '追跡用のパラメータがあります',
          text: `${tracking.map(([k]) => k).join(', ')} はアクセス解析用です。共有するときは削除しても中身は変わりません。`,
        });
      }
    }
    if (u.protocol === 'http:') {
      blocks.push({
        type: 'notice',
        level: 'warn',
        title: 'http（暗号化なし）です',
        text: '同じサイトが https で開ける場合があります。URL の先頭を https に変えて試してください。',
      });
    }
    blocks.push({ type: 'code', text: u.toString(), lang: 'text' });
    return result('url', 'URL', 'URL を分解しました', blocks);
  },
  fixtures: [
    { name: 'クエリ付き', input: 'https://example.com/a/b?q=hello&utm_source=x', expect: { score: 86 } },
    { name: 'URLでない', input: 'example.com/a/b', expect: { score: 0 } },
    { name: 'otpauth', input: 'otpauth://totp/Example:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example', expect: { score: 93 } },
  ],
};
