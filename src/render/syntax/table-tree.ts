import type { StateCore, Token } from "markdown-it";
import { escapeHtml } from "../../parts/escape.ts";
import { markOwn } from "../../parts/own.ts";
import { renderTreeKeyCell, renderTypeCell } from "../../parts/table.ts";
import { planTreeRows, yamlLinePaths } from "../../tree-logic.ts";
import type { TableSpec } from "./tables.ts";
import {
  envOf,
  featureOn,
  findNestedClose,
  markOf,
  ownBlock,
  tabBoundaryOf,
  textOf,
} from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** 必須の列の文字のうち、必須と読み込む値 */
const REQUIRED_VALUES = ["✓", "true"];

/** 階層の表の `table_open` の `meta` に `decorateTables` が配置する、表の指定と表のマーカーの文字 */
export type TreeTableMeta = { treeSpec?: TableSpec; treeMark?: string };

/** 表の 1 行のトークンの位置: `tr_open`・`tr_close` とセルごとの開きと閉じ */
type RowRange = {
  open: number;
  close: number;
  cells: Array<{ open: number; close: number }>;
};

/** `start` の表の直下の見出しの行と本文の行を集める（中の表は数えない） */
function collectRows(
  tokens: Token[],
  start: number,
  end: number,
): { head: RowRange[]; body: RowRange[]; bodyOpen: number; bodyClose: number } {
  const head: RowRange[] = [];
  const body: RowRange[] = [];
  let depth = 0;
  let inBody = false;
  let bodyOpen = -1;
  let bodyClose = -1;
  let row: RowRange | undefined;
  let cellOpen = -1;
  for (let index = start + 1; index < end; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    if (token.type === "table_open") {
      depth += 1;
    } else if (token.type === "table_close") {
      depth -= 1;
    }
    if (depth > 0) {
      continue;
    }
    switch (token.type) {
      case "tbody_open":
        inBody = true;
        bodyOpen = index;
        break;
      case "tbody_close":
        bodyClose = index;
        break;
      case "tr_open":
        row = { open: index, close: index, cells: [] };
        break;
      case "tr_close":
        if (row) {
          row.close = index;
          (inBody ? body : head).push(row);
        }
        row = undefined;
        break;
      case "th_open":
      case "td_open":
        cellOpen = index;
        break;
      case "th_close":
      case "td_close":
        row?.cells.push({ open: cellOpen, close: index });
        break;
      default:
        break;
    }
  }
  return { head, body, bodyOpen, bodyClose };
}

/** セルの中身の文字 */
function cellText(tokens: Token[], cell: { open: number } | undefined): string {
  const inline = cell ? tokens[cell.open + 1] : undefined;
  return inline?.type === "inline" ? textOf(inline).trim() : "";
}

