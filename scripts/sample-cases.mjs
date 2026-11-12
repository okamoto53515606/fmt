/**
 * レポート（docs/report.md）用のサンプル定義。
 * ここに足すと、レポートと回帰テストの両方に反映される。
 *
 * 方針:
 *  - 公開して問題ないデータだけを使う（実在の秘密・個人情報・位置情報は入れない）
 *  - 「before → after」が伝わるように、現場でありそうな文章で書く
 */

const mojibake = Buffer.from('こんにちは、世界。文字化けのテストです。', 'utf8').toString('latin1');

/** 16進ダンプのサンプル（バイト列から正しく組み立てる） */
const hexdump = (() => {
  const src = Buffer.from('Hello, fmt!\n日本語: こんにちは', 'utf8');
  const lines = [];
  for (let off = 0; off < src.length; off += 16) {
    const chunk = src.subarray(off, Math.min(off + 16, src.length));
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
})();

const jwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

const encryptedLike = (() => {
  // 決定論的な「高エントロピーのバイナリ」を作る（暗号化データの見え方の例）
  const chunks = [];
  for (let i = 0; i < 8; i++) {
    chunks.push(Buffer.from(Array.from({ length: 32 }, (_, j) => (i * 37 + j * 149 + 11) & 0xff)));
  }
  return Buffer.concat(chunks).toString('base64');
})();

export const cases = [
  {
    id: 'jwt',
    group: 'ログイン情報',
    title: '「この長い文字列は何ですか？」と送られてきたトークン',
    story: '問い合わせ本文に、ブラウザからコピーした文字列が貼られていた。',
    kind: 'text',
    input: jwt,
    expectPrimary: 'jwt',
    mustInclude: ['期限切れ', 'HS256'],
  },
  {
    id: 'otpauth',
    group: 'ログイン情報',
    title: '2段階認証の設定情報（otpauth）',
    story: '認証アプリの設定を移行したい、と相談された。',
    kind: 'text',
    input:
      'otpauth://totp/Example:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example',
    expectPrimary: 'url',
    mustInclude: ['2段階認証', '秘密キー'],
  },
  {
    id: 'json-broken',
    group: '設定・データ',
    title: 'アプリが読んでくれない設定ファイル（JSON）',
    story: '「保存したのにエラーになる」と言われ、中身を貼ってもらった。',
    kind: 'text',
    input: `{
  "orderId": "A-10023",
  "items": [
    { "sku": "P-1", "qty": 2 },
  ],
  "total": 3980
}`,
    expectPrimary: 'json',
    mustInclude: ['カンマ', '行目'],
  },
  {
    id: 'json',
    group: '設定・データ',
    title: 'API の応答（JSON）',
    story: '「返ってくる値の意味がわからない」と言われた。',
    kind: 'text',
    input:
      '{"status":"ok","user":{"id":1042,"name":"山田 太郎","email":"taro@example.com"},"roles":["admin","editor"],"lastLogin":"2026-11-10T23:41:00Z"}',
    expectPrimary: 'json',
  },
  {
    id: 'csv',
    group: '表データ',
    title: 'メールに貼られていた表（CSV）',
    story: 'Excel に貼り直したいが、崩れてしまうと言われた。',
    kind: 'text',
    input: `注文ID,商品,数量,金額
A-1001,ボールペン,3,360
A-1002,ノート,1,220
A-1003,付箋,5,750`,
    expectPrimary: 'csv',
    mustInclude: ['Excel'],
  },
  {
    id: 'csv-wide',
    group: '表データ',
    title: '列が多くて横に長い表（CSV）',
    story: '「Excel に貼ると右にはみ出して読めない」と言われた。',
    kind: 'text',
    input: [
      '社員ID,氏名,部署,役職,メール,電話,入社日,勤務地,雇用形態,勤怠ID',
      'A-1001,山田 太郎,営業部,主任,taro@example.com,03-0000-1111,2020-04-01,東京,正社員,EMP-0001',
      'A-1002,佐藤 花子,開発部,課長,hanako@example.com,03-0000-2222,2018-10-01,大阪,正社員,EMP-0002',
    ].join('\n'),
    expectPrimary: 'csv',
    mustInclude: ['縦横変換', '元の向き'],
  },
  {
    id: 'log',
    group: 'ログ',
    title: '「502 が出ている」と言われたアクセスログ',
    story: '障害対応で、サーバーのログ 3 行だけが共有された。',
    kind: 'text',
    input: `203.0.113.5 - - [12/Nov/2026:10:00:00 +0900] "GET /index.html HTTP/1.1" 200 5120 "-" "Mozilla/5.0"
203.0.113.7 - - [12/Nov/2026:10:00:02 +0900] "POST /api/order HTTP/1.1" 502 0 "-" "curl/8.5.0"
203.0.113.9 - - [12/Nov/2026:10:00:03 +0900] "GET /logo.png HTTP/1.1" 404 0 "-" "Mozilla/5.0"`,
    expectPrimary: 'log',
    mustInclude: ['502 Bad Gateway', '404 Not Found'],
  },
  {
    id: 'mail',
    group: 'ログ',
    title: 'メールのソース（.eml）',
    story: '「届いたメールのヘッダを見てほしい」と .eml が送られてきた。',
    kind: 'textFile',
    file: 'docs/test-mail/testmail1.eml',
    maxLines: 22,
    expectPrimary: 'mail',
    mustInclude: ['件名', '添付ファイル'],
  },
  {
    id: 'url',
    group: 'Web',
    title: 'エンコードされた長い URL（どこが本物？）',
    story: '「この URL を開いて大丈夫？」と聞かれた。パラメータが %E3… で読めない。',
    kind: 'text',
    input:
      'https://example.com/search?q=%E6%9D%B1%E4%BA%AC%E9%A7%85&sort=%E6%96%B0%E7%9D%80&next=https%253A%252F%252Fexample.com%252Fa%253Fb%253D1&utm_source=newsletter&utm_medium=email',
    expectPrimary: 'url',
    mustInclude: ['東京駅', '二重', '追跡用'],
  },
  {
    id: 'cookie',
    group: 'Web',
    title: 'Set-Cookie の生データ',
    story: '「ログインが保持されない」と言われ、応答ヘッダを見せてもらった。',
    kind: 'text',
    input: 'Set-Cookie: session_id=8f3a9c2e5b; Path=/; Expires=Wed, 12 Nov 2026 10:00:00 GMT',
    expectPrimary: 'cookie',
    mustInclude: ['HttpOnly'],
  },
  {
    id: 'urlenc',
    group: 'エンコードされたデータ',
    title: 'URL エンコードされた日本語',
    story: 'ログに `%E3%81%93...` が並んでいて読めない、と言われた。',
    kind: 'text',
    input:
      '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E3%80%81%E3%83%86%E3%82%B9%E3%83%88%E3%81%A7%E3%81%99%E3%80%82',
    expectPrimary: 'text',
    mustInclude: ['こんにちは、テストです。'],
  },
  {
    id: 'base64-image',
    group: 'エンコードされたデータ',
    title: 'Base64 に埋め込まれた画像（data URI）',
    story: '「この文字列、画像らしいんだけど見られない」と言われた。',
    kind: 'dataUri',
    file: 'docs/bar-code/qr-sample.png',
    expectPrimary: 'image',
    mustInclude: ['PNG', 'QR_CODE'],
  },
  {
    id: 'base64-binary',
    group: 'エンコードされたデータ',
    title: 'Base64 を解除しても読めないデータ',
    story: '「暗号化されているみたい」と言われた。',
    kind: 'text',
    input: encryptedLike,
    expectPrimary: 'binary',
    mustInclude: ['エントロピー', '復号'],
  },
  {
    id: 'mojibake',
    group: 'エンコードされたデータ',
    title: '文字化けしたテキスト',
    story: 'メールで届いた文章が `ãã...` になっていた。',
    kind: 'text',
    input: mojibake,
    beforeNote: '※ 見えない制御文字を含むため、環境によっては「ããã«…」のように見えます。',
    expectPrimary: 'mojibake',
    mustInclude: ['こんにちは、世界'],
  },
  {
    id: 'hexdump',
    group: 'エンコードされたデータ',
    title: '16進ダンプ',
    story: '「バイナリの中身を見たい」と言われ、ダンプが貼られた。',
    kind: 'text',
    input: hexdump,
    expectPrimary: 'text',
    mustInclude: ['こんにちは'],
  },
  {
    id: 'cert',
    group: '証明書・鍵',
    title: '証明書（PEM）',
    story: '「この証明書、いつまで有効？」と聞かれた。',
    kind: 'textFile',
    file: 'docs/samples/test-cert.pem',
    expectPrimary: 'pem',
    mustInclude: ['有効期間', 'fmt.example.com'],
  },
  {
    id: 'hash',
    group: 'その他',
    title: '32 桁の英数字（ハッシュ？）',
    story: '「これ、パスワードを復元できる？」と聞かれた。',
    kind: 'text',
    input: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    expectPrimary: 'hash',
    mustInclude: ['SHA-256'],
  },
  {
    id: 'error',
    group: 'その他',
    title: '英語のエラー（ECONNREFUSED）',
    story: '「英語でエラーが出た」とスクショではなく文字列が送られてきた。',
    kind: 'text',
    input: `Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect (node:net:1598:16)`,
    expectPrimary: 'error',
    mustInclude: ['接続', '次にやること'],
  },
  {
    id: 'datetime',
    group: 'その他',
    title: 'GMT 表記の日時',
    story: '「この時刻は日本時間でいつ？」と聞かれた。',
    kind: 'text',
    input: 'Sun, 06 Nov 1994 08:49:37 GMT',
    expectPrimary: 'datetime',
    mustInclude: ['日本時間'],
  },
  {
    id: 'xml',
    group: '設定・データ',
    title: '1 行につぶれた XML',
    story: '「どこが対応していないのかわからない」と言われた。',
    kind: 'text',
    input:
      '<?xml version="1.0" encoding="UTF-8"?><order id="A-1001"><customer><name>山田 太郎</name><email>taro@example.com</email></customer><items><item sku="P-1" qty="2"/></items></order>',
    expectPrimary: 'xml',
  },
  {
    id: 'markdown',
    group: 'その他',
    title: 'Markdown のメモ（HTML にしたい）',
    story: 'チャットに貼られた手順書を、そのまま共有できる形にしたい。',
    kind: 'text',
    input: `# 障害報告

## 概要
2026-11-12 10:00 頃、注文 API で **502** が発生しました。

- 影響: 注文の一部
- 復旧: 10:15

| 時刻 | 状態 |
|---|---|
| 10:00 | 502 |
| 10:15 | 復旧 |`,
    expectPrimary: 'markdown',
    mustInclude: ['HTML'],
  },
  {
    id: 'photo',
    group: '画像',
    title: 'iPhone の写真（EXIF）',
    story: '「この写真、どこかの情報が入ってる？」と聞かれた。',
    kind: 'imageFiles',
    files: [
      'docs/iphone-photo/IMG_0175.jpeg',
      'docs/iphone-photo/IMG_0130.jpeg',
      'docs/iphone-photo/IMG_0183.jpeg',
    ],
    expectPrimary: 'image',
    mustInclude: ['1200', 'iPhone'],
  },
  {
    id: 'qr',
    group: '画像',
    title: 'QR コードのスクリーンショット',
    story: '「この QR、何が入ってる？」と画像が送られてきた。',
    kind: 'imageFiles',
    files: ['docs/bar-code/qr-sample.png'],
    inlineImage: 'docs/bar-code/qr-sample.png',
    expectPrimary: 'image',
    mustInclude: ['QR_CODE', 'fmt.okamomedia.tokyo'],
  },
  {
    id: 'qr-otpauth',
    group: '画像',
    title: 'QR が 2段階認証の設定情報だった',
    story: '「この QR を読み取って」と言われたが、中身を確かめたい。',
    kind: 'imageFiles',
    files: ['docs/bar-code/qr-otpauth-sample.png'],
    inlineImage: 'docs/bar-code/qr-otpauth-sample.png',
    beforeNote: '※ この QR は公開サンプルの偽シークレット（`JBSWY3DPEHPK3PXP`）で生成しています。実物は使いません。',
    expectPrimary: 'image',
    mustInclude: ['2段階認証', '秘密キー'],
  },
  {
    id: 'plain',
    group: 'その他',
    title: 'ただの文章（判定できないとき）',
    story: '形式が分からないとき、無言で真っ白にしないための例。',
    kind: 'text',
    input: '明日の打ち合わせは 10 時からです。資料を 3 部お願いします。',
    expectPrimary: 'text',
    mustInclude: ['文字だけ'],
  },

  // ---- マスキング（オプション ON） ----
  {
    id: 'mask-contact',
    group: 'マスキング',
    title: 'お客様の連絡先と接続元 IP',
    story: '問い合わせメモをそのままチャットに貼りそうになった。',
    kind: 'text',
    mask: true,
    input: 'お客様: taro.yamada@example.com\n電話: 090-1234-5678\n接続元: 203.0.113.7',
    expectPrimary: 'text',
    mustInclude: ['t***', '203.0.*.*'],
    mustNotInclude: ['taro.yamada@example.com', '203.0.113.7'],
  },
  {
    id: 'mask-aws',
    group: 'マスキング',
    title: 'AWS のアカウントIDと API キー',
    story: '設定ファイルの一部を、ベンダーに確認を依頼するところだった。',
    kind: 'text',
    mask: true,
    input:
      'AWS_ACCOUNT_ID=123456789012\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nrole=arn:aws:iam::123456789012:role/Admin',
    expectPrimary: 'text',
    mustInclude: ['********9012', 'AKIA************MPLE'],
    mustNotInclude: ['123456789012', 'AKIAIOSFODNN7EXAMPLE'],
  },
  {
    id: 'mask-otp',
    group: 'マスキング',
    title: '2段階認証の設定を共有する',
    story: '設定情報を共有する必要があり、秘密キーだけを隠したい。',
    kind: 'text',
    mask: true,
    input: 'otpauth://totp/fmt%20demo:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=fmt%20demo',
    expectPrimary: 'url',
    mustInclude: ['secret=JB'],
    mustNotInclude: ['JBSWY3DPEHPK3PXP'],
  },
];
