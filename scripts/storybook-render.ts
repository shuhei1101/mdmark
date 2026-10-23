import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import {
  type DiagramDirective,
  definitionWarning,
  type MdmarkChartDefinition,
  type MdmarkFlowDefinition,
  type MdmarkParamDefinition,
  type MdmarkSequenceDefinition,
  readDefinition,
} from "../src/diagram/definition.ts";
import { computeDiff } from "../src/diff/compute.ts";
import type { WarningItem } from "../src/extensions.ts";
import { renderBacklinks } from "../src/parts/backlinks.ts";
import { renderBadge } from "../src/parts/badge.ts";
import { type CalloutKind, renderCallout } from "../src/parts/callout.ts";
import { type CodeLine, renderCodeBlock } from "../src/parts/code-block.ts";
import {
  type CommentFormState,
  renderCommentBubble,
  renderCommentButton,
  renderCommentForm,
  renderCommentMark,
  renderCommentOrphans,
} from "../src/parts/comment.ts";
import { renderDiagram, renderDiagramTip } from "../src/parts/diagram.ts";
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
import { renderFigure } from "../src/parts/figure.ts";
import { type HintPlacement, renderHint } from "../src/parts/hint.ts";
import { renderNotice } from "../src/parts/notice.ts";
import { type CopyState, renderParam } from "../src/parts/param.ts";
import { renderRevisionPicker } from "../src/parts/revision-picker.ts";
import { renderRowDetail } from "../src/parts/row-detail.ts";
import { renderSection } from "../src/parts/section.ts";
import { renderSteps } from "../src/parts/steps.ts";
import { renderSyntaxWarning } from "../src/parts/syntax-warning.ts";
import { renderTable, type TableOptions } from "../src/parts/table.ts";
import { renderTabs } from "../src/parts/tabs.ts";
import { renderTermTip, type TermTipDoc } from "../src/parts/term-tip.ts";
import { renderToc, type TocHeading } from "../src/parts/toc.ts";
import { renderTree, type TreeNode } from "../src/parts/tree.ts";
import { renderView } from "../src/parts/view.ts";
import { sanitizeEmbedded } from "../src/render/sanitize.ts";
import { renderConfigBand } from "../vscode/src/webview/parts/config-band.ts";
import {
  type PreviewStatusState,
  renderPreviewStatus,
} from "../vscode/src/webview/parts/preview-status.ts";

// 描画の口を外へ出さないための待受アドレス
const RENDER_HOST = "127.0.0.1";
// 待ち受けるポートの範囲
const MIN_PORT = 1;
const MAX_PORT = 65535;
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "..");
// 描画の口の経路: 本文の CSS と、部品の HTML の前置き
const CSS_PATH = "/render/index.css";
// VS Code 拡張機能のパネルの CSS（状態の表示と帯のストーリーが読む）の経路と、その元のソース
const VSCODE_CSS_PATH = "/render/vscode.css";
const VSCODE_CSS_SOURCE = join("vscode", "src", "webview", "preview.css");
const PART_PATH_PATTERN = /^\/render\/([^/]+)$/;
// 図のストーリーが読む、拡大・縮小の操作を付ける処理の経路と、その元のソース
const DIAGRAM_SCRIPT_PATH = "/render/diagram.js";
const DIAGRAM_SOURCE = "src/interact/diagrams.ts";
// 図のストーリーに足す印: Storybook の `preview.js` が見つけ、描いた直後の倍率（全体が収まる倍率）にする操作を付ける
const DIAGRAM_FIT_MARKER = "<span hidden data-story-fit></span>";

// 中身を持つ部品に渡す、部品ごとの見本の HTML
const SAMPLE_BODY =
  "<p>中身の見本です。段落が続くときの間隔も確かめられます。</p>";
const SAMPLE_IMAGE =
  "<img alt=\"見本の図\" width=\"320\" height=\"120\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23d1d9e0'/%3E%3C/svg%3E\">";
const SAMPLE_TABLE =
  "<table><thead><tr><th>列A</th><th>列B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>";