/** `tree` の表の本文の各行にパスと深さを付け、表に無い親の行を差し込み、キー・型・必須・既定の列のセルを替える */
export function decorateTreeTable(options: {
  /** markdown-it の状態 */
  state: StateCore;
  /** 表の `table_open` の位置 */
  start: number;
  /** 表の `table_close` の位置 */
  end: number;
  /** `readTableSpec` の結果（`tree` を持つ） */
  spec: TableSpec;
}): void {
  const { state, start, end, spec } = options;
  const tree = spec.tree;
  if (tree === undefined || end < 0) {
    return;
  }
  const tokens = state.tokens;
  const nonce = envOf(state).nonce;
  const { head, body, bodyOpen, bodyClose } = collectRows(tokens, start, end);
  if (bodyOpen < 0 || bodyClose < 0) {
    return;
  }
  /** マーカーを付けた HTML の `html_inline` を作る */
  const inlineHtml = (html: string): Token => {
    const token = new state.Token("html_inline", "", 0);
    token.content = markOwn(html, nonce);
    return token;
  };
  /** 開きのトークンに、mdmark が付けた属性として値を付ける */
  const setOwn = (token: Token, name: string, value: string): void => {
    token.attrSet(name, value);
    token.attrSet("data-mdmark-own", nonce);
  };
  const required = spec.treeRequired;
  // 見出しの行から必須の列を除く
  const dropped = new Set<number>();
  if (required !== undefined) {
    for (const row of head) {
      const cell = row.cells[required];
      for (let index = cell?.open ?? 0; cell && index <= cell.close; index++) {
        dropped.add(index);
      }
    }
  }
  const keys = body.map((row) => cellText(tokens, row.cells[tree]));
  const plans = planTreeRows(keys);
  const sample = body[0];
  const level = sample ? (tokens[sample.open]?.level ?? 0) : 0;
  const columns = sample?.cells.length ?? 0;
  const rowsOut: Token[] = [];
  for (const plan of plans) {
    const classes = [
      "mdmark-tree-row",
      ...(plan.virtual ? ["is-virtual"] : []),
      ...(plan.hasChildren ? ["has-children"] : []),
    ].join(" ");
    const source = plan.source === undefined ? undefined : body[plan.source];
    const isRequired =
      source !== undefined &&
      required !== undefined &&
      REQUIRED_VALUES.includes(cellText(tokens, source.cells[required]));
    const keyHtml = renderTreeKeyCell({
      name: plan.name,
      depth: plan.depth,
      required: isRequired,
    });
    let trOpen: Token;
    const cellsOut: Token[] = [];
    if (source) {
      trOpen = tokens[source.open] as Token;
      for (const [column, cell] of source.cells.entries()) {
        if (column === required) {
          continue;
        }
        const open = tokens[cell.open] as Token;
        const inline = tokens[cell.open + 1];
        if (inline?.type === "inline") {
          const text = textOf(inline).trim();
          if (column === tree) {
            open.attrJoin("class", "mdmark-tree-key");
            open.attrSet("data-mdmark-own", nonce);
            inline.children = [inlineHtml(keyHtml)];
          } else if (column === spec.treeType && text !== "") {
            inline.children = [inlineHtml(renderTypeCell(text))];
          } else if (column === spec.treeDefault && text !== "") {
            inline.children = [
              inlineHtml('<span class="mdmark-tree-default">'),
              ...(inline.children ?? []),
              inlineHtml("</span>"),
            ];
          }
        }
        cellsOut.push(...tokens.slice(cell.open, cell.close + 1));
      }
    } else {
      // 表に無い親の行は、キーのセルだけ中身を持つ空の行にする
      trOpen = new state.Token("tr_open", "tr", 1);
      trOpen.level = level;
      for (let column = 0; column < columns; column++) {
        if (column === required) {
          continue;
        }
        const open = new state.Token("td_open", "td", 1);
        open.level = level + 1;
        const inline = new state.Token("inline", "", 0);
        inline.level = level + 2;
        inline.children = [];
        if (column === tree) {
          setOwn(open, "class", "mdmark-tree-key");
          inline.children = [inlineHtml(keyHtml)];
        }
        const close = new state.Token("td_close", "td", -1);
        close.level = level + 1;
        cellsOut.push(open, inline, close);
      }
    }
    trOpen.attrJoin("class", classes);
    setOwn(trOpen, "data-path", plan.path);
    setOwn(trOpen, "data-parent", plan.parent);
    setOwn(trOpen, "data-depth", String(plan.depth));
    const trClose = source
      ? (tokens[source.close] as Token)
      : new state.Token("tr_close", "tr", -1);
    trClose.level = level;
    rowsOut.push(trOpen, ...cellsOut, trClose);
  }
  const bodyStart = body[0]?.open ?? bodyClose;
  const bodyEnd = body.at(-1)?.close ?? bodyClose - 1;
  // 本文の行の後ろ（一致する行が無い通知の行など）は残す
  const rest = tokens.slice(bodyEnd + 1, bodyClose);
  const before = tokens
    .slice(start, bodyStart)
    .filter((_, offset) => !dropped.has(start + offset));
  state.tokens = [
    ...tokens.slice(0, start),
    ...before,
    ...rowsOut,
    ...rest,
    ...tokens.slice(bodyClose),
  ];
}

/** 文字が `text` の見出しの位置を返却する（無ければ `-1`） */
function findHeading(tokens: Token[], text: string): number {
  return tokens.findIndex(
    (token, index) =>
      token.type === "heading_open" &&
      tokens[index + 1]?.type === "inline" &&
      textOf(tokens[index + 1] as Token).trim() === text,
  );
}

/** 見出しの直下のタブの範囲の `start` と `end` の境目の位置を返却する（無ければ `undefined`） */
function tabsAfterHeading(
  tokens: Token[],
  heading: number,
): { from: number; to: number } | undefined {
  let index = heading + 3;
  while (markOf(tokens[index])) {
    index += 1;
  }
  if (tabBoundaryOf(tokens[index]) !== "start") {
    return undefined;
  }
  let depth = 0;
  for (let cursor = index; cursor < tokens.length; cursor++) {
    const boundary = tabBoundaryOf(tokens[cursor]);
    if (boundary === "start") {
      depth += 1;
    } else if (boundary === "end") {
      depth -= 1;
      if (depth === 0) {
        return { from: index, to: cursor };
      }
    }
  }
  return undefined;
}

