/** 中の規則も根の要素の中に限る `@` の規則 */
const NESTING_AT_RULES = new Set(["media", "supports", "container", "layer"]);

/** 中を書き換えずに残す `@` の規則 */
const KEPT_AT_RULES = new Set(["keyframes", "font-face"]);

/** 先頭にあれば根の要素として解釈するセレクタ */
const ROOT_LIKE_SELECTOR = /^(?::root|html|body)(?![\w-])/;

/** 最上位の規則 1 つ。`body` が無いものは `;` で終わる文 */
type CssRule = { prelude: string; body: string | undefined };

/** `start` の位置の文字列かコメントの終わりの次の位置を返却する（文字列でもコメントでもなければ `start`） */
function skipQuoted(css: string, start: number): number {
  const char = css[start];
  if (char === '"' || char === "'") {
    let index = start + 1;
    while (index < css.length && css[index] !== char) {
      index += css[index] === "\\" ? 2 : 1;
    }
    return index + 1;
  }
  if (css.startsWith("/*", start)) {
    const end = css.indexOf("*/", start + 2);
    return end === -1 ? css.length : end + 2;
  }
  return start;
}

/** コメントを取り除く（文字列の中は残す） */
function stripComments(css: string): string {
  let result = "";
  let index = 0;
  while (index < css.length) {
    const next = skipQuoted(css, index);
    if (next === index) {
      result += css[index];
      index += 1;
    } else {
      result += css.startsWith("/*", index) ? " " : css.slice(index, next);
      index = next;
    }
  }
  return result;
}

/** `{` の次の位置から、文字列とコメントを飛ばしながら対応する `}` を探し、中身の終わりと `}` の次の位置を返却する（閉じなければ両方とも末尾） */
function findBlockEnd(
  css: string,
  bodyStart: number,
): { bodyEnd: number; next: number } {
  let depth = 1;
  let index = bodyStart;
  while (index < css.length && depth > 0) {
    const skipped = skipQuoted(css, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
    }
    index += 1;
  }
  return { bodyEnd: depth === 0 ? index - 1 : index, next: index };
}

/** 文字列とコメントを飛ばしながら、最上位の規則を `{` と対応する `}`、または `;` で切り出す */
function splitRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let preludeStart = 0;
  let index = 0;
  while (index < css.length) {
    const next = skipQuoted(css, index);
    if (next !== index) {
      index = next;
      continue;
    }
    const char = css[index];
    if (char === ";") {
      rules.push({ prelude: css.slice(preludeStart, index), body: undefined });
      preludeStart = index + 1;
    } else if (char === "{") {
      const bodyStart = index + 1;
      const { bodyEnd, next: after } = findBlockEnd(css, bodyStart);
      rules.push({
        prelude: css.slice(preludeStart, index),
        body: css.slice(bodyStart, bodyEnd),
      });
      preludeStart = after;
      index = after;
      continue;
    }
    index += 1;
  }
  return rules.filter(
    (rule) => rule.body !== undefined || rule.prelude.trim() !== "",
  );
}

/** セレクタの並びを、括弧・角括弧・文字列の外の `,` で分ける */
function splitSelectors(prelude: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  let index = 0;
  while (index < prelude.length) {
    const next = skipQuoted(prelude, index);
    if (next !== index) {
      index = next;
      continue;
    }
    const char = prelude[index];
    if (char === "(" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "]") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      selectors.push(prelude.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  selectors.push(prelude.slice(start));
  return selectors.map((selector) => selector.trim()).filter(Boolean);
}

/** セレクタ 1 つを根の要素の中に限る */
function scopeSelector(selector: string, root: string): string {
  const leading = ROOT_LIKE_SELECTOR.exec(selector);
  if (leading) {
    return `${root}${selector.slice(leading[0].length)}`;
  }
  if (selector.includes(":scope")) {
    return selector.replaceAll(":scope", root);
  }
  return `${root} ${selector}`;
}

/** `@` の規則 1 つを根の要素の中に限った CSS にする。範囲の外へ該当しうる規則（`@import`・`@scope`・`@starting-style` など）は `undefined` */
function scopeAtRule(
  rule: { head: string; body: string | undefined },
  root: string,
): string | undefined {
  const { head, body } = rule;
  const name = /^@([\w-]+)/.exec(head)?.[1]?.toLowerCase() ?? "";
  if (NESTING_AT_RULES.has(name)) {
    return body === undefined
      ? `${head};`
      : `${head} { ${scopeRules(body, root)} }`;
  }
  if (KEPT_AT_RULES.has(name) && body !== undefined) {
    return `${head} {${body}}`;
  }
  return undefined;
}

/** 規則 1 つを根の要素の中に限った CSS にする。中身の無い文と落とす `@` の規則は `undefined` */
function scopeRule(rule: CssRule, root: string): string | undefined {
  const head = rule.prelude.trim();
  if (head.startsWith("@")) {
    return scopeAtRule({ head, body: rule.body }, root);
  }
  if (rule.body === undefined) {
    return undefined;
  }
  const selectors = splitSelectors(head).map((selector) =>
    scopeSelector(selector, root),
  );
  return `${selectors.join(", ")} {${rule.body}}`;
}

/** 規則の並びを根の要素の中に限った CSS にする */
function scopeRules(css: string, root: string): string {
  return splitRules(css)
    .map((rule) => scopeRule(rule, root))
    .filter((part) => part !== undefined)
    .join("\n");
}

/** 範囲の `css` の各規則を、範囲の根の要素 `.mdmark-html[data-html-scope="{scope}"]` の中だけに該当する CSS にする */
export function scopeCss(options: {
  /** 範囲の `css` のコードブロックの中身 */
  css: string;
  /** 範囲の通し番号 */
  scope: number;
}): string {
  const root = `.mdmark-html[data-html-scope="${options.scope}"]`;
  return scopeRules(stripComments(options.css), root).replace(
    /<\/style/gi,
    "<\\/style",
  );
}
