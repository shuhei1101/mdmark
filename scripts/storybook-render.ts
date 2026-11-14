import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import type { HLJSApi, LanguageFn } from "highlight.js";
import type { SideTocMode } from "../src/config.ts";
import {
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkErDefinition,
  type MdmarkParamDefinition,
  readDefinition,
} from "../src/diagram/definition.ts";
import { computeDiff } from "../src/diff/compute.ts";
import type { WarningItem } from "../src/extensions.ts";
import { highlightLines } from "../src/highlight-lines.ts";
import type { MdmarkAlias } from "../src/knowledge/aliases.ts";
import { parseMapData } from "../src/map/data.ts";
import { parseFlowchart } from "../src/map/flowchart.ts";
import { layoutMap } from "../src/map/layout.ts";
import { parseSequence } from "../src/map/sequence.ts";
import { sequenceRows } from "../src/map/sequence-rows.ts";
import { renderBackToTop } from "../src/parts/back-to-top.ts";
import { renderBacklinks } from "../src/parts/backlinks.ts";
import { renderBadge } from "../src/parts/badge.ts";
import { type CalloutKind, renderCallout } from "../src/parts/callout.ts";
import { type AttachmentKind, renderCard } from "../src/parts/card.ts";
import { type CardGridItem, renderCardGrid } from "../src/parts/card-grid.ts";
import { type CodeLine, renderCodeBlock } from "../src/parts/code-block.ts";
import { renderCollapsible } from "../src/parts/collapsible.ts";
import type { ColorName } from "../src/parts/colors.ts";
import {
  type CommentClosedKind,
  type CommentFormState,
  type CommentRemoveState,
  renderCommentBubble,
  renderCommentButton,
  renderCommentForm,
  renderCommentMark,
  renderCommentMarker,
  renderCommentOrphans,
} from "../src/parts/comment.ts";
import {
  renderDiagram,
  renderDiagramFrame,
  renderDiagramTip,
} from "../src/parts/diagram.ts";
import { renderDiffBlock } from "../src/parts/diff-blocks.ts";
import { renderDiffHtml } from "../src/parts/diff-html.ts";
import { renderDiffLines } from "../src/parts/diff-lines.ts";
import { renderDiffMessage } from "../src/parts/diff-message.ts";
import {
  type DiffMinimapMark,
  renderDiffMinimap,
} from "../src/parts/diff-minimap.ts";
import { renderDiffToggle } from "../src/parts/diff-toggle.ts";
import { type DocListItem, renderDocList } from "../src/parts/doc-list.ts";
import { renderEmbed } from "../src/parts/embed.ts";
import { renderEmbeddedHtml } from "../src/parts/embedded-html.ts";
import { escapeHtml } from "../src/parts/escape.ts";
import { renderFigure } from "../src/parts/figure.ts";
import { renderFootnoteRef, renderFootnotes } from "../src/parts/footnote.ts";
import { renderFrontmatter } from "../src/parts/frontmatter.ts";
import { renderGallery } from "../src/parts/gallery.ts";
import { renderGif } from "../src/parts/gif.ts";
import { renderHighlight } from "../src/parts/highlight.ts";
import { type HintPlacement, renderHint } from "../src/parts/hint.ts";
import { renderImageFigure } from "../src/parts/image.ts";
import {
  type MdmarkIconNode,
  renderInlineIcon,
} from "../src/parts/inline-icon.ts";
import { renderKbd } from "../src/parts/kbd.ts";
import { renderLayoutColumns } from "../src/parts/layout-columns.ts";
import { renderLightbox } from "../src/parts/lightbox.ts";
import {
  renderMapBand,
  renderMapFlow,
  renderMapSequence,
} from "../src/parts/map.ts";
import { renderMedia } from "../src/parts/media.ts";
import { renderMermaidDiagram } from "../src/parts/mermaid.ts";
import { renderNotice } from "../src/parts/notice.ts";
import { type CopyState, renderParam } from "../src/parts/param.ts";
import { renderRevisionPicker } from "../src/parts/revision-picker.ts";
import { renderRowDetail } from "../src/parts/row-detail.ts";
import { renderSection } from "../src/parts/section.ts";
import { renderSideToc, type SideTocHeading } from "../src/parts/side-toc.ts";
import { renderSteps } from "../src/parts/steps.ts";
import { renderSyntaxWarning } from "../src/parts/syntax-warning.ts";
import { renderTable, type TableOptions } from "../src/parts/table.ts";
import { renderTabs } from "../src/parts/tabs.ts";
import {
  renderTermTip,
  type TermTipCopyState,
  type TermTipDoc,
} from "../src/parts/term-tip.ts";
import { renderTextColor } from "../src/parts/text-color.ts";
import { renderToc, type TocHeading } from "../src/parts/toc.ts";
import { renderTree, type TreeNode } from "../src/parts/tree.ts";
import { renderView } from "../src/parts/view.ts";
import { renderWide } from "../src/parts/wide.ts";
import { sanitizeEmbedded } from "../src/render/sanitize.ts";
import { scopeCss } from "../src/render/scope-css.ts";
import { syntaxLanguageOf } from "../src/render/syntax/code-blocks.ts";
import { planCellMerges } from "../src/render/syntax/table-cells.ts";
import { warningsOf } from "../src/render/syntax/tables.ts";
import {
  CONFIG as MAP_CONFIG,
  DATA as MAP_DATA,
  FLOW as MAP_FLOW,
  SEQUENCE as MAP_SEQUENCE,
} from "../tests/unit/helpers/map.ts";
import { renderMediaError } from "../vscode/src/webview/shared/lib/media-error.ts";

// 描画のインターフェースを外へ出さないための待受アドレス
const RENDER_HOST = "127.0.0.1";
// 待ち受けるポートの範囲
const MIN_PORT = 1;
const MAX_PORT = 65535;
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "..");
// 描画のインターフェースの経路: 本文の CSS と、部品の HTML の前置き
const CSS_PATH = "/render/index.css";
const PART_PATH_PATTERN = /^\/render\/([^/]+)$/;
// ストーリーが読み込む、操作を付ける処理の経路と、その元のソース（図の拡大・縮小、表の見出し行と集計の行を留める処理、ファイルツリーの注釈の列を統一する処理）
const SCRIPT_SOURCES: Record<string, string> = {
  "/render/diagram.js": "src/interact/diagrams.ts",
  "/render/sticky.js": "src/interact/sticky.ts",
  "/render/trees.js": "src/interact/trees.ts",
};

/** mermaid の図の見本の SVG のフォルダ（`npm run fixtures:mermaid` が記載する） */
const MERMAID_FIXTURES_DIR = join(
  REPO_ROOT,
  "tests",
  "fixtures",
  "mermaid-svg",
);

/** mermaid の図の見本の名前の書式 */
const MERMAID_FIXTURE_NAME = /^[a-z0-9-]+$/;

/** mermaid の図を開いたときの倍率の下限（`src/mermaid.ts` の `MERMAID_MIN_FIT` と同じ値） */
const MERMAID_STORY_MIN_FIT = 0.75;

/** mermaid の図の見本の SVG を読み込む。書式に合わない名前と無い名前は `undefined` */
function readMermaidFixture(name: string): string | undefined {
  if (!MERMAID_FIXTURE_NAME.test(name)) {
    return undefined;
  }
  const file = join(MERMAID_FIXTURES_DIR, `${name}.svg`);
  return existsSync(file) ? readFileSync(file, "utf8").trim() : undefined;
}

/** 見本の SVG を種類 `mermaid` の図の枠に入れた HTML を返却する。見本が無ければ `undefined` */
function renderMermaidStory(options: {
  svg: string;
  printSvg?: string | undefined;
  title: string;
}): string | undefined {
  const svg = readMermaidFixture(options.svg);
  if (svg === undefined) {
    return undefined;
  }
  const printSvg =
    options.printSvg === undefined
      ? undefined
      : readMermaidFixture(options.printSvg);
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  const part = renderMermaidDiagram({
    svg,
    printSvg,
    width: Number(box?.[1] ?? 0),
    height: Number(box?.[2] ?? 0),
  });
  return renderDiagramFrame(
    {
      kind: "mermaid",
      title: options.title,
      legend: [],
      fitMin: MERMAID_STORY_MIN_FIT,
      id: "story-mermaid",
    },
    part,
  );
}

