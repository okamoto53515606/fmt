import type { MaskCounts } from '../types.ts';

/**
 * 機密情報のマスキング。
 * 誤検知が少ないパターンだけを対象にし、元の形が推測できる程度に残す
 * （例: taro@gmail.com → t***@g***.com）。
 */

export const emptyCounts = (): MaskCounts => ({
  emails: 0,
  phones: 0,
  keys: 0,
  cards: 0,
  mynumbers: 0,
  addresses: 0,
  ips: 0,
  accounts: 0,
  paths: 0,
});

const stars = (n: number) => '*'.repeat(Math.max(3, Math.min(8, n)));

function maskWord(w: string): string {
  if (w.length <= 2) return `${w[0] ?? ''}*`;
  return `${w[0]}${stars(w.length - 2)}${w[w.length - 1]}`;
}

/** `password: required` のような、秘密ではない普通の英単語 */
const NOT_SECRET = new Set([
  'required', 'enabled', 'disabled', 'true', 'false', 'none', 'null', 'empty', 'change',
  'reset', 'forgot', 'unknown', 'default', 'string', 'number', 'undefined', 'placeholder',
  'optional', 'inherit', 'automatic', 'manual', 'expired', 'invalid', 'missing',
]);

/** 実在の人名ではない、ありふれたアカウント名（/home/workspace などを伏せない） */
const SAFE_HOME = new Set([
  'workspace', 'ubuntu', 'user', 'users', 'runner', 'node', 'app', 'codespace', 'vscode',
  'root', 'admin', 'administrator', 'ec2-user', 'sandbox', 'default', 'test', 'tmp',
  'shared', 'public', 'home', 'git', 'www', 'deploy', 'build', 'agent',
]);

