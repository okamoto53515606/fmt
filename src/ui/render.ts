import { marked } from 'marked';
import type { Analysis, Block, Result } from '../types.ts';

const SAFE_TAGS = new Set([
  'a', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'sup', 'sub',
]);

const SAFE_ATTRS: Record<string, string[]> = {
  a: ['href', 'title'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
  ol: ['start'],
};

const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'img', 'svg', 'math', 'video', 'audio', 'source']);

/**
 * マスキングの伏せ字（`***`）が Markdown の強調として食われないようにする。
 * `t********a@example.com` をそのまま流すと `t*a` に化けるため、
 * 4 つ以上続く `*` だけをエスケープする（`***強調***` は 3 つなので影響しない）。
 */
const escapeMaskStars = (s: string) => s.replace(/\*{4,}/g, (m) => '\\*'.repeat(m.length));

/** Markdown / HTML を安全な要素だけに削る（外部画像・スクリプト・フォームを落とす） */
export function sanitizeHtml(html: string): DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (DROP_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      if (!SAFE_TAGS.has(tag)) {
        const text = document.createTextNode(el.textContent ?? '');
        el.replaceWith(text);
        continue;
      }
      for (const attr of [...el.attributes]) {
        if (!(SAFE_ATTRS[tag] ?? []).includes(attr.name.toLowerCase())) el.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        if (!/^https?:\/\//i.test(href) && !href.startsWith('#')) {
          el.removeAttribute('href');
        } else {
          el.setAttribute('rel', 'noreferrer noopener');
          el.setAttribute('target', '_blank');
        }
      }
      walk(el);
    }
  };
  walk(tpl.content);
  return tpl.content;
}

const HTML_DOC_CSS = `
  body { font-family: -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", Meiryo, sans-serif;
    line-height: 1.75; color: #1b2330; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
  h1,h2,h3 { line-height:1.35; margin-top:1.6em; }
  code { background:#f2f4f8; padding:2px 5px; border-radius:4px; font-size:0.92em; }
  pre { background:#f6f8fb; padding:12px; border-radius:8px; overflow:auto; }
  table { border-collapse: collapse; width:100%; }
  th,td { border:1px solid #ccd3de; padding:6px 10px; text-align:left; }
  blockquote { border-left:4px solid #ccd3de; margin:1em 0; padding:0.2em 1em; color:#556; }
  @media print { body { margin:0; } a { color:inherit; text-decoration:none; } }
`;

function feedback(btn: HTMLButtonElement) {
  const original = btn.textContent;
  btn.textContent = 'コピーしました';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 1200);
}

function copyButton(label: string, getText: () => string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip-btn';
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      feedback(btn);
    } catch {
      btn.textContent = 'コピーできませんでした';
    }
  });
  return btn;
}

