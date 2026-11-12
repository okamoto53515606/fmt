/**
 * エラーコード・英語エラーの「意味・原因・次にやること」辞書。
 * 機械翻訳ではなく、よくあるエラーに対する説明を引く方式。
 * 辞書に無いものは無理に訳さない（誤誘導を避ける）。
 */

export interface ErrorExplanation {
  code: string;
  title: string;
  meaning: string;
  cause: string;
  action: string;
}

const HTTP: Record<string, { title: string; meaning: string; cause: string; action: string }> = {
  '400': {
    title: '400 Bad Request',
    meaning: '送った内容の形式が正しくない、とサーバーが判断しました。',
    cause: 'URL の書き間違い、フォームの必須項目漏れ、古いブックマーク。',
    action: 'URL をコピーし直す／入力内容を確認する。ブラウザの再読み込み。',
  },
  '401': {
    title: '401 Unauthorized',
    meaning: 'ログインが必要、またはログイン情報が受け付けられませんでした。',
    cause: 'パスワード変更後の古いログイン状態、トークンの期限切れ。',
    action: '一度ログアウトして再ログイン。シークレットウィンドウでも確認。',
  },
  '403': {
    title: '403 Forbidden',
    meaning: 'アクセス権がありません（ログインはできているが許可されていない）。',
    cause: '共有設定の漏れ、社外IPからのアクセス、ファイルの権限。',
    action: '管理者に権限を確認。共有リンクの有効期限も確認。',
  },
  '404': {
    title: '404 Not Found',
    meaning: 'その URL にファイル（ページ）が存在しません。',
    cause: 'URL の打ち間違い、ページの削除・移動、公開前。',
    action: 'URL を確認。サイト内検索やメニューから辿り直す。',
  },
  '405': {
    title: '405 Method Not Allowed',
    meaning: 'その操作（GET/POST など）は許可されていません。',
    cause: 'フォームの送信方法の不一致、API の使い方の誤り。',
    action: 'URL が正しいか確認。API なら仕様書のメソッドを確認。',
  },
  '408': {
    title: '408 Request Timeout',
    meaning: '通信が途中で途切れ、サーバーが待ち時間切れにしました。',
    cause: '回線が不安定、大きすぎる送信、プロキシの制限。',
    action: '回線を変えて再試行。VPN を切って試す。',
  },
  '413': {
    title: '413 Payload Too Large',
    meaning: '送ったデータが大きすぎます。',
    cause: '添付ファイルが上限超過、画像のサイズが大きい。',
    action: 'ファイルを分割・圧縮する。上限値を管理者に確認。',
  },
  '429': {
    title: '429 Too Many Requests',
    meaning: '短時間にアクセスしすぎたため、一時的に制限されています。',
    cause: '自動処理の連打、共有アカウントでの同時利用。',
    action: '数分待ってから再試行。自動処理なら間隔を空ける。',
  },
  '500': {
    title: '500 Internal Server Error',
    meaning: 'サーバー側のプログラムでエラーが起きました（利用者のせいではありません）。',
    cause: 'サーバーの不具合、データの破損、設定ミス。',
    action: '少し待って再読み込み。直らなければ管理者へ連絡（発生時刻を伝える）。',
  },
  '502': {
    title: '502 Bad Gateway',
    meaning: 'サーバーの前段（ゲートウェイ）が、後ろのサーバーから正しい応答を得られませんでした。',
    cause: 'アプリの停止・再起動中、処理が長すぎてタイムアウト。',
    action: '数十秒待って再読み込み。繰り返すなら管理者へ。',
  },
  '503': {
    title: '503 Service Unavailable',
    meaning: 'サービスが一時的に利用できません（混雑またはメンテナンス）。',
    cause: 'メンテナンス中、アクセス集中、サーバー停止。',
    action: '時間を置いて再試行。告知ページや社内連絡を確認。',
  },
  '504': {
    title: '504 Gateway Timeout',
    meaning: '前段のサーバーが、後ろのサーバーの応答を待ちきれませんでした。',
    cause: '重い処理、DB のロック、外部サービスの遅延。',
    action: '再試行。繰り返すなら処理内容を小さく分ける。',
  },
};

