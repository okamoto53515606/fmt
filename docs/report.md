# fmt 動作レポート（before → after）

> このファイルは `npm run report` で自動生成しています（手で編集しないでください）。
> サンプルは公開して問題ないものだけを使っています（実在の秘密・個人情報・位置情報は含みません）。

**貼る前（before）→ 貼った後（after）** を、実際の出力そのままで並べたものです。

## 一覧

| # | 貼ったもの | 主結果 | 確度 |
|---|---|---|---|
| 1 | 「この長い文字列は何ですか？」と送られてきたトークン | JWT | 高 |
| 2 | 2段階認証の設定情報（otpauth） | 2段階認証の設定情報 | 高 |
| 3 | アプリが読んでくれない設定ファイル（JSON） | JSON（エラーあり） | 中 |
| 4 | API の応答（JSON） | JSON | 高 |
| 5 | メールに貼られていた表（CSV） | カンマ区切り（CSV） | 高 |
| 6 | 列が多くて横に長い表（CSV） | カンマ区切り（CSV） | 高 |
| 7 | 「502 が出ている」と言われたアクセスログ | Web サーバーのアクセスログ | 高 |
| 8 | メールのソース（.eml） | メールのソース | 高 |
| 9 | エンコードされた長い URL（どこが本物？） | URL | 高 |
| 10 | Set-Cookie の生データ | Cookie | 高 |
| 11 | URL エンコードされた日本語 | テキスト（文字だけのデータ） | 低 |
| 12 | Base64 に埋め込まれた画像（data URI） | 画像 | 高 |
| 13 | Base64 を解除しても読めないデータ | バイナリデータ（文字ではありません） | 中 |
| 14 | 文字化けしたテキスト | 文字化け | 高 |
| 15 | 16進ダンプ | テキスト（文字だけのデータ） | 低 |
| 16 | 証明書（PEM） | 証明書 / 鍵 | 高 |
| 17 | 32 桁の英数字（ハッシュ？） | ハッシュ値 | 中 |
| 18 | 英語のエラー（ECONNREFUSED） | エラーメッセージ | 中 |
| 19 | GMT 表記の日時 | 日時 | 高 |
| 20 | 1 行につぶれた XML | XML | 高 |
| 21 | Markdown のメモ（HTML にしたい） | Markdown | 中 |
| 22 | iPhone の写真（EXIF） | 画像 | 高 |
| 23 | QR コードのスクリーンショット | 画像 | 高 |
| 24 | QR が 2段階認証の設定情報だった | 画像 | 高 |
| 25 | ただの文章（判定できないとき） | テキスト（文字だけのデータ） | 低 |
| 26 | お客様の連絡先と接続元 IP 🔒 | テキスト（文字だけのデータ） | 低 |
| 27 | AWS のアカウントIDと API キー 🔒 | テキスト（文字だけのデータ） | 低 |
| 28 | 2段階認証の設定を共有する 🔒 | 2段階認証の設定情報 | 高 |
| 29 | AI とのやりとりの生ログ（どこを触ったか分からない） | GitHub Copilot の会話ログ | 高 |
| 30 | AI の会話ログを共有する（マスク ON） 🔒 | GitHub Copilot の会話ログ | 中 |

## ログイン情報

### 1. 「この長い文字列は何ですか？」と送られてきたトークン

**こういうとき**：問い合わせ本文に、ブラウザからコピーした文字列が貼られていた。

**before**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IuWxseeUsOWkqumDjiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**after**

> **JWT**（確度 高）
>
> JWT です。ログイン状態を表す札のようなもので、中身は誰でも読めます。

**中身（ヘッダと本文）**

| 項目 | 内容 |
|---|---|
| 署名の方式（alg） | HS256<br><sub>HS256 は共通鍵、RS256 は公開鍵方式</sub> |
| 種類（typ） | JWT |
| sub | 1234567890 |
| name | 山田太郎 |
| role | admin |
| 有効期限（この時刻を過ぎると無効） | 2023年11月15日(水) 07:13:20 JST<br><sub>期限切れです（このトークンはもう使えません）</sub> |

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

```json
{
  "sub": "1234567890",
  "name": "山田太郎",
  "role": "admin",
  "exp": 1700000000
}
```

> **署名は確認していません**
> 
> この画面は中身を「表示」しているだけで、本物かどうかの検証はしていません。他人のトークンを貼らないでください（持っているだけでログインできます）。

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> APIキー・秘密鍵 1
> 
> 種類: JWT（ログイン情報のトークン）
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: 本文（Payload）を保存 / トークンを保存

<sub>判定の根拠: 点（.）で3つに区切られている / 先頭が eyJ（JSON を base64 にした印） / ヘッダに alg がある</sub>

### 2. 2段階認証の設定情報（otpauth）

**こういうとき**：認証アプリの設定を移行したい、と相談された。

**before**

```
otpauth://totp/Example:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
```

**after**

> **2段階認証の設定情報**（確度 高）
>
> 2段階認証アプリに登録するための情報です。中に「秘密キー」が入っています。

> **秘密キーです。誰にも見せないでください**
> 
> この secret を知っている人は、あなたのワンタイムパスワードを作れます。画面共有・スクリーンショット・チャットへの貼り付けに注意してください。共有が必要なら「機密情報をマスク」をオンにしてください。

**中身**

| 項目 | 内容 |
|---|---|
| 種類 | TOTP<br><sub>totp は時間ベースの6桁コード</sub> |
| 名前（ラベル） | Example:test@example.com |
| 発行元（issuer） | Example |
| 秘密キー（secret） | secret=JBSWY3DPEHPK3PXP |

```text
otpauth://totp/Example:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
```

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（2 種類）**
> 
> APIキー・秘密鍵 1、メールアドレス 1
> 
> 種類: 2段階認証のシークレット
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

<sub>判定の根拠: otpauth:// で始まる / secret= に秘密キーがある</sub>

## 設定・データ

### 3. アプリが読んでくれない設定ファイル（JSON）

**こういうとき**：「保存したのにエラーになる」と言われ、中身を貼ってもらった。

**before**

```
{
  "orderId": "A-10023",
  "items": [
    { "sku": "P-1", "qty": 2 },
  ],
  "total": 3980
}
```

**after**

> **JSON（エラーあり）**（確度 中）
>
> JSON の形をしていますが、構文エラーがあります。場所を示します。（推定）

> **5行目 3文字目でエラー**
> 
> 最後の要素のあとにカンマ（,）が残っています
> 末尾のカンマを削除してください

```text
   4 |     { "sku": "P-1", "qty": 2 },
   5 |   ],
   6 |   "total": 3980
     |   ^

5行目の 3 文字目: 最後の要素のあとにカンマ（,）が残っています
ヒント: 末尾のカンマを削除してください
```

```json
{
  "orderId": "A-10023",
  "items": [
    { "sku": "P-1", "qty": 2 },
  ],
  "total": 3980
}
```

**保存できるもの**: 元のテキストを保存

<sub>判定の根拠: { } や "キー": 値 の形が見える / 構文として読めない</sub>

### 4. API の応答（JSON）

**こういうとき**：「返ってくる値の意味がわからない」と言われた。

**before**

```
{"status":"ok","user":{"id":1042,"name":"山田 太郎","email":"taro@example.com"},"roles":["admin","editor"],"lastLogin":"2026-11-10T23:41:00Z"}
```

**after**

> **JSON**（確度 高）
>
> JSON です。項目（キー）が 4 個あります。整形して読みやすくしました。

