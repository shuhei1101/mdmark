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

/** 表の行を集めるときの途中の値 */
type RowWalk = {
  head: RowRange[];
  body: RowRange[];
  bodyOpen: number;
  bodyClose: number;
  inBody: boolean;
  /** 読んでいる行 */
  row: RowRange | undefined;
  /** 読んでいるセルの開きの位置 */
  cellOpen: number;
};

/** セルの開きの位置を記録する */
const openCell = (walk: RowWalk, index: number): void => {
  walk.cellOpen = index;
};

/** 読んでいる行にセルを足す */
const closeCell = (walk: RowWalk, index: number): void => {
  walk.row?.cells.push({ open: walk.cellOpen, close: index });
};

/** トークンの種類ごとの、行を集める手順 */
const ROW_STEPS: Readonly<
  Record<string, (walk: RowWalk, index: number) => void>
> = {
  tbody_open: (walk, index) => {
    walk.inBody = true;
    walk.bodyOpen = index;
  },
  tbody_close: (walk, index) => {
    walk.bodyClose = index;
  },
  tr_open: (walk, index) => {
    walk.row = { open: index, close: index, cells: [] };
  },
  tr_close: (walk, index) => {
    if (walk.row) {
      walk.row.close = index;
      (walk.inBody ? walk.body : walk.head).push(walk.row);
    }
    walk.row = undefined;
  },
  th_open: openCell,
  td_open: openCell,
  th_close: closeCell,
  td_close: closeCell,
};

/** `start` の表の直下の見出しの行と本文の行を集める（中の表は数えない） */
function collectRows(
  tokens: Token[],
  start: number,
  end: number,
): { head: RowRange[]; body: RowRange[]; bodyOpen: number; bodyClose: number } {
  const walk: RowWalk = {
    head: [],
    body: [],
    bodyOpen: -1,
    bodyClose: -1,
    inBody: false,
    row: undefined,
    cellOpen: -1,
  };
  let depth = 0;
  for (let index = start + 1; index < end; index++) {
    const type = tokens[index]?.type;
    if (type === "table_open") {
      depth += 1;
    } else if (type === "table_close") {
      depth -= 1;
    }
    if (type !== undefined && depth === 0 && Object.hasOwn(ROW_STEPS, type)) {
      ROW_STEPS[type]?.(walk, index);
    }
  }
  const { head, body, bodyOpen, bodyClose } = walk;
  return { head, body, bodyOpen, bodyClose };
}

/** セルの中身の文字 */
function cellText(tokens: Token[], cell: { open: number } | undefined): string {
  const inline = cell ? tokens[cell.open + 1] : undefined;
  return inline?.type === "inline" ? textOf(inline).trim() : "";
}

/** 階層の表の行を作るときに引く値 */
type TreeContext = {
  state: StateCore;
  tokens: Token[];
  nonce: string;
  spec: TableSpec;
  /** キーの列 */
  tree: number;
  /** 必須の列 */
  required: number | undefined;
  /** 本文の行のトークンの深さ */
  level: number;
  /** 本文の行のセルの数 */
  columns: number;
};

/** マーカーを付けた HTML の `html_inline` を作る */
function inlineHtml(context: TreeContext, html: string): Token {
  const token = new context.state.Token("html_inline", "", 0);
  token.content = markOwn(html, context.nonce);
  return token;
}

/** 開きのトークンに、mdmark が付けた属性として値を付ける */
function setOwn(
  token: Token,
  attribute: { name: string; value: string; nonce: string },
): void {
  token.attrSet(attribute.name, attribute.value);
  token.attrSet("data-mdmark-own", attribute.nonce);
}

/** 見出しの行の必須の列のセルのトークンの位置 */
function droppedHeadCells(
  head: RowRange[],
  required: number | undefined,
): Set<number> {
  const dropped = new Set<number>();
  if (required === undefined) {
    return dropped;
  }
  for (const row of head) {
    const cell = row.cells[required];
    for (let index = cell?.open ?? 0; cell && index <= cell.close; index++) {
      dropped.add(index);
    }
  }
  return dropped;
}