const SMTP: Record<string, { title: string; meaning: string; cause: string; action: string }> = {
  '421': {
    title: 'SMTP 421',
    meaning: '相手のメールサーバーがサービスを提供できない状態です。',
    cause: '相手側の混雑・メンテナンス、接続数超過。',
    action: '時間を置いて再送。続く場合は相手先の管理者へ。',
  },
  '450': {
    title: 'SMTP 450',
    meaning: '一時的に受信できません（あとで再送すれば通る可能性）。',
    cause: '相手メールボックスの一時的な問題、迷惑メール判定。',
    action: '時間を置いて再送。',
  },
  '451': {
    title: 'SMTP 451',
    meaning: 'サーバー側の一時的なエラーで処理できませんでした。',
    cause: '相手サーバーの内部エラー、過負荷。',
    action: '時間を置いて再送。',
  },
  '452': {
    title: 'SMTP 452',
    meaning: 'サーバーの空き容量が足りません。',
    cause: '相手メールボックスが満杯。',
    action: '受信者に不要メールの削除を依頼。',
  },
  '550': {
    title: 'SMTP 550',
    meaning: '受信を拒否されました。',
    cause: '宛先アドレスの誤り、迷惑メール判定、中継の拒否、添付の禁止。',
    action: '宛先を確認。添付や URL を外して再送。管理者に解除を依頼。',
  },
  '552': {
    title: 'SMTP 552',
    meaning: 'メールのサイズが大きすぎて受信できません。',
    cause: '添付ファイルの合計が上限超過。',
    action: '添付を減らす／ファイル共有リンクを使う。',
  },
  '554': {
    title: 'SMTP 554',
    meaning: '送信を拒否されました（ポリシー違反）。',
    cause: '迷惑メール判定、SPF/DKIM の不備、ブラックリスト。',
    action: '管理者に相談。送信元ドメインの設定を確認。',
  },
};