```json
{
  "status": "ok",
  "user": {
    "id": 1042,
    "name": "山田 太郎",
    "email": "taro@example.com"
  },
  "roles": ["admin", "editor"],
  "lastLogin": "2026-11-10T23:41:00Z"
}
```

**いちばん外側の項目**

| 項目 | 内容 |
|---|---|
| status | ok |
| user | { … }（3 項目） |
| roles | [ … ]（2 件） |
| lastLogin | 2026-11-10T23:41:00Z |

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> メールアドレス 1
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: 整形した JSON を保存

<sub>判定の根拠: 全体が { } で囲まれている / 値の数 10 個 / 入れ子の深さ 3</sub>

### 5. 1 行につぶれた XML

**こういうとき**：「どこが対応していないのかわからない」と言われた。

**before**

```
<?xml version="1.0" encoding="UTF-8"?><order id="A-1001"><customer><name>山田 太郎</name><email>taro@example.com</email></customer><items><item sku="P-1" qty="2"/></items></order>
```

**after**

> **XML**（確度 高）
>
> XML です。入れ子（階層）が分かるように整形しました。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<order id="A-1001">
  <customer>
    <name>山田 太郎</name>
    <email>taro@example.com</email>
  </customer>
  <items>
    <item sku="P-1" qty="2"/>
  </items>
</order>
```

> **タグの対応**
> 
> すべてのタグが正しく閉じられています。

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> メールアドレス 1
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: 整形した XML を保存

<sub>判定の根拠: 6 個のタグ / 5 個の終了タグ</sub>

## 表データ

### 6. メールに貼られていた表（CSV）

**こういうとき**：Excel に貼り直したいが、崩れてしまうと言われた。

**before**

```
注文ID,商品,数量,金額
A-1001,ボールペン,3,360
A-1002,ノート,1,220
A-1003,付箋,5,750
```

**after**

> **カンマ区切り（CSV）**（確度 高）
>
> 表のデータです（4 行 × 4 列）。表として表示し、Excel に貼れる形でも出せます。

**表（4 行 × 4 列）**

| 注文ID | 商品 | 数量 | 金額 |
|---|---|---|---|
| A-1001 | ボールペン | 3 | 360 |
| A-1002 | ノート | 1 | 220 |
| A-1003 | 付箋 | 5 | 750 |

> **Excel に貼るには**
> 
> 下の「Excel 用（タブ区切り）」をコピーして、Excel のセルに貼り付けてください。文字化けする場合は「Excel 用ファイル」をダウンロードしてください（UTF-8 BOM 付き）。

**保存できるもの**: Excel 用（タブ区切り） / Excel 用ファイル（縦横変換） / CSV を保存 / コピー用テキスト

<sub>判定の根拠: 4 列がそろっている / 区切り文字は「,」</sub>

### 7. 列が多くて横に長い表（CSV）

**こういうとき**：「Excel に貼ると右にはみ出して読めない」と言われた。

**before**

```
社員ID,氏名,部署,役職,メール,電話,入社日,勤務地,雇用形態,勤怠ID
A-1001,山田 太郎,営業部,主任,taro@example.com,03-0000-1111,2020-04-01,東京,正社員,EMP-0001
A-1002,佐藤 花子,開発部,課長,hanako@example.com,03-0000-2222,2018-10-01,大阪,正社員,EMP-0002
```

**after**

> **カンマ区切り（CSV）**（確度 高）
>
> 表のデータです（3 行 × 10 列）。横に長いので、項目を縦に並べ替えて表示します。

**表（3 行 × 10 列）を縦横変換**

| 項目 | 1行目 | 2行目 |
|---|---|---|
| 社員ID | A-1001 | A-1002 |
| 氏名 | 山田 太郎 | 佐藤 花子 |
| 部署 | 営業部 | 開発部 |
| 役職 | 主任 | 課長 |
| メール | taro@example.com | hanako@example.com |
| 電話 | 03-0000-1111 | 03-0000-2222 |
| 入社日 | 2020-04-01 | 2018-10-01 |
| 勤務地 | 東京 | 大阪 |
| 雇用形態 | 正社員 | 正社員 |
| 勤怠ID | EMP-0001 | EMP-0002 |

_横に長くて読みづらいため、項目を縦に並べ替えました。_

**元の向き**

| 社員ID | 氏名 | 部署 | 役職 | メール | 電話 | 入社日 | 勤務地 |
|---|---|---|---|---|---|---|---|
| A-1001 | 山田 太郎 | 営業部 | 主任 | taro@example.com | 03-0000-1111 | 2020-04-01 | 東京 |
| A-1002 | 佐藤 花子 | 開発部 | 課長 | hanako@example.com | 03-0000-2222 | 2018-10-01 | 大阪 |

> **Excel に貼るには**
> 
> 「Excel 用（タブ区切り）」は元の向き、「Excel 用ファイル（縦横変換）」は項目を縦にした形です。用途に合わせて選んでください（どちらも UTF-8 BOM 付き）。

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（2 種類）**
> 
> メールアドレス 2、電話番号 2
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: Excel 用（タブ区切り） / Excel 用ファイル（縦横変換） / CSV を保存 / コピー用テキスト

<sub>判定の根拠: 10 列がそろっている / 区切り文字は「,」</sub>

## ログ

### 8. 「502 が出ている」と言われたアクセスログ

**こういうとき**：障害対応で、サーバーのログ 3 行だけが共有された。

**before**

```
203.0.113.5 - - [12/Nov/2026:10:00:00 +0900] "GET /index.html HTTP/1.1" 200 5120 "-" "Mozilla/5.0"
203.0.113.7 - - [12/Nov/2026:10:00:02 +0900] "POST /api/order HTTP/1.1" 502 0 "-" "curl/8.5.0"
203.0.113.9 - - [12/Nov/2026:10:00:03 +0900] "GET /logo.png HTTP/1.1" 404 0 "-" "Mozilla/5.0"
```

**after**

> **Web サーバーのアクセスログ**（確度 高）
>
> ログです（3 行）。表にして、エラー行を抜き出しました。

**Web サーバーのアクセスログ（3 行）**

| 日時 | 接続元IP | メソッド | パス | 状態 | バイト数 | リファラ | ユーザーエージェント |
|---|---|---|---|---|---|---|---|
| 2026年11月12日(木) 10:00:00 JST | 203.0.113.5 | GET | /index.html HTTP/1.1 | 200 | 5120 | - | Mozilla/5.0 |
| 2026年11月12日(木) 10:00:02 JST | 203.0.113.7 | POST | /api/order HTTP/1.1 | 502 | 0 | - | curl/8.5.0 |
| 2026年11月12日(木) 10:00:03 JST | 203.0.113.9 | GET | /logo.png HTTP/1.1 | 404 | 0 | - | Mozilla/5.0 |

> **エラーと思われる行が 2 行あります**
> 
> 下の欄に「意味・原因・次にやること」をまとめています。該当行はこの表の状態（ステータス）列で確認できます。

```text
203.0.113.7 - - [12/Nov/2026:10:00:02 +0900] "POST /api/order HTTP/1.1" 502 0 "-" "curl/8.5.0"
203.0.113.9 - - [12/Nov/2026:10:00:03 +0900] "GET /logo.png HTTP/1.1" 404 0 "-" "Mozilla/5.0"
```

**補足欄に出るもの**

**502 Bad Gateway**

| 項目 | 内容 |
|---|---|
| どういうこと | サーバーの前段（ゲートウェイ）が、後ろのサーバーから正しい応答を得られませんでした。 |
| よくある原因 | アプリの停止・再起動中、処理が長すぎてタイムアウト。 |
| 次にやること | 数十秒待って再読み込み。繰り返すなら管理者へ。 |

**404 Not Found**

| 項目 | 内容 |
|---|---|
| どういうこと | その URL にファイル（ページ）が存在しません。 |
| よくある原因 | URL の打ち間違い、ページの削除・移動、公開前。 |
| 次にやること | URL を確認。サイト内検索やメニューから辿り直す。 |

> **機密情報らしきものが見つかりました（1 種類）**
> 
> IPアドレス 3
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: Excel 用（タブ区切り）

<sub>判定の根拠: 3 行が当てはまる / 列は 10 個 / 2 行がエラーらしい</sub>

### 9. メールのソース（.eml）

**こういうとき**：「届いたメールのヘッダを見てほしい」と .eml が送られてきた。

**before**

```text
MIME-Version: 1.0
Date: Thu, 12 Nov 2026 22:55:01 +0900
Message-ID: <CAPf7Wzq5v1BvDPNU3WoEHjjt=DMrZs7wgM4o1rko7LXSfH=x4g@mail.gmail.com>
Subject: =?UTF-8?B?44OG44K544OI44Oh44O844Or44Gn44GZ44CC?=
From: Taro Yamada <test99999999@gmail.com>
To: Taro Yamada <test99999999@gmail.com>
Content-Type: multipart/mixed; boundary="0000000000006ecbc8066014a84e"

