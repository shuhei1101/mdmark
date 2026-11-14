import MarkdownIt from "markdown-it";
import { knownMarkNames, loadExtensionDirectives } from "./check.ts";
import type { LoadedConfig } from "./config.ts";
import type { ExportPayload } from "./html.ts";

/** 隠す書き出しで、単語の一部として出る `mdmark` を置き換える別名 */
export const TRACE_ALIAS = "zq";

/** `createViewerEntry` が範囲のスクリプトの表の鍵の代わりに記載する文字列リテラルの頭。後ろに鍵の番号と `@@` を付ける */
export const HTML_SCRIPT_KEY_PREFIX = "@@html-script-key-";

/** 範囲のスクリプトの表の鍵の仮の文字列（囲むクオートを含む） */
const HTML_SCRIPT_KEY_PATTERN = new RegExp(
  `(["'\`])${HTML_SCRIPT_KEY_PREFIX}(\\d+)@@\\1`,
  "g",
);

/** 配布物の CSS の先頭に付くバージョンの宣言 */
const VERSION_DECLARATION_PATTERN = /:root\{--mdmark-version:"[^"]*"\}\n?/g;

/** HTML のコメント */
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** マーカー（`<!-- 名前 -->`・`<!-- 名前: 引数 -->`・`<!-- /名前 -->`）の全体 */
const MARK_COMMENT_PATTERN =
  /^<!--\s*\/?([a-z][a-z0-9-]*)(?::[\s\S]*?)?\s*-->$/;

/** 行内のコード（同じ数のバッククォートで囲んだ範囲） */
const INLINE_CODE_PATTERN = /(`+)[\s\S]*?\1/g;

/** 単語の一部として出る `mdmark` を、大文字・小文字の構成を保って `TRACE_ALIAS` へ置き換える */
export const hideNames = (text: string): string =>
  text.replace(/mdmark/gi, (found) => {
    if (found === found.toUpperCase()) {
      return TRACE_ALIAS.toUpperCase();
    }
    if (found[0] === "M") {
      return `${TRACE_ALIAS[0]?.toUpperCase() ?? ""}${TRACE_ALIAS.slice(1)}`;
    }
    return TRACE_ALIAS;
  });

/** 行内のコードの外にある、マーカーでない HTML のコメントを削除する */
const dropCommentsOutsideCode = (
  text: string,
  markNames: ReadonlySet<string>,
): string => {
  const drop = (part: string): string =>
    part.replace(COMMENT_PATTERN, (comment) => {
      const name = MARK_COMMENT_PATTERN.exec(comment)?.[1];
      return name !== undefined && markNames.has(name) ? comment : "";
    });
  let result = "";
  let last = 0;
  for (const match of text.matchAll(INLINE_CODE_PATTERN)) {
    result += drop(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + drop(text.slice(last));
};

/** 生の HTML のブロックと行内の HTML を持つ行の番号（0 から）を集める */
const htmlLines = (markdown: string): Set<number> => {
  const tokens = new MarkdownIt({ html: true, linkify: true }).parse(
    markdown,
    {},
  );
  const lines = new Set<number>();
  for (const token of tokens) {
    const hasHtml =
      token.type === "html_block" ||
      (token.type === "inline" &&
        (token.children ?? []).some((child) => child.type === "html_inline"));
    if (hasHtml && token.map) {
      for (let line = token.map[0]; line < token.map[1]; line++) {
        lines.add(line);
      }
    }
  }
  return lines;
};

/** 埋め込みの Markdown で、部品の要素名・CSS 変数・`class` の値・アセットの頭の `mdmark` を別名へ置き換え、マーカーでない HTML のコメントを削除する */
export const hideMarkdown = (options: {
  markdown: string;
  markNames: ReadonlySet<string>;
}): string => {
  const { markdown, markNames } = options;
  const targets = htmlLines(markdown);
  const lines = markdown.split("\n");
  const kept: string[] = [];
  // 生の HTML の連続した行をまとめて扱い、複数行のコメントも削除する
  for (let line = 0; line < lines.length; ) {
    if (!targets.has(line)) {
      kept.push(lines[line] ?? "");
      line++;
      continue;
    }
    let end = line;
    while (targets.has(end)) {
      end++;
    }
    kept.push(
      dropCommentsOutsideCode(lines.slice(line, end).join("\n"), markNames),
    );
    line = end;
  }
  return kept
    .join("\n")
    .replace(/(<\/?)mdmark-/gi, `$1${TRACE_ALIAS}-`)
    .replace(/--mdmark-/g, `--${TRACE_ALIAS}-`)
    .replace(
      /(\bclass\s*=\s*["'])([^"']*)/gi,
      (_, head: string, value: string) =>
        head + value.replace(/\bmdmark-/g, `${TRACE_ALIAS}-`),
    )
    .replace(/\bmdmark-asset:/g, `${TRACE_ALIAS}-asset:`);
};

/** 記法・外部ライブラリ・拡張の `directive`・設定の `check.ignore` の、描画が参照するマーカーの名前を集める */
export const collectMarkNames = async (
  loaded: LoadedConfig,
): Promise<Set<string>> => {
  // 拡張の誤りは書き出しの警告が出すため、ずれは捨てる
  const { directives } = await loadExtensionDirectives(loaded, loaded.path);
  return new Set([
    ...knownMarkNames({ config: loaded.config, directives }),
    ...(loaded.config.check?.ignore ?? []),
  ]);
};

/** 値を JSON にして名前を置き換え、元の構造に戻す */
const hideValue = <T>(value: T): T =>
  JSON.parse(hideNames(JSON.stringify(value))) as T;

/** 利用者が記載した値を除く項目（`config`・`icons`）の名前を置き換えた書き出しの中身を返却する */
export const hidePayload = (payload: ExportPayload): ExportPayload => ({
  ...payload,
  config: hideValue(payload.config),
  ...(payload.icons ? { icons: hideValue(payload.icons) } : {}),
});

/** CSS からバージョンの宣言を削除し、名前を置き換える */
export const hideCss = (css: string): string =>
  hideNames(css.replace(VERSION_DECLARATION_PATTERN, ""));

/** まとめたスクリプトの名前を置き換え、範囲のスクリプトの表の鍵を元の文字に戻す。ライセンスの注釈は削除しない */
export const hideScript = (options: { code: string; keys: string[] }): string =>
  hideNames(options.code).replace(
    HTML_SCRIPT_KEY_PATTERN,
    (found, _quote: string, index: string) => {
      const key = options.keys[Number(index)];
      return key === undefined ? found : JSON.stringify(key);
    },
  );