/** HTML の文字参照を文字に戻す */
function unescapeHtml(html: string): string {
  return html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/** 見本の `yaml` のコードブロックの行を `span.mdmark-yaml-line` にし、キーを持つ行に `data-path` を付ける */
function linkYamlLines(html: string): string {
  if (!html.includes("language-yaml")) {
    return html;
  }
  const linePattern =
    /<span([^>]*?) class="mdmark-code-line"([^>]*)>([\s\S]*?<span[^>]*class="mdmark-code-text"[^>]*>([\s\S]*?)<\/span>)/g;
  const lines = [...html.matchAll(linePattern)].map((match) =>
    unescapeHtml((match[4] ?? "").replace(/<[^>]*>/g, "")),
  );
  const paths = yamlLinePaths(lines);
  let index = 0;
  return html.replace(
    linePattern,
    (_whole, before: string, after: string, rest: string) => {
      const path = paths[index];
      index += 1;
      const pathAttribute =
        path === undefined ? "" : ` data-path="${escapeHtml(path)}"`;
      return `<span${before} class="mdmark-code-line mdmark-yaml-line"${after}${pathAttribute}>${rest}`;
    },
  );
}

/** `meta.role` の値が `role` の `html_block` を、`from` から `step` の向きに探す */
function findRole(
  tokens: Token[],
  from: number,
  step: 1 | -1,
  role: string,
): number {
  for (let index = from; index >= 0 && index < tokens.length; index += step) {
    if ((tokens[index]?.meta as { role?: string } | null)?.role === role) {
      return index;
    }
  }
  return -1;
}

/** コアルール。`example` を持つ階層の表ごとに、見出しの直下のタブの範囲を表の直後の見本に移し、表と見本を `div.mdmark-tree-layout` で囲む */
export function linkTreeExamples(state: StateCore): void {
  if (!featureOn(state, "table")) {
    return;
  }
  let serial = 0;
  for (let index = 0; index < state.tokens.length; index++) {
    const tokens = state.tokens;
    const token = tokens[index];
    const meta = token?.meta as TreeTableMeta | null | undefined;
    const example = meta?.treeSpec?.example;
    if (token?.type !== "table_open" || example === undefined) {
      continue;
    }
    const wrapperOpen = findRole(tokens, index, -1, "table-open");
    const wrapperClose = findRole(
      tokens,
      findNestedClose(tokens, index),
      1,
      "table-close",
    );
    const heading = findHeading(tokens, example);
    const tabs = heading < 0 ? undefined : tabsAfterHeading(tokens, heading);
    if (!tabs || wrapperOpen < 0 || wrapperClose < 0) {
      const warning = warningBlock(state, {
        mark: meta?.treeMark,
        message: `の \`tree.example.heading\` の見出し \`${example}\` が文書に無いか、直下にタブがありません。見本を配置せずに描いています。`,
      });
      tokens.splice(Math.max(wrapperOpen, index), 0, warning);
      index += 1;
      continue;
    }
    const moved = tokens.slice(tabs.from, tabs.to + 1).map((moving) => {
      if (moving.type === "html_block") {
        moving.content = linkYamlLines(moving.content);
      }
      return moving;
    });
    const id = `mdmark-tree-${serial}-example`;
    serial += 1;
    const layoutOpen = ownBlock(state, '<div class="mdmark-tree-layout">');
    const asideOpen = ownBlock(
      state,
      `<aside class="mdmark-tree-example" id="${id}" aria-label="見本: ${escapeHtml(example)}">`,
    );
    const asideClose = ownBlock(state, "</aside></div>");
    const remaining = tokens.filter(
      (_, position) => position < tabs.from || position > tabs.to,
    );
    const shift = tabs.from < wrapperOpen ? moved.length : 0;
    const open = wrapperOpen - shift;
    const close = wrapperClose - shift;
    state.tokens = [
      ...remaining.slice(0, open),
      layoutOpen,
      ...remaining.slice(open, close + 1),
      asideOpen,
      ...moved,
      asideClose,
      ...remaining.slice(close + 1),
    ];
    index = close + 1 + moved.length + 2;
  }
}
