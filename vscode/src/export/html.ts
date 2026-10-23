import { basename, dirname, extname, resolve } from "node:path";
import type { PreviewConfig } from "../config.ts";
import { escapeHtml } from "../escape.ts";

/** 印刷のダイアログを出すまでの待ちの上限（ミリ秒）。`mount` の後、外部ライブラリの印の場所が無くなるのとフォントを待つ上限 */
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

/** `JSON.stringify` し、`<` を JSON の Unicode エスケープ（6 文字）に置き換えて返す。本文の `</script>` で `script` 要素が閉じない */
export function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/** 印刷を待つ処理。外部ライブラリの印の場所が無くなり、フォントを読み終えたら 1 回だけ `window.print()` を呼ぶ。待ちの上限を超えたらそのまま呼ぶ */
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

/** 書き出す HTML を組む。`<base>`・そのバージョンの `index.css` の `<link>`・本文と設定の JSON の `<script type="application/json">`・`index.js` を読んで `mount` を呼ぶ `<script type="module">` を持つ。`print` が `true` のときだけ印刷を待つ処理を足す */
export function buildExportHtml(options: {
  /** 全文 */
  markdown: string;
  /** 設定（`libraries` は `file:` の URL に直した値） */
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
}): string {
  const data = escapeScriptJson({
    markdown: options.markdown,
    config: options.config,
  });
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)}</title>
<base href="${escapeHtml(options.baseHref)}">
<link rel="stylesheet" href="${escapeHtml(options.distCss)}">
</head>
<body>
<main></main>
<script type="application/json" id="mdmark-data">${data}</script>
<script type="module">
import { mount } from ${escapeScriptJson(options.distJs)};
const main = document.querySelector("main");
const data = JSON.parse(document.getElementById("mdmark-data").textContent);
mount(main, { markdown: data.markdown, config: data.config });${options.print ? PRINT_SCRIPT : ""}
</script>
</body>
</html>
`;
}
