import { resolveLink } from "../knowledge/paths.ts";

/** URL の `#` のうち、文書の指定として扱う頭 */
export const DOC_HASH_PREFIX = "#/";

/** 文書のパスを書いたリンクに付ける属性 */
const DOC_PATH_ATTRIBUTE = "data-doc-path";

/** `#` のあとの文字を、パーセント符号化を戻して返す。戻せないときはそのまま返す */
function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** URL の `#` が指す文書と見出しを読む。`#/` で始まらないときと 1 枚に無い文書を指すときは `entry` を返す */
export function resolveRoute(
  hash: string,
  paths: ReadonlySet<string>,
  entry: string,
): { path: string; heading: string | null; missing: boolean } {
  if (!hash.startsWith(DOC_HASH_PREFIX)) {
    return { path: entry, heading: null, missing: false };
  }
  const rest = hash.slice(DOC_HASH_PREFIX.length);
  const separator = rest.indexOf("#");
  const path = decode(separator < 0 ? rest : rest.slice(0, separator));
  const headingText = separator < 0 ? "" : decode(rest.slice(separator + 1));
  if (!paths.has(path)) {
    return { path: entry, heading: null, missing: true };
  }
  return {
    path,
    heading: headingText === "" ? null : headingText,
    missing: false,
  };
}

/** 描いた文書のリンクのうち、まとめた文書への相対リンクと同じ文書の中のアンカーを、1 枚の中の文書へ移るリンクに書き換える */
export function rewriteLinks(
  root: HTMLElement,
  docPath: string,
  paths: ReadonlySet<string>,
): void {
  for (const link of root.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? "";
    // 同じ文書の中のアンカー: 描いた文書のパスを足す
    if (href.startsWith("#") && href.length > 1) {
      if (!href.startsWith(DOC_HASH_PREFIX)) {
        link.setAttribute("href", `${DOC_HASH_PREFIX}${docPath}${href}`);
      }
      continue;
    }
    const target = resolveLink(docPath, href);
    if (target === undefined || !paths.has(target)) {
      continue;
    }
    const hashIndex = href.indexOf("#");
    const fragment = hashIndex < 0 ? "" : href.slice(hashIndex);
    link.setAttribute("href", `${DOC_HASH_PREFIX}${target}${fragment}`);
    link.setAttribute(DOC_PATH_ATTRIBUTE, target);
  }
}