/** 表にある行のセルの中身を、キー・型・既定の列で替える */
function decorateSourceCell(
  context: TreeContext,
  cell: { column: number; open: number; keyHtml: string },
): void {
  const { tokens, tree, spec, nonce } = context;
  const { column, keyHtml } = cell;
  const open = tokens[cell.open] as Token;
  const inline = tokens[cell.open + 1];
  if (inline?.type !== "inline") {
    return;
  }
  const text = textOf(inline).trim();
  if (column === tree) {
    open.attrJoin("class", "mdmark-tree-key");
    open.attrSet("data-mdmark-own", nonce);
    inline.children = [inlineHtml(context, keyHtml)];
  } else if (column === spec.treeType && text !== "") {
    inline.children = [inlineHtml(context, renderTypeCell(text))];
  } else if (column === spec.treeDefault && text !== "") {
    inline.children = [
      inlineHtml(context, '<span class="mdmark-tree-default">'),
      ...(inline.children ?? []),
      inlineHtml(context, "</span>"),
    ];
  }
}

/** 表にある行のセルのトークン（必須の列を除く） */
function sourceCells(
  context: TreeContext,
  row: { source: RowRange; keyHtml: string },
): Token[] {
  const { tokens, required } = context;
  const out: Token[] = [];
  for (const [column, cell] of row.source.cells.entries()) {
    if (column === required) {
      continue;
    }
    decorateSourceCell(context, {
      column,
      open: cell.open,
      keyHtml: row.keyHtml,
    });
    out.push(...tokens.slice(cell.open, cell.close + 1));
  }
  return out;
}

/** 表に無い親の行は、キーのセルだけ中身を持つ空の行にする */
function virtualCells(context: TreeContext, keyHtml: string): Token[] {
  const { state, tree, required, level, columns, nonce } = context;
  const out: Token[] = [];
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
      setOwn(open, { name: "class", value: "mdmark-tree-key", nonce });
      inline.children = [inlineHtml(context, keyHtml)];
    }
    const close = new state.Token("td_close", "td", -1);
    close.level = level + 1;
    out.push(open, inline, close);
  }
  return out;
}

/** 行の描き方 1 つの行のトークン（パスと深さを付ける） */
function treeRowTokens(
  context: TreeContext,
  row: { plan: ReturnType<typeof planTreeRows>[number]; body: RowRange[] },
): Token[] {
  const { state, tokens, required, level, nonce } = context;
  const { plan, body } = row;
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
  const trOpen = source
    ? (tokens[source.open] as Token)
    : new state.Token("tr_open", "tr", 1);
  if (!source) {
    trOpen.level = level;
  }
  const cellsOut = source
    ? sourceCells(context, { source, keyHtml })
    : virtualCells(context, keyHtml);
  trOpen.attrJoin(
    "class",
    [
      "mdmark-tree-row",
      ...(plan.virtual ? ["is-virtual"] : []),
      ...(plan.hasChildren ? ["has-children"] : []),
    ].join(" "),
  );
  setOwn(trOpen, { name: "data-path", value: plan.path, nonce });
  setOwn(trOpen, { name: "data-parent", value: plan.parent, nonce });
  setOwn(trOpen, { name: "data-depth", value: String(plan.depth), nonce });
  const trClose = source
    ? (tokens[source.close] as Token)
    : new state.Token("tr_close", "tr", -1);
  trClose.level = level;
  return [trOpen, ...cellsOut, trClose];
}

/** 階層の表の行を作るときに引く値（行の深さとセルの数は、本文の最初の行に合わせる） */
function treeContextOf(
  state: StateCore,
  table: { spec: TableSpec; tree: number; sample: RowRange | undefined },
): TreeContext {
  const { spec, tree, sample } = table;
  const tokens = state.tokens;
  return {
    state,
    tokens,
    nonce: envOf(state).nonce,
    spec,
    tree,
    required: spec.treeRequired,
    level: sample ? (tokens[sample.open]?.level ?? 0) : 0,
    columns: sample?.cells.length ?? 0,
  };
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
  const { head, body, bodyOpen, bodyClose } = collectRows(tokens, start, end);
  if (bodyOpen < 0 || bodyClose < 0) {
    return;
  }
  const context = treeContextOf(state, { spec, tree, sample: body[0] });
  // 見出しの行から必須の列を除く
  const dropped = droppedHeadCells(head, spec.treeRequired);
  const keys = body.map((row) => cellText(tokens, row.cells[tree]));
  const rowsOut = planTreeRows(keys).flatMap((plan) =>
    treeRowTokens(context, { plan, body }),
  );
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
  return html.replace(linePattern, (_whole: string, ...groups: string[]) => {
    const [before = "", after = "", rest = ""] = groups;
    const path = paths[index];
    index += 1;
    const pathAttribute =
      path === undefined ? "" : ` data-path="${escapeHtml(path)}"`;
    return `<span${before} class="mdmark-code-line mdmark-yaml-line"${after}${pathAttribute}>${rest}`;
  });
}