--0000000000006ecbc8066014a84e
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

44GT44KM44Gv44OG44K544OI44Oh44O844Or44Gn44GZ44CCDQrmt7vku5jjg5XjgqHjgqTjg6vv
vIjnlLvlg4/vvInjgoLjgYLjgorjgb7jgZnjgIINCg==
--0000000000006ecbc8066014a84e
Content-Type: image/png; name="homepage_github.png"
Content-Disposition: attachment; filename="homepage_github.png"
Content-Transfer-Encoding: base64
X-Attachment-Id: f_mwdm0mk70
Content-ID: <f_mwdm0mk70>

iVBORw0KGgoAAAANSUhEUgAABDoAAAO9CAYAAABjPwdXAAAAAXNSR0IArs4c6QAAAARnQU1BAACx
…（以下省略）
```

**after**

> **メールのソース**（確度 高）
>
> メールのソースです。ヘッダと本文を分けて表示します。

**要点**

| 項目 | 内容 |
|---|---|
| 差出人（From） | Taro Yamada &lt;test99999999@gmail.com&gt; |
| 宛先（To） | Taro Yamada &lt;test99999999@gmail.com&gt; |
| 件名（Subject） | テストメールです。 |
| 日時（Date） | 2026年11月12日(木) 22:55:01 JST<br><sub>元の表記: Thu, 12 Nov 2026 22:55:01 +0900</sub> |
| メッセージID | &lt;CAPf7Wzq5v1BvDPNU3WoEHjjt=DMrZs7wgM4o1rko7LXSfH=x4g@mail.gmail.com&gt; |

**添付ファイル（2 個）**

| ファイル名 | 種類 |
|---|---|
| homepage_github.png | image/png |
| homepage_v2.1.4.png | image/png |

> **添付ファイルは開きません**
> 
> この画面は添付の中身を表示しません（ウイルスの可能性があるため）。必要なら、いったん保存してからウイルス対策ソフトで確認してください。

```text
これはテストメールです。
添付ファイル（画像）もあります。

```

**その他のヘッダ（1 個）**

| 名前 | 値 |
|---|---|
| MIME-Version | 1.0 |

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> メールアドレス 3
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: 本文を保存

<sub>判定の根拠: From / Subject / Date などのヘッダが並んでいる / 空行のあとに本文が続く</sub>

### 10. AI とのやりとりの生ログ（どこを触ったか分からない）

**こういうとき**：「この作業、何をしたのか教えて」と、チャットのログを丸ごと貼られた。

**before**

```
User: このエラーの原因を教えて

GitHub Copilot: 状況を確認します。

Ran terminal command:  tail -n 50 /var/log/nginx/error.log
2026-11-14 10:00:00 [error] 1234#0: *1 connect() failed (111: Connection refused)

Read [](), lines 1 to 120
Searched for regex `proxy_pass` (`/etc/nginx/conf.d/app.conf`), 2 results
Created []()
Made changes.

User: 直してください

GitHub Copilot: 向き先が違っていました。
Ran terminal command:  sudo nginx -t
Ran terminal command:  sudo systemctl reload nginx
Checked terminal output
```

**after**

> **GitHub Copilot の会話ログ**（確度 高）
>
> 会話の生ログです（発言 4 件・道具の実行 8 回）。発言ごとに区切って、何をしたかを一覧にしました。

**会話の概要**

| 項目 | 内容 |
|---|---|
| 形式 | GitHub Copilot Chat の生ログ |
| 発言 | 4 件（あなた 2 / AI 2） |
| 道具の実行 | 8 回 |
| やったことの内訳 | コマンド実行 3 / ファイル読み取り 1 / 検索 1 / ファイル作成 1 / ファイル編集 1 / 確認・失敗 1 |
| 分量 | 18 行 / 472 文字 |

**発言の一覧（4 件）**

| # | 話者 | 内容 | 道具 |
|---|---|---|---|
| 1 | あなた（User） | このエラーの原因を教えて | — |
| 2 | GitHub Copilot | 状況を確認します。 | 5 回（コマンド実行・ファイル読み取り・検索・ファイル作成・ファイル編集） |
| 3 | あなた（User） | 直してください | — |
| 4 | GitHub Copilot | 向き先が違っていました。 | 3 回（コマンド実行・確認・失敗） |

_「内容」は各発言の最初の 1 文です。_

**やったこと（道具の内訳）**

| 種類 | 回数 | 例 |
|---|---|---|
| コマンド実行 | 3 | tail -n 50 /var/log/nginx/error.log |
| ファイル読み取り | 1 | — |
| 検索 | 1 | — |
| ファイル作成 | 1 | — |
| ファイル編集 | 1 | — |
| 確認・失敗 | 1 | — |

_「例」は最初に見つかった 1 件です。コマンドの中身は下の欄にまとめています。_

```shell
#2  tail -n 50 /var/log/nginx/error.log
#4  sudo nginx -t
#4  sudo systemctl reload nginx
```

```markdown
# 会話ログ（整形）

- 発言: 4（あなた 2 / AI 2）
- 道具の実行: 8 回
- 内訳: コマンド実行 3 / ファイル読み取り 1 / 検索 1 / ファイル作成 1 / ファイル編集 1 / 確認・失敗 1
- 元の分量: 18 行 / 472 文字

## 1. あなた（User）

このエラーの原因を教えて

---

## 2. GitHub Copilot

> やったこと（5 回）: コマンド実行・ファイル読み取り・検索・ファイル作成・ファイル編集

