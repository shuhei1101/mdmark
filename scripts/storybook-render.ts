import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import type { WarningItem } from "../src/extensions.ts";
import { renderBacklinks } from "../src/parts/backlinks.ts";
import { renderBadge } from "../src/parts/badge.ts";
import { type CalloutKind, renderCallout } from "../src/parts/callout.ts";
import { renderEmbed } from "../src/parts/embed.ts";
import { renderFigure } from "../src/parts/figure.ts";
import { renderNotice } from "../src/parts/notice.ts";
import { renderRowDetail } from "../src/parts/row-detail.ts";
import { renderSection } from "../src/parts/section.ts";
import { renderSteps } from "../src/parts/steps.ts";
import { renderSyntaxWarning } from "../src/parts/syntax-warning.ts";
import { renderTable, type TableOptions } from "../src/parts/table.ts";
import { renderTabs } from "../src/parts/tabs.ts";
import { renderTermTip, type TermTipDoc } from "../src/parts/term-tip.ts";
import { renderToc, type TocHeading } from "../src/parts/toc.ts";
import { renderTree, type TreeNode } from "../src/parts/tree.ts";

// 描画の口を外へ出さないための待受アドレス
const RENDER_HOST = "127.0.0.1";
// 待ち受けるポートの範囲
const MIN_PORT = 1;
const MAX_PORT = 65535;
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "..");
// 描画の口の経路: 本文の CSS と、部品の HTML の前置き
const CSS_PATH = "/render/index.css";
const PART_PATH_PATTERN = /^\/render\/([^/]+)$/;

// 中身を持つ部品に渡す、部品ごとの見本の HTML
const SAMPLE_BODY =
  "<p>中身の見本です。段落が続くときの間隔も確かめられます。</p>";
const SAMPLE_IMAGE =
  "<img alt=\"見本の図\" width=\"320\" height=\"120\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23d1d9e0'/%3E%3C/svg%3E\">";
const SAMPLE_TABLE =
  "<table><thead><tr><th>列A</th><th>列B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>";

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

// 部品の id から、部品の関数を呼ぶ表
const PART_RENDERERS: Record<string, (args: PartArgs) => string> = {
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
    });
    // 開いた状態を見せるストーリーは、語の枠に `is-open` を付け、ツールチップの下に余白を取る
    const open = args.open === true;
    const wrap = open
      ? html.replace(
          'class="mdmark-term-wrap"',
          'class="mdmark-term-wrap is-open"',
        )
      : html;
    return `<p style="padding-block-end:${open ? "22rem" : "0"}">本文の${wrap}を読む。</p>`;
  },
  backlinks: (args) =>
    renderBacklinks({
      id: String(args.id ?? ""),
      docs: args.docs as Array<{ title: string; href: string }>,
    }),
  table: (args) => renderTable(args as TableOptions),
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
    });
  },
  steps: (args) => renderSteps({ items: args.items as string[] }),
  tree: (args) => renderTree({ nodes: args.nodes as TreeNode[] }),
  badge: (args) => renderBadge({ label: String(args.label ?? "") }),
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
    const source =
      params.get("source") === "extension" ? "extension" : "library";
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

/** `GET /render/index.css` に `src/index.css` を、`GET /render/{部品の id}` に部品の HTML を返す HTTP サーバーを作る（待ち受けは呼び出し側） */
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