// 図のストーリーに追加するマーカー: Storybook の `preview.js` が見つけ、描いた直後の倍率（全体が収まる倍率）にする操作を付ける
const DIAGRAM_FIT_MARKER = "<span hidden data-story-fit></span>";

/** 利用側の枠を持つ面（線と影で本文から浮かせる）。図の枠の線を削除する値を指定する */
const FRAMED_SURFACE_STYLE =
  "padding:1rem;border:1px solid var(--mdmark-color-border);border-radius:0.5rem;box-shadow:0 1px 3px rgb(0 0 0 / 0.08);--mdmark-diagram-box-shadow:none";

// 中身を持つ部品に指定する、部品ごとの見本の HTML
const SAMPLE_BODY =
  "<p>中身の見本です。段落が続くときの間隔も確認できます。</p>";
const SAMPLE_IMAGE =
  "<img alt=\"見本の図\" width=\"320\" height=\"120\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23d1d9e0'/%3E%3C/svg%3E\">";
const SAMPLE_TABLE =
  "<table><thead><tr><th>列A</th><th>列B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>";

// 図の見本の定義を記載した文書と、見本の名前ごとの `json` のコードブロックが持つキー
const SAMPLE_DOCUMENT = join(REPO_ROOT, "docs", "guide", "図を描く-見本.md");
const SAMPLE_KEYS: Record<string, string> = {
  "reply-time": '"series"',
  strength: '"knob"',
};

// グラフの種類ごとの見本の定義（棒・円・散布図）。`bar` の 4 系列は、色と塗りの模様の組を全て見せる
const BAR_SAMPLE: MdmarkChartDefinition = {
  type: "bar",
  title: "窓口ごとの問い合わせの件数",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "窓口", ticks: ["メール", "フォーム", "チャット", "電話"] },
  y: { label: "件" },
  series: [
    { name: "自動返信", points: [124, 86, 57, 12] },
    { name: "担当者", points: [38, 41, 63, 95] },
  ],
};
const BAR_FOUR_SAMPLE: MdmarkChartDefinition = {
  ...BAR_SAMPLE,
  title: "窓口ごとの問い合わせの件数（週ごと）",
  scope: "10 月",
  updated: "2026-10-31",
  series: [
    { name: "第 1 週", points: [118, 80, 49, 15] },
    { name: "第 2 週", points: [124, 86, 57, 12] },
    { name: "第 3 週", points: [131, 92, 61, 18] },
    { name: "第 4 週", points: [109, 77, 70, 9] },
  ],
};
const PIE_SAMPLE: MdmarkChartDefinition = {
  type: "pie",
  title: "返信の種類の割合",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  unit: " 件",
  items: [
    { name: "よくある質問で回答した", value: 186 },
    { name: "担当者へ回した", value: 92 },
    { name: "返信しなかった", value: 22 },
  ],
};
const SCATTER_SAMPLE: MdmarkChartDefinition = {
  type: "scatter",
  title: "本文の長さと返信までの時間",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "本文の長さ（字）" },
  y: { label: "分" },
  series: [
    {
      name: "自動返信",
      points: [
        [120, 6],
        [260, 9],
        [410, 11],
        [580, 14],
        [730, 13],
        [900, 18],
      ],
    },
    {
      name: "担当者",
      points: [
        [150, 28],
        [300, 35],
        [450, 41],
        [620, 39],
        [800, 52],
        [960, 58],
      ],
    },
  ],
};

// ヒントのストーリーに出す文
const HINT_TEXT = "返信の種類を 1 つ選ぶ。選べないときは担当者へ回す";

// ノードの `hint` のストーリーに出す文
const NODE_HINT_TEXT =
  "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読み込まず、下書きの ID で頼まれた操作をする";

// ノードの中の `{{単語}}` に出す意味（見本の文書の用語集の表と同じ）
const SAMPLE_TERMS: Record<string, string> = {
  意思決定モデル:
    "選択肢から選ぶ・当てはまるかに回答するだけの、速く安い判断用の AI",
  よくある質問: "問い合わせの多い質問と、その回答をまとめた表",
};

/** 見本の文書から、見本の定義の JSON の文字を取り出す */
function sampleText(name: string): string {
  const blocks = [
    ...readFileSync(SAMPLE_DOCUMENT, "utf8").matchAll(
      /```json\n([\s\S]*?)\n```/g,
    ),
  ];
  const key = SAMPLE_KEYS[name];
  const text =
    key === undefined
      ? undefined
      : blocks.map((block) => block[1]).find((block) => block?.includes(key));
  if (text === undefined) {
    throw new Error(`見本の定義が無い: ${name}`);
  }
  return text;
}

// #275 で追加したグラフの種類の見本（モックと同じ定義）
const CHART_SAMPLES_FILE = join(
  REPO_ROOT,
  "docs",
  "mock",
  "refs",
  "275",
  "assets",
  "samples.js",
);

/** モックの見本のスクリプトから、名前 `name` のグラフの定義を取り出す（モックの表の `kind` は定義に含めない） */
function mockChart(name: string): MdmarkChartDefinition {
  const window: { mdmarkMockDiagrams: Record<string, unknown> } = {
    mdmarkMockDiagrams: {},
  };
  runInNewContext(readFileSync(CHART_SAMPLES_FILE, "utf8"), { window });
  const found = window.mdmarkMockDiagrams[name] as
    | (MdmarkChartDefinition & { kind?: string })
    | undefined;
  if (found === undefined) {
    throw new Error(`モックの見本の定義が無い: ${name}`);
  }
  const { kind: _kind, ...definition } = found;
  return JSON.parse(JSON.stringify(definition)) as MdmarkChartDefinition;
}

// #298 の ER 図の見本（モックと同じ定義）
const ER_SAMPLES_FILE = join(
  REPO_ROOT,
  "docs",
  "mock",
  "refs",
  "298",
  "assets",
  "er-samples.js",
);

/** モックの ER 図の見本のスクリプトから、名前 `name` の定義を取り出す（モックの表の `kind` は定義に含めない） */
function mockEr(name: string): MdmarkErDefinition {
  const window: { mdmarkMockDiagrams: Record<string, unknown> } = {
    mdmarkMockDiagrams: {},
  };
  runInNewContext(readFileSync(ER_SAMPLES_FILE, "utf8"), { window });
  const found = window.mdmarkMockDiagrams[name] as
    | (MdmarkErDefinition & { kind?: string })
    | undefined;
  if (found === undefined) {
    throw new Error(`モックの見本の定義が無い: ${name}`);
  }
  const { kind: _kind, ...definition } = found;
  return JSON.parse(JSON.stringify(definition)) as MdmarkErDefinition;
}

/** 図のストーリーの操作の指定: 保った高さ（`height`）と、付けた後にフォーカスする要素（`focus`）をマーカーに持たせる */
function storyMarker(args: PartArgs, focus?: string): string {
  const height =
    typeof args.height === "number"
      ? ` data-story-height="${args.height}"`
      : "";
  const target = focus === undefined ? "" : ` data-story-focus="${focus}"`;
  return `<span hidden data-story-fit${height}${target}></span>`;
}

/** 関係が無い列を指す ER 図の記載の警告 */
function invalidErDefinition(): string {
  const definition = mockEr("shop-er");
  definition.relations = definition.relations.map((relation) =>
    relation.label === "注文する"
      ? { ...relation, toColumn: "customer" }
      : relation,
  );
  const { message, items } = definitionWarning(
    "er",
    readDefinition("er", [JSON.stringify(definition)]).problems,
  );
  return renderSyntaxWarning({ message, items });
}

/** 系列が上限より多いストーリーの記載の警告: 見本の 6 つの系列に 1 つ追加して読み込ませる */
function tooManySeriesDefinition(): string {
  const definition = mockChart("reply-time-6");
  definition.series?.push({ name: "代理店", points: [33, 30, 28, 27, 25] });
  const { message, items } = definitionWarning(
    "chart",
    readDefinition("chart", [JSON.stringify(definition)]).problems,
  );
  return renderSyntaxWarning({ message, items });
}

/** 見本の定義を読み込んだ値 */
function sampleDefinition<T>(name: string): T {
  return JSON.parse(sampleText(name)) as T;
}

/** 定義を読み込めないストーリーの記載の警告: 見本の閉じの `}` を落として読み込ませる */
function invalidDefinition(directive: DiagramDirective, name: string): string {
  const text = sampleText(name);
  const broken = text.slice(0, text.lastIndexOf("}"));
  const { message, items } = definitionWarning(
    directive,
    readDefinition(directive, [broken]).problems,
  );
  return renderSyntaxWarning({ message, items });
}

