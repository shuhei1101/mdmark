import { basename, dirname, extname, resolve } from "node:path";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import type { PreviewConfig } from "../config.ts";
import { escapeHtml } from "../escape.ts";

/** 印刷のダイアログを出すまでの待ちの上限（ミリ秒）。`mount` の後、外部ライブラリのマーカーの場所が無くなるのとフォントを待つ上限 */
export const PRINT_WAIT_MS = 10000;

/** 書き出す HTML のパスを決める。`outputDir` が空なら Markdown と同じフォルダ、相対パスならワークスペースのフォルダから、絶対パスならそのまま。拡張子を `.html` に替えた名前を付ける */
export function resolveExportPath(options: {
  /** Markdown の絶対パス */
  markdownPath: string;
  /** `mdmark.export.outputDir` */
  outputDir: string;
  /** Markdown を含むワークスペースのフォルダ（ワークスペースの外の Markdown は Markdown のフォルダ） */
  workspaceDir: string;
}): string {
  const { markdownPath, outputDir, workspaceDir } = options;
  const name = `${basename(markdownPath, extname(markdownPath))}.html`;
  const directory =
    outputDir === "" ? dirname(markdownPath) : resolve(workspaceDir, outputDir);
  return resolve(directory, name);
}

/** `JSON.stringify` し、`<` を JSON の Unicode エスケープ（6 文字）に置き換えて返却する。本文の `</script>` で `script` 要素が閉じない */
export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/** ES モジュールのコードを、`file:` のページから `import()` で読み込める `data:` の URL にする */
export function moduleDataUrl(code: string): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

/** まとめた拡張を順に読み込み、`mount` の前に登録する（読み込めない拡張は飛ばす） */
const REGISTER_EXTENSIONS_SCRIPT = `
for (const url of data.extensions) {
  try {
    registerExtension((await import(url)).default);
  } catch (error) {
    console.error("拡張を登録できません:", error);
  }
}`;

/** 印刷を待つ処理。外部ライブラリのマーカーの場所が無くなり、フォントを読み込み終えたら 1 回だけ `window.print()` を呼ぶ。待ちの上限を超えたらそのまま呼ぶ */
const PRINT_SCRIPT = `
const PRINT_WAIT_MS = ${PRINT_WAIT_MS};
let printed = false;
let fontsReady = false;
const placeholders = () => main.querySelector('.mdmark-embed[role="status"]') !== null;
const print = () => {
  if (printed) {
    return;
  }
  printed = true;
  observer.disconnect();
  window.print();
};
const check = () => {
  if (fontsReady && !placeholders()) {
    print();
  }
};
const observer = new MutationObserver(check);
observer.observe(main, { childList: true, subtree: true, attributes: true });
document.fonts.ready.then(() => {
  fontsReady = true;
  check();
});
setTimeout(print, PRINT_WAIT_MS);
`;

/** 書き出す HTML を組む。`<base>`・そのバージョンの `index.css` の `<link>`・本文と設定の JSON の `<script type="application/json">`・`importMap` が空でないときの `<script type="importmap">`・`index.js` を読み込んで `mount` を呼ぶ `<script type="module">` を持つ。`aliases` があるときは JSON に埋めて `mount` の `opts.aliases` に指定する。`print` が `true` のときだけ印刷を待つ処理を追加する */
export function buildExportHtml(options: {
  /** 全文 */
  markdown: string;
  /** 設定（相対パスの `libraries`・`html-scripts.url` は `data:` の URL にした値） */
  config: PreviewConfig;
  /** Markdown のファイル名 */
  title: string;
  /** 配布物の `index.js` の URL */
  distJs: string;
  /** 配布物の `index.css` の URL */
  distCss: string;
  /** Markdown のフォルダの `file:` の URL に `/` を付けたもの */
  baseHref: string;
  /** 印刷を待つか */
  print: boolean;
  /** 重ねた設定の `theme` の CSS の中身 */
  themeCss?: string | undefined;
  /** 拡張をまとめた ES モジュールのコード（設定の順） */
  extensions: string[];
  /** import map の `imports`（相対パスの `syntax.url` の本体と言語のモジュールの `data:` の URL）。空なら配置しない */
  importMap?: Record<string, string> | undefined;
  /** 設定の `aliases` から作ったエイリアス。無いときは JSON にも `mount` にも指定しない */
  aliases?: MdmarkAlias[] | undefined;
}): string {
  const data = escapeScriptJson({
    markdown: options.markdown,
    config: options.config,
    // `file:` のページは `file:` のモジュールを読み込まないため、`data:` の URL にして読み込む
    extensions: options.extensions.map(moduleDataUrl),
    ...(options.aliases === undefined ? {} : { aliases: options.aliases }),
  });
  const themeStyle =
    options.themeCss === undefined
      ? ""
      : `<style>${options.themeCss.replace(/<\/(style)/gi, "<\\/$1")}</style>\n`;
  const importMap =
    options.importMap === undefined ||
    Object.keys(options.importMap).length === 0
      ? ""
      : `<script type="importmap">${escapeScriptJson({ imports: options.importMap })}</script>\n`;
  const register =
    options.extensions.length === 0 ? "" : REGISTER_EXTENSIONS_SCRIPT;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)}</title>
<base href="${escapeHtml(options.baseHref)}">
<link rel="stylesheet" href="${escapeHtml(options.distCss)}">
${themeStyle}${importMap}</head>
<body>
<main></main>
<script type="application/json" id="mdmark-data">${data}</script>
<script type="module">
import { mount${options.extensions.length === 0 ? "" : ", registerExtension"} } from ${escapeScriptJson(options.distJs)};
const main = document.querySelector("main");
const data = JSON.parse(document.getElementById("mdmark-data").textContent);${register}
mount(main, { markdown: data.markdown, config: data.config${options.aliases === undefined ? "" : ", aliases: data.aliases"} });${options.print ? PRINT_SCRIPT : ""}
</script>
</body>
</html>
`;
}