const PATTERNS: { re: RegExp; make: (m: RegExpMatchArray) => ErrorExplanation }[] = [
  {
    re: /\bERR_CONNECTION_REFUSED\b/,
    make: () => ({
      code: 'ERR_CONNECTION_REFUSED',
      title: '接続を拒否されました（ブラウザ）',
      meaning: '相手のサーバーが応答を受け付けませんでした。',
      cause: 'サービスが停止している、ポートが閉じている、URL のポート番号が違う。',
      action: 'URL（ポート番号）を確認。サーバーが起動しているか管理者に確認。',
    }),
  },
  {
    re: /\bERR_NAME_NOT_RESOLVED\b/,
    make: () => ({
      code: 'ERR_NAME_NOT_RESOLVED',
      title: 'ドメイン名が見つかりません（ブラウザ）',
      meaning: 'URL のサーバー名（ドメイン）を名前解決できませんでした。',
      cause: 'ドメインの打ち間違い、DNS の設定漏れ・反映待ち、社内 DNS の制限。',
      action: 'URL を確認。別の回線（スマホのテザリング）で試す。',
    }),
  },
  {
    re: /\bERR_CERT_(?:DATE_INVALID|AUTHORITY_INVALID|COMMON_NAME_INVALID)\b/,
    make: (m) => ({
      code: m[0],
      title: '証明書のエラー（ブラウザ）',
      meaning: 'HTTPS の証明書が期限切れ・発行元不明・名前不一致です。',
      cause: '証明書の更新漏れ、自己署名証明書、URL のホスト名違い。',
      action: '期限と名前を確認。社内システムなら管理者へ（自己署名は例外扱いの判断が必要）。',
    }),
  },
  {
    re: /\bSSL_ERROR_(?:RX_RECORD_TOO_LONG|WRONG_VERSION_NUMBER)\b/,
    make: (m) => ({
      code: m[0],
      title: 'HTTPS でない応答が返っています',
      meaning: 'HTTPS で接続しようとしたのに、暗号化されていない応答が返りました。',
      cause: 'URL の https/http の取り違え、ポート番号の誤り、プロキシの介入。',
      action: 'URL の先頭を確認（http と https）。プロキシ設定を確認。',
    }),
  },
  {
    re: /\bENOENT\b/,
    make: () => ({
      code: 'ENOENT',
      title: 'ファイルが見つかりません（プログラム）',
      meaning: '指定したファイルやフォルダが存在しません。',
      cause: 'パスの打ち間違い、作業フォルダの違い、ファイルの移動・削除。',
      action: 'パスを確認。絶対パスで試す。作業フォルダを確認。',
    }),
  },
  {
    re: /\bEACCES\b|\bEPERM\b/,
    make: (m) => ({
      code: m[0],
      title: 'アクセス権がありません（プログラム）',
      meaning: 'ファイルやフォルダを操作する権限がありません。',
      cause: '管理者権限が必要、読み取り専用、他のアプリが使用中。',
      action: '権限を確認。管理者として実行。別の場所にコピーして試す。',
    }),
  },
  {
    re: /\bECONNREFUSED\b/,
    make: () => ({
      code: 'ECONNREFUSED',
      title: '接続が拒否されました（プログラム）',
      meaning: '接続先でサービスが動いていません。',
      cause: 'サーバー未起動、ポート違い、ファイアウォール。',
      action: 'サービスが起動しているか、ポート番号が合っているかを確認。',
    }),
  },
  {
    re: /\bETIMEDOUT\b|\bESOCKETTIMEDOUT\b/,
    make: (m) => ({
      code: m[0],
      title: 'タイムアウトしました（プログラム）',
      meaning: '決められた時間内に応答がありませんでした。',
      cause: '回線が遅い・不安定、相手が重い、ファイアウォールで遮断。',
      action: '回線を変える。待ち時間を延ばす。遮断の有無を確認。',
    }),
  },
  {
    re: /\bENOTFOUND\b/,
    make: () => ({
      code: 'ENOTFOUND',
      title: 'ホスト名が見つかりません（プログラム）',
      meaning: '接続先の名前を解決できませんでした。',
      cause: 'ホスト名の誤り、DNS 障害、ネットワーク未接続。',
      action: 'ホスト名を確認。`nslookup` などで名前解決を確認。',
    }),
  },
  {
    re: /\bEADDRINUSE\b/,
    make: () => ({
      code: 'EADDRINUSE',
      title: 'ポートが使用中です（プログラム）',
      meaning: '同じポート番号を別のプログラムが使っています。',
      cause: '前回のプロセスが残っている、別のアプリと競合。',
      action: '前回のプロセスを終了する。ポート番号を変える。',
    }),
  },
  {
    re: /\bENOSPC\b|No space left on device/i,
    make: () => ({
      code: 'ENOSPC',
      title: 'ディスクの空き容量がありません',
      meaning: '保存先の空き容量が足りません。',
      cause: 'ログや一時ファイルの増加、容量の小さいドライブ。',
      action: '不要ファイルを削除。保存先を変更。',
    }),
  },
  {
    re: /\bout of memory\b|\bOOM\b|\bENOMEM\b/i,
    make: () => ({
      code: 'ENOMEM',
      title: 'メモリが足りません',
      meaning: '処理に必要なメモリを確保できませんでした。',
      cause: '扱うデータが大きすぎる、同時実行が多い。',
      action: 'アプリを再起動。データを分割。他のアプリを閉じる。',
    }),
  },
  {
    re: /\bpermission denied\b/i,
    make: () => ({
      code: 'Permission denied',
      title: '権限が拒否されました',
      meaning: 'その操作を行う権限がありません。',
      cause: '管理者権限が必要、共有設定、読み取り専用。',
      action: '権限を確認。管理者に依頼。',
    }),
  },
  {
    re: /\baccess denied\b/i,
    make: () => ({
      code: 'Access denied',
      title: 'アクセスが拒否されました',
      meaning: '認証は通ったが、その操作は許可されていません。',
      cause: '権限不足、グループ未所属、IP 制限。',
      action: '権限とネットワーク条件を管理者に確認。',
    }),
  },
  {
    re: /\b0x80070005\b/i,
    make: () => ({
      code: '0x80070005',
      title: 'アクセス拒否（Windows）',
      meaning: 'Windows が操作を拒否しました（権限不足）。',
      cause: '管理者権限が必要、ウイルス対策ソフトの制限。',
      action: '管理者として実行。セキュリティソフトの除外設定を確認。',
    }),
  },
  {
    re: /\b0x80004005\b/i,
    make: () => ({
      code: '0x80004005',
      title: '特定できないエラー（Windows）',
      meaning: 'Windows で原因を特定できないエラーが発生しました。',
      cause: 'ネットワーク共有、レジストリ、権限など多岐。',
      action: '最新の更新を適用。ネットワーク共有の資格情報を再入力。',
    }),
  },
  {
    re: /\btoo many (?:open files|connections)\b/i,
    make: (m) => ({
      code: m[0],
      title: '接続・ファイル数の上限',
      meaning: '同時に扱える数の上限に達しました。',
      cause: '接続を閉じていない、負荷集中。',
      action: '同時実行数を減らす。アプリを再起動。',
    }),
  },
  {
    re: /\bdeadlock\b/i,
    make: () => ({
      code: 'deadlock',
      title: 'デッドロック',
      meaning: '2つの処理が互いの完了を待ち続けて止まっています。',
      cause: 'DB のロック順序、トランザクションの競合。',
      action: '再試行。処理の順序を見直す。',
    }),
  },
  {
    re: /\bself[- ]signed certificate\b/i,
    make: () => ({
      code: 'self-signed certificate',
      title: '自己署名証明書',
      meaning: '公的な認証局を通していない証明書です。',
      cause: '社内システム、開発環境、証明書の設定ミス。',
      action: '社内システムなら管理者に正規の証明書か確認。',
    }),
  },
  {
    re: /\bcertificate has expired\b|\bcertificate expired\b/i,
    make: () => ({
      code: 'certificate expired',
      title: '証明書の有効期限切れ',
      meaning: 'HTTPS の証明書が期限切れです。',
      cause: '更新漏れ。',
      action: 'サーバー管理者に更新を依頼。',
    }),
  },
  {
    re: /\bquota exceeded\b|\bover quota\b/i,
    make: () => ({
      code: 'quota exceeded',
      title: '容量の上限超過',
      meaning: 'メールボックスやストレージの上限を超えています。',
      cause: '不要データの蓄積。',
      action: '不要なメール・ファイルを削除。上限の引き上げを管理者に相談。',
    }),
  },
];

