/**
 * 機能別ランディングページの内容。
 *
 * ここに 1 件足すと、`npm run pages` が
 *   - <slug>/index.html（JS 無しでも読める静的 HTML）
 *   - sitemap.xml / llms.txt の 1 行
 * をまとめて生成する。
 *
 * 文章はすべて手書き。テンプレの使い回しで薄いページを作らないこと
 * （各ページに固有の解説・表・FAQ を持たせる）。
 */

export const SITE = {
  origin: 'https://fmt.okamomedia.tokyo',
  name: 'fmt',
  repo: 'https://github.com/okamoto53515606/fmt',
};

/** 全ページ共通の「安全」ブロック。主張だけでなく検証手段まで書く。 */
const SAFETY = `
<p>
  解析はすべて<strong>ブラウザの中</strong>で行います。サーバーが無いので、入力した内容が送られる先がありません。
  配信側の CSP（Content-Security-Policy）で <code>fetch</code> / <code>XMLHttpRequest</code> / <code>WebSocket</code> /
  <code>sendBeacon</code> を禁止しており（<code>connect-src 'none'</code>）、ビルド時に
  <code>scripts/check-no-network.mjs</code> が送信 API の混入を検査しています。
  入力は保存しません（再読み込みで消えます）。一度読み込めばオフラインでも動きます。
</p>
`;

/** 各ページの末尾に置く共通の但し書き。 */
const HONESTY = `
<p class="lp-muted">
  このページの判定は決まったルールによるもので、AI（LLM）は使っていません。同じ入力なら同じ結果になります。
  マスキングには取りこぼしがあります。共有前の目視確認をおすすめします。
</p>
`;

