import { resolve } from "node:path";

/** リンクの開き先 */
export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "markdown"; path: string }
  | { kind: "file"; path: string }
  | { kind: "none" };

/** 先頭のスキーム */
const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** 既定のブラウザ（や既定のアプリ）で開くスキーム */
const EXTERNAL_SCHEMES = new Set(["http", "https", "mailto"]);

/** `http:`・`https:`・`mailto:` は `external`、それ以外のスキームは `none`、相対パスは `#` 以降を落として Markdown のフォルダから解決し、拡張子が `.md` なら `markdown`、他は `file` を返す */
export function resolveLink(options: {
  /** 記載したままの `href` */
  href: string;
  /** Markdown のフォルダの絶対パス */
  markdownDir: string;
}): LinkTarget {
  const { href, markdownDir } = options;
  const scheme = SCHEME_PATTERN.exec(href)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    return EXTERNAL_SCHEMES.has(scheme)
      ? { kind: "external", url: href }
      : { kind: "none" };
  }
  // 相対パス: `#` と `?` 以降を落とし、パーセントエンコードを戻す
  const [relative = ""] = href.split(/[#?]/);
  if (relative === "") {
    return { kind: "none" };
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return { kind: "none" };
  }
  const path = resolve(markdownDir, decoded);
  return path.toLowerCase().endsWith(".md")
    ? { kind: "markdown", path }
    : { kind: "file", path };
}