状況を確認します。
…（以下省略）
```

**生成される HTML**

```html
<h1>会話ログ（整形）</h1>
<ul>
<li>発言: 4（あなた 2 / AI 2）</li>
<li>道具の実行: 8 回</li>
<li>内訳: コマンド実行 3 / ファイル読み取り 1 / 検索 1 / ファイル作成 1 / ファイル編集 1 / 確認・失敗 1</li>
<li>元の分量: 18 行 / 472 文字</li>
</ul>
<h2>1. あなた（User）</h2>
<p>このエラーの原因を教えて</p>
<hr>
<h2>2. GitHub Copilot</h2>
<blockquote>
<p>やったこと（5 回）: コマンド実行・ファイル読み取り・検索・ファイル作成・ファイル編集</p>
</blockquote>
<p>状況を確認します。</p>
<p>Ran terminal command:  tail -n 50 /var/log/nginx/error.log
2026-11-14 10:00:00 [error] 1234#0: *1 connect() failed (111: Connection refused)</p>
<p>Read <a href=""></a>, lines 1 to 120
Searched for regex <code>proxy_pass</code> (<code>/etc/nginx/conf.d/app.conf</code>), 2 results
Created <a href=""></a>
Made changes.</p>
<hr>
<h2>3. あなた（User）</h2>
<p>直してください</p>
<hr>
<h2>4. GitHub Copilot</h2>
…（以下省略）
```

> **そのまま共有する前に**
> 
> この種のログには、ファイルの場所（C:\Users\名前 など）・接続先・APIキー・メールアドレスが写りやすいです。「機密情報をマスク」をオンにすると、利用者名・メール・キー・IP などを伏せた状態で表示・コピー・保存できます。

**補足欄に出るもの**

> **英語のメッセージです**
> 
> よくあるエラーの辞書には見つかりませんでした。機械的に翻訳すると意味を取り違えることがあるため、原文のまま表示しています。

**保存できるもの**: 整形した会話ログ（Markdown） / 発言一覧（Excel 用）

<sub>判定の根拠: 「User:」「GitHub Copilot:」の行が 4 件 / 道具の実行行が 8 件 / GitHub Copilot Chat の書き出しと一致</sub>

## Web

### 11. エンコードされた長い URL（どこが本物？）

**こういうとき**：「この URL を開いて大丈夫？」と聞かれた。パラメータが %E3… で読めない。

**before**

```
https://example.com/search?q=%E6%9D%B1%E4%BA%AC%E9%A7%85&sort=%E6%96%B0%E7%9D%80&next=https%253A%252F%252Fexample.com%252Fa%253Fb%253D1&utm_source=newsletter&utm_medium=email
```

**after**

> **URL**（確度 高）
>
> URL です。接続先は「example.com」、開くページは「/search」です。

**URL の構成**

| 項目 | 内容 |
|---|---|
| 方式（スキーム） | https |
| 接続先（ホスト） | example.com |
| ページ（パス） | /search |

**パラメータ（5 個）**

| 名前 | 値（URL デコード後） | 種類 |
|---|---|---|
| q | 東京駅 |  |
| sort | 新着 |  |
| next | https://example.com/a?b=1 | 二重エンコードを解除 |
| utm_source | newsletter | 追跡用（消してよいことが多い） |
| utm_medium | email | 追跡用（消してよいことが多い） |

> **二重にエンコードされていました**
> 
> 1 個の値は、URL エンコードが 2 回かかっていました（例: %25E3 → %E3 → あ）。表示は最後まで戻した結果です。

> **追跡用のパラメータがあります**
> 
> utm_source, utm_medium はアクセス解析用です。共有するときは削除しても中身は変わりません。

```text
https://example.com/search?q=%E6%9D%B1%E4%BA%AC%E9%A7%85&sort=%E6%96%B0%E7%9D%80&next=https%253A%252F%252Fexample.com%252Fa%253Fb%253D1&utm_source=newsletter&utm_medium=email
```

<sub>判定の根拠: スキーム https / ホスト example.com / 5 個のパラメータ</sub>

### 12. Set-Cookie の生データ

**こういうとき**：「ログインが保持されない」と言われ、応答ヘッダを見せてもらった。

**before**

```
Set-Cookie: session_id=8f3a9c2e5b; Path=/; Expires=Wed, 12 Nov 2026 10:00:00 GMT
```

**after**

> **Cookie**（確度 高）
>
> Cookie です。名前と値を分けて表示します。

**Cookie の内容（1 個）**

| 名前 | 値 | Path | Expires |
|---|---|---|---|
| session_id | 8f3a9c2e5b | / | 2026年11月12日(木) 19:00:00 JST |

> **セキュリティ設定が不足しています**
> 
> 次の属性がありません: HttpOnly（JavaScript から読めなくする）、Secure（HTTPS のときだけ送る）、SameSite（他のサイトからの送信を制限）。ログイン情報を含む Cookie では特に重要です。

> **有効期限**
> 
> 2026年11月12日(木) 19:00:00 JST
> （元の表記: Wed, 12 Nov 2026 10:00:00 GMT）

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> APIキー・秘密鍵 1
> 
> 種類: 設定に書かれた秘密の値
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

<sub>判定の根拠: Cookie: / Set-Cookie: で始まっている / セミコロンで区切られている</sub>

## エンコードされたデータ

### 13. URL エンコードされた日本語

**こういうとき**：ログに `%E3%81%93...` が並んでいて読めない、と言われた。

**before**

```
%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E3%80%81%E3%83%86%E3%82%B9%E3%83%88%E3%81%A7%E3%81%99%E3%80%82
```

**after**

> **テキスト（文字だけのデータ）**（確度 低）
>
> URL エンコード を解除しました。これといって特徴のないテキストです。そのまま表示しています。

```text
こんにちは、テストです。
```

**解除した手順**: URL エンコード

**保存できるもの**: テキストを保存

<sub>判定の根拠: 特別な形式の目印が見つからない</sub>

### 14. Base64 に埋め込まれた画像（data URI）

**こういうとき**：「この文字列、画像らしいんだけど見られない」と言われた。

**before**

```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAFACAYAAADNkKWqAAAAAklEQVR4AewaftIAAAhKSURBVO3BQY4cSRIEQTVH/f/LtgR44D…（2,946 文字）
```

**after**

> **画像**（確度 高）
>
> data URI（Base64 埋め込み） を解除しました。エンコードされたデータの中身は PNG 画像でした。

**画像の情報**

| ファイル名 | 形式 | サイズ | バイト数 | GPS | QR/バーコード |
|---|---|---|---|---|---|
| decoded.png | PNG | 320×320 | 2,193 | なし | QR_CODE |

> **QR_CODE を読み取りました**
> 
> https://fmt.okamomedia.tokyo/

**解除した手順**: data URI（Base64 埋め込み）

**保存できるもの**: decoded.png を保存

<sub>判定の根拠: 先頭に PNG の印 / 2,193 バイト</sub>

### 15. Base64 を解除しても読めないデータ

**こういうとき**：「暗号化されているみたい」と言われた。

**before**

```
C6A1yl/0iR6zSN1yB5wxxlvwhRqvRNluA5gtwlfsgRYwxVrvhBmuQ9htApcswVbrgBWqP9Rp/pMovVLnfBGmO1XqfxSpPtNo/ZInvFHmexClOs9k+Y4juE3idwyhNstgeg+kOc5j+I0it0zhdgugNcpf9Ikes0jdcgecMcZb8IWfNMle84gdskfccQabMMVa74QZrkPYbQKXLMFW64AVqsRZ7oMYrULXbAGWK8BV6n8UqT7TaP2SJ7xR5nsQpTrP6X4TqD3SZ/yRJrtQ5XoPpDnOY/iNIrdM4XYLoDXKX/QOozjNYveMIbZL4HUKnzTJXvOIHbJH3HEGmzDFWu+EGQ==
```

**after**

> **バイナリデータ（文字ではありません）**（確度 中）
>
> Base64（中身はバイナリ） を解除しました。256 バイトのバイナリです。文字でも画像でもありません。（推定）

**推定**

| 項目 | 内容 |
|---|---|
| 大きさ | 256 バイト |
| 形式の判定 | 不明（既知のファイル形式の印がない） |
| MIME の推定 | application/octet-stream |
| エントロピー | 7.22 bit/byte<br><sub>圧縮・バイナリ形式の可能性があります</sub> |

```text
00000000  0b a0 35 ca 5f f4 89 1e b3 48 dd 72 07 9c 31 c6  |..5._....H.r..1.|
00000010  5b f0 85 1a af 44 d9 6e 03 98 2d c2 57 ec 81 16  |[....D.n..-.W...|
00000020  30 c5 5a ef 84 19 ae 43 d8 6d 02 97 2c c1 56 eb  |0.Z....C.m..,.V.|
00000030  80 15 aa 3f d4 69 fe 93 28 bd 52 e7 7c 11 a6 3b  |...?.i..(.R.|..;|
00000040  55 ea 7f 14 a9 3e d3 68 fd 92 27 bc 51 e6 7b 10  |U....>.h..'.Q.{.|
00000050  a5 3a cf 64 f9 8e 23 b8 4d e2 77 0c a1 36 cb 60  |.:.d..#.M.w..6.`|
00000060  7a 0f a4 39 ce 63 f8 8d 22 b7 4c e1 76 0b a0 35  |z..9.c..".L.v..5|
00000070  ca 5f f4 89 1e b3 48 dd 72 07 9c 31 c6 5b f0 85  |._....H.r..1.[..|
00000080  9f 34 c9 5e f3 88 1d b2 47 dc 71 06 9b 30 c5 5a  |.4.^....G.q..0.Z|
00000090  ef 84 19 ae 43 d8 6d 02 97 2c c1 56 eb 80 15 aa  |....C.m..,.V....|
000000a0  c4 59 ee 83 18 ad 42 d7 6c 01 96 2b c0 55 ea 7f  |.Y....B.l..+.U..|
000000b0  14 a9 3e d3 68 fd 92 27 bc 51 e6 7b 10 a5 3a cf  |..>.h..'.Q.{..:.|
000000c0  e9 7e 13 a8 3d d2 67 fc 91 26 bb 50 e5 7a 0f a4  |.~..=.g..&.P.z..|
000000d0  39 ce 63 f8 8d 22 b7 4c e1 76 0b a0 35 ca 5f f4  |9.c..".L.v..5._.|
000000e0  0e a3 38 cd 62 f7 8c 21 b6 4b e0 75 0a 9f 34 c9  |..8.b..!.K.u..4.|
000000f0  5e f3 88 1d b2 47 dc 71 06 9b 30 c5 5a ef 84 19  |^....G.q..0.Z...|
```

> **復号・展開はしていません**
> 
> 暗号化・圧縮されたデータを推測で開くと、誤った内容を表示して誤解のもとになります。この画面では「何らかのバイナリである」ことまでをお伝えします。元のアプリで開くか、管理者に確認してください。

**解除した手順**: Base64（中身はバイナリ）

<sub>判定の根拠: 先頭 0b a0 35 ca 5f f4 89 1e / エントロピー 7.22 bit/byte</sub>

### 16. 文字化けしたテキスト

**こういうとき**：メールで届いた文章が `ãã...` になっていた。

**before**

```
ããã«ã¡ã¯ãä¸çãæå­åãã®ãã¹ãã§ãã
```

_※ 見えない制御文字を含むため、環境によっては「ããã«…」のように見えます。_

**after**

> **文字化け**（確度 高）
>
> 文字化けしています。元の文字に戻せました。

> **原因**
> 
> UTF-8 を別の文字コードで読んだためです。

**復元**

| 項目 | 内容 |
|---|---|
| 原因 | UTF-8 を別の文字コードで読んだ |
| 対応 | UTF-8 として復元 |

```text
こんにちは、世界。文字化けのテストです。
```

**保存できるもの**: 復元したテキストを保存

<sub>判定の根拠: UTF-8 を別の文字コードで読んだ / UTF-8 として復元すると日本語として読める</sub>

### 17. 16進ダンプ

**こういうとき**：「バイナリの中身を見たい」と言われ、ダンプが貼られた。

**before**

```
00000000  48 65 6c 6c 6f 2c 20 66 6d 74 21 0a e6 97 a5 e6  |Hello, fmt!.....|
00000010  9c ac e8 aa 9e 3a 20 e3 81 93 e3 82 93 e3 81 ab  |.....: .........|
00000020  e3 81 a1 e3 81 af                                |......|
```

**after**

> **テキスト（文字だけのデータ）**（確度 低）
>
> 16進ダンプ を解除しました。これといって特徴のないテキストです。そのまま表示しています。

```text
Hello, fmt!
日本語: こんにちは
```

**解除した手順**: 16進ダンプ

**保存できるもの**: テキストを保存

<sub>判定の根拠: 特別な形式の目印が見つからない</sub>

## 証明書・鍵

### 18. 証明書（PEM）

**こういうとき**：「この証明書、いつまで有効？」と聞かれた。

**before**

```text
-----BEGIN CERTIFICATE-----
MIIDqDCCApCgAwIBAgIUdlGHygYQc+mC5+sVfAt7vP44B/8wDQYJKoZIhvcNAQEL
BQAwUDELMAkGA1UEBhMCSlAxFjAUBgNVBAoMDWZtdCB0ZXN0IGRvY3MxDzANBgNV
BAsMBlNhbXBsZTEYMBYGA1UEAwwPZm10LmV4YW1wbGUuY29tMB4XDTI2MTExMjE0
MTEyOFoXDTI3MDIxMDE0MTEyOFowUDELMAkGA1UEBhMCSlAxFjAUBgNVBAoMDWZt
dCB0ZXN0IGRvY3MxDzANBgNVBAsMBlNhbXBsZTEYMBYGA1UEAwwPZm10LmV4YW1w
bGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9HdyZKB8kXkp
2l0KxzasykxVlZFCEL69/0/MVV881cbRsO0p35PPhpuhQSjLtgWsYPBS3j/knWQj
wHw/eS1lLzSbdNKg/b/8phW9+QrRpQCt5jk53TesETWSvfBg7Bje6X5/r/fCuyoV
2p8RZg3cDsF5hPtGMw20zLF1ok7klQAaZ4EgVqErL7MzGOK/cRWbR6Eog9iEdW9+
U/d+DrUBI8IfKWtJLfcrB4PPX0pByr2UF5trECeKcoWHYOQsFq8wrCRlGkxTNrmX
XwHSqkWo1piAeFGGepcQwIKBMtNr7cVhSfeSeGgAMT5OmWq6dRG960ReabFwcunZ
GOtiYXEgRQIDAQABo3oweDAdBgNVHQ4EFgQUPgdSTviQY1m2UetT+AZot6oLuV8w
HwYDVR0jBBgwFoAUPgdSTviQY1m2UetT+AZot6oLuV8wDwYDVR0TAQH/BAUwAwEB
/zAlBgNVHREEHjAcgg9mbXQuZXhhbXBsZS5jb22CCWxvY2FsaG9zdDANBgkqhkiG
9w0BAQsFAAOCAQEAOpSoUSXkFQBzbUk0+k2FbbyPUB3Sl1QdHN10qZaePpU+/q1B
Fxn1hDBUwV1lSyDVidy0JHihq+YmaMc4zeS5fuAAEkaN018iQT8Du27TIOSKQDXS
yoo/Lh8e4QbYnSeoO7T6Fu662AyuqA5PRvlVu3GmrU7kjXa+drNXM75WdMYG5ZvO
J4gZDmYpBtO8mCRLsHm8KvqZm3C8T+cjAdtnRthJoMTbLr8/lG/pAAEC6jgCzrpi
7EkptOviCMGxwRTzGjdiFrxCGEkN3Su9UbIyoTU6ZvaR/CDSY2hDfZyaeVmFw/FS
…（以下省略）
```

**after**

> **証明書 / 鍵**（確度 高）
>
> 証明書です。有効期限・発行元・対象ホストを確認できます。

**証明書の中身**

| 項目 | 内容 |
|---|---|
| 対象（Subject） | C=JP, O=fmt test docs, OU=Sample, CN=fmt.example.com |
| 発行元（Issuer） | C=JP, O=fmt test docs, OU=Sample, CN=fmt.example.com |
| 有効期間 | 2026年11月12日(木) 23:11:28 JST 〜 2027年02月10日(水) 23:11:28 JST<br><sub>有効です</sub> |
| 署名の方式 | SHA256 with RSA |
| 公開鍵 | RSA 2048 bit |
| シリアル番号 | 765187ca061073e982e7eb157c0b7bbcfe3807ff |
| CA（認証局） | はい |

**この証明書が有効な名前（SAN）**

| 名前 |
|---|
| fmt.example.com |
| localhost |

> **この画面でやっていないこと**
> 
> 署名の検証、失効（CRL/OCSP）の確認、パスワード付き鍵の復号は行っていません。

```text
-----BEGIN CERTIFICATE-----
MIIDqDCCApCgAwIBAgIUdlGHygYQc+mC5+sVfAt7vP44B/8wDQYJKoZIhvcNAQEL
BQAwUDELMAkGA1UEBhMCSlAxFjAUBgNVBAoMDWZtdCB0ZXN0IGRvY3MxDzANBgNV
BAsMBlNhbXBsZTEYMBYGA1UEAwwPZm10LmV4YW1wbGUuY29tMB4XDTI2MTExMjE0
MTEyOFoXDTI3MDIxMDE0MTEyOFowUDELMAkGA1UEBhMCSlAxFjAUBgNVBAoMDWZt
dCB0ZXN0IGRvY3MxDzANBgNVBAsMBlNhbXBsZTEYMBYGA1UEAwwPZm10LmV4YW1w
bGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9HdyZKB8kXkp
2l0KxzasykxVlZFCEL69/0/MVV881cbRsO0p35PPhpuhQSjLtgWsYPBS3j/knWQj
wHw/eS1lLzSbdNKg/b/8phW9+QrRpQCt5jk53TesETWSvfBg7Bje6X5/r/fCuyoV
2p8RZg3cDsF5hPtGMw20zLF1ok7klQAaZ4EgVqErL7MzGOK/cRWbR6Eog9iEdW9+
U/d+DrUBI8IfKWtJLfcrB4PPX0pByr2UF5trECeKcoWHYOQsFq8wrCRlGkxTNrmX
XwHSqkWo1piAeFGGepcQwIKBMtNr7cVhSfeSeGgAMT5OmWq6dRG960ReabFwcunZ
GOtiYXEgRQIDAQABo3oweDAdBgNVHQ4EFgQUPgdSTviQY1m2UetT+AZot6oLuV8w
HwYDVR0jBBgwFoAUPgdSTviQY1m2UetT+AZot6oLuV8wDwYDVR0TAQH/BAUwAwEB
/zAlBgNVHREEHjAcgg9mbXQuZXhhbXBsZS5jb22CCWxvY2FsaG9zdDANBgkqhkiG
9w0BAQsFAAOCAQEAOpSoUSXkFQBzbUk0+k2FbbyPUB3Sl1QdHN10qZaePpU+/q1B
Fxn1hDBUwV1lSyDVidy0JHihq+YmaMc4zeS5fuAAEkaN018iQT8Du27TIOSKQDXS
yoo/Lh8e4QbYnSeoO7T6Fu662AyuqA5PRvlVu3GmrU7kjXa+drNXM75WdMYG5ZvO
J4gZDmYpBtO8mCRLsHm8KvqZm3C8T+cjAdtnRthJoMTbLr8/lG/pAAEC6jgCzrpi
7EkptOviCMGxwRTzGjdiFrxCGEkN3Su9UbIyoTU6ZvaR/CDSY2hDfZyaeVmFw/FS
mlouVbmStpHQkxdS0WZglGY05DViVBW4EZ0pSw==
-----END CERTIFICATE-----

```

**補足欄に出るもの**

> **英語のメッセージです**
> 
> よくあるエラーの辞書には見つかりませんでした。機械的に翻訳すると意味を取り違えることがあるため、原文のまま表示しています。

<sub>判定の根拠: -----BEGIN ...----- の形式 / CERTIFICATE</sub>

## その他

### 19. 32 桁の英数字（ハッシュ？）

**こういうとき**：「これ、パスワードを復元できる？」と聞かれた。

**before**

```
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

**after**

> **ハッシュ値**（確度 中）
>
> ハッシュ値のようです。64 桁（256 bit）から、SHA-256 の可能性が高いです。

**推定**

| 項目 | 内容 |
|---|---|
| 長さ | 64 文字 |
| ビット数 | 256 bit |
| 表記 | 16進数 |
| 候補 | SHA-256 / BLAKE2s-256 / Keccak-256（Ethereum） |

> **「推定」です**
> 
> 同じ長さのハッシュは区別できません（例: SHA-256 の先頭 32 桁と MD5）。確定するには、元データが分かっている必要があります。パスワードのハッシュを元に戻すことはできません。

```text
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

<sub>判定の根拠: 16進数 64 桁 / 候補: SHA-256 / 候補: BLAKE2s-256 / 候補: Keccak-256（Ethereum）</sub>

### 20. 英語のエラー（ECONNREFUSED）

**こういうとき**：「英語でエラーが出た」とスクショではなく文字列が送られてきた。

**before**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect (node:net:1598:16)
```

**after**

> **エラーメッセージ**（確度 中）
>
> エラーが 1 件あります。意味と、次にやることを日本語で説明します。（推定）

**接続が拒否されました（プログラム）**

| 項目 | 内容 |
|---|---|
| どういうこと | 接続先でサービスが動いていません。 |
| よくある原因 | サーバー未起動、ポート違い、ファイアウォール。 |
| 次にやること | サービスが起動しているか、ポート番号が合っているかを確認。 |

> **原文**
> 
> Error: connect ECONNREFUSED 127.0.0.1:5432
>     at TCPConnectWrap.afterConnect (node:net:1598:16)

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（1 種類）**
> 
> IPアドレス 1
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

<sub>判定の根拠: ECONNREFUSED</sub>

### 21. GMT 表記の日時

**こういうとき**：「この時刻は日本時間でいつ？」と聞かれた。

**before**

```
Sun, 06 Nov 1994 08:49:37 GMT
```

**after**

> **日時**（確度 高）
>
> 日時です。日本時間に直して表示します。

| 元の表記 | 日本時間 | UTC | いまから |
|---|---|---|---|
| Sun, 06 Nov 1994 08:49:37 GMT | 1994年11月06日(日) 17:49:37 JST | 1994-11-06T08:49:37.000Z | 32年前 |

_タイムゾーンの指定が無い日時は、日本時間とみなしています。_

<sub>判定の根拠: 「Sun, 06 Nov 1994 08:49:37 GMT」(HTTP の日時（GMT）)</sub>

### 22. Markdown のメモ（HTML にしたい）

**こういうとき**：チャットに貼られた手順書を、そのまま共有できる形にしたい。

**before**

```
# 障害報告

## 概要
2026-11-12 10:00 頃、注文 API で **502** が発生しました。

- 影響: 注文の一部
- 復旧: 10:15

| 時刻 | 状態 |
|---|---|
| 10:00 | 502 |
| 10:15 | 復旧 |
```

**after**

> **Markdown**（確度 中）
>
> Markdown です。Web ページの形に変換して表示します。（推定）

> **安全のため一部を無効にしています**
> 
> スクリプト（&lt;script&gt;）と外部の画像は表示しません。リンクはクリックできますが、この画面から自動で通信することはありません。

```markdown
# 障害報告

## 概要
2026-11-12 10:00 頃、注文 API で **502** が発生しました。

- 影響: 注文の一部
- 復旧: 10:15

| 時刻 | 状態 |
|---|---|
| 10:00 | 502 |
| 10:15 | 復旧 |
```

**生成される HTML**

```html
<h1>障害報告</h1>
<h2>概要</h2>
<p>2026-11-12 10:00 頃、注文 API で <strong>502</strong> が発生しました。</p>
<ul>
<li>影響: 注文の一部</li>
<li>復旧: 10:15</li>
</ul>
<table>
<thead>
<tr>
<th>時刻</th>
<th>状態</th>
</tr>
</thead>
<tbody><tr>
<td>10:00</td>
<td>502</td>
</tr>
<tr>
<td>10:15</td>
<td>復旧</td>
</tr>
</tbody></table>

```

**保存できるもの**: Markdown を保存

<sub>判定の根拠: 見出し 2 個 / コードブロック 0 個 / 箇条書き 2 行 / リンク 0 個</sub>

### 23. ただの文章（判定できないとき）

**こういうとき**：形式が分からないとき、無言で真っ白にしないための例。

**before**

```
明日の打ち合わせは 10 時からです。資料を 3 部お願いします。
```

**after**

> **テキスト（文字だけのデータ）**（確度 低）
>
> これといって特徴のないテキストです。そのまま表示しています。

```text
明日の打ち合わせは 10 時からです。資料を 3 部お願いします。
```

**保存できるもの**: テキストを保存

<sub>判定の根拠: 特別な形式の目印が見つからない</sub>

## 画像

### 24. iPhone の写真（EXIF）

**こういうとき**：「この写真、どこかの情報が入ってる？」と聞かれた。

**入力**: [IMG_0175.jpeg](./iphone-photo/IMG_0175.jpeg) / [IMG_0130.jpeg](./iphone-photo/IMG_0130.jpeg) / [IMG_0183.jpeg](./iphone-photo/IMG_0183.jpeg)

**after**

> **画像**（確度 高）
>
> 画像が 3 枚あります。形式・サイズ・撮影情報を一覧にしました。

**画像の一覧（3 枚）**

| ファイル名 | 形式 | サイズ | バイト数 | GPS | QR/バーコード |
|---|---|---|---|---|---|
| IMG_0175.jpeg | JPEG | 1200×1600 | 500,204 | なし | — |
| IMG_0130.jpeg | JPEG | 1200×1600 | 150,346 | なし | — |
| IMG_0183.jpeg | JPEG | 1200×1600 | 491,798 | なし | — |

**撮影情報（EXIF）: IMG_0175.jpeg**

| 項目 | 内容 |
|---|---|
| メーカー | Apple |
| 機種 | iPhone SE (2nd generation) |
| 向き | Horizontal (normal) |
| ソフトウェア | 26.5.2 |
| 更新日時（現地） | 2026-07-19 17:36:46 |
| シャッタースピード | 0.008928571428571428 |
| F値 | 1.8 |
| ISO 感度 | 80 |
| 撮影日時（現地） | 2026-07-19 17:36:46 |
| 作成日時（現地） | 2026-07-19 17:36:46 |
| フラッシュ | Flash did not fire, compulsory flash mode |
| 焦点距離 | 3.99 |
| レンズ | iPhone SE (2nd generation) back camera 3.99mm f/1.8 |

**撮影情報（EXIF）: IMG_0130.jpeg**

| 項目 | 内容 |
|---|---|
| メーカー | Apple |
| 機種 | iPhone SE (2nd generation) |
| 向き | Horizontal (normal) |
| ソフトウェア | 26.4.2 |
| 更新日時（現地） | 2026-05-23 17:38:05 |
| シャッタースピード | 0.016666666666666666 |
| F値 | 1.8 |
| ISO 感度 | 250 |
| 撮影日時（現地） | 2026-05-23 17:38:05 |
| 作成日時（現地） | 2026-05-23 17:38:05 |
| フラッシュ | Flash did not fire, compulsory flash mode |
| 焦点距離 | 3.99 |
| レンズ | iPhone SE (2nd generation) back camera 3.99mm f/1.8 |

**撮影情報（EXIF）: IMG_0183.jpeg**

| 項目 | 内容 |
|---|---|
| メーカー | Apple |
| 機種 | iPhone SE (2nd generation) |
| 向き | Horizontal (normal) |
| ソフトウェア | 26.5.2 |
| 更新日時（現地） | 2026-07-26 17:23:22 |
| シャッタースピード | 0.003246753246753247 |
| F値 | 1.8 |
| ISO 感度 | 20 |
| 撮影日時（現地） | 2026-07-26 17:23:22 |
| 作成日時（現地） | 2026-07-26 17:23:22 |
| フラッシュ | Flash did not fire, compulsory flash mode |
| 焦点距離 | 3.99 |
| レンズ | iPhone SE (2nd generation) back camera 3.99mm f/1.8 |

<sub>判定の根拠: 3 枚 / IMG_0175.jpeg: jpeg 1200×1600 / IMG_0130.jpeg: jpeg 1200×1600 / IMG_0183.jpeg: jpeg 1200×1600</sub>

### 25. QR コードのスクリーンショット

**こういうとき**：「この QR、何が入ってる？」と画像が送られてきた。

![QR コード](./bar-code/qr-sample.png)

**入力**: [qr-sample.png](./bar-code/qr-sample.png)

**after**

> **画像**（確度 高）
>
> 画像です（PNG、320×320）。撮影情報（EXIF）は含まれていません。

**画像の情報**

| ファイル名 | 形式 | サイズ | バイト数 | GPS | QR/バーコード |
|---|---|---|---|---|---|
| qr-sample.png | PNG | 320×320 | 2,193 | なし | QR_CODE |

> **QR_CODE を読み取りました**
> 
> https://fmt.okamomedia.tokyo/

<sub>判定の根拠: 1 枚 / qr-sample.png: png 320×320</sub>

### 26. QR が 2段階認証の設定情報だった

**こういうとき**：「この QR を読み取って」と言われたが、中身を確かめたい。

![QR コード](./bar-code/qr-otpauth-sample.png)

**入力**: [qr-otpauth-sample.png](./bar-code/qr-otpauth-sample.png)

_※ この QR は公開サンプルの偽シークレット（`JBSWY3DPEHPK3PXP`）で生成しています。実物は使いません。_

**after**

> **画像**（確度 高）
>
> 画像です（PNG、320×320）。撮影情報（EXIF）は含まれていません。

**画像の情報**

| ファイル名 | 形式 | サイズ | バイト数 | GPS | QR/バーコード |
|---|---|---|---|---|---|
| qr-otpauth-sample.png | PNG | 320×320 | 2,783 | なし | QR_CODE |

> **QR_CODE（2段階認証の設定情報）**
> 
> 2段階認証（MFA）に登録するための情報です。
> 
> otpauth://totp/fmt%20demo:test@example.com?secret=JBSWY3DPEHPK3PXP&amp;issuer=fmt%20demo
> 
> この中の秘密キー（secret）を知っている人は、あなたのワンタイムパスワードを作れます。画面共有やスクリーンショットに注意してください。

<sub>判定の根拠: 1 枚 / qr-otpauth-sample.png: png 320×320</sub>

## マスキング

### 27. お客様の連絡先と接続元 IP（マスク ON）

**こういうとき**：問い合わせメモをそのままチャットに貼りそうになった。

**before**

```
お客様: taro.yamada@example.com
電話: 090-1234-5678
接続元: 203.0.113.7
```

**after（機密情報をマスク ON）**

> **テキスト（文字だけのデータ）**（確度 低）
>
> これといって特徴のないテキストです。そのまま表示しています。

```text
お客様: t********a@e*******.com
電話: 09*-****-**78
接続元: 203.0.*.*
```

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（3 種類）**
> 
> メールアドレス 1、電話番号 1、IPアドレス 1
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: テキストを保存

<sub>判定の根拠: 特別な形式の目印が見つからない</sub>

### 28. AWS のアカウントIDと API キー（マスク ON）

**こういうとき**：設定ファイルの一部を、ベンダーに確認を依頼するところだった。

**before**

```
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
role=arn:aws:iam::123456789012:role/Admin
```

**after（機密情報をマスク ON）**

> **テキスト（文字だけのデータ）**（確度 低）
>
> これといって特徴のないテキストです。そのまま表示しています。

```text
AWS_ACCOUNT_ID=********9012
AWS_ACCESS_KEY_ID=AKIA************MPLE
role=arn:aws:iam::********9012:role/Admin
```

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（2 種類）**
> 
> APIキー・秘密鍵 1、AWS アカウントID 2
> 
> 種類: AWS アカウントID、AWS アクセスキー
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: テキストを保存

<sub>判定の根拠: 特別な形式の目印が見つからない</sub>

### 29. 2段階認証の設定を共有する（マスク ON）

**こういうとき**：設定情報を共有する必要があり、秘密キーだけを隠したい。

**before**

```
otpauth://totp/fmt%20demo:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=fmt%20demo
```

**after（機密情報をマスク ON）**

> **2段階認証の設定情報**（確度 高）
>
> 2段階認証アプリに登録するための情報です。中に「秘密キー」が入っています。

> **秘密キーです。誰にも見せないでください**
> 
> この secret を知っている人は、あなたのワンタイムパスワードを作れます。画面共有・スクリーンショット・チャットへの貼り付けに注意してください。共有が必要なら「機密情報をマスク」をオンにしてください。

**中身**

| 項目 | 内容 |
|---|---|
| 種類 | TOTP<br><sub>totp は時間ベースの6桁コード</sub> |
| 名前（ラベル） | fmt demo:t***t@e*******.com |
| 発行元（issuer） | fmt demo |
| 秘密キー（secret） | secret=JB************XP |

```text
otpauth://totp/fmt%20demo:t***t@e*******.com?secret=JB************XP&issuer=fmt%20demo
```

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（2 種類）**
> 
> APIキー・秘密鍵 1、メールアドレス 1
> 
> 種類: 2段階認証のシークレット
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

<sub>判定の根拠: otpauth:// で始まる / secret= に秘密キーがある</sub>

### 30. AI の会話ログを共有する（マスク ON）（マスク ON）

**こういうとき**：作業ログを社内に共有する前に、写り込んだ個人情報と鍵を伏せたかった。

**before**

```
User: 設定を確認して

GitHub Copilot: 確認しました。
ログの置き場所は C:\Users\yamada\OneDrive\デスクトップ\log.txt です。
連絡先は taro.yamada@example.com、電話は 090-1234-5678 です。
設定は DB_PASSWORD=SuperSecret123 でした。
Ran terminal command:  sudo systemctl status nginx
```

**after（機密情報をマスク ON）**

> **GitHub Copilot の会話ログ**（確度 中）
>
> 会話の生ログです（発言 2 件・道具の実行 1 回）。発言ごとに区切って、何をしたかを一覧にしました。

**会話の概要**

| 項目 | 内容 |
|---|---|
| 形式 | GitHub Copilot Chat の生ログ |
| 発言 | 2 件（あなた 1 / AI 1） |
| 道具の実行 | 1 回 |
| やったことの内訳 | コマンド実行 1 |
| 分量 | 7 行 / 229 文字 |

**発言の一覧（2 件）**

| # | 話者 | 内容 | 道具 |
|---|---|---|---|
| 1 | あなた（User） | 設定を確認して | — |
| 2 | GitHub Copilot | 確認しました。 | 1 回（コマンド実行） |

_「内容」は各発言の最初の 1 文です。_

**やったこと（道具の内訳）**

| 種類 | 回数 | 例 |
|---|---|---|
| コマンド実行 | 1 | sudo systemctl status nginx |

_「例」は最初に見つかった 1 件です。コマンドの中身は下の欄にまとめています。_

```shell
#2  sudo systemctl status nginx
```

```markdown
# 会話ログ（整形）

- 発言: 2（あなた 1 / AI 1）
- 道具の実行: 1 回
- 内訳: コマンド実行 1
- 元の分量: 7 行 / 229 文字

## 1. あなた（User）

設定を確認して

---

## 2. GitHub Copilot

> やったこと（1 回）: コマンド実行

確認しました。
…（以下省略）
```

**生成される HTML**

```html
<h1>会話ログ（整形）</h1>
<ul>
<li>発言: 2（あなた 1 / AI 1）</li>
<li>道具の実行: 1 回</li>
<li>内訳: コマンド実行 1</li>
<li>元の分量: 7 行 / 229 文字</li>
</ul>
<h2>1. あなた（User）</h2>
<p>設定を確認して</p>
<hr>
<h2>2. GitHub Copilot</h2>
<blockquote>
<p>やったこと（1 回）: コマンド実行</p>
</blockquote>
<p>確認しました。
ログの置き場所は C:\Users\y<strong><strong>a\OneDrive\デスクトップ\log.txt です。
連絡先は t</strong>*<em><strong><strong>a@e</strong></strong></em></strong>.com、電話は 09*-<strong><strong>-<strong>78 です。
設定は DB_PASSWORD=Su</strong></strong></strong>****23 でした。
Ran terminal command:  sudo systemctl status nginx</p>
<hr>

```

> **そのまま共有する前に**
> 
> この種のログには、ファイルの場所（C:\Users\名* など）・接続先・APIキー・メールアドレスが写りやすいです。「機密情報をマスク」をオンにすると、利用者名・メール・キー・IP などを伏せた状態で表示・コピー・保存できます。

**補足欄に出るもの**

> **機密情報らしきものが見つかりました（4 種類）**
> 
> APIキー・秘密鍵 1、メールアドレス 1、電話番号 1、利用者名を含むパス 1
> 
> 種類: 利用者名を含むパス、設定に書かれた秘密の値
> 
> 「機密情報をマスク」がオンのときは、表示・コピー・保存する内容が伏せ字（例: t***@g***.com）になります。オフにすると元の値が見えます。この判定は取りこぼしもあるため、共有前の目視確認もおすすめします。

**保存できるもの**: 整形した会話ログ（Markdown） / 発言一覧（Excel 用）

<sub>判定の根拠: 「User:」「GitHub Copilot:」の行が 2 件 / 道具の実行行が 1 件 / GitHub Copilot Chat の書き出しと一致</sub>

---

## このレポートについて

- 生成: `npm run report`（`tsc` などは不要。Node の型ストリップで `.ts` を直接読み込みます）
- 検証: `npm run test:samples` は生成結果が現在のファイルと一致するか確認します
- サンプルの追加: `scripts/sample-cases.mjs` に 1 件足すと、レポートと検証の両方に反映されます
- 画像の QR 読み取りだけは Node では `@napi-rs/canvas` を使っています（ブラウザでは `OffscreenCanvas`）

