import type {
  MdmarkAlias,
  MdmarkIndex,
  MdmarkReferences,
} from "../../../src/index.ts";
import { iconSvg } from "../../../src/parts/icons.ts";

/** 索引つきの `render` の結合テストが使用する索引: 文書 3 つと用語 1 つ */
export const INDEX: MdmarkIndex = {
  schema: 2,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API", aliases: ["公開関数"] },
    { id: "guide", path: "使い方/guide.md", title: "使用方法" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      meaning: "話し合いの記録を配置するフォルダ",
    },
  ],
};

/** 参照の表: `arch` を `api`・`guide` が参照している */
export const REFERENCES: MdmarkReferences = {
  backlinks: { arch: ["api", "guide"], api: ["arch"], guide: [] },
  glossary: [],
};

/** 描く文書の `id` */
export const DOC_ID = "arch";

/** 用語 `ワークスペース` と、文書の別名 `公開関数` が出る Markdown */
export const MARKDOWN = "ワークスペースを配置し、公開関数を使用する。\n";

/** 上の入力で `render` が返却する HTML 文字列 */
export const EXPECTED_HTML =
  '<p><span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-1">ワークスペース</span><span class="mdmark-term-tip" id="mdmark-term-1" role="tooltip"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">用語</span><span class="mdmark-term-tip-meaning">話し合いの記録を配置するフォルダ</span></span></span></span>を配置し、<span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-details="mdmark-term-2">公開関数</span><span class="mdmark-term-tip" id="mdmark-term-2" role="group" aria-label="「公開関数」の関連文書"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">関連文書</span><span class="mdmark-term-tip-docs" role="list"><span class="mdmark-term-tip-doc" role="listitem"><a href="../api.md">API</a></span></span></span></span></span>を使用する。</p>\n<nav class="mdmark-backlinks" aria-labelledby="mdmark-backlinks-title"><p class="mdmark-backlinks-title" id="mdmark-backlinks-title">関連文書</p><ul><li><a href="../api.md">API</a></li><li><a href="../使い方/guide.md">使用方法</a></li></ul></nav>';

/** やめた言い方の `render` の結合テストが使用する索引: 描く文書 `guide` と、やめた言い方 `作業場` を持つ用語 1 つ */
export const AVOID_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: "guide", path: "guide.md", title: "使用方法" }],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      meaning: "話し合いの記録を配置するフォルダ",
      avoid: ["作業場"],
    },
  ],
};

/** やめた言い方の入力で描く文書の `id` */
export const AVOID_DOC_ID = "guide";

/** 用語 `ワークスペース` とそのやめた言い方 `作業場` が出る Markdown */
export const AVOID_MARKDOWN = "ワークスペースと作業場を配置する。\n";

/** 上の入力で `render` が返却する HTML 文字列 */
export const AVOID_EXPECTED_HTML =
  '<p><span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-1">ワークスペース</span><span class="mdmark-term-tip" id="mdmark-term-1" role="tooltip"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">用語</span><span class="mdmark-term-tip-meaning">話し合いの記録を配置するフォルダ</span></span></span></span>と<span class="mdmark-term-wrap"><span class="mdmark-term mdmark-term-avoided" tabindex="0" aria-describedby="mdmark-term-2">作業場</span><span class="mdmark-term-tip" id="mdmark-term-2" role="tooltip"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">代わりの用語</span><span class="mdmark-term-tip-replacement">ワークスペース</span><span class="mdmark-term-tip-meaning">話し合いの記録を配置するフォルダ</span></span></span></span>を配置する。</p>\n';

/** エイリアスの `render` の結合テストが使用するエイリアス: `term` の `ワークスペース` と `command` の `単体テスト` */
export const ALIASES: MdmarkAlias[] = [
  {
    alias_type: "term",
    id: "ws",
    name: "ワークスペース",
    aliases: [],
    description: "話し合いの記録を配置するフォルダ",
  },
  {
    alias_type: "command",
    id: "unit-test",
    name: "単体テスト",
    aliases: [],
    description: "ライブラリ本体の単体テストを実行する",
    command: "npm run test:unit",
  },
];

/** エイリアスの名前が出る Markdown */
export const ALIAS_MARKDOWN = "ワークスペース、単体テストを実行する。\n";

/** コピーのボタンのアイコン。`render` は sanitize で属性名を小文字にするため `viewBox` は `viewbox` になる（ブラウザの解析が `viewBox` に修正する） */
const COPY_ICON = iconSvg("copy").replace("viewBox", "viewbox");

/** 上の入力で `render` が返却する HTML 文字列（コピーのボタンのアイコンは部品のものを使用する） */
export const ALIAS_EXPECTED_HTML = `<p><span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-1">ワークスペース</span><span class="mdmark-term-tip" id="mdmark-term-1" role="tooltip"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">用語</span><span class="mdmark-term-tip-name">ワークスペース</span><span class="mdmark-term-tip-meaning" id="mdmark-term-1-meaning">話し合いの記録を配置するフォルダ</span></span></span></span>、<span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-2-meaning" aria-details="mdmark-term-2">単体テスト</span><span class="mdmark-term-tip" id="mdmark-term-2" role="group" aria-label="「単体テスト」のコマンド"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">コマンド</span><span class="mdmark-term-tip-name">単体テスト</span><span class="mdmark-term-tip-meaning" id="mdmark-term-2-meaning">ライブラリ本体の単体テストを実行する</span><span class="mdmark-term-tip-command"><code>npm run test:unit</code><button class="mdmark-term-tip-copy" type="button" data-state="idle">${COPY_ICON}コピー</button></span><span class="mdmark-visually-hidden mdmark-term-tip-status" role="status"></span></span></span></span>を実行する。</p>\n`;