/** `zoom` を指定しないストーリーは、描いた直後に全体が収まる倍率にするマーカーを追加する */
function fitted(html: string, args: PartArgs): string {
  return typeof args.zoom === "number" ? html : html + DIAGRAM_FIT_MARKER;
}

/** 図の部品のストーリーの引数: 見本・状態 */
function diagramArgs(args: PartArgs): {
  zoom?: number;
  fit?: number;
  modal?: boolean;
  resizable?: boolean;
  touchActive?: boolean;
} {
  return {
    ...(args.resizable === false ? { resizable: false } : {}),
    ...(args.touchActive === true ? { touchActive: true } : {}),
    ...(typeof args.zoom === "number" ? { zoom: args.zoom } : {}),
    ...(typeof args.fit === "number" ? { fit: args.fit } : {}),
    ...(args.modal === true ? { modal: true } : {}),
  };
}

/** カードの格子のストーリーで使用する、配布物に入れない Lucide のアイコン */
const CARD_GRID_ICONS: Record<string, MdmarkIconNode> = {
  book: [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
      },
    ],
  ],
  rocket: [
    ["path", { d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" }],
    [
      "path",
      {
        d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09",
      },
    ],
    [
      "path",
      {
        d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z",
      },
    ],
    ["path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
};

/** 問い合わせの引数の値を戻す: JSON として読み込める値（配列・オブジェクト・数・真偽値）は JSON として読み込み、読み込めなければ文字列のまま */
function decodeValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** 部品の関数に指定する引数 */
type PartArgs = Record<string, unknown>;

// 画像・動画・音声のストーリーが `src` に記載するファイルの配置場所（モックと同じ見本）
const SAMPLE_MEDIA_DIR = join(
  REPO_ROOT,
  "docs",
  "mock",
  "refs",
  "263",
  "assets",
  "media",
);

// 見本のファイルの拡張子ごとの MIME タイプ
const SAMPLE_MEDIA_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  gif: "image/gif",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

/** ストーリーの `src` に記載した見本のファイルを data: URL にする（`#` の後ろは除く）。見本に無い名前はそのまま返却する */
function sampleMedia(src: unknown): string {
  const name = String(src ?? "").split("#", 1)[0] ?? "";
  const type = SAMPLE_MEDIA_TYPES[name.slice(name.lastIndexOf(".") + 1)];
  if (type === undefined || name.includes("/")) {
    return String(src ?? "");
  }
  try {
    const data = readFileSync(join(SAMPLE_MEDIA_DIR, name)).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return name;
  }
}

// 回り込みを見せるストーリーで図の後ろに配置する段落
const WRAP_PARAGRAPH =
  "<p>図の横に回り込む本文の見本です。段落が図の高さを超えて続くときは、図の下から本文の幅いっぱいに戻ります。回り込みの幅と余白を確認するため、何行かに折り返す長さの文を配置しています。</p>";

// ギャラリーの見本の列の数（部品の既定と同じ）
const GALLERY_DEFAULT_COLS = 2;

// 見本の SVG から大きさを読み込めないときの画像の大きさ
const DEFAULT_SAMPLE_SIZE = { width: 320, height: 180 };

// ギャラリーのストーリーに並べる画像
const GALLERY_SAMPLES = [
  "step-1.svg",
  "step-2.svg",
  "step-3.svg",
  "step-4.svg",
];

// 番号を付けたギャラリーのストーリーに並べる画像と、その小さな番号の文字
const NUMBERED_GALLERY_SAMPLES = [
  { src: "screen-light.svg", caption: "明るい配色", letter: "a" },
  { src: "screen-dark.svg", caption: "暗い配色", letter: "b" },
];

/** 画像の図のストーリーの引数から、見本の画像を適用した画像の図を描く */
function storyImageFigure(args: PartArgs): string {
  const align = args.align as "left" | "center" | "right" | undefined;
  const html = renderImageFigure({
    src: sampleMedia(args.src),
    alt: String(args.alt ?? ""),
    ...(args.caption === undefined ? {} : { caption: String(args.caption) }),
    ...(args.width === undefined ? {} : { width: String(args.width) }),
    ...(align === undefined ? {} : { align }),
    lightbox: args.lightbox !== false,
    ...(args.only === undefined ? {} : { only: args.only as "light" | "dark" }),
    ...(args.id === undefined ? {} : { id: String(args.id) }),
    ...(args.label === undefined ? {} : { label: String(args.label) }),
  });
  return align === "left" || align === "right"
    ? `${html}${WRAP_PARAGRAPH}`
    : html;
}

/** ギャラリーのストーリーの HTML（`numbered` のときは 2 枚に番号を付ける） */
function storyGallery(cols: number, numbered: boolean): string {
  const body = numbered
    ? NUMBERED_GALLERY_SAMPLES.map(({ src, caption, letter }) =>
        renderImageFigure({
          src: sampleMedia(src),
          alt: caption,
          caption,
          id: `fig-schemes-${letter}`,
          label: `図 2${letter}`,
        }),
      ).join("")
    : GALLERY_SAMPLES.map((src, index) =>
        renderImageFigure({
          src: sampleMedia(src),
          alt: `手順 ${index + 1} の画面`,
          caption: `手順 ${index + 1}`,
        }),
      ).join("");
  return renderGallery({ cols, body });
}

/** ライトボックスのストーリー: 閉じた `dialog` を開いた状態で文書の中に配置し、倍率を掛けた大きさで画像を描く */
function storyLightbox(args: PartArgs): string {
  const zoom = typeof args.zoom === "number" ? args.zoom : undefined;
  const html = renderLightbox({
    src: sampleMedia(args.src),
    alt: String(args.alt ?? ""),
    ...(args.caption === undefined ? {} : { caption: String(args.caption) }),
    index: Number(args.index),
    total: Number(args.total),
    ...(zoom === undefined ? {} : { zoom }),
  });
  const scale = zoom ?? 1;
  const size = sampleImageSize(args.src);
  return html
    .replace(
      '<dialog class="mdmark-lightbox"',
      '<dialog open class="mdmark-lightbox" style="position: static; width: 100%; height: 26rem"',
    )
    .replace(
      'class="mdmark-lightbox-stage"',
      `class="mdmark-lightbox-stage${scale > 1 ? " is-zoomed" : ""}"`,
    )
    .replace(
      '<div class="mdmark-lightbox-sizer">',
      `<div class="mdmark-lightbox-sizer" style="width: ${size.width * scale}px; height: ${size.height * scale}px">`,
    )
    .replace(
      /(<div class="mdmark-lightbox-sizer"[^>]*><img )/,
      `$1style="width: ${size.width}px; height: ${size.height}px; transform: scale(${scale})" `,
    );
}

/** 見本の SVG の `width`・`height` を読み込む（読み込めなければ `DEFAULT_SAMPLE_SIZE`） */
function sampleImageSize(src: unknown): { width: number; height: number } {
  const name = String(src ?? "").split("#", 1)[0] ?? "";
  try {
    const svg = readFileSync(join(SAMPLE_MEDIA_DIR, name), "utf8");
    const width = Number(/\bwidth="(\d+)"/.exec(svg)?.[1]);
    const height = Number(/\bheight="(\d+)"/.exec(svg)?.[1]);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  } catch {
    // 見本に無い名前は既定の大きさにする
  }
  return DEFAULT_SAMPLE_SIZE;
}

/** 本文の文字の色のストーリー: 文字の中の `[文字](URL)` をリンクにする */
function storyTextColor(args: PartArgs): string {
  const text = String(args.text ?? "").replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );
  return `<p>${renderTextColor({ color: args.color as ColorName, text })}</p>`;
}

/** 中身を持つ部品の中身: ストーリーの引数 `body` があればそれ、無ければ見本 */
function bodyOf(args: PartArgs, sample: string): string {
  return typeof args.body === "string" ? args.body : sample;
}

// 差分のストーリーの見本: 行の差分に使用する前と後の Markdown
const DIFF_TEXT_BEFORE =
  "# 問い合わせ窓口の週の報告\n\nよくある質問の差分は、担当者が週に 1 回確かめます。\n削除する行\n終わり\n";
const DIFF_TEXT_AFTER =
  "# 問い合わせ窓口の週の報告\n\nよくある質問の変更は、担当者が週に 1 回確かめます。\n終わり\n追加する行\n";
const DIFF_LONG_BEFORE =
  "返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-faq-table に配置します。\n";
const DIFF_LONG_AFTER =
  "返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-frequently-asked-questions-table に配置します。\n";

/** 埋め込んだ HTML の範囲を 1 つ持つ Markdown。表のメール欄の件数を引数で変える */
function diffTable(mail: number, extra = ""): string {
  return `<!-- html -->\n\`\`\`html\n<table><tr><th>窓口</th><th>件数</th></tr><tr><td>メール</td><td>${mail}</td></tr>${extra}</table>\n\`\`\`\n<!-- /html -->\n`;
}

// 埋め込んだ HTML の差分の見本: 前と後の Markdown
const DIFF_HTML_SAMPLES: Record<string, { before: string; after: string }> = {
  table: { before: diffTable(120), after: diffTable(150) },
  added: { before: "# タイトル\n", after: `# タイトル\n${diffTable(150)}` },
  unchanged: {
    before: `${diffTable(120)}前の段落\n`,
    after: `${diffTable(120)}後の段落\n`,
  },
  script: {
    before: diffTable(
      120,
      '<tr><td><button onclick="alert(1)">数える</button><script>alert(1)</script></td></tr>',
    ),
    after: diffTable(
      150,
      '<tr><td><button onclick="alert(1)">数える</button><script>alert(1)</script></td></tr>',
    ),
  },
};

// 差分のストーリーで前と後に出すリビジョンの説明
const DIFF_STORY_LABELS = {
  before: "2026/10/18 09:12 初版（佐藤）",
  after: "2026/10/19 16:40 件数を修正する（鈴木）",
};

/** 差分の見本を比べる。単語の区切りは `Intl.Segmenter`（`ja`・`word`）で、`char` の見本だけ持たないことにして 1 文字ずつ比べる */
function storyDiff(before: string, after: string, segmented: boolean) {
  return computeDiff({
    before,
    after,
    segmenter: segmented
      ? new Intl.Segmenter("ja", { granularity: "word" })
      : undefined,
  });
}

/** 差分の行のストーリー */
function storyDiffLines(args: PartArgs): string {
  const sample = String(args.sample);
  const [before, after] =
    sample === "long"
      ? [DIFF_LONG_BEFORE, DIFF_LONG_AFTER]
      : sample === "html"
        ? [
            `${DIFF_TEXT_BEFORE}${diffTable(120)}`,
            `${DIFF_TEXT_AFTER}${diffTable(150)}`,
          ]
        : [DIFF_TEXT_BEFORE, DIFF_TEXT_AFTER];
  const result = storyDiff(before, after, sample !== "char");
  return renderDiffLines({
    blocks: result.blocks.map((block) =>
      block.type === "html"
        ? {
            ...block,
            before: block.before && sanitizeEmbedded(block.before, (t) => t),
            after: block.after && sanitizeEmbedded(block.after, (t) => t),
          }
        : block,
    ),
    sides: "side",
    labels: DIFF_STORY_LABELS,
  });
}

/** 埋め込んだ HTML の差分のストーリー */
function storyDiffHtml(args: PartArgs): string {
  const sample =
    DIFF_HTML_SAMPLES[String(args.sample)] ?? DIFF_HTML_SAMPLES.table;
  const result = storyDiff(sample?.before ?? "", sample?.after ?? "", true);
  const block = result.blocks.find((candidate) => candidate.type === "html");
  if (block?.type !== "html") {
    throw new Error("埋め込んだ HTML の範囲が無い見本");
  }
  const safe = (html: string | null, label: string) =>
    html === null
      ? null
      : { label, html: sanitizeEmbedded(html, (text) => text) };
  return renderDiffHtml({
    changed: block.changed,
    view: args.view === "rendered" ? "rendered" : "source",
    sides: args.sides === "stack" ? "stack" : "side",
    lines: renderDiffLines({
      blocks: [{ type: "lines", lines: block.lines }],
      sides: "side",
    }),
    before: safe(block.before, DIFF_STORY_LABELS.before),
    after: safe(block.after, DIFF_STORY_LABELS.after),
  });
}

// コメントのボタン・入力欄・吹き出しのストーリーに追加する規則: 本物は `document.body` の直下で `position: fixed` だが、ストーリーではその場に配置する
const STATIC_POPOVER_STYLE =
  "<style>.mdmark-comment-add,.mdmark-comment-popover{position:static;max-width:100%}</style>";

// 部品の id から、部品の関数を呼ぶ表
/** 範囲のスクリプトと CSS のストーリー: 通し番号 `scope` の範囲に、根の要素の中に限った `css` の `style` と、実行しない `script` の `template` を配置し、範囲の外に同じ class のノードを持つ範囲を続ける。`opened` のときは根の要素に class `is-open` を付ける */
function rangeScopeStory(args: PartArgs): string {
  const scope = Number(args.scope);
  const css = typeof args.css === "string" ? args.css : "";
  // 問い合わせの値は JSON として読み込んだ後に届く
  const script =
    typeof args.script === "object" && args.script !== null
      ? (args.script as { lang: string; code: string })
      : undefined;
  const opened = args.opened === true ? " is-open" : "";
  const style =
    css === ""
      ? ""
      : `<style class="mdmark-html-style">${scopeCss({ css, scope })}</style>`;
  const template = script
    ? `<template class="mdmark-html-script" data-lang="${escapeHtml(script.lang)}">${escapeHtml(script.code)}</template>`
    : "";
  return `<div class="mdmark-html${opened}" data-html-scope="${scope}">${style}<div class="box">範囲のノード</div>${template}</div>${renderEmbeddedHtml({ html: '<div class="box">範囲の外のノード</div>' })}`;
}

/** map のシーケンス図の全ての矢印の種類と autonumber の見本 */
const MAP_SEQUENCE_ARROWS = `sequenceDiagram
  autonumber
  participant A as 送り手
  participant B as 受け手
  A->B: 実線
  A-->B: 点線
  A->>B: 塗った矢じり
  A-->>B: 点線と塗った矢じり
  A-xB: 失敗
  A--xB: 点線の失敗
  A-)B: 非同期
  A--)B: 点線の非同期
  A<<->>B: 両向き
  A<<-->>B: 点線の両向き
`;

/** map のシーケンス図の名前が 2 行の参加者の見本 */
const MAP_SEQUENCE_TALL = `sequenceDiagram
  participant A as 利用側のページの描画の処理
  participant B as mount
  A->>B: 設定と Markdown
  B-->>A: 描いた文書
`;

/** ストーリーの args の配列（JSON の文字でも、Storybook が配列にした値でもよい。無ければ空） */
const jsonList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : typeof value === "string" && value !== ""
      ? (JSON.parse(value) as string[])
      : [];

/** ストーリーの args のオブジェクト（JSON の文字でも、Storybook がオブジェクトにした値でもよい） */
const jsonObject = <T>(value: unknown): T | undefined =>
  typeof value === "object" && value !== null
    ? (value as T)
    : typeof value === "string" && value !== ""
      ? (JSON.parse(value) as T)
      : undefined;

/** map の構成図の、名前の長いノードを持つ見本 */
const MAP_FLOW_LONG = MAP_FLOW.replace(
  'layout["入れ子のグループの自動配置"]',
  'layout["入れ子のグループを内側から順に自動配置して、グループの大きさを決める"]',
);

/** map の部品を図の枠に入れる */
const mapFrame = (
  title: string,
  part: { html: string; tips: string },
  size: { width: number; height: number },
): string =>
  renderDiagramFrame(
    { kind: "map", title, legend: [], wide: true, tools: [], id: "story-map" },
    { ...part, ...size },
  );

const PART_RENDERERS: Record<string, (args: PartArgs) => string> = {
  "map-flow": (args) => {
    const entered = typeof args.entered === "string" ? args.entered : undefined;
    const collapsed = jsonList(args.collapsed);
    const { data } = parseMapData(MAP_DATA);
    const layout = layoutMap(
      parseFlowchart(args.source === "long" ? MAP_FLOW_LONG : MAP_FLOW),
      { collapsed, entered },
      jsonObject(args.ends) === undefined
        ? {}
        : { "mount->marker": { ends: jsonObject(args.ends) } },
      args.node_fit === "width" ? "width" : "height",
    );
    const focus = jsonObject<{ nodes: string[]; wires: string[] }>(args.focus);
    const selected = jsonList(args.selected);
    return mapFrame(
      "全体の構成",
      renderMapFlow({
        layout,
        kinds: MAP_CONFIG.kinds,
        lines: MAP_CONFIG.lines,
        notes: {
          ...Object.fromEntries(
            Object.entries(data.notes).map(([id, note]) => [id, note.text]),
          ),
          ...jsonObject<Record<string, string>>(args.notes),
        },
        links: jsonObject<Record<string, string>>(args.links),
        collapsed,
        entered,
        selected,
        focus,
        // 選んだノードの線か、強調する線にデータの印を流す（mount の attachMapFlow と同じ）
        packets: (selected.length > 0
          ? layout.wires
              .filter((wire) =>
                selected.length === 1
                  ? selected.includes(wire.from) || selected.includes(wire.to)
                  : selected.includes(wire.from) && selected.includes(wire.to),
              )
              .map((wire) => wire.id)
          : (focus?.wires ?? [])
        ).map((wire) => ({
          wire,
          direction: "forward" as const,
          color: data.layout[wire]?.packet?.color,
          shape: data.layout[wire]?.packet?.shape ?? "circle",
        })),
        colors: Object.fromEntries(
          Object.entries(data.layout).flatMap(([id, entry]) =>
            entry.color === undefined ? [] : [[id, entry.color]],
          ),
        ),
        dragging: undefined,
        id: "story-map",
      }),
      layout,
    );
  },
  "map-sequence": (args) => {
    const sequence = parseSequence(
      args.source === "arrows"
        ? MAP_SEQUENCE_ARROWS
        : args.source === "tall"
          ? MAP_SEQUENCE_TALL
          : MAP_SEQUENCE,
    );
    const collapsed = jsonList(args.collapsed).map(Number);
    // 問い合わせの値は数に読み替わって届く
    const entered =
      args.entered === undefined || args.entered === ""
        ? undefined
        : Number(args.entered);
    const rows = sequenceRows(sequence, {
      order:
        jsonList(args.order).length > 0
          ? jsonList(args.order)
          : sequence.participants.map((item) => item.id),
      collapsed,
      entered,
    });
    const part = renderMapSequence({
      sequence,
      rows: rows.rows,
      participants: rows.participants,
      collapsed,
      entered,
      selected: jsonList(args.selected),
      focus: jsonObject<{ message: number }>(args.focus),
      id: "story-map-seq",
    });
    const width = Number(
      /<svg[^>]*\swidth="([\d.]+)"/.exec(part.html)?.[1] ?? 0,
    );
    const height = Number(
      /<svg[^>]*\sheight="([\d.]+)"/.exec(part.html)?.[1] ?? 0,
    );
    return mapFrame("文書を描くまで", part, { width, height });
  },
  "map-band": (args) =>
    renderMapBand({
      mode: args.mode === "playback" ? "playback" : "walkthrough",
      total: typeof args.total === "number" ? args.total : 4,
      index: typeof args.index === "number" ? args.index : undefined,
      title: typeof args.title === "string" ? args.title : "",
      text: typeof args.text === "string" ? args.text : "",
      auto: args.auto === true,
      label: "全体の構成の案内",
    }),
  "diff-toggle": (args) =>
    renderDiffToggle({
      controls: String(args.controls ?? ""),
      expanded: args.expanded === true,
    }),
  "revision-picker": (args) =>
    renderRevisionPicker({
      revisions: args.revisions as Parameters<
        typeof renderRevisionPicker
      >[0]["revisions"],
      before: String(args.before),
      after: String(args.after),
      ...(args.counts === undefined
        ? {}
        : { counts: args.counts as { del: number; add: number } }),
      idPrefix: "story-picker",
    }),
  "diff-lines": storyDiffLines,
  "diff-html": storyDiffHtml,
  "diff-minimap": (args) =>
    renderDiffMinimap({
      marks: args.marks as DiffMinimapMark[],
      view: args.view as { top: number; height: number },
    }),
  "diff-blocks": (args) => {
    const unit = args.unit as "block" | "item" | "row";
    const html = renderDiffBlock({
      kind: args.kind as "add" | "del",
      unit,
      html: String(args.html ?? ""),
    });
    // 項目と行はリスト・表の中に、ブロックは前後の段落の間に配置し、変えていないブロックと文字の位置が一致することを見せる
    if (unit === "item") {
      return `<ol><li>前の項目</li>${html}<li>後ろの項目</li></ol>`;
    }
    if (unit === "row") {
      return `<table><thead><tr><th>項目</th><th>内容</th><th>担当</th></tr></thead><tbody><tr><td>前の行</td><td>前の内容</td><td>開発者</td></tr>${html}<tr><td>後ろの行</td><td>後ろの内容</td><td>開発者</td></tr></tbody></table>`;
    }
    return `<p>前の段落</p>${html}<p>後ろの段落</p>`;
  },
  "diff-message": (args) =>
    renderDiffMessage({
      kind: args.kind as "same" | "single" | "loading",
      spinner: args.spinner === true,
    }),
  "syntax-warning": (args) =>
    renderSyntaxWarning({
      mark: args.mark as string | undefined,
      message: String(args.message ?? ""),
      items: args.items as WarningItem[] | undefined,
    }),
  "term-tip": (args) => {
    const html = renderTermTip({
      text: String(args.text ?? ""),
      id: String(args.id ?? ""),
      meaning: args.meaning as string | undefined,
      docs: args.docs as TermTipDoc[] | undefined,
      replacement: args.replacement as
        | { term: string; meaning?: string }
        | undefined,
      alias: args.alias as MdmarkAlias | undefined,
      copy: args.copy as TermTipCopyState | undefined,
      below: args.below === true,
    });
    // 開いた状態を見せるストーリーは、単語の枠に `is-open` を付け、ツールチップの上と下に余白を取る
    const open = args.open === true;
    const wrap = open
      ? html.replace(
          'class="mdmark-term-wrap',
          'class="mdmark-term-wrap is-open',
        )
      : html;
    const space = open ? "22rem" : "0";
    return `<p style="padding-block:${space}">本文の${wrap}を読み込む。</p>`;
  },
  backlinks: (args) =>
    renderBacklinks({
      id: String(args.id ?? ""),
      docs: args.docs as Array<{ title: string; href: string }>,
    }),
  table: (args) => {
    // 結合する相手の無い `^^`・`<<` は、記法と同じ記載の警告を表の前に配置する
    const options = args as TableOptions;
    const plan = planCellMerges({
      cells: [options.columns ?? [], ...(options.rows ?? [])],
      headRows: 1,
    });
    const warnings = warningsOf("<!-- table: data -->", plan.warnings).map(
      (warning) => renderSyntaxWarning(warning),
    );
    return warnings.join("") + renderTable(options);
  },
  view: (args) =>
    renderView(args as unknown as Parameters<typeof renderView>[0]),
  "comment-button": () => STATIC_POPOVER_STYLE + renderCommentButton(),
  "comment-form": (args) =>
    STATIC_POPOVER_STYLE +
    renderCommentForm({
      quote: String(args.quote ?? ""),
      body: args.body as string | undefined,
      state: args.state as CommentFormState | undefined,
      id: String(args.id ?? ""),
    }),
  "comment-mark": (args) =>
    `<p>本文の<span>${renderCommentMark({
      text: String(args.text ?? ""),
      expanded: args.expanded === true,
      focused: args.focused === true,
    })}</span>を読み込む。</p>`,
  "comment-bubble": (args) =>
    STATIC_POPOVER_STYLE +
    renderCommentBubble({
      quote: String(args.quote ?? ""),
      bodies: args.bodies as string[],
      canEdit: args.canEdit === true,
      canRemove: args.canRemove === true,
      editIndex:
        typeof args.editIndex === "number" ? args.editIndex : undefined,
      draft: typeof args.draft === "string" ? args.draft : undefined,
      editState: args.editState as CommentFormState | undefined,
      confirmIndex:
        typeof args.confirmIndex === "number" ? args.confirmIndex : undefined,
      removeState: args.removeState as CommentRemoveState | undefined,
    }),
  // 余白のマーカーは余白の列に重ねて配置するため、余白の列の縦の中ほどに配置する
  "comment-marker": (args) =>
    `<div class="mdmark-comment-margin" style="block-size: 3rem">${renderCommentMarker(
      {
        quote: String(args.quote ?? ""),
        count: args.count === undefined ? 1 : Number(args.count),
        current: args.current === true,
        ...(args.closed === undefined
          ? {}
          : { closed: args.closed as CommentClosedKind }),
      },
    ).replace("<button ", '<button style="top: 50%" ')}</div>`,
  "comment-orphans": (args) =>
    renderCommentOrphans({
      comments: args.comments as Array<{ quote: string; body: string }>,
      id: String(args.id ?? ""),
    }),
  callout: (args) =>
    renderCallout({
      kind: args.kind as CalloutKind,
      collapsed: args.collapsed as boolean | undefined,
      open: args.open as boolean | undefined,
      title: args.title as string | undefined,
      // 入れ子のストーリーは、本文の段落の後ろに補足の注意書きを配置する
      body:
        args.nested === true
          ? `<p>設定を書き換える前に、今の設定のバックアップを取ってください。</p>${renderCallout(
              {
                kind: "note",
                body: "<p>バックアップは <code>mdmark upgrade</code> が自動で作ります。</p>",
              },
            )}`
          : bodyOf(args, SAMPLE_BODY),
    }),
  tabs: (args) => {
    const titles = args.titles as string[];
    return renderTabs({
      id: "story",
      titles,
      panels: titles.map((title, index) =>
        // 入れ子のストーリーは、2 つ目の中身に内側のタブを配置する
        args.nested === true && index === 1
          ? renderTabs({
              id: "story-inner",
              titles: ["PowerShell", "WSL"],
              panels: ["PowerShell", "WSL"].map(
                (inner) => `<p>${inner} の中身の見本です。</p>`,
              ),
              selected: 0,
            })
          : `<p>${title} の中身の見本です。</p>`,
      ),
      selected: args.selected as number | undefined,
      group: args.group as string | undefined,
      collapse: args.collapse as "none" | "closed" | "open" | undefined,
      title: args.title as string | undefined,
    });
  },
  steps: (args) =>
    renderSteps({
      items: args.items as string[],
      collapse: args.collapse as "none" | "closed" | "open" | undefined,
      title: args.title as string | undefined,
    }),
  tree: (args) =>
    renderTree({
      nodes: args.nodes as TreeNode[],
      source: String(args.source ?? ""),
      open: args.open === undefined ? undefined : String(args.open),
      interactive: args.interactive === true,
      copyState: args.copyState as "idle" | "copied" | undefined,
      copyFallback: args.copyFallback === true,
      wrap: args.wrap === true,
    }),
  badge: (args) =>
    renderBadge({
      label: String(args.label ?? ""),
      ...(args.color === undefined ? {} : { color: args.color as ColorName }),
    }),
  "footnote-ref": (args) => {
    const html = renderFootnoteRef({
      number: Number(args.number),
      refIndex: args.refIndex === undefined ? 0 : Number(args.refIndex),
      bodies: args.bodies as string[],
      below: args.below === true,
    });
    // 開いた状態を見せるストーリーは、番号に `is-open` を付け、ツールチップの上と下に余白を取る
    const open = args.open === true;
    const ref = open
      ? html.replace('class="mdmark-fn-ref', 'class="mdmark-fn-ref is-open')
      : html;
    const space = open ? "12rem" : "0";
    return `<p style="padding-block:${space}">本文の補足${ref}を読み込む。</p>`;
  },
  footnotes: (args) =>
    renderFootnotes({
      items: args.items as Array<{
        number: number;
        html: string;
        refCount: number;
      }>,
      open: args.open === true,
    }),
  "text-color": storyTextColor,
  "inline-icon": (args) => {
    const icon = renderInlineIcon({
      name: String(args.name ?? ""),
      node: args.node as MdmarkIconNode | undefined,
    });
    return args.heading === true
      ? `<h2>${icon}はじめに</h2>`
      : `<p>保存した${icon}内容を確認する。</p>`;
  },
  kbd: (args) =>
    `<p>${renderKbd({ keys: args.keys as string[] })} を押す。</p>`,
  highlight: (args) =>
    `<p>本文の中の${renderHighlight({
      html: String(args.html ?? ""),
      ...(args.color === undefined ? {} : { color: args.color as ColorName }),
    })}を目立たせる。</p>`,
  "layout-columns": (args) =>
    renderLayoutColumns({ columns: args.columns as string[] }),
  "details-range": (args) =>
    renderCollapsible({
      title: String(args.title ?? ""),
      open: args.open === true,
      body: String(args.html ?? ""),
    }),
  frontmatter: (args) =>
    renderFrontmatter({
      body: String(args.body ?? ""),
      open: args.open === true,
    }),
  wide: (args) =>
    `<p>範囲の前の段落</p>${renderWide({
      body: String(args.html ?? ""),
      state: args.state === "narrow" ? "narrow" : "wide",
      toggle: args.toggle === true,
    })}`,
  "image-figure": storyImageFigure,
  gallery: (args) => {
    const cols = Number(args.cols ?? GALLERY_DEFAULT_COLS);
    // 番号を付けたギャラリーは、図表の番号の図に入れて全体の番号を下に出す
    return args.numbered === true
      ? renderFigure({
          kind: "image",
          id: "schemes",
          number: 2,
          caption: "配色ごとのプレビュー",
          body: storyGallery(cols, true),
        })
      : storyGallery(cols, false);
  },
  lightbox: storyLightbox,
  media: (args) =>
    renderMedia({
      kind: args.kind as "video" | "audio",
      src: sampleMedia(args.src),
      alt: String(args.alt ?? ""),
      ...(args.caption === undefined ? {} : { caption: String(args.caption) }),
      ...(args.width === undefined ? {} : { width: String(args.width) }),
      ...(args.poster === undefined
        ? {}
        : { poster: sampleMedia(args.poster) }),
      autoplay: args.autoplay === true,
      loop: args.loop === true,
    }),
  // 文書と同じく画像の図の中に配置する（`mount` は図の中の `img` を包む）
  gif: (args) =>
    `<figure class="mdmark-figure mdmark-image">${renderGif({
      src: sampleMedia(args.src),
      alt: String(args.alt ?? ""),
      paused: args.paused === true,
      lightbox: args.lightbox !== false,
    })}</figure>`,
  card: (args) =>
    renderCard({
      kind: args.kind as "link" | "file",
      href: String(args.href ?? ""),
      title: String(args.title ?? ""),
      ...(args.fileKind === undefined
        ? {}
        : { fileKind: args.fileKind as AttachmentKind }),
    }),
  // 配布物に入れないアイコンは、記法のアイコンと同じく Lucide の構造を指定する
  "card-grid": (args) => {
    return renderCardGrid({
      items: args.items as CardGridItem[],
      icons: CARD_GRID_ICONS,
    });
  },
  "media-error": (args) =>
    renderMediaError({
      kind: args.kind as "video" | "audio",
      format: String(args.format ?? ""),
      path: String(args.path ?? ""),
    }),
  "code-block": (args) => {
    const language = String(args.language ?? "");
    const lines = args.lines as CodeLine[];
    const html = renderCodeBlock({
      language,
      title: String(args.title ?? ""),
      lineNumbers: args.lineNumbers === true,
      ...(typeof args.lineStart === "number"
        ? { lineStart: args.lineStart }
        : {}),
      wrap: args.wrap === true,
      lines,
      ...(typeof args.fileName === "string" ? { fileName: args.fileName } : {}),
      ...(typeof args.syntax === "string" ? { syntax: args.syntax } : {}),
      ...(typeof args.copyState === "string"
        ? { copyState: args.copyState as "idle" | "copied" | "failed" }
        : {}),
      // 畳める行を持つストーリーは、`mount` が付ける開閉のボタンと `⋯` を配置した状態で出す
      foldButtons: lines.some((line) => line.foldLines !== undefined),
      foldColumnHovered: args.foldColumnHovered === true,
    });
    return args.highlight === true
      ? highlightCodeBlock(html, language, lines)
      : html;
  },
  toc: (args) => renderToc({ headings: args.headings as TocHeading[] }),
  "back-to-top": (args) =>
    renderBackToTop({ hidden: args.hidden as boolean | undefined }),
  "side-toc": (args) =>
    // 本文の列を左に配置し、右側の目次を描く先の要素の右端に配置する（`mount` が描く並びと同じ）
    `<div class="mdmark-content">${SAMPLE_BODY}</div>${renderSideToc({
      headings: args.headings as SideTocHeading[],
      mode: args.mode as SideTocMode | undefined,
      sections: args.sections as boolean | undefined,
      open: args.open as boolean | undefined,
      pinned: args.pinned as boolean | undefined,
      current: args.current as string | undefined,
    })}`,
  section: (args) =>
    renderSection({
      level: args.level as 1 | 2 | 3 | 4,
      id: String(args.id),
      title: String(args.title),
      open: args.open as boolean | undefined,
      toggle: args.toggle as boolean | undefined,
      body: bodyOf(args, SAMPLE_BODY),
    }),
  "row-detail": (args) => {
    const columns = Number(args.columns);
    const { row, toggle } = renderRowDetail({
      id: "story-detail",
      row: Number(args.row),
      columns,
      label: String(args.label),
      open: args.open as boolean | undefined,
      body: bodyOf(args, SAMPLE_BODY),
    });
    const head = `<td><span class="mdmark-row-head">${toggle}${String(args.label)}</span></td>`;
    const cells = Array.from({ length: columns - 1 }, () => "<td>値</td>");
    return `<table><tbody><tr>${head}${cells.join("")}</tr>${row}</tbody></table>`;
  },
  "doc-list": (args) =>
    renderDocList({
      docs: args.docs as DocListItem[],
      current: args.current as string | undefined,
    }),
  "diagram-frame": (args) => {
    if (args.kind === "mermaid") {
      return fitted(
        renderMermaidStory({
          svg: "flowchart",
          title: typeof args.title === "string" ? args.title : "",
        }) ?? "",
        args,
      );
    }
    const html = renderDiagram({
      kind: "er",
      definition: mockEr("shop-er"),
      id: "story-frame",
      lookup: (word) => SAMPLE_TERMS[word],
      ...diagramArgs(args),
    });
    const frame =
      typeof args.height === "number" || args.focusResize === true
        ? html +
          storyMarker(
            args,
            args.focusResize === true ? ".mdmark-diagram-resize" : undefined,
          )
        : fitted(html, args);
    if (args.surface !== true) {
      return frame;
    }
    // 全画面は mount と同じく面の子の mdmark-diagram-dialog に描き、画面全体に配置する
    const body =
      args.modal === true
        ? `<dialog class="mdmark-diagram-dialog" open="open" style="position:fixed;inset:0">${frame}</dialog>`
        : frame;
    return `<div class="story-framed-surface" style="${FRAMED_SURFACE_STYLE}">${body}</div>`;
  },
  "er-diagram": (args) => {
    if (args.invalid === true) {
      return invalidErDefinition();
    }
    const name =
      args.sample === "colors"
        ? "shop-er-colors"
        : args.sample === "folded"
          ? "shop-er-folded"
          : "shop-er";
    return fitted(
      renderDiagram({ kind: "er", definition: mockEr(name), id: "story-er" }),
      args,
    );
  },
  chart: (args) => {
    if (args.invalid === true) {
      return invalidDefinition("chart", "reply-time");
    }
    if (args.tooMany === true) {
      return tooManySeriesDefinition();
    }
    let definition: MdmarkChartDefinition;
    if (typeof args.sample === "string") {
      definition = mockChart(args.sample);
    } else if (args.type === "bar") {
      definition = args.series === 4 ? BAR_FOUR_SAMPLE : BAR_SAMPLE;
    } else if (args.type === "pie") {
      definition = PIE_SAMPLE;
    } else if (args.type === "scatter") {
      definition = SCATTER_SAMPLE;
    } else {
      definition = sampleDefinition<MdmarkChartDefinition>("reply-time");
      if (args.series === 4) {
        // 色と模様の組の全てを見せるため、見本の 2 つの系列に 2 つ追加する
        definition.series?.push(
          { name: "夜間", points: [20, 18, 25, 16, 22] },
          { name: "休日", points: [30, 28, 35, 26, 32] },
        );
      }
    }
    const chart = renderDiagram({
      kind: "chart",
      definition,
      id: "story-chart",
    });
    return args.focusItem === true
      ? chart + storyMarker(args, ".mdmark-diagram-item-hit")
      : fitted(chart, args);
  },
  "diagram-tooltip": (args) => {
    const open = args.open === true;
    if (args.kind === "table") {
      // ER 図の注文のテーブルの説明のボタンで開いた状態: テーブルの上に出す
      const orders = mockEr("shop-er").tables.find((t) => t.id === "orders");
      const table = renderDiagramTip({
        id: "story-tip",
        kind: "table",
        label: orders?.label ?? "",
        ...(orders ? { table: orders } : {}),
        open,
      }).replace(
        'role="tooltip"',
        'role="tooltip" style="position:absolute;inset-block:auto 100%;inset-inline-start:0.5rem"',
      );
      return `<div style="padding-block-start:16rem"><div class="mdmark-diagram-box" style="min-height:11rem;padding:1rem"><button class="mdmark-diagram-info" type="button" aria-label="「注文」の説明" aria-describedby="story-tip">i</button>${table}</div></div>`;
    }
    if (args.kind === "item" || args.group === true) {
      // 折れ線の点・map の構成図のグループのタイトルのマーカーで開いた状態: 持ち主の下に出す
      const tip = (
        args.kind === "item"
          ? renderDiagramTip({
              id: "story-tip",
              kind: "item",
              label: "一次回答",
              value: "水: 18 分",
              open,
            })
          : renderDiagramTip({
              id: "story-tip",
              kind: "hint",
              label: "記法の読み取り",
              hint: "記法を読み取る部分",
              open,
            })
      ).replace(
        'role="tooltip"',
        'role="tooltip" style="position:absolute;inset-block-start:3rem;inset-inline-start:0.5rem"',
      );
      const owner =
        args.kind === "item"
          ? '<svg width="40" height="40" aria-hidden="true"><circle class="mdmark-diagram-item-hit" cx="20" cy="20" r="12" tabindex="0" aria-describedby="story-tip"></circle></svg>'
          : '<div class="map-group-head"><button class="map-group-title" type="button">記法の読み取り</button><button class="mdmark-diagram-info mdmark-diagram-group-info" type="button" aria-label="「記法の読み取り」の説明" aria-describedby="story-tip">i</button></div>';
      return `<div style="padding-block-end:${open ? "8rem" : "0"}"><div class="mdmark-diagram-box" style="min-height:11rem;padding:1rem">${owner}${tip}</div></div>`;
    }
    const kind = args.kind === "hint" ? "hint" : "wire";
    const tip =
      args.term === true
        ? renderDiagramTip({
            id: "story-tip",
            kind: "wire",
            label: "用語",
            tip: SAMPLE_TERMS.意思決定モデル ?? "",
            open,
          })
        : renderDiagramTip({
            id: "story-tip",
            kind,
            label: "本文",
            tip: "件名を除いた本文。署名と引用は落とす",
            ...(kind === "hint" ? { hint: NODE_HINT_TEXT } : {}),
            open,
          });
    // 開いた状態は、ノードの上端の上に出す（画面に対する位置は操作が決める）。ノードの上に余白を取る
    const placedTip = open
      ? tip.replace(
          'role="tooltip"',
          'role="tooltip" style="position:absolute;inset-block:auto 100%;inset-inline-start:0.5rem"',
        )
      : tip;
    const owner =
      args.term === true
        ? '<span class="mdmark-term" tabindex="0" aria-describedby="story-tip">意思決定モデル</span>'
        : kind === "hint"
          ? '<button class="mdmark-diagram-info" type="button" aria-label="「窓口の MCP」の説明" aria-describedby="story-tip">i</button>'
          : '<span class="mdmark-diagram-label has-tip" tabindex="0" aria-describedby="story-tip">本文</span>';
    return `<div style="padding-block-start:${open ? "11rem" : "0"}"><div class="mdmark-diagram-box" style="min-height:11rem;padding:1rem">${owner}${placedTip}</div></div>`;
  },
  hint: (args) =>
    renderHint({
      text: HINT_TEXT,
      placement: (args.placement === "inline"
        ? "inline"
        : "block") satisfies HintPlacement,
      open: args.open === true,
      // 記載した人が地の色を付けたブロックの要素: マーカーが地の色の上でも判読できる
      ...(args.colored === true
        ? {
            style:
              "padding:1rem;background:#1f6feb;color:#fff;border-radius:6px",
          }
        : {}),
    }),
  "embedded-html": (args) => {
    const chart = renderDiagram({
      kind: "chart",
      definition: BAR_SAMPLE,
      id: "story-embedded-chart",
    });
    const boxes =
      '<div style="display:flex;gap:12px"><div style="padding:12px;border:1px solid var(--mdmark-color-border);color:var(--mdmark-color-link)">受け取り</div><div style="padding:12px;border:1px solid var(--mdmark-color-border);color:var(--mdmark-color-link)">分類</div></div><p><button type="button">押しても何も起きない</button></p>';
    const html =
      args.chart === true
        ? `<h3>窓口ごとの問い合わせの件数</h3>${chart}<p>見出しと段落の間のグラフだけに、図のボタンがある。</p>`
        : args.wide === true
          ? '<div style="width:900px;padding:12px;border:1px solid var(--mdmark-color-border)">列より広い HTML。中で横にスクロールする。</div>'
          : boxes;
    if (args.scope !== undefined) {
      return rangeScopeStory(args);
    }
    const embedded = renderEmbeddedHtml({ html, wide: args.wide === true });
    return args.chart === true ? fitted(embedded, args) : embedded;
  },
  param: (args) =>
    fitted(
      renderParam(sampleDefinition<MdmarkParamDefinition>("strength"), {
        id: "story-param",
        ...(typeof args.value === "number" ? { value: args.value } : {}),
        ...(args.copy === undefined ? {} : { copy: args.copy as CopyState }),
        ...(typeof args.copyLabel === "string"
          ? { copyLabel: args.copyLabel }
          : {}),
      }),
      args,
    ),
  figure: (args) =>
    renderFigure({
      kind: args.kind as "image" | "table",
      id: args.id as string | undefined,
      number: Number(args.number),
      caption: args.caption as string | undefined,
      body:
        args.body === "gallery"
          ? storyGallery(GALLERY_DEFAULT_COLS, true)
          : bodyOf(args, args.kind === "table" ? SAMPLE_TABLE : SAMPLE_IMAGE),
    }),
};

/** 色分けのライブラリ（npm の `highlight.js`）を同期で読み込む。描画のインターフェースは Node で動き、言語の登録を `renderPart` の同期のうちに終えるため `require` で読み込む */
const requireModule = createRequire(import.meta.url);

/** 部品の HTML の行の中身（行に分けないときは `code` の中身）を、`language` の言語で色分けした HTML に置き換える。色分けしない言語は部品の HTML のまま返却する */
function highlightCodeBlock(
  html: string,
  language: string,
  lines: CodeLine[],
): string {
  const name = syntaxLanguageOf(language);
  if (name === undefined) {
    return html;
  }
  const hljs = (
    requireModule("highlight.js/lib/core") as HLJSApi
  ).newInstance();
  hljs.registerLanguage(
    name,
    requireModule(`highlight.js/lib/languages/${name}`) as LanguageFn,
  );
  const colored = highlightLines({
    hljs,
    language: name,
    lines: lines.map((line) => line.text),
  });
  const textPattern = /(<span class="mdmark-code-text">)[\s\S]*?(<\/span>)/g;
  if (html.includes('class="mdmark-code-text"')) {
    let index = 0;
    return html.replace(
      textPattern,
      (_, open: string, close: string) =>
        `${open}${colored[index++] ?? ""}${close}`,
    );
  }
  return html.replace(
    /(<code[^>]*>)[\s\S]*?(<\/code>)/,
    (_, open: string, close: string) =>
      `${open}${colored.join("\n")}\n${close}`,
  );
}

/** ストーリーの `server.id` の部品を、問い合わせの引数で描き、描く先の要素（class `mdmark`）で包んで返却する。知らない部品は `undefined` */
export function renderPart(options: {
  /** 部品の id */
  component: string;
  /** 問い合わせの引数 */
  params: URLSearchParams;
}): string | undefined {
  const { component, params } = options;
  const name = params.get("name") ?? "";
  if (component === "notice") {
    // 真偽値は問い合わせの文字列で届くため、`"false"` のときだけ偽にする
    const figure = params.get("figure") !== "false";
    const requested = params.get("source");
    const source =
      requested === "extension" ||
      requested === "diff-revisions" ||
      requested === "diff-content" ||
      requested === "diff-blocks" ||
      requested === "icons"
        ? requested
        : "library";
    return `<div class="mdmark">${renderNotice({ name, figure, source })}</div>`;
  }
  if (component === "embed") {
    // 引数の JSON のオブジェクトは JSON の文字列で届く
    const text = params.get("options");
    const options = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    return `<div class="mdmark">${renderEmbed({ name, options })}</div>`;
  }
  if (component === "mermaid-diagram") {
    // 見本の SVG はファイルの名前で届く
    const html = renderMermaidStory({
      svg: params.get("svg") ?? "",
      printSvg: params.get("printSvg") ?? undefined,
      title: params.get("title") ?? "",
    });
    if (html === undefined) {
      return undefined;
    }
    const className =
      params.get("scheme") === "dark" ? "mdmark mdmark-theme-dark" : "mdmark";
    return `<div class="${className}">${html}${DIAGRAM_FIT_MARKER}</div>`;
  }
  const renderer = Object.hasOwn(PART_RENDERERS, component)
    ? PART_RENDERERS[component]
    : undefined;
  if (!renderer) {
    return undefined;
  }
  const args: PartArgs = {};
  for (const [key, value] of params) {
    args[key] = decodeValue(value);
  }
  // `scheme` が `dark` のストーリーは暗い配色で、`frameWidth` を持つストーリーはその幅の要素で包んで描く（描く先の要素の幅を超えない）
  const className =
    args.scheme === "dark" ? "mdmark mdmark-theme-dark" : "mdmark";
  const html = renderer(args);
  const framed =
    typeof args.frameWidth === "string"
      ? `<div style="width: ${args.frameWidth}; max-width: 100%">${html}</div>`
      : html;
  return `<div class="${className}">${framed}</div>`;
}

/** 操作の処理（`source`）をブラウザの ES モジュールにまとめた文字。経路ごとに、初めて求められたときにまとめる */
const scriptCodes = new Map<string, Promise<string>>();
function bundledScript(options: {
  root: string;
  path: string;
  source: string;
}): Promise<string> {
  const key = `${options.root}\0${options.path}`;
  let code = scriptCodes.get(key);
  if (code === undefined) {
    code = build({
      absWorkingDir: options.root,
      entryPoints: [options.source],
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "silent",
    }).then((result) => result.outputFiles[0]?.text ?? "");
    scriptCodes.set(key, code);
  }
  return code;
}

/** `GET /render/index.css` に `src/index.css` を、`GET /render/diagram.js`・`GET /render/sticky.js`・`GET /render/trees.js` に操作の処理をまとめたものを、`GET /render/{部品の id}` に部品の HTML を返却する HTTP サーバーを作る（待ち受けは呼び出し側） */
export function createRenderServer(options: {
  /** 作業ツリーの場所（`src/index.css` を読み込む） */
  root: string;
}): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${RENDER_HOST}`);
    if (url.pathname === CSS_PATH) {
      const css = readFileSync(join(options.root, "src", "index.css"), "utf8");
      response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      response.end(css);
      return;
    }
    const scriptSource = SCRIPT_SOURCES[url.pathname];
    if (scriptSource !== undefined) {
      bundledScript({
        root: options.root,
        path: url.pathname,
        source: scriptSource,
      }).then(
        (code) => {
          response.writeHead(200, {
            "Content-Type": "text/javascript; charset=utf-8",
          });
          response.end(code);
        },
        (error: unknown) => {
          response.writeHead(500, {
            "Content-Type": "text/plain; charset=utf-8",
          });
          response.end(String(error));
        },
      );
      return;
    }
    const component = PART_PATH_PATTERN.exec(url.pathname)?.[1];
    if (component === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    const html = renderPart({ component, params: url.searchParams });
    if (html === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`知らない部品: ${component}`);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
}

/** 環境変数 `RENDER_PORT` のポートで、`RENDER_HOST` に描画のインターフェースを待ち受ける */
export function main(): void {
  const port = Number(process.env.RENDER_PORT);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    console.error(
      `RENDER_PORT は ${MIN_PORT}〜${MAX_PORT} の整数にする: ${process.env.RENDER_PORT}`,
    );
    process.exitCode = 1;
    return;
  }
  createRenderServer({ root: REPO_ROOT }).listen(port, RENDER_HOST);
}

// `node scripts/storybook-render.ts` で入口として実行されたときだけ実行する
if (import.meta.main) {
  main();
}
