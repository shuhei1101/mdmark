import type { Page } from "playwright";
import { GREET_SOURCE } from "./cli.ts";

/** タイトル・本文・索引の用語に mdmark を持ち、隠す書き出しの全ての置き換えと削除を通る文書 */
const INTRO = [
  '<!-- features: {"html-scripts": true} -->',
  "",
  "# mdmark の紹介",
  "",
  "mdmark は Markdown を描きます。[使い方](./guide.md) を参照。",
  "",
  "<!-- todo -->",
  "",
  '<!-- greet: {"target": "利用者"} -->',
  "",
  '<!-- tabs: {"group": "os"} -->',
  "",
  "### macOS",
  "",
  "macOS の手順。",
  "",
  "### Windows",
  "",
  "Windows の手順。",
  "",
  "<!-- /tabs -->",
  "",
  "<!-- table: data -->",
  "",
  "| 名前 | 件数 |",
  "| --- | --- |",
  "| b | 2 |",
  "| a | 10 |",
  "",
  "<!-- /table -->",
  "",
  "```mermaid",
  "flowchart LR",
  "  A[書く] --> B[書き出す]",
  "```",
  "",
  "`icon:sailboat` 航海",
  "",
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">箱</div>',
  "<mdmark-chart>",
  '{"type": "bar", "title": "件数", "scope": "今週", "updated": "2026-11-14", "x": {"label": "窓口", "ticks": ["メール", "電話"]}, "y": {"label": "件"}, "series": [{"name": "件", "points": [3, 5]}]}',
  "</mdmark-chart>",
  "```",
  "",
  "```css",
  ".box { color: var(--mdmark-color-accent); }",
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): (() => void) => {",
  '  root.querySelector<HTMLElement>(".box")?.addEventListener("click", () => {',
  '    root.classList.add("is-open");',
  "    (window as unknown as { __mdmarkOpened?: boolean }).__mdmarkOpened = true;",
  "  });",
  "  return () => {};",
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
  '<p class="mdmark-align-center">中央</p>',
  "",
  "```html",
  "<mdmark-chart>{}</mdmark-chart>",
  "```",
  "",
].join("\n");

/** 隠す書き出しの結合テストのフォルダ: `mdmark-intro.md`・戻るリンクを持つ `guide.md`・索引・`theme.css`・拡張と、`mermaid.url` を手元に向けた設定 */
export const TRACES_FILES: Record<string, string> = {
  "mdmark.config.yaml": [
    "index: index.yaml",
    "theme: theme.css",
    "extensions: [extensions/greet.js]",
    "mermaid:",
    "  url: vendor/mermaid/mermaid.esm.min.mjs",
    "build:",
    '  include: ["*.md"]',
    "  entry: mdmark-intro.md",
    "  out: dist/docs.html",
    "",
  ].join("\n"),
  "index.yaml": [
    "schema: 2",
    "docs:",
    "  - id: intro",
    "    path: mdmark-intro.md",
    "    title: mdmark の紹介",
    "  - id: guide",
    "    path: guide.md",
    "    title: 使い方",
    "terms:",
    "  - id: mdmark",
    "    term: mdmark",
    "    meaning: Markdown を描くライブラリ",
    "",
  ].join("\n"),
  "theme.css":
    ".mdmark { --mdmark-radius: 8px; --mdmark-color-accent: rgb(200, 30, 30); }\n.mdmark h1 { letter-spacing: 3px; }\n",
  "extensions/greet.js": GREET_SOURCE,
  "mdmark-intro.md": INTRO,
  "guide.md": "# 使い方\n\n[紹介へ戻る](./mdmark-intro.md)\n",
};

/** 隠した HTML の残りを数えた結果 */
export type TraceReport = {
  /** `<title>` と範囲のスクリプトの表の鍵（`__mdmarkOpened` を持つ文字列）を除く、HTML の文字列の `mdmark` の数 */
  outside: number;
  /** 埋め込みの JSON の、利用者が記載した値の項目を除く値の `mdmark` の数 */
  generated: number;
  /** 埋め込みの Markdown の `<mdmark-`・`--mdmark-`・`class` の値の `mdmark-` の数 */
  markdownNames: number;
  /** HTML の文字列の `<!--` の数 */
  comments: number;
  /** 埋め込みの Markdown */
  markdown: string;
};

/** 隠した HTML の中身を、別名の `#zq-payload` から取り出して数える */
export function reportTraces(html: string): TraceReport {
  const match =
    /(<script type="application\/json" id="zq-payload">)([\s\S]*?)(<\/script>)/.exec(
      html,
    );
  if (!match?.[2]) {
    throw new Error("#zq-payload が無い");
  }
  const payload = JSON.parse(match[2]) as Record<string, unknown> & {
    docs: Array<{ markdown: string }>;
  };
  const {
    index: _index,
    references: _references,
    docs,
    entry: _entry,
    aliases: _aliases,
    includes: _includes,
    assets: _assets,
    ...rest
  } = payload;
  const outside = html
    .replace(match[0], "")
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/"[^"]*__mdmarkOpened[^"]*"/g, "");
  const markdown = docs.map((doc) => doc.markdown).join("\n");
  const count = (text: string, pattern: RegExp) =>
    (text.match(pattern) ?? []).length;
  return {
    outside: count(outside, /mdmark/gi),
    generated: count(JSON.stringify(rest), /mdmark/gi),
    markdownNames: count(
      markdown,
      /<\/?mdmark-|--mdmark-|class="[^"]*\bmdmark-/gi,
    ),
    comments: count(outside, /<!--/g),
    markdown,
  };
}

/** 開いた文書の要素を、別名を `mdmark` に戻した class と計算後のスタイルで並べる。本文のコードの例（`-chart>{}` を持つ `pre`）の中は除く */
export async function snapshotDom(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const normalize = (text: string) =>
      text.replace(/\bzq/g, "mdmark").replace(/\bZq/g, "Mdmark");
    const rows: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.closest("svg") && element.tagName.toLowerCase() !== "svg") {
        continue;
      }
      if (element.closest("pre")?.textContent?.includes("-chart>{}")) {
        continue;
      }
      const style = getComputedStyle(element);
      rows.push(
        [
          normalize(element.tagName.toLowerCase()),
          normalize(element.getAttribute("class") ?? ""),
          style.display,
          style.color,
          style.backgroundColor,
          style.fontSize,
          style.letterSpacing,
          style.borderRadius,
        ].join("|"),
      );
    }
    return rows;
  });
}

/** 開いた文書の DOM のコメントのノードの数 */
export async function countCommentNodes(page: Page): Promise<number> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    let count = 0;
    while (walker.nextNode()) {
      count++;
    }
    return count;
  });
}
