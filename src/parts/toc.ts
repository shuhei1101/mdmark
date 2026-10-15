import { escapeHtml } from "./escape.ts";

/** 目次に載せる見出し */
export type TocHeading = {
  /** 見出しの階層 */
  level: 2 | 3;
  /** 見出しの ID */
  id: string;
  /** 見出しの文字 */
  text: string;
};

/** 見出し 1 つのリンクを `li` の頭にする */
function renderLink(heading: TocHeading): string {
  return `<a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`;
}

/** 目次の HTML を返す。h3 は直前の h2 の入れ子にする */
export function renderToc(options: {
  /** 文書の h2・h3 */
  headings: TocHeading[];
}): string {
  const items: string[] = [];
  let children: string[] = [];
  let current: TocHeading | undefined;
  /** 直前の h2 とその h3 を `li` にして閉じる */
  const flush = (): void => {
    if (current) {
      const nested = children.length ? `<ul>${children.join("")}</ul>` : "";
      items.push(`<li>${renderLink(current)}${nested}</li>`);
    }
    current = undefined;
    children = [];
  };
  for (const heading of options.headings) {
    if (heading.level === 2) {
      flush();
      current = heading;
    } else if (current) {
      children.push(`<li>${renderLink(heading)}</li>`);
    } else {
      // 直前に h2 が無い h3 は、1 段目に並べる
      items.push(`<li>${renderLink(heading)}</li>`);
    }
  }
  flush();
  return `<nav class="mdmark-toc" aria-label="目次"><p class="mdmark-toc-title">目次</p><ul>${items.join("")}</ul></nav>`;
}