export const pages = [
  {
    slug: 'url-encode',
    nav: 'URLエンコード',
    h1: 'URLエンコード・デコード',
    title: 'URLエンコード・デコード｜日本語をパーセントエンコーディングに変換',
    description:
      '日本語やスペースをURLで使える形式（パーセントエンコーディング）に変換・復元。%E3%81%82 のような文字列を読める文字に戻します。二重エンコードも解除。入力はブラウザの外に出ません。',
    lead:
      'URLエンコード（パーセントエンコーディング）は、日本語やスペースなどURLに直接書けない文字を「%」＋16進数に置き換える仕組みです。このページでは変換と復元の両方を、ブラウザの中だけで行えます。',
    sample:
      'https://example.com/search?q=%E6%9D%B1%E4%BA%AC%E9%A7%85&utm_source=newsletter&page=2',
    placeholder: '%E3%81%82 のようなエンコード済み文字列、またはURLを貼り付け',
    featureList: [
      'パーセントエンコーディングへの変換と復元',
      '二重エンコードの解除',
      'URLのホスト・パス・クエリへの分解',
      '追跡用パラメータ（utm_* など）の指摘',
      '文字化けの判定と復元',
    ],
    sections: [
      {
        h2: 'URLエンコードとは',
        html: `
<p>
  URLに使える文字はRFC 3986で決まっています。日本語やスペースはそのままでは置けません。
  UTF-8のバイト列に分解し、1バイトずつ <code>%</code> ＋16進2桁に置き換えるのがパーセントエンコーディングです。
</p>
<table class="lp-table">
  <caption>変換の例（UTF-8）</caption>
  <thead><tr><th>元の文字</th><th>UTF-8 のバイト</th><th>エンコード後</th></tr></thead>
  <tbody>
    <tr><td>あ</td><td>E3 81 82</td><td><code>%E3%81%82</code></td></tr>
    <tr><td>東</td><td>E6 9D B1</td><td><code>%E6%9D%B1</code></td></tr>
    <tr><td>空白</td><td>20</td><td><code>%20</code>（フォーム送信では <code>+</code> のことも）</td></tr>
    <tr><td>/</td><td>2F</td><td><code>%2F</code></td></tr>
    <tr><td>&amp;</td><td>26</td><td><code>%26</code></td></tr>
  </tbody>
</table>
<p>
  英数字と <code>-</code> <code>.</code> <code>_</code> <code>~</code> は変換されません（unreserved characters）。
  それ以外は、たとえ <code>/</code> のような記号でも「区切りとしての意味を消したいとき」はエンコードします。
</p>
`,
      },
      {
        h2: '二重エンコードに注意',
        html: `
<p>
  <code>%E3%81%82</code> をもう一度エンコードすると、<code>%</code> 自身が <code>%25</code> になって
  <code>%25E3%2581%2582</code> になります。検索結果やリダイレクトURLで「日本語にならない」ときは、
  ほぼこれが原因です。このツールは <code>%25</code> を見つけると、もう一段デコードして結果を出します。
</p>
`,
      },
      {
        h2: 'このツールでできること',
        html: `
<ul>
  <li>エンコード済みの文字列を貼ると、自動で判定して復元します（判定の根拠も表示します）</li>
  <li>URL全体を貼ると、ホスト・パス・クエリに分解し、パラメータの値だけをデコードします</li>
  <li>追跡用パラメータ（<code>utm_*</code>、<code>gclid</code> など）を見つけて指摘します</li>
  <li>解除した先がJSONやJWTだった場合は、続けてその形式として解析します</li>
</ul>
`,
      },
      {
        h2: '復元できないことがある文字列',
        html: `
<p>
  パーセントエンコーディングは文字コードを指定しません。<code>%93%FA</code> のようにShift_JISで作られた文字列は、
  UTF-8として読むと化けます。このツールは化けた結果を「文字化け」として判定し、復元できる型かどうかを示します。
  復元できる場合（UTF-8をShift_JISとして誤読した等）は元の文字に戻します。
</p>
`,
      },
    ],
    faq: [
      {
        q: '%E3%81%82 は何と読みますか？',
        a: '「あ」です。UTF-8では「あ」が E3 81 82 の3バイトなので、1バイトずつ %＋16進にしたものが %E3%81%82 になります。',
      },
      {
        q: '「+」は空白ですか？',
        a: 'フォーム送信（application/x-www-form-urlencoded）では + は空白を表します。一方URLのパス部分では + は文字そのものです。どちらの文脈かで意味が変わります。',
      },
      {
        q: 'エンコードしたのに、ブラウザのアドレスバーでは日本語のままに見えます',
        a: 'ブラウザは表示用にデコードして見せているだけで、内部ではエンコードされた形で送っています。コピーしてメモ帳などに貼ると %E3… の形を確認できます。',
      },
      {
        q: '入力したURLはどこかに送信されますか？',
        a: 'いいえ。解析はブラウザ内のWeb Workerで完結し、CSPで外部通信を禁止しています。サーバーが無いため、送る先そのものがありません。',
      },
      {
        q: 'Shift_JISのURLも復元できますか？',
        a: '文字コードの情報が文字列に含まれていないため、UTF-8以外で作られた文字列は化けることがあります。化けた場合は「文字化け」として判定し、復元できる型かどうかを表示します。',
      },
    ],
    related: ['base64', 'jwt', 'json'],
    lastmod: '2026-11-14',
    priority: '0.9',
  },

  {
    slug: 'base64',
    nav: 'Base64',
    h1: 'Base64エンコード・デコード',
    title: 'Base64エンコード・デコード｜日本語も文字化けせず変換（送信なし）',
    description:
      'テキストをBase64に、Base64をテキストに変換。日本語（UTF-8）対応、URL-safe形式も判定。data URIを貼れば画像として表示・保存できます。入力はブラウザの外に出ません。',
    lead:
      'Base64は、画像やバイナリなどのデータを英数字64種類だけの文字列に変換する方式です。このページではテキスト→Base64、Base64→テキストの両方向を、ブラウザの中だけで変換できます。',
    sample:
      'eyJvcmRlcklkIjoiQS0xMDAyMyIsImN1c3RvbWVyIjp7Im5hbWUiOiLlsbHnlLDlpKqpg48ifSwidG90YWwiOjM5ODB9',
    placeholder: 'テキスト、Base64文字列、または data:image/png;base64,... を貼り付け',
    featureList: [
      'テキストとBase64の相互変換',
      'URL-safe Base64 の判定',
      'Base64を解除した先の形式の再判定（JSON・画像など）',
      'data URI の画像表示と保存',
      '日本語（UTF-8）の文字化け検出',
    ],
    sections: [
      {
        h2: 'Base64の仕組み',
        html: `
<p>
  データを3バイト（24ビット）ずつに区切り、6ビットずつ4つの値に分けて、決められた64文字
  （<code>A-Z</code> <code>a-z</code> <code>0-9</code> <code>+</code> <code>/</code>）に対応させます。
  3の倍数にならない端数は <code>=</code> で埋めます（パディング）。
</p>
<p>
  「<code>Man</code>」→「<code>TWFu</code>」のように、<strong>3バイトが4文字</strong>になります。
  つまりデータ量は約33%増えます。メール（MIME）、JSON、data URI、JWTなどで使われているのは、
  「通信経路で壊れない文字だけにする」ためです。
</p>
`,
      },
      {
        h2: 'Base64は暗号化ではありません',
        html: `
<p>
  Base64は<strong>誰でも元に戻せる</strong>変換です。鍵もパスワードも使いません。
  「Base64にしたから中身は見られない」と考えるのは危険で、APIキーやトークンをBase64で包んだだけの設定ファイルが
  漏れる事故は実際に起きています。秘匿したい場合は暗号化が必要です。
</p>
`,
      },
      {
        h2: '日本語が文字化けする理由',
        html: `
<p>
  Base64は「バイト列」を変換する方式で、文字コードの情報を持ちません。
  文字列をUTF-8のバイト列にしてから変換していないと、復元したときに化けます。
  このツールはUTF-8として復元し、化けた場合は「文字化け」として判定して、復元できる型かどうかを示します。
</p>
`,
      },
      {
        h2: 'URL-safe Base64 と data URI',
        html: `
<table class="lp-table">
  <thead><tr><th>種類</th><th>使う文字</th><th>主な用途</th></tr></thead>
  <tbody>
    <tr><td>標準（RFC 4648）</td><td><code>+</code> <code>/</code> <code>=</code></td><td>メール添付、設定ファイル</td></tr>
    <tr><td>URL-safe</td><td><code>-</code> <code>_</code>（パディング省略可）</td><td>JWT、URLのパラメータ</td></tr>
  </tbody>
</table>
<p>
  URL-safe形式でも、このツールは同じように解除して中身を判定します。
  <code>data:image/png;base64,…</code> の形（data URI）を貼った場合は、画像として表示・保存できます。
</p>
`,
      },
    ],
    faq: [
      {
        q: 'Base64は暗号化ですか？',
        a: 'いいえ。鍵を使わない、誰でも元に戻せる変換です。秘匿したいデータには暗号化が必要です。',
      },
      {
        q: '日本語が文字化けします',
        a: 'Base64はバイト列の変換で、文字コードの情報を含みません。元のテキストがUTF-8以外（Shift_JISなど）で作られていると化けます。このツールは化けを検出し、復元できる型かどうかを表示します。',
      },
      {
        q: '末尾の「=」は必要ですか？',
        a: '3バイトの倍数にならないときに付くパディングです。省略される規格（URL-safe）もあるため、無くてもデコードできる場合があります。',
      },
      {
        q: '画像もBase64にできますか？',
        a: 'このツールはテキスト入力が対象です。画像をBase64にしたい場合は、data URI（data:image/png;base64,…）を貼ると中身を画像として表示・保存できます。',
      },
      {
        q: '入力した内容は送信されますか？',
        a: 'いいえ。変換はブラウザ内で完結し、CSPで外部通信を禁止しています。入力は保存されず、再読み込みで消えます。',
      },
    ],
    related: ['url-encode', 'jwt', 'json'],
    lastmod: '2026-11-14',
    priority: '0.9',
  },

  {
    slug: 'jwt',
    nav: 'JWT',
    h1: 'JWT デコード',
    title: 'JWT デコード｜ヘッダ・Payload・有効期限を日本時間で確認',
    description:
      'JWT（JSON Web Token）を貼ると、ヘッダ・Payload・有効期限（exp / iat / nbf）を日本時間で表示します。期限切れは警告。署名の検証は行いません。トークンは送信しません。',
    lead:
      'JWT（JSON Web Token）は「ヘッダ.ペイロード.署名」の3つをドットでつないだ文字列です。貼り付けると中身と有効期限（exp）を日本時間で表示します。署名の検証は行いません。',
    sample:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    placeholder: 'eyJhbGciOi… で始まるトークンを貼り付け',
    featureList: [
      'JWTのヘッダ・Payloadの表示',
      '有効期限（exp）の日本時間への変換と期限切れの指摘',
      'exp がミリ秒になっている場合の指摘',
      'Payload内の機密情報のマスキング',
    ],
    sections: [
      {
        h2: 'JWTの構造',
        html: `
<p>
  <code>xxxxx.yyyyy.zzzzz</code> のように、ドットで区切られた3つの部分からできています。
  前の2つは<strong>Base64URL</strong>でエンコードされたJSONです（暗号化ではありません。誰でも読めます）。
</p>
<table class="lp-table">
  <thead><tr><th>部分</th><th>中身</th><th>例</th></tr></thead>
  <tbody>
    <tr><td>Header</td><td>署名アルゴリズムとトークンの種類</td><td><code>{"alg":"HS256","typ":"JWT"}</code></td></tr>
    <tr><td>Payload</td><td>クレーム（利用者ID・期限・発行者など）</td><td><code>{"sub":"123","exp":1700000000}</code></td></tr>
    <tr><td>Signature</td><td>ヘッダとPayloadに対する署名</td><td>バイナリ（Base64URL）</td></tr>
  </tbody>
</table>
`,
      },
      {
        h2: 'よく使うクレームと時刻の読み方',
        html: `
<table class="lp-table">
  <thead><tr><th>クレーム</th><th>意味</th><th>注意</th></tr></thead>
  <tbody>
    <tr><td><code>exp</code></td><td>有効期限</td><td>UNIX時刻の<strong>秒</strong>。10桁なら秒、13桁ならミリ秒</td></tr>
    <tr><td><code>iat</code></td><td>発行時刻</td><td>同上</td></tr>
    <tr><td><code>nbf</code></td><td>この時刻より前は無効</td><td>同上</td></tr>
    <tr><td><code>iss</code> / <code>aud</code></td><td>発行者 / 対象</td><td>取り違えると別サービスのトークンを受け入れてしまう</td></tr>
    <tr><td><code>sub</code></td><td>利用者の識別子</td><td>メールアドレスが入っていることもある</td></tr>
  </tbody>
</table>
<p>
  <code>exp</code> を<strong>ミリ秒</strong>で入れてしまう実装ミスはよくあります。10桁なら秒、13桁ならミリ秒です。
  このツールは日本時間に直し、現在時刻と比べて期限切れかどうかを表示します。
</p>
`,
      },
      {
        h2: '「デコード」と「検証」は別物',
        html: `
<p>
  デコードは中身を読むだけ、検証は<strong>署名が正しいか</strong>を確かめることです。デコードだけでは改ざんを検出できません。
  このツールはデコードのみで、署名の検証は行いません（鍵を預かる必要があり、ブラウザ内で鍵を扱う設計にしていないため）。
  本番の検証は、必ずサーバー側で、鍵やJWKSを使って行ってください。
</p>
<p>
  なお、JWTは<strong>それ自体が認証情報</strong>です。パスワードと同じ扱いで、外部のサービスに貼るのは避けてください。
</p>
`,
      },
      {
        h2: 'このツールでできること',
        html: `
<ul>
  <li>ヘッダ・Payloadを整形して表示し、有効期限を日本時間と「あと何日」で示します</li>
  <li>期限切れ・<code>nbf</code> 前・<code>exp</code> がミリ秒、といった不自然な値を指摘します</li>
  <li>PayloadにメールアドレスやAPIキーらしき値があれば、マスクして表示します（既定ON）</li>
  <li>署名部分は中身を出しません（長さと方式のみ）</li>
</ul>
`,
      },
    ],
    faq: [
      {
        q: '署名鍵なしでデコードできますか？',
        a: 'できます。HeaderとPayloadはBase64URLでエンコードされているだけで、鍵は不要です。ただし署名が正しいかどうかは分かりません。',
      },
      {
        q: '期限切れかどうかを判定してくれますか？',
        a: 'はい。exp と現在時刻を比べ、期限切れなら警告を出します。exp が13桁（ミリ秒）になっている場合も指摘します。',
      },
      {
        q: 'JWTをオンラインのデコードサービスに貼っても大丈夫ですか？',
        a: 'トークンはパスワードに相当する認証情報です。サーバーに送られるサービスに貼ると、そのサービスと経路にトークンが残ります。このツールは送信せず、ブラウザ内で完結します。',
      },
      {
        q: 'alg: none のトークンは危険ですか？',
        a: '署名なしを意味するため、検証側が alg を信頼していると改ざんを受け入れます。受け入れるアルゴリズムをサーバー側で固定してください。',
      },
      {
        q: 'JWTの中に個人情報が入っていても大丈夫ですか？',
        a: 'Payloadは暗号化されておらず、誰でも読めます。個人情報や秘密を入れず、必要な識別子だけを持たせるのが原則です。',
      },
    ],
    related: ['base64', 'json', 'url-encode'],
    lastmod: '2026-11-14',
    priority: '0.9',
  },

  {
    slug: 'json',
    nav: 'JSON整形',
    h1: 'JSON 整形・構文チェック',
    title: 'JSON 整形｜構文エラーの位置と原因を日本語で表示（送信なし）',
    description:
      'JSONを貼ると整形し、構文エラーがあれば何行目の何文字目かとよくある原因を日本語で示します。JSON Lines（1行1JSON）も自動判定。入力はブラウザの外に出ません。',
    lead:
      'JSONを貼ると整形し、構文エラーがあれば「何行目の何文字目か」「よくある原因」を日本語で示します。エラーメッセージが英語で分かりにくいときにも使えます。',
    sample:
      '{"orderId":"A-10023","customer":{"name":"山田 太郎","email":"taro.yamada@example.com"},"items":[{"sku":"P-1","qty":2},],"total":3980}',
    placeholder: 'JSONを貼り付け（壊れていても構いません）',
    featureList: [
      'JSONの整形',
      '構文エラーの行・文字位置の表示',
      'よくある原因（末尾カンマ・全角引用符など）の日本語での説明',
      'JSON Lines（1行1JSON）の自動判定と表への整形',
    ],
    sections: [
      {
        h2: 'JSONでよくあるエラーと直し方',
        html: `
<table class="lp-table">
  <thead><tr><th>症状</th><th>原因</th><th>直し方</th></tr></thead>
  <tbody>
    <tr><td>Unexpected token }</td><td>末尾のカンマ（ケツカンマ）</td><td><code>[1,2,]</code> → <code>[1,2]</code></td></tr>
    <tr><td>Unexpected token '</td><td>シングルクォート</td><td><code>'a'</code> → <code>"a"</code></td></tr>
    <tr><td>Unexpected token あ</td><td>キーや値の引用符がない／全角の「”」</td><td>半角の <code>"</code> に直す</td></tr>
    <tr><td>Unexpected end of JSON input</td><td>括弧の閉じ忘れ、途中で切れている</td><td><code>{</code> と <code>[</code> の数を数える</td></tr>
    <tr><td>Unexpected token N</td><td><code>NaN</code> / <code>Infinity</code> / コメント</td><td>JSONに存在しない値。文字列か <code>null</code> にする</td></tr>
  </tbody>
</table>
<p>
  このツールは、エラー位置を行・文字位置で示し、上の表のような「よくある原因」を日本語で添えます。
</p>
`,
      },
      {
        h2: 'JSONとJavaScriptオブジェクトの違い',
        html: `
<p>
  JavaScriptのオブジェクトリテラルはJSONより緩く、シングルクォート・末尾カンマ・コメント・関数・
  <code>undefined</code> が書けます。JSONはこれらをすべて許しません。
  「ブラウザのコンソールでは動くのに、JSONとして読むと失敗する」ときは、この差が原因です。
</p>
`,
      },
      {
        h2: 'JSON Lines（1行1JSON）との違い',
        html: `
<p>
  JSON Lines（NDJSON）は「1行に1つのJSON」を並べた形式で、ログやストリームで使われます。
  配列ではないので、そのままではJSONとして読めません。このツールは
  <code>{…}\\n{…}</code> の形を見つけるとJSON Linesとして判定し、表に整形します（CSVとは誤認しません）。
</p>
`,
      },
      {
        h2: '大きいJSONの扱い',
        html: `
<p>
  テキストは4MBまで解析します。超えた場合は先頭4MBだけを対象にし、その旨を結果に明記します。
  数万行のログを貼る場合は、行を絞るかJSON Linesのまま貼るほうが扱いやすくなります。
</p>
`,
      },
    ],
    faq: [
      {
        q: 'エラーの場所を教えてくれますか？',
        a: 'はい。何行目の何文字目かを示し、よくある原因（末尾カンマ、シングルクォート、全角引用符など）を日本語で添えます。',
      },
      {
        q: 'JSONをそのままAPIに送れますか？',
        a: 'このツールは整形と表示までです。整形結果はコピーできますが、送信は行いません（CSPで外部通信を禁止しています）。',
      },
      {
        q: 'キーを並べ替えたり、値を変換したりできますか？',
        a: 'いいえ。整形と構文チェックが目的です。並べ替えやマッピングは行いません。',
      },
      {
        q: '個人情報を含むJSONでも安全ですか？',
        a: '入力は送信されず、保存もされません。ただし既定でONのマスキングはメールアドレスなどを伏せて表示するため、値そのものを見たいときはチェックを外してください。',
      },
      {
        q: 'JSON LinesはCSVとして表示されますか？',
        a: 'いいえ。1行1JSONの形を検出してJSON Linesとして扱います。表に整形し、入れ子は「親.子」の列名にします。',
      },
    ],
    related: ['jwt', 'base64', 'url-encode'],
    lastmod: '2026-11-14',
    priority: '0.9',
  },

  {
    slug: 'exif',
    nav: 'EXIF確認',
    h1: '写真のEXIF・GPS位置情報を確認',
    title: '写真のEXIF・GPS位置情報を確認｜送信せずにブラウザ内で判定',
    description:
      '写真をドロップすると、撮影日時・カメラ・GPS座標などのEXIF情報を表示し、位置情報が残っているかを判定します。画像はアップロードされません。',
    lead:
      '写真には、撮影日時・カメラの機種・GPSの座標などが埋め込まれています（EXIF）。写真をドロップすると、何が残っているかを表示し、位置情報が写り込んだままかどうかを判定します。',
    sample: '',
    placeholder: '写真をここにドラッグ＆ドロップ（または「画像を選ぶ」）',
    featureList: [
      '写真のEXIF（規格・寸法・撮影日時・機種）の表示',
      'GPS位置情報の有無の判定',
      'QRコード・バーコードの読み取り',
      '画像を送信しないブラウザ内での解析',
    ],
    imageOnly: true,
    sections: [
      {
        h2: '写真に残る情報（EXIF）',
        html: `
<table class="lp-table">
  <thead><tr><th>項目</th><th>内容</th><th>リスク</th></tr></thead>
  <tbody>
    <tr><td>GPS</td><td>緯度・経度・高度・方角</td><td>自宅や勤務先が特定できる</td></tr>
    <tr><td>撮影日時</td><td>撮った日時（端末の設定による）</td><td>行動の記録になる</td></tr>
    <tr><td>機種・シリアル</td><td>カメラやスマホの型番・個体番号</td><td>同じ人物の別投稿と結び付く</td></tr>
    <tr><td>編集ソフト</td><td>加工に使ったアプリ</td><td>単体では弱いが組み合わせで効く</td></tr>
    <tr><td>サムネイル</td><td>画像内に残る小さなプレビュー</td><td>トリミング前の全体が残ることがある</td></tr>
  </tbody>
</table>
`,
      },
      {
        h2: '実例：実際の写真で確認する',
        html: `
<figure class="lp-figure">
  <img src="../exif-sample.jpg" width="1200" height="1600" loading="lazy" decoding="async"
    alt="川原の砂利と草、奥に鉄橋と夕方の空の写真" />
  <figcaption>
    実際に iPhone SE（第2世代）で撮影した写真（1200×1600 px、480 KB）。EXIFは残したまま置いています。
    この画像を保存して、このページにドロップすると同じ値が表示されます。
  </figcaption>
</figure>
<p>この写真のEXIFを、このツールで実際に読み取った結果です。</p>
<table class="lp-table">
  <thead><tr><th>項目</th><th>値</th></tr></thead>
  <tbody>
    <tr><td>撮影日時（現地）</td><td>2026-07-26 17:23:22（UTCオフセット +09:00）</td></tr>
    <tr><td>メーカー / 機種</td><td>Apple / iPhone SE (2nd generation)</td></tr>
    <tr><td>レンズ・F値・ISO</td><td>3.99mm・F1.8・ISO 20</td></tr>
    <tr><td>GPS（位置情報）</td><td><strong>なし</strong></td></tr>
  </tbody>
</table>
<p>
  GPSが無い写真でも、撮影日時・機種・レンズは残ります。これらが組み合わさると
  「同じ人が撮った別の投稿」が結び付くことがあるため、公開前に一度確認しておくと安心です。
</p>
`,
      },
      {
        h2: 'SNSに上げると消えるのか',
        html: `
<p>
  サービスによります。X（旧Twitter）やInstagramはアップロード時に再エンコードしてメタデータを落とすとされていますが、
  仕様は予告なく変わります。<strong>「SNSが消してくれる」を前提にしない</strong>のが安全です。
  メール添付、チャット、フリマアプリ、クラウドのリンク共有では、元のファイルがそのまま渡ることもあります。
</p>
`,
      },
      {
        h2: '位置情報を消す方法',
        html: `
<ul>
  <li><strong>iPhone</strong>: 写真アプリで共有するときに「オプション」→「位置情報を削除」をオンにする（iOS 13以降）</li>
  <li><strong>Android</strong>: 共有時のメタデータ削除はアプリ次第。Google フォトで共有すると位置情報が落ちる場合があります</li>
  <li><strong>スクリーンショット</strong>: 画面を撮り直すとEXIFはほぼ消えます（解像度は落ちます）</li>
  <li><strong>撮らない</strong>: カメラの設定で位置情報の付与をオフにするのが根本的な対策です</li>
</ul>
<p>
  このツールは<strong>確認まで</strong>で、削除機能はありません。削除した結果を確認するために使ってください
  （消したつもりで残っている、という事故がよくあります）。
</p>
`,
      },
      {
        h2: 'このツールで分かること',
        html: `
<ul>
  <li>形式・寸法・ファイルサイズ、EXIFの有無</li>
  <li>撮影日時（現地時間）、機種、GPSの座標</li>
  <li>QRコード・バーコードが写っている場合はその内容（2段階認証のシークレットは既定でマスク）</li>
  <li>画像は<strong>アップロードされません</strong>。解析はブラウザ内のWeb Workerで行います</li>
</ul>
`,
      },
    ],
    faq: [
      {
        q: 'このツールで位置情報を削除できますか？',
        a: 'いいえ。確認と判定までで、削除機能はありません。削除はOS標準の機能（iPhoneの共有時の「位置情報を削除」など）を使ってください。削除後にこのツールで再確認できます。',
      },
      {
        q: '画像はアップロードされますか？',
        a: 'されません。画像はブラウザ内で読み取るだけで、外部への送信はCSPで禁止しています。サーバーが無いため、送る先そのものがありません。',
      },
      {
        q: 'スクリーンショットを撮れば安全ですか？',
        a: '多くの場合EXIFは消えますが、解像度が落ち、画面の他の情報が写り込む可能性があります。元の写真のサムネイルが残る形式もあるため、削除後は必ず確認してください。',
      },
      {
        q: 'GPSの座標から何が分かりますか？',
        a: '緯度・経度があれば地図上で位置を特定できます。自宅で撮った写真は自宅の位置を指します。市区町村レベルではなく、建物が分かる精度のことが多いです。',
      },
      {
        q: 'HEICの写真も確認できますか？',
        a: 'ブラウザで表示できる形式に変換して解析します（元のファイルは変更しません）。変換に対応していない環境では、解析できないことがあります。',
      },
    ],
    related: ['json', 'base64', 'url-encode'],
    lastmod: '2026-11-14',
    priority: '0.8',
  },
];

/** /tools/ の一覧ページ。 */
export const hub = {
  slug: 'tools',
  h1: 'ツール一覧',
  title: 'ツール一覧｜ブラウザ完結のデコード＆整形ツール fmt',
  description:
    'URLエンコード、Base64、JWT、JSON、EXIF・GPSなど、貼るだけで中身が分かるツールの一覧。すべてブラウザ内で完結し、入力は送信されません。',
  lead:
    'fmt は「意味がわからない文字列やファイルを貼ると、何なのかを日本語で説明する」ツールです。目的別にページを分けています。どのページでも、解析はブラウザの中だけで行います。',
  lastmod: '2026-11-14',
  priority: '0.8',
};

export const SAFETY_BLOCK = SAFETY;
export const HONESTY_BLOCK = HONESTY;