/** HTTP のステータスコード説明 */
export function httpInfo(code: string): ErrorExplanation | null {
  const e = HTTP[code];
  if (!e) return null;
  return { code: `HTTP ${code}`, ...e };
}

/** SMTP の応答コード説明 */
export function smtpInfo(code: string): ErrorExplanation | null {
  const e = SMTP[code];
  if (!e) return null;
  return { code: `SMTP ${code}`, ...e };
}

/** 文脈から HTTP ステータスを拾う（数字の誤検知を避ける） */
export function findHttpCodes(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /HTTP\/\d(?:\.\d)?"?\s+(\d{3})\b/g,
    /\bstatus(?:_?code)?["'\s:=]+(\d{3})\b/gi,
    /"(\d{3})"\s+\d+|"\d{3}"\s+(\d{3})\b/g, // combined log の "GET ..." 200 1234
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const code = m[1] ?? m[2];
      if (code && /^[45]\d{2}$/.test(code)) found.add(code);
    }
  }
  return [...found];
}

/** SMTP の応答コードを拾う */
export function findSmtpCodes(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b([245]\d{2})[- ](\d\.\d+\.\d+)?/g)) {
    const code = m[1]!;
    // 年号やIPの一部を拾わないよう、SMTP らしい文脈を要求
    const around = text.slice(Math.max(0, m.index - 40), m.index + 40);
    if (!/(smtp|mail|postfix|sendmail|said|status|diagnostic|550|554)/i.test(around)) continue;
    if (code === '250' && !/smtp|mail|postfix|sendmail/i.test(around)) continue;
    found.add(code);
  }
  return [...found];
}

/** 英語エラーのパターン辞書を引く */
export function explainErrors(text: string): ErrorExplanation[] {
  const out: ErrorExplanation[] = [];
  const seen = new Set<string>();

  for (const code of findHttpCodes(text)) {
    const info = httpInfo(code);
    if (info && !seen.has(info.code)) {
      seen.add(info.code);
      out.push(info);
    }
  }
  for (const code of findSmtpCodes(text)) {
    const info = smtpInfo(code);
    if (info && !seen.has(info.code)) {
      seen.add(info.code);
      out.push(info);
    }
  }
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    const info = p.make(m);
    if (seen.has(info.code)) continue;
    seen.add(info.code);
    out.push(info);
  }
  return out.slice(0, 8);
}

/** 英語の割合（辞書に無い英語エラーを「翻訳できない」と正直に伝えるため） */
export function englishRatio(text: string): number {
  const sample = text.slice(0, 2000);
  const letters = sample.match(/[A-Za-z]/g)?.length ?? 0;
  const nonSpace = sample.replace(/\s/g, '').length || 1;
  return letters / nonSpace;
}
