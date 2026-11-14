import type { MdmarkConfig } from "../config.ts";
import { LUCIDE_VERSION } from "../inline-icons.ts";
import type { MdmarkAlias } from "../knowledge/aliases.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
import { escapeHtml } from "../parts/escape.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import { hideCss, hideNames, hidePayload } from "./traces.ts";

/** `bundle` で埋めた画像を指す `src` の頭 */
export const ASSET_SCHEME = "mdmark-asset:";

/** 書き出した HTML に JSON で埋め、開いたときに起動の処理が読み込む中身 */
export type ExportPayload = {
  /** `export` は `document`、`build` は `bundle` */
  kind: "document" | "bundle";
  /** `features`・`libraries` を持つ設定（`libraries` の値は埋めたモジュールの名前に替える） */
  config: MdmarkConfig;
  /** 索引 */
  index?: MdmarkIndex | undefined;
  /** `collectReferences` の参照の表 */
  references?: MdmarkReferences | undefined;
  /** 埋める文書。`markdown` は画像を `data:` URL に替え、動画・音声の `src` をコピーへの相対パスに替えたもの（`bundle` では画像を `mdmark-asset:{キー}` に替える） */
  docs: Array<{
    path: string;
    title: string;
    markdown: string;
    docId?: string | undefined;
    /** 取り込む文書の表: 文書のフォルダからのパスから、`includes` のキー（設定ファイルのフォルダからのパス）を参照する */
    includes?: Record<string, string> | undefined;
  }>;
  /** 取り込む文書の本文。キーは設定ファイルのフォルダからのパスで、同じファイルは 1 回だけ持つ */
  includes?: Record<string, string> | undefined;
  /** まとめていない名前のアイコンの形状の表 */
  icons?: Record<string, MdmarkIconNode> | undefined;
  /** 最初に開く文書の `path` */
  entry: string;
  /** `loadAliases` が作ったエイリアス（`env` を含まない）。設定に `aliases` が無ければ持たない */
  aliases?: MdmarkAlias[] | undefined;
  /** `bundle` で埋めた画像のキーから `data:` URL を参照する表。`document` では持たない */
  assets?: Record<string, string> | undefined;
};

/** 書き出しの中身を入れる `script` 要素の `id`（起動の処理が読み込む） */
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

/** 1 文書の HTML の本文: 描く先の要素だけを配置する */
const DOCUMENT_BODY = '<article class="mdmark"></article>';

/** `style` 要素の中で閉じタグと読み込まれないよう、`</style` を `<\/style` に替える */
function escapeStyle(css: string): string {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

/** 書き出しの中身を JSON にし、`script` 要素を閉じる並びにならないよう `<` を JSON のエスケープに替える */
function encodePayload(payload: ExportPayload): string {
  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

/** 空でない CSS の `style` 要素（隠すときは mdmark の名前を隠す） */
function styleTags(styles: string[], hide: boolean): string {
  return styles
    .filter((css) => css !== "")
    .map((css) => `<style>${escapeStyle(hide ? hideCss(css) : css)}</style>`)
    .join("");
}

/** アイコンを埋めたときの lucide のライセンスの表記。隠すときはライセンスの表記を HTML のコメントにせず、スクリプトの先頭の注釈に置く */
function lucideLicense(options: {
  payload: ExportPayload;
  script: string;
  hide: boolean;
}): { comment: string; script: string } {
  const { payload, script, hide } = options;
  const hasIcons = payload.icons && Object.keys(payload.icons).length > 0;
  if (!hasIcons) {
    return { comment: "", script };
  }
  const license = `lucide ${LUCIDE_VERSION} - ISC License (c) Lucide Contributors / MIT License (c) 2013-present Cole Bemis`;
  return hide
    ? { comment: "", script: `/*! ${license} */\n${script}` }
    : { comment: `<!-- ${license} -->`, script };
}

/** 配布物の CSS・利用側の CSS・書き出しの中身・まとめたスクリプトを埋めた 1 枚の HTML を返却する */
export function assembleHtml(parts: {
  /** 埋める中身 */
  payload: ExportPayload;
  /** 配布物の CSS */
  distCss: string;
  /** 利用側の CSS */
  themeCss?: string | undefined;
  /** `bundleViewer` が起動の処理と埋めるモジュールをまとめたスクリプト（`</script` と `<!--` の並びは替えてある） */
  script: string;
  /** mdmark の名前・HTML のコメント・バージョンを隠すか（`script` は `bundleViewer` が隠したものを指定する） */
  hideTraces?: boolean | undefined;
}): string {
  const { distCss, themeCss, script } = parts;
  const hide = parts.hideTraces === true;
  const payload = hide ? hidePayload(parts.payload) : parts.payload;
  const entry = payload.docs.find((doc) => doc.path === payload.entry);
  const title = escapeHtml(entry?.title ?? payload.entry);
  const skeleton = payload.kind === "bundle" ? BUNDLE_BODY : DOCUMENT_BODY;
  const body = hide ? hideNames(skeleton) : skeleton;
  const payloadId = hide ? hideNames(PAYLOAD_ID) : PAYLOAD_ID;
  const styles = styleTags([distCss, themeCss ?? ""], hide);
  const license = lucideLicense({ payload, script, hide });
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
    license.comment,
    `<script type="application/json" id="${payloadId}">${encodePayload(payload)}</script>`,
    `<script type="module">${license.script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