/** Luhn チェック（クレジットカード番号の誤検知を減らす） */
export function luhnOk(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** マイナンバーのチェックディジット */
export function myNumberOk(d: string): boolean {
  if (d.length !== 12) return false;
  let sum = 0;
  for (let n = 1; n <= 11; n++) {
    const p = Number(d[11 - n]);
    sum += p * (n <= 6 ? n + 1 : n - 5);
  }
  const rem = sum % 11;
  const check = rem <= 1 ? 0 : 11 - rem;
  return check === Number(d[11]);
}

const KEY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'OpenAI APIキー', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'Anthropic APIキー', re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'AWS アクセスキー', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'Google APIキー', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'GitHub トークン', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { name: 'Slack トークン', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Stripe キー', re: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: '秘密鍵ブロック', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
];

export function maskText(
  input: string,
  knownAccounts?: ReadonlySet<string>,
): { text: string; counts: MaskCounts; found: string[]; accounts: string[] } {
  // 他のブロックで判明した ID を渡されたときは、キャッシュを使わない
  if (!knownAccounts?.size) {
    const hit = CACHE.get(input);
    if (hit) return hit;
  }
  const res = maskCompute(input, knownAccounts);
  if (!knownAccounts?.size) {
    if (CACHE.size >= 6) {
      const first = CACHE.keys().next();
      if (!first.done) CACHE.delete(first.value);
    }
    CACHE.set(input, res);
  }
  return res;
}

/** 同じ文字列を何度もマスクするので結果を使い回す（エンジンがブロックごとに呼ぶ） */
const CACHE = new Map<string, { text: string; counts: MaskCounts; found: string[]; accounts: string[] }>();

function maskCompute(
  input: string,
  knownAccounts?: ReadonlySet<string>,
): { text: string; counts: MaskCounts; found: string[]; accounts: string[] } {
  const counts = emptyCounts();
  const found: string[] = [];
  let text = input;

  // 0. 2段階認証のシークレット（otpauth:// の secret=...）
  text = text.replace(/\b(secret=)([A-Z2-7]{8,})/gi, (_m, prefix: string, secret: string) => {
    counts.keys++;
    found.push('2段階認証のシークレット');
    return `${prefix}${secret.slice(0, 2)}${'*'.repeat(Math.max(4, secret.length - 4))}${secret.slice(-2)}`;
  });

  // 1. 秘密鍵ブロック（最優先で丸ごと）
  text = text.replace(KEY_PATTERNS[KEY_PATTERNS.length - 1]!.re, () => {
    counts.keys++;
    found.push('秘密鍵ブロック');
    return '-----BEGIN PRIVATE KEY-----\n（秘密鍵のため非表示）\n-----END PRIVATE KEY-----';
  });

  // 1.5 AWS アカウントID（ARN / 2段階認証のラベル / account の文脈）
  const accountIds = new Set<string>(knownAccounts ?? []);
  const maskAccount = (id: string) => {
    accountIds.add(id);
    return `********${id.slice(-4)}`;
  };
  text = text.replace(/\b(arn:aws[a-z-]*:[a-z0-9-]*:[a-z0-9-]*:)(\d{12})\b/g, (_m, prefix: string, id: string) => {
    counts.accounts++;
    found.push('AWS アカウントID');
    return `${prefix}${maskAccount(id)}`;
  });
  text = text.replace(/\b([A-Za-z0-9._%+-]+)@(\d{12})\b/g, (_m, user: string, id: string) => {
    counts.accounts++;
    found.push('AWS アカウントID');
    return `${user}@${maskAccount(id)}`;
  });
  text = text.replace(
    /((?:account|アカウント)(?:[_ ]?(?:id|ID|Id|番号))?[\s:=「"]{0,6})(\d{12})\b/gi,
    (_m, prefix: string, id: string) => {
      counts.accounts++;
      found.push('AWS アカウントID');
      return `${prefix}${maskAccount(id)}`;
    },
  );

  // 1.5b ホスト名・URL に埋め込まれたアカウントID
  //      （210387976006.dkr.ecr… / s3://fmt-210387976006-ap-northeast-1）
  text = text.replace(/(\b\d{12})(\.(?:dkr\.ecr|s3|amazonaws)\.)/g, (_m, id: string, rest: string) => {
    counts.accounts++;
    found.push('AWS アカウントID');
    return `${maskAccount(id)}${rest}`;
  });
  text = text.replace(/(\bs3:\/\/[a-z0-9][a-z0-9.-]*?)(\d{12})(?=[-/])/g, (_m, head: string, id: string) => {
    counts.accounts++;
    found.push('AWS アカウントID');
    return `${head}${maskAccount(id)}`;
  });

  // 1.6 認証ヘッダ（Authorization: Bearer xxx / Basic xxx）
  text = text.replace(/\b(Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{12,})/g, (m, scheme: string, token: string) => {
    if (token.includes('*')) return m;
    counts.keys++;
    found.push('認証トークン');
    return `${scheme} ${token.slice(0, 2)}${'*'.repeat(Math.max(4, token.length - 4))}${token.slice(-2)}`;
  });

  // 1.8 利用者名を含むパス（C:\Users\okamo / /Users/okamo / /home/okamo）
  const maskPath = (m: string, prefix: string, name: string) => {
    if (SAFE_HOME.has(name.toLowerCase())) return m;
    counts.paths++;
    found.push('利用者名を含むパス');
    return `${prefix}${maskWord(name)}`;
  };
  text = text.replace(/([\\/]Users[\\/])([^\\/\s"'<>|]+)/g, maskPath);
  text = text.replace(/(\/home\/)([^\/\s"'<>|]+)/g, maskPath);

  // 1.9 JWT（ログイン情報のトークン）
  //      ヘッダ・本文は jwt ルールが別途表示するので、文字列だけ短くする
  text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, (m) => {
    if (m.includes('*')) return m;
    counts.keys++;
    found.push('JWT（ログイン情報のトークン）');
    return `${m.slice(0, 10)}…（中略）…${m.slice(-4)}`;
  });

  // 2. API キー
  for (const p of KEY_PATTERNS.slice(0, -1)) {
    text = text.replace(p.re, (m) => {
      counts.keys++;
      found.push(p.name);
      const keep = Math.min(4, Math.floor(m.length / 4));
      return `${m.slice(0, keep)}${'*'.repeat(Math.max(4, m.length - keep - 4))}${m.slice(-4)}`;
    });
  }

  // 2.5 KEY=VALUE / KEY: VALUE 形式の機密（.env や設定の貼り付け）
  text = text.replace(
    /\b((?:[A-Za-z0-9]{1,20}[_-])*(?:api[_-]?key|access[_-]?key(?:[_-]?id)?|secret(?:[_-]?key)?|client[_-]?secret|private[_-]?key|token|password|passwd|pwd|session[_-]?id|auth[_-]?token))\b(\s*[=:]\s*)(["']?)([^\s"'`,;]{6,})\3/gi,
    (m, name: string, sep: string, _quote: string, value: string) => {
      if (value.includes('*') || /^[<${]/.test(value) || NOT_SECRET.has(value.toLowerCase())) return m;
      counts.keys++;
      found.push('設定に書かれた秘密の値');
      return `${name}${sep}${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
    },
  );

  // 3. メールアドレス
  text = text.replace(/\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, (_m, local: string, domain: string) => {
    counts.emails++;
    const parts = domain.split('.');
    const tld = parts.pop() ?? '';
    const host = parts.join('.') || '';
    const maskedHost = host ? `${host[0]}${stars(host.length)}` : '';
    return `${maskWord(local)}@${maskedHost}${maskedHost ? '.' : ''}${tld}`;
  });

  // 4. クレジットカード（Luhn が通ったものだけ）
  text = text.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19 || !luhnOk(digits)) return m;
    counts.cards++;
    return `${digits.slice(0, 4)}${'*'.repeat(digits.length - 8)}${digits.slice(-4)}`;
  });

  // 5. マイナンバー（12桁 + チェックディジット）
  text = text.replace(/\b\d{12}\b/g, (m) => {
    if (!myNumberOk(m)) return m;
    counts.mynumbers++;
    return `********${m.slice(-4)}`;
  });

  // 6. 電話番号（日本の固定・携帯・IP電話・+81）
  text = text.replace(/(?:\+81[ -]?\d{1,4}[ -]?\d{1,4}[ -]?\d{3,4}|\b0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}\b)/g, (m) => {
    const digits = m.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) return m;
    counts.phones++;
    let di = 0;
    return m.replace(/\d/g, (d) => {
      const keep = di < 2 || di >= digits.length - 2;
      di++;
      return keep ? d : '*';
    });
  });

  // 7. 日本の住所（都道府県＋市区町村まで残し、番地以降を隠す）
  text = text.replace(
    /((?:北海道|東京都|京都府|大阪府|.{2,3}県)(?:[^\s、。]{1,12}?[市区町村]))([^\s、。]{0,24})/g,
    (_m, head: string, rest: string) => {
      if (!/[0-9０-９]/.test(rest)) return _m;
      counts.addresses++;
      return `${head}${'*'.repeat(Math.max(3, Math.min(10, rest.length)))}`;
    },
  );

  // 8. IP アドレス（後半を隠す）
  text = text.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, (_m, a, b) => {
    counts.ips++;
    return `${a}.${b}.*.*`;
  });

  // 9. 一度 AWS のアカウントIDと判明した番号は、同じ入力の他の場所でも伏せる
  //    （コマンドの grep 条件や `for p in fmt-210387976006 …` のような裸の出現）
  for (const id of accountIds) {
    text = text.replace(new RegExp(`\\b${id}\\b`, 'g'), () => {
      counts.accounts++;
      return `********${id.slice(-4)}`;
    });
  }

  return { text, counts, found: [...new Set(found)], accounts: [...accountIds] };
}
