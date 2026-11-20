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

/** 開きタグ・閉じタグ（属性の値の `>` はサニタイズで `&gt;` になっている） */
const TAG_PATTERN = /<(\/?)([^\s/>]+)([^>]*)>/g;

/** タグの中の属性（名前と、あれば値） */
const ATTRIBUTE_PATTERN = /([^\s=/]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"'>]+)?/g;

/** 名前を置き換える属性の値か（`class`・`id`・`data-*`） */
const isNameValue = (name: string): boolean =>
  name === "class" || name === "id" || name.startsWith("data-");

/** 属性の値の `mdmark` を、属性の種類に合わせて置き換える */
const hideAttributeValue = (name: string, value: string): string => {
  if (isNameValue(name)) {
    return hideNames(value);
  }
  const assets = value.replace(/\bmdmark-asset:/g, `${TRACE_ALIAS}-asset:`);
  return name === "style"
    ? assets.replace(/--mdmark-/g, `--${TRACE_ALIAS}-`)
    : assets;
};

/** 描いた本文の HTML で、要素名・属性名・`class` と `id` と `data-*` の属性の値・`style` の CSS 変数の名前・`mdmark-asset:` の `mdmark` だけを別名へ置き換え、HTML のコメントを削除する。テキストのノードと `href`・`src`・`alt`・`title` の値は置き換えない */
export const hideRenderedHtml = (html: string): string =>
  html
    .replace(COMMENT_PATTERN, "")
    .replace(
      TAG_PATTERN,
      (_tag, slash: string, name: string, rest: string) =>
        `<${slash}${hideNames(name)}${rest.replace(
          ATTRIBUTE_PATTERN,
          (_attr, attr: string, equals = "", value = "") =>
            `${hideNames(attr)}${equals}${value === "" ? "" : hideAttributeValue(attr.toLowerCase(), value)}`,
        )}>`,
    );

/** 値を JSON にして名前を置き換え、元の構造に戻す */
const hideValue = <T>(value: T): T =>
  JSON.parse(hideNames(JSON.stringify(value))) as T;

/** 利用者が記載した値を除く項目（`config`・`icons`・`docs[].rendered` の HTML 以外）の名前を置き換え、描いた本文の HTML に `hideRenderedHtml` を適用した書き出しの中身を返却する。`docs[].pureMarkdown` は置き換えない */
export const hidePayload = (payload: ExportPayload): ExportPayload => ({
  ...payload,
  config: hideValue(payload.config),
  ...(payload.icons ? { icons: hideValue(payload.icons) } : {}),
  docs: payload.docs.map((doc) => {
    const { html, ...others } = doc.rendered;
    return {
      ...doc,
      rendered: { ...hideValue(others), html: hideRenderedHtml(html) },
    };
  }),
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
