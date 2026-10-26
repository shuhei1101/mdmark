import type { MdmarkConfig } from "../config.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
import { escapeHtml } from "../parts/escape.ts";

/** 書き出した HTML に JSON で埋め、開いたときに起動の処理が読む中身 */
export type ExportPayload = {
  /** `export` は `document`、`build` は `bundle` */
  kind: "document" | "bundle";
  /** `features`・`libraries` を持つ設定（`libraries` の値は埋めたモジュールの名前に替える） */
  config: MdmarkConfig;
  /** 索引 */
  index?: MdmarkIndex | undefined;
  /** `collectReferences` の参照の表 */
  references?: MdmarkReferences | undefined;
  /** 埋める文書。`markdown` は画像を `data:` URL に替えたもの */
  docs: Array<{
    path: string;
    title: string;
    markdown: string;
    docId?: string | undefined;
  }>;
  /** 最初に開く文書の `path` */
  entry: string;
  /** 印の名前から束ねたモジュールのコードを引く表 */
  modules: Record<string, string>;
  /** 束ねた拡張のモジュールのコード */
  extensions: string[];
  /** 埋めた部品のモジュールのコード。文書にビューの印があるときだけ `view` を持つ（コメントの部品は埋めない）。無ければ空として読む */
  parts?: Partial<Record<"view", string>>;
  /** 束ねた色分けのライブラリのコード。`core` は本体、`languages` は言語のモジュール名からコードを引く表。文書に色分けの対象があり本体を束ねられたときだけ持つ */
  syntax?: { core: string; languages: Record<string, string> } | undefined;
};

/** 書き出しの中身を入れる `script` 要素の `id`（起動の処理が読む） */
const PAYLOAD_ID = "mdmark-payload";

/** 三本線のアイコン（文書の一覧を開くボタン） */
const MENU_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.75 4h10.5"/><path d="M2.75 8h10.5"/><path d="M2.75 12h10.5"/></svg>';

/** ×のアイコン（パネルを閉じるボタン） */
const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8"/><path d="M12 4l-8 8"/></svg>';

/** まとめた HTML の画面の骨組み: 横の一覧・狭い幅の帯・開いている文書の領域・一覧のパネル */
const BUNDLE_BODY = [
  '<div class="mdmark-bundle">',
  '<aside class="mdmark-bundle-side"></aside>',
  '<main class="mdmark-bundle-main">',
  '<div class="mdmark-bundle-bar">',
  `<button class="mdmark-bundle-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="mdmark-doc-list-panel" data-panel-open>${MENU_ICON}文書の一覧</button>`,
  '<span class="mdmark-bundle-bar-title" data-bar-title></span>',
  "</div>",
  '<article class="mdmark" data-doc-view></article>',
  "</main>",
  "</div>",
  '<dialog class="mdmark-bundle-panel" id="mdmark-doc-list-panel" closedby="any" aria-labelledby="mdmark-doc-list-panel-title">',
  '<div class="mdmark-bundle-panel-head">',
  '<p class="mdmark-bundle-panel-title" id="mdmark-doc-list-panel-title">文書の一覧</p>',
  `<button class="mdmark-bundle-button is-icon" type="button" aria-label="文書の一覧を閉じる" data-panel-close>${CLOSE_ICON}</button>`,
  "</div>",
  "<div data-panel-body></div>",
  "</dialog>",
].join("");

/** 1 文書の HTML の本文: 描く先の要素だけを置く */
const DOCUMENT_BODY = '<article class="mdmark"></article>';

/** `style` 要素の中で閉じタグと読まれないよう、`</style` を `<\/style` に替える */
function escapeStyle(css: string): string {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

/** 書き出しの中身を JSON にし、`script` 要素を閉じる並びにならないよう `<` を JSON のエスケープに替える */
function encodePayload(payload: ExportPayload): string {
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

/** 配布物の CSS・使う側の CSS・書き出しの中身・起動の処理を埋めた 1 枚の HTML を返す */
export function assembleHtml(parts: {
  /** 埋める中身 */
  payload: ExportPayload;
  /** 配布物の CSS */
  distCss: string;
  /** 使う側の CSS */
  themeCss?: string | undefined;
  /** 起動の処理（`dist/viewer.js`） */
  viewer: string;
}): string {
  const { payload, distCss, themeCss, viewer } = parts;
  const entry = payload.docs.find((doc) => doc.path === payload.entry);
  const title = escapeHtml(entry?.title ?? payload.entry);
  const body = payload.kind === "bundle" ? BUNDLE_BODY : DOCUMENT_BODY;
  const styles = [distCss, themeCss ?? ""]
    .filter((css) => css !== "")
    .map((css) => `<style>${escapeStyle(css)}</style>`)
    .join("");
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light dark">',
    `<title>${title}</title>`,
    styles,
    "</head>",
    "<body>",
    body,
    `<script type="application/json" id="${PAYLOAD_ID}">${encodePayload(payload)}</script>`,
    `<script type="module">${viewer}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