// 図の見本の定義を書いた文書と、その中の `json` のコードブロックの並び
const SAMPLE_DOCUMENT = join(
  REPO_ROOT,
  "docs",
  "使い方",
  "図を描く",
  "見本.md",
);
const SAMPLE_BLOCKS: Record<string, number> = {
  inquiry: 0,
  "inquiry-seq": 1,
  "reply-time": 2,
  strength: 3,
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
    { name: "よくある質問で答えた", value: 186 },
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

// 箱の `hint` のストーリーに出す文
const NODE_HINT_TEXT =
  "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読まず、下書きの ID で頼まれた操作をする";

// 箱の中の `{{語}}` に出す意味（見本の文書の用語集の表と同じ）
const SAMPLE_TERMS: Record<string, string> = {
  意思決定モデル:
    "選択肢から選ぶ・当てはまるかに答えるだけの、速く安い判断用の AI",
  よくある質問: "問い合わせの多い質問と、その答えをまとめた表",
};

// 長い題と箱の名前を見せるストーリーで足す文字
const LONG_TITLE =
  "問い合わせのメールを受け取ってから、分類・下書き・送信を経て、担当者のチャットへ控えを流すまでの、とても長い題名の構成";
const LONG_NAME_SUFFIX = "（箱の名前が長いときは箱の中で折り返す）";

/** 見本の文書から、見本の定義の JSON の文字を取り出す */
function sampleText(name: string): string {
  const blocks = [
    ...readFileSync(SAMPLE_DOCUMENT, "utf8").matchAll(
      /```json\n([\s\S]*?)\n```/g,
    ),
  ];
  const text = blocks[SAMPLE_BLOCKS[name] ?? -1]?.[1];
  if (text === undefined) {
    throw new Error(`見本の定義が無い: ${name}`);
  }
  return text;
}

/** 見本の定義を読んだ値 */
function sampleDefinition<T>(name: string): T {
  return JSON.parse(sampleText(name)) as T;
}

/** 定義を読めないストーリーの書き方の警告: 見本の閉じの `}` を落として読ませる */
function invalidDefinition(directive: DiagramDirective, name: string): string {
  const text = sampleText(name);
  const broken = text.slice(0, text.lastIndexOf("}"));
  const { message, items } = definitionWarning(
    directive,
    readDefinition(directive, [broken]).problems,
  );
  return renderSyntaxWarning({ message, items });
}

/** `zoom` を渡さないストーリーは、描いた直後に全体が収まる倍率にする印を足す */
function fitted(html: string, args: PartArgs): string {
  return typeof args.zoom === "number" ? html : html + DIAGRAM_FIT_MARKER;
}

/** 図の部品のストーリーの引数: 見本・状態 */
function diagramArgs(args: PartArgs): { zoom?: number; modal?: boolean } {
  return {
    ...(typeof args.zoom === "number" ? { zoom: args.zoom } : {}),
    ...(args.modal === true ? { modal: true } : {}),
  };
}

/** 問い合わせの引数の値を戻す: JSON として読める値（配列・オブジェクト・数・真偽値）は JSON として読み、読めなければ文字列のまま */
function decodeValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** 部品の関数に渡す引数 */
type PartArgs = Record<string, unknown>;

/** 中身を持つ部品の中身: ストーリーの引数 `body` があればそれ、無ければ見本 */
function bodyOf(args: PartArgs, sample: string): string {
  return typeof args.body === "string" ? args.body : sample;
}

// 差分のストーリーの見本: 行の差分に使う前と後の Markdown
const DIFF_TEXT_BEFORE =
  "# 問い合わせ窓口の週の報告\n\nよくある質問の差分は、担当者が週に 1 回確かめます。\n消す行\n終わり\n";
const DIFF_TEXT_AFTER =
  "# 問い合わせ窓口の週の報告\n\nよくある質問の変更は、担当者が週に 1 回確かめます。\n終わり\n足す行\n";
const DIFF_LONG_BEFORE =
  "返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-faq-table に置きます。\n";
const DIFF_LONG_AFTER =
  "返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-frequently-asked-questions-table に置きます。\n";

/** 埋め込んだ HTML の範囲を 1 つ持つ Markdown。表のメール欄の件数を引数で変える */
function diffTable(mail: number, extra = ""): string {
  return `<!-- html -->\n\`\`\`html\n<table><tr><th>窓口</th><th>件数</th></tr><tr><td>メール</td><td>${mail}</td></tr>${extra}</table>\n\`\`\`\n<!-- /html -->\n`;
}

// 埋め込んだ HTML の差分の見本: 前と後の Markdown
const DIFF_HTML_SAMPLES: Record<string, { before: string; after: string }> = {
  table: { before: diffTable(120), after: diffTable(150) },
  added: { before: "# 題\n", after: `# 題\n${diffTable(150)}` },
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
  after: "2026/10/19 16:40 件数を直す（鈴木）",
};

/** 差分の見本を比べる。語の区切りは `Intl.Segmenter`（`ja`・`word`）で、`char` の見本だけ持たないことにして 1 文字ずつ比べる */
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

// コメントのボタン・入力欄・吹き出しのストーリーに足す規則: 本物は `document.body` の直下で `position: fixed` だが、ストーリーではその場に置く
const STATIC_POPOVER_STYLE =
  "<style>.mdmark-comment-add,.mdmark-comment-popover{position:static}</style>";

// 部品の id から、部品の関数を呼ぶ表
const PART_RENDERERS: Record<string, (args: PartArgs) => string> = {
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
        | { term: string; meaning: string }
        | undefined,
      below: args.below === true,
    });
    // 開いた状態を見せるストーリーは、語の枠に `is-open` を付け、ツールチップの上と下に余白を取る
    const open = args.open === true;
    const wrap = open
      ? html.replace(
          'class="mdmark-term-wrap',
          'class="mdmark-term-wrap is-open',
        )
      : html;
    const space = open ? "22rem" : "0";
    return `<p style="padding-block:${space}">本文の${wrap}を読む。</p>`;
  },
  backlinks: (args) =>
    renderBacklinks({
      id: String(args.id ?? ""),
      docs: args.docs as Array<{ title: string; href: string }>,
    }),
  table: (args) => renderTable(args as TableOptions),
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
    })}</span>を読む。</p>`,
  "comment-bubble": (args) =>
    STATIC_POPOVER_STYLE +
    renderCommentBubble({
      quote: String(args.quote ?? ""),
      bodies: args.bodies as string[],
    }),
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
      body: bodyOf(args, SAMPLE_BODY),
    }),
  tabs: (args) => {
    const titles = args.titles as string[];
    return renderTabs({
      id: "story",
      titles,
      panels: titles.map((title) => `<p>${title} の中身の見本です。</p>`),
      selected: args.selected as number | undefined,
      group: args.group as string | undefined,
    });
  },
  steps: (args) => renderSteps({ items: args.items as string[] }),
  tree: (args) => renderTree({ nodes: args.nodes as TreeNode[] }),
  badge: (args) => renderBadge({ label: String(args.label ?? "") }),
  "code-block": (args) =>
    renderCodeBlock({
      language: String(args.language ?? ""),
      title: String(args.title ?? ""),
      lineNumbers: args.lineNumbers === true,
      lines: args.lines as CodeLine[],
    }),
  toc: (args) => renderToc({ headings: args.headings as TocHeading[] }),
  section: (args) =>
    renderSection({
      level: args.level as 2 | 3 | 4,
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
  "preview-status": (args) =>
    renderPreviewStatus({
      state: args.state as PreviewStatusState,
      ...(args.version === undefined ? {} : { version: String(args.version) }),
    }),
  "config-band": (args) =>
    renderConfigBand({ path: String(args.path), line: Number(args.line) }),
  "doc-list": (args) =>
    renderDocList({
      docs: args.docs as DocListItem[],
      current: args.current as string | undefined,
    }),
  "diagram-frame": (args) =>
    fitted(
      renderDiagram({
        kind: "flow",
        definition: sampleDefinition<MdmarkFlowDefinition>("inquiry"),
        id: "story-frame",
        lookup: (word) => SAMPLE_TERMS[word],
        ...diagramArgs(args),
      }),
      args,
    ),
  "flow-diagram": (args) => {
    if (args.invalid === true) {
      return invalidDefinition("flow", "inquiry");
    }
    const definition = sampleDefinition<MdmarkFlowDefinition>("inquiry");
    if (args.longNames === true) {
      definition.title = LONG_TITLE;
      for (const node of definition.nodes) {
        node.name = `${node.name}${LONG_NAME_SUFFIX}`;
      }
    }
    return fitted(
      renderDiagram({
        kind: "flow",
        definition,
        id: "story-flow",
        lookup: (word) => SAMPLE_TERMS[word],
      }),
      args,
    );
  },
  "sequence-diagram": (args) =>
    args.invalid === true
      ? invalidDefinition("sequence", "inquiry-seq")
      : fitted(
          renderDiagram({
            kind: "sequence",
            definition:
              sampleDefinition<MdmarkSequenceDefinition>("inquiry-seq"),
            id: "story-sequence",
            lookup: (word) => SAMPLE_TERMS[word],
          }),
          args,
        ),
  chart: (args) => {
    if (args.invalid === true) {
      return invalidDefinition("chart", "reply-time");
    }
    let definition: MdmarkChartDefinition;
    if (args.type === "bar") {
      definition = args.series === 4 ? BAR_FOUR_SAMPLE : BAR_SAMPLE;
    } else if (args.type === "pie") {
      definition = PIE_SAMPLE;
    } else if (args.type === "scatter") {
      definition = SCATTER_SAMPLE;
    } else {
      definition = sampleDefinition<MdmarkChartDefinition>("reply-time");
      if (args.series === 4) {
        // 色と模様の組の全てを見せるため、見本の 2 つの系列に 2 つ足す
        definition.series?.push(
          { name: "夜間", points: [20, 18, 25, 16, 22] },
          { name: "休日", points: [30, 28, 35, 26, 32] },
        );
      }
    }
    return fitted(
      renderDiagram({ kind: "chart", definition, id: "story-chart" }),
      args,
    );
  },
  "diagram-tooltip": (args) => {
    const open = args.open === true;
    const kind =
      args.kind === "io" ? "io" : args.kind === "hint" ? "hint" : "wire";
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
            label: kind === "io" ? "分類" : "本文",
            tip: "件名を除いた本文。署名と引用は落とす",
            ...(kind === "hint" ? { hint: NODE_HINT_TEXT } : {}),
            io: {
              in: "問い合わせの本文",
              do: "返信の種類（よくある質問で答える・担当者へ回す）から 1 つ選ぶ",
              out: "返信の種類と、その確からしさ",
            },
            open,
          });
    // 開いた状態は、持ち主の上に出す（画面に対する位置は操作が決める）。上の余白の左上に置く
    const placedTip = open
      ? tip.replace(
          'role="tooltip"',
          'role="tooltip" style="position:absolute;inset-block-start:0.5rem;inset-inline-start:0.5rem"',
        )
      : tip;
    const owner =
      args.term === true
        ? '<span class="mdmark-term" tabindex="0" aria-describedby="story-tip">意思決定モデル</span>'
        : kind === "io"
          ? '<button class="mdmark-diagram-info" type="button" aria-label="「分類」の入力・処理・出力" aria-describedby="story-tip">i</button>'
          : kind === "hint"
            ? '<button class="mdmark-diagram-info" type="button" aria-label="「窓口の MCP」の説明" aria-describedby="story-tip">i</button>'
            : '<span class="mdmark-diagram-label has-tip" tabindex="0" aria-describedby="story-tip">本文</span>';
    return `<div class="mdmark-diagram-box" style="min-height:11rem;padding:1rem;padding-block-start:${open ? "11rem" : "1rem"}">${owner}${placedTip}</div>`;
  },
  hint: (args) =>
    renderHint({
      text: HINT_TEXT,
      placement: (args.placement === "inline"
        ? "inline"
        : "block") satisfies HintPlacement,
      open: args.open === true,
      // 書いた人が地の色を付けたブロックの要素: 印が地の色の上でも読める
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
    const embedded = renderEmbeddedHtml({ html, wide: args.wide === true });
    return args.chart === true ? fitted(embedded, args) : embedded;
  },
  param: (args) =>
    fitted(
      renderParam(sampleDefinition<MdmarkParamDefinition>("strength"), {
        id: "story-param",
        ...(typeof args.value === "number" ? { value: args.value } : {}),
        ...(args.copy === undefined ? {} : { copy: args.copy as CopyState }),
      }),
      args,
    ),
  figure: (args) =>
    renderFigure({
      kind: args.kind as "image" | "table",
      id: args.id as string | undefined,
      number: Number(args.number),
      caption: args.caption as string | undefined,
      body: bodyOf(args, args.kind === "table" ? SAMPLE_TABLE : SAMPLE_IMAGE),
    }),
};

/** ストーリーの `server.id` の部品を、問い合わせの引数で描き、描く先の要素（class `mdmark`）で包んで返す。知らない部品は `undefined` */
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
      requested === "diff-content"
        ? requested
        : "library";
    return `<div class="mdmark">${renderNotice({ name, figure, source })}</div>`;
  }
  if (component === "embed") {
    // 配列はカンマで区切った 1 つの文字列で届く
    const joined = params.get("args") ?? "";
    const args = joined === "" ? [] : joined.split(",");
    return `<div class="mdmark">${renderEmbed({ name, args })}</div>`;
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
  return `<div class="mdmark">${renderer(args)}</div>`;
}

/** 図の操作（`src/interact/diagrams.ts`）をブラウザの ES モジュールに束ねた文字。初めて求められたときに束ねる */
let diagramScriptCode: Promise<string> | undefined;
function diagramScript(root: string): Promise<string> {
  diagramScriptCode ??= build({
    absWorkingDir: root,
    entryPoints: [DIAGRAM_SOURCE],
    bundle: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  }).then((result) => result.outputFiles[0]?.text ?? "");
  return diagramScriptCode;
}

/** `GET /render/index.css` に `src/index.css` を、`GET /render/vscode.css` に `vscode/src/webview/preview.css` を、`GET /render/{部品の id}` に部品の HTML を返す HTTP サーバーを作る（待ち受けは呼び出し側） */
export function createRenderServer(options: {
  /** 作業ツリーの場所（`src/index.css` を読む） */
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
    if (url.pathname === VSCODE_CSS_PATH) {
      const css = readFileSync(join(options.root, VSCODE_CSS_SOURCE), "utf8");
      response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      response.end(css);
      return;
    }
    if (url.pathname === DIAGRAM_SCRIPT_PATH) {
      diagramScript(options.root).then(
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

/** 環境変数 `RENDER_PORT` のポートで、`RENDER_HOST` に描画の口を待ち受ける */
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

// `node scripts/storybook-render.ts` で入口として実行されたときだけ流す
if (import.meta.main) {
  main();
}