/** `meta.role` の値が `role` の `html_block` を、`from` から `step` の向きに探す */
function findRole(
  tokens: Token[],
  search: { from: number; step: 1 | -1; role: string },
): number {
  const { from, step, role } = search;
  for (let index = from; index >= 0 && index < tokens.length; index += step) {
    if ((tokens[index]?.meta as { role?: string } | null)?.role === role) {
      return index;
    }
  }
  return -1;
}

/** タブの範囲を表の直後の見本に移し、表と見本を `div.mdmark-tree-layout` で囲み、次に読むトークンの 1 つ前の位置を返却する */
function wrapTreeExample(
  state: StateCore,
  place: {
    tabs: { from: number; to: number };
    wrapperOpen: number;
    wrapperClose: number;
    id: string;
    example: string;
  },
): number {
  const { tabs, wrapperOpen, wrapperClose, id, example } = place;
  const tokens = state.tokens;
  const moved = tokens.slice(tabs.from, tabs.to + 1).map((moving) => {
    if (moving.type === "html_block") {
      moving.content = linkYamlLines(moving.content);
    }
    return moving;
  });
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
  return close + 1 + moved.length + 2;
}

/** 階層の表 1 つの見本を配置し、次に読むトークンの 1 つ前の位置と、見本を配置したかを返却する。見本の見出しかタブが無ければ記載の警告にする */
function placeTreeExample(
  state: StateCore,
  table: { index: number; example: string; meta: TreeTableMeta; id: string },
): { index: number; placed: boolean } {
  const { index, example, meta, id } = table;
  const tokens = state.tokens;
  const wrapperOpen = findRole(tokens, {
    from: index,
    step: -1,
    role: "table-open",
  });
  const wrapperClose = findRole(tokens, {
    from: findNestedClose(tokens, index),
    step: 1,
    role: "table-close",
  });
  const heading = findHeading(tokens, example);
  const tabs = heading < 0 ? undefined : tabsAfterHeading(tokens, heading);
  if (tabs && wrapperOpen >= 0 && wrapperClose >= 0) {
    return {
      index: wrapTreeExample(state, {
        tabs,
        wrapperOpen,
        wrapperClose,
        id,
        example,
      }),
      placed: true,
    };
  }
  const warning = warningBlock(state, {
    mark: meta.treeMark,
    message: `の \`tree.example.heading\` の見出し \`${example}\` が文書に無いか、直下にタブがありません。見本を配置せずに描いています。`,
  });
  tokens.splice(Math.max(wrapperOpen, index), 0, warning);
  return { index: index + 1, placed: false };
}

/** `example` を持つ階層の表の `table_open` なら、表の指定と見本の見出し */
function treeExampleOf(
  token: Token | undefined,
): { meta: TreeTableMeta; example: string } | undefined {
  const meta = token?.meta as TreeTableMeta | null | undefined;
  const example = meta?.treeSpec?.example;
  if (token?.type !== "table_open" || !meta || example === undefined) {
    return undefined;
  }
  return { meta, example };
}

/** コアルール。`example` を持つ階層の表ごとに、見出しの直下のタブの範囲を表の直後の見本に移し、表と見本を `div.mdmark-tree-layout` で囲む */
export function linkTreeExamples(state: StateCore): void {
  if (!featureOn(state, "table")) {
    return;
  }
  let serial = 0;
  for (let index = 0; index < state.tokens.length; index++) {
    const found = treeExampleOf(state.tokens[index]);
    if (!found) {
      continue;
    }
    const result = placeTreeExample(state, {
      index,
      ...found,
      id: `mdmark-tree-${serial}-example`,
    });
    index = result.index;
    if (result.placed) {
      serial += 1;
    }
  }
}