function downloadLink(label: string, blob: Blob, filename: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'chip-btn';
  a.textContent = label;
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  return a;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderBlock(block: Block, urls: string[]): HTMLElement {
  const wrap = el('div', `block block-${block.type}`);
  switch (block.type) {
    case 'notice': {
      const title = block.title ?? (block.level === 'error' ? 'エラー' : block.level === 'warn' ? '注意' : '補足');
      wrap.classList.add(`is-${block.level}`);
      wrap.append(el('div', 'notice-title', title), el('div', 'notice-text', block.text));
      break;
    }
    case 'text': {
      const pre = el('div', 'plain');
      pre.textContent = block.text;
      wrap.append(pre);
      break;
    }
    case 'code': {
      const pre = el('pre', 'code');
      const code = el('code', undefined, block.text);
      pre.append(code);
      wrap.append(pre);
      const bar = el('div', 'block-bar');
      bar.append(copyButton('コピー', () => block.text));
      wrap.append(bar);
      break;
    }
    case 'kv': {
      if (block.title) wrap.append(el('div', 'block-title', block.title));
      const list = el('dl', 'kv');
      for (const item of block.items) {
        const dt = el('dt', undefined, item.k);
        const dd = el('dd');
        dd.textContent = item.v || '—';
        if (item.note) dd.append(el('span', 'kv-note', item.note));
        list.append(dt, dd);
      }
      wrap.append(list);
      break;
    }
    case 'table': {
      if (block.title) wrap.append(el('div', 'block-title', block.title));
      const scroller = el('div', 'table-scroll');
      const table = el('table', 'data');
      const thead = el('thead');
      const hr = el('tr');
      for (const c of block.columns) hr.append(el('th', undefined, c));
      thead.append(hr);
      const tbody = el('tbody');
      for (const row of block.rows) {
        const tr = el('tr');
        for (const cell of row) tr.append(el('td', undefined, cell));
        tbody.append(tr);
      }
      table.append(thead, tbody);
      scroller.append(table);
      wrap.append(scroller);
      if (block.note) wrap.append(el('p', 'block-note', block.note));
      const bar = el('div', 'block-bar');
      bar.append(
        copyButton('表をコピー（Excel 用）', () =>
          [block.columns, ...block.rows].map((r) => r.join('\t')).join('\n'),
        ),
      );
      wrap.append(bar);
      break;
    }
    case 'image': {
      const url = URL.createObjectURL(block.blob);
      urls.push(url);
      const img = el('img', 'preview');
      img.src = url;
      img.alt = block.alt;
      img.loading = 'lazy';
      wrap.append(img);
      if (block.caption) wrap.append(el('div', 'block-note', block.caption));
      break;
    }
    case 'markdown': {
      const html = String(marked.parse(escapeMaskStars(block.text), { gfm: true, async: false }));
      const frag = sanitizeHtml(html);
      const md = el('div', 'md');
      md.append(frag);
      wrap.append(md);
      const htmlText = `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>document</title>\n<style>${HTML_DOC_CSS}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
      const bar = el('div', 'block-bar');
      bar.append(
        copyButton('HTML をコピー', () => htmlText),
        downloadLink('HTML を保存', new Blob([htmlText], { type: 'text/html;charset=utf-8' }), 'document.html'),
      );
      wrap.append(bar);
      break;
    }
    case 'html': {
      const md = el('div', 'md');
      md.append(sanitizeHtml(block.html));
      wrap.append(md);
      break;
    }
  }
  return wrap;
}

export function renderResult(container: HTMLElement, result: Result, urls: string[]) {
  container.innerHTML = '';
  for (const block of result.blocks) container.append(renderBlock(block, urls));
  if (result.downloads.length) {
    const bar = el('div', 'downloads');
    bar.append(el('span', 'downloads-label', '保存する'));
    for (const d of result.downloads) bar.append(downloadLink(d.label, d.blob, d.filename));
    container.append(bar);
  }
}

export interface RenderHandles {
  verdict: HTMLElement;
  alternates: HTMLElement;
  output: HTMLElement;
  stats: HTMLElement;
  notes: HTMLElement;
}

const CONF_LABEL: Record<string, string> = { high: '確度 高', medium: '確度 中', low: '確度 低' };

export function renderAnalysis(h: RenderHandles, a: Analysis, selected: number): string[] {
  const urls: string[] = [];

  // 結論
  h.verdict.innerHTML = '';
  const head = el('div', 'verdict-head');
  head.append(el('span', `conf conf-${a.confidence}`, CONF_LABEL[a.confidence] ?? ''));
  if (a.primary) head.append(el('span', 'verdict-type', a.primary.title));
  h.verdict.append(head, el('p', 'verdict-text', a.headline));

  if (a.trace.length) {
    const trace = el('div', 'trace');
    trace.append(el('span', 'trace-label', '解除した手順'));
    for (const t of a.trace) trace.append(el('span', 'trace-step', t.label));
    h.verdict.append(trace);
  }
  if (a.elapsedMs > 0) h.verdict.append(el('div', 'elapsed', `${a.elapsedMs} ms で解析`));

  // 他の解釈
  h.alternates.innerHTML = '';
  if (a.primary && a.alternates.length) {
    h.alternates.append(el('span', 'alt-label', 'ほかの見方'));
    const mk = (label: string, idx: number, active: boolean) => {
      const b = el('button', `alt-chip${active ? ' is-active' : ''}`, label);
      b.type = 'button';
      b.dataset.index = String(idx);
      b.setAttribute('aria-pressed', String(active));
      h.alternates.append(b);
    };
    mk(`おすすめ: ${a.primary.title}`, -1, selected === -1);
    a.alternates.forEach((alt, i) => {
      const b = el('button', `alt-chip${selected === i ? ' is-active' : ''}`, alt.title);
      b.type = 'button';
      b.dataset.index = String(i);
      b.title = `確度: ${alt.confidence}（スコア ${alt.score}）`;
      b.setAttribute('aria-pressed', String(selected === i));
      h.alternates.append(b);
    });
  }

  // 出力
  const chosen = selected >= 0 ? a.alternates[selected]?.result : a.primary;
  if (chosen) {
    renderResult(h.output, chosen, urls);
  } else {
    h.output.innerHTML = '';
    h.output.append(el('p', 'empty', '判定できる内容がありませんでした。'));
  }

  // 統計
  h.stats.innerHTML = '';
  h.stats.append(el('h3', 'section-title', '統計情報'));
  const dl = el('dl', 'stats');
  for (const s of a.stats) {
    const dt = el('dt');
    dt.textContent = s.label;
    const dd = el('dd', s.warn ? 'is-warn' : undefined, s.value);
    if (s.note) dd.append(el('span', 'kv-note', s.note));
    dl.append(dt, dd);
  }
  h.stats.append(dl);

  // 補足
  h.notes.innerHTML = '';
  h.notes.append(el('h3', 'section-title', '補足'));
  if (a.notes.length === 0) {
    h.notes.append(el('p', 'muted', '特に注意する点はありません。'));
  } else {
    for (const b of a.notes) h.notes.append(renderBlock(b, urls));
  }

  return urls;
}
