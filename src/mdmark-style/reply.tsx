import {
  type StyleColorName,
  styleColor,
} from "../shared/style-tokens.logic.ts";
import { type ReplyBlock, splitBlocks } from "./blocks.ts";
import {
  renderRowDetail,
  renderStack,
  renderSteps,
  renderTree,
} from "./document-parts.tsx";
import { inlinePlainText, splitInlineMarks } from "./inline-marks.ts";
import { readSettings, SettingsError, type StyleSettings } from "./settings.ts";
import { displayWidth, fitColumns, wrapCell } from "./table-layout.ts";
import type { TermMark } from "./terms.ts";
import {
  type Elements,
  type RenderEngine,
  type RenderEvent,
  renderFootnotes,
  renderTermText,
  termMarksOf,
  type UiNode,
} from "./user-message.tsx";

/** mod の環境が持つ JSX の factory */
declare const h: (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => UiNode;

/** 超えると Claude Code が描かない部品の木の大きさ */
export const TREE_LIMITS = { nodes: 20_000, depth: 32, chars: 100_000 };

/** ブロックを描く文脈 */
export type RenderContext = {
  elements: Elements;
  surface: string;
  columns?: number;
  theme: string | undefined;
  /** 開閉の状態の鍵の頭（`requestId` とブロックの本文のハッシュ） */
  blockKey: string;
  parts: StyleSettings["parts"];
  /** 本文の用語のマーカー（行は本文の頭から） */
  marks: TermMark[];
  ui: Pick<RenderEngine["ui"], "copy" | "invalidate">;
};

/** 開閉の状態。Claude Code を閉じると消える */
export const foldStates = new Map<string, boolean>();

/** 注意書きの種類から色の名前 */
const CALLOUT_COLORS: Record<string, StyleColorName> = {
  NOTE: "calloutNote",
  TIP: "calloutTip",
  IMPORTANT: "calloutImportant",
  WARNING: "calloutWarning",
  CAUTION: "calloutCaution",
};

/** コードの行のマーカーの記号と色 */
const CODE_MARK_STYLES: Record<string, { prefix: string; color: string }> = {
  "++": { prefix: "+", color: "#3fb950" },
  "--": { prefix: "-", color: "#f85149" },
  highlight: { prefix: "▍", color: "#d29922" },
  focus: { prefix: "▍", color: "#58a6ff" },
  error: { prefix: "✕", color: "#f85149" },
  warning: { prefix: "!", color: "#d29922" },
};

/** 本文のハッシュ（FNV-1a の 32 ビット）を 16 進で返却する */
const hashText = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

/** 開閉のボタンと、開いているときの中身を描く。押すと状態を反転して描き直す */
export const renderFold = (options: {
  key: string;
  title: string;
  body: () => UiNode;
  context: RenderContext;
}): UiNode => {
  const { key, title, body, context } = options;
  const { Box, Button } = context.elements;
  const open = foldStates.get(key) ?? false;
  const toggle = () => {
    foldStates.set(key, !(foldStates.get(key) ?? false));
    context.ui.invalidate("ui.render");
  };
  return h(
    Box,
    { key, flexDirection: "column" },
    h(Button, {
      key: `${key}:button`,
      label: `${open ? "▾" : "▸"} ${title}`,
      onPress: toggle,
    }),
    open ? body() : undefined,
  );
};

/** 表の罫線の 1 行 */
const ruleLine = (widths: number[], [left, middle, right]: string[]): string =>
  `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`;

/** 表の行（折り返したセル）を、行ごとの文字列にする */
const rowLines = (options: {
  cells: string[];
  widths: number[];
  wrap: boolean;
}) => {
  const { cells, widths, wrap } = options;
  const wrapped = widths.map((width, index) => {
    const text = cells[index] ?? "";
    return wrap ? wrapCell({ text, width }) : [text];
  });
  const height = Math.max(1, ...wrapped.map((lines) => lines.length));
  return Array.from({ length: height }, (_, row) =>
    wrapped.map((lines, index) => {
      const text = lines[row] ?? "";
      const pad = (widths[index] ?? 0) - displayWidth(text);
      return `${text}${" ".repeat(Math.max(0, pad))}`;
    }),
  );
};

/** 行の詳細の開閉の Button の文字と、後ろの空白 */
const ROW_TOGGLE_TEXT = "[ ▸ ] ";

/** セルの文字が行内の記法を含めば真 */
const hasInline = (cell: string, context: RenderContext): boolean =>
  context.parts.inline &&
  splitInlineMarks(cell).some((segment) => segment.kind !== "text");

/** セルの、画面に描かれる文字 */
const cellText = (cell: string, context: RenderContext): string =>
  context.parts.inline ? inlinePlainText(splitInlineMarks(cell)) : cell;

/** 表を罫線で囲んで描く */
const renderTable = (block: ReplyBlock, context: RenderContext): UiNode => {
  const table = block.table;
  const { Box, Text } = context.elements;
  if (table === undefined) {
    return undefined;
  }
  const detailRows = new Set((table.details ?? []).map((detail) => detail.row));
  const shown = (row: string[], rowIndex: number | undefined) =>
    row.map((cell, index) => {
      const text = cellText(cell, context);
      return index === 0 && rowIndex !== undefined && detailRows.has(rowIndex)
        ? `${ROW_TOGGLE_TEXT}${text}`
        : text;
    });
  const cells = [
    shown(table.header, undefined),
    ...table.rows.map((row, index) => shown(row, index)),
  ];
  const wrap = context.surface !== "desktop";
  const widths = fitColumns({
    cells,
    ...(context.columns === undefined ? {} : { columns: context.columns }),
    wrap,
  });
  const border = styleColor({ name: "border", theme: context.theme });
  /** 1 行の、セルごとの部品。行内の記法は 1 行に収まるセルだけに描き、行の詳細の Button は行の 1 行目の先頭のセルに描く */
  const cellNodes = (options: {
    raw: string[] | undefined;
    columns: string[];
    bold: boolean;
    toggle: UiNode | undefined;
  }): { nodes: UiNode[]; rich: boolean } => {
    let rich = false;
    const nodes = options.columns.map((cell, index) => {
      const raw = options.raw?.[index];
      const toggle = index === 0 ? options.toggle : undefined;
      if (raw === undefined && toggle !== undefined) {
        rich = true;
        const rest = cell.startsWith(ROW_TOGGLE_TEXT)
          ? cell.slice(ROW_TOGGLE_TEXT.length)
          : cell;
        return [
          toggle,
          h(Text, null, " "),
          h(Text, options.bold ? { bold: true } : null, rest),
        ];
      }
      if (
        raw === undefined ||
        (toggle === undefined && !hasInline(raw, context))
      ) {
        return h(Text, options.bold ? { bold: true } : null, cell);
      }
      rich = true;
      const drawn = `${toggle === undefined ? "" : ROW_TOGGLE_TEXT}${cellText(raw, context)}`;
      const pad = " ".repeat(
        Math.max(0, (widths[index] ?? 0) - displayWidth(drawn)),
      );
      return [
        toggle,
        toggle === undefined ? undefined : h(Text, null, " "),
        renderTermText({
          elements: context.elements,
          line: raw,
          marks: [],
          parts: context.parts,
          theme: context.theme,
          ...(options.bold ? { base: { bold: true } } : {}),
        }),
        h(Text, null, pad),
      ];
    });
    return { nodes, rich };
  };
  const lineNode = (
    key: string,
    columns: string[],
    options: {
      bold: boolean;
      raw?: string[];
      toggle?: UiNode;
    },
  ) => {
    const { nodes, rich } = cellNodes({
      raw: options.raw,
      columns,
      bold: options.bold,
      toggle: options.toggle,
    });
    const children = [
      h(Text, { color: border }, "│ "),
      ...nodes.flatMap((node, index) => [
        node,
        h(Text, { color: border }, index === nodes.length - 1 ? " │" : " │ "),
      ]),
    ];
    return rich
      ? h(Box, { key, flexDirection: "row" }, ...children)
      : h(Text, { key }, ...children);
  };
  /** 見出しか本文の 1 行を、折り返した行ごとの部品にする */
  const rowNodes = (options: {
    key: string;
    raw: string[];
    shownCells: string[];
    bold: boolean;
    toggle?: UiNode;
  }): UiNode[] => {
    const lines = rowLines({ cells: options.shownCells, widths, wrap });
    const single = lines.length === 1;
    return lines.map((columns, index) =>
      lineNode(`${options.key}-${index}`, columns, {
        bold: options.bold,
        ...(single ? { raw: options.raw } : {}),
        ...(index === 0 && options.toggle !== undefined
          ? { toggle: options.toggle }
          : {}),
      }),
    );
  };
  const bold = table.kind === "data";
  const bodyLines = table.rows.flatMap((row, rowIndex) => {
    const detail = table.details?.find((item) => item.row === rowIndex);
    if (detail === undefined) {
      return rowNodes({
        key: `row-${rowIndex}`,
        raw: row,
        shownCells: shown(row, rowIndex),
        bold: false,
      });
    }
    const { toggle, detail: opened } = renderRowDetail({
      key: `${context.blockKey}:row-detail:${block.line}:${rowIndex}`,
      body: () =>
        h(
          Box,
          { flexDirection: "column" },
          ...detail.body.map((inner) => renderBlock({ block: inner, context })),
        ),
      context,
    });
    return [
      ...rowNodes({
        key: `row-${rowIndex}`,
        raw: row,
        shownCells: shown(row, rowIndex),
        bold: false,
        toggle,
      }),
      opened,
    ];
  });
  const lines: UiNode[] = [
    table.figure === undefined
      ? undefined
      : h(Text, { key: "figure", dimColor: true }, `表 ${table.figure}`),
    h(Text, { key: "top", color: border }, ruleLine(widths, ["┌", "┬", "┐"])),
    ...rowNodes({
      key: "head",
      raw: table.header,
      shownCells: shown(table.header, undefined),
      bold,
    }),
    h(Text, { key: "sep", color: border }, ruleLine(widths, ["├", "┼", "┤"])),
    ...bodyLines,
    h(
      Text,
      { key: "bottom", color: border },
      ruleLine(widths, ["└", "┴", "┘"]),
    ),
  ];
  const total =
    widths.reduce((sum, width) => sum + width, 0) + widths.length * 3 + 1;
  const scroll =
    context.surface === "desktop" &&
    context.columns !== undefined &&
    total > context.columns;
  return h(
    Box,
    {
      key: `table-${block.line}`,
      flexDirection: "column",
      ...(scroll ? { overflowX: "scroll" } : {}),
    },
    ...lines,
  );
};

/** コードブロックを背景の面で描く */
const renderCode = (block: ReplyBlock, context: RenderContext): UiNode => {
  const code = block.code;
  const { Box, Text, Button, Code } = context.elements;
  if (code === undefined) {
    return undefined;
  }
  const source = code.lines.map((line) => line.text).join("\n");
  const head = [code.title, code.lang]
    .filter((item) => item !== undefined && item !== "")
    .join("  ");
  const digits = String(code.lines.length).length;
  return h(
    Box,
    {
      key: `code-${block.line}`,
      flexDirection: "column",
      backgroundColor: styleColor({
        name: "codeBackground",
        theme: context.theme,
      }),
      paddingX: 1,
    },
    h(
      Box,
      { flexDirection: "row", justifyContent: "space-between" },
      h(Text, { dimColor: true }, head),
      h(Button, {
        key: `${context.blockKey}:copy:${block.line}`,
        label: "コピー",
        onPress: () =>
          context.ui.copy({ text: source, surface: context.surface }),
      }),
    ),
    ...code.lines.map((line, index) => {
      const style =
        line.mark === undefined ? undefined : CODE_MARK_STYLES[line.mark];
      return h(
        Box,
        { key: `line-${index}`, flexDirection: "row" },
        code.lineNumbers
          ? h(
              Text,
              { dimColor: true },
              `${String(index + 1).padStart(digits)} `,
            )
          : undefined,
        h(
          Text,
          style === undefined ? { dimColor: true } : { color: style.color },
          `${style?.prefix ?? " "} `,
        ),
        h(Code, {
          source: line.text,
          ...(code.lang === "" ? {} : { language: code.lang }),
        }),
      );
    }),
  );
};

/** 返答の本文の行での用語の位置を、ブロックの行の中の位置に修正する。ブロックの行に用語の文字が無ければ返却しない */
const markInLine = (
  mark: TermMark,
  columns: number[] | undefined,
): TermMark | undefined => {
  if (columns === undefined) {
    return mark;
  }
  const start = columns.findIndex((column) => column >= mark.start);
  const end = columns.filter((column) => column < mark.end).length;
  return start < 0 || end <= start ? undefined : { ...mark, start, end };
};

/** ブロックの行ごとの、行の中の位置に修正した用語の一致 */
const marksByLine = (
  block: ReplyBlock,
  lines: string[],
  marks: TermMark[],
): TermMark[][] =>
  lines.map((_line, index) =>
    marks
      .filter((mark) => mark.line === block.line + index)
      .map((mark) => markInLine(mark, block.columns?.[index]))
      .filter((mark): mark is TermMark => mark !== undefined),
  );

/** 段落・箇条書き。用語のマーカーか行内の記法があれば行ごとに用語の部品で描き、無ければ `Markdown` 部品に任せる */
const renderMarkdown = (block: ReplyBlock, context: RenderContext): UiNode => {
  const { Box, Markdown } = context.elements;
  const markdown = block.markdown ?? "";
  const lines = markdown.split("\n");
  const lineMarks = marksByLine(block, lines, context.marks);
  const marks = lineMarks.flat();
  if (marks.length === 0 && !lines.some((line) => hasInline(line, context))) {
    return h(Markdown, { key: `md-${block.line}`, text: markdown });
  }
  return h(
    Box,
    { key: `md-${block.line}`, flexDirection: "column" },
    ...lines.map((line, index) =>
      renderTermText({
        elements: context.elements,
        line,
        marks: lineMarks[index] ?? [],
        parts: context.parts,
        theme: context.theme,
        ...(context.columns === undefined ? {} : { width: context.columns }),
      }),
    ),
  );
};

/** 注意書きを種類の色の縦線とラベルで描く */
const renderCallout = (block: ReplyBlock, context: RenderContext): UiNode => {
  const callout = block.callout;
  const { Box, Text } = context.elements;
  if (callout === undefined) {
    return undefined;
  }
  const color = styleColor({
    name: CALLOUT_COLORS[callout.type] ?? "calloutNote",
    theme: context.theme,
  });
  const label = callout.title ?? callout.type;
  const content = () =>
    h(
      Box,
      { key: `callout-${block.line}`, flexDirection: "row" },
      h(Text, { color }, "┃ "),
      h(
        Box,
        { flexDirection: "column" },
        callout.closed ? undefined : h(Text, { bold: true, color }, label),
        ...callout.body.map((inner) => renderBlock({ block: inner, context })),
      ),
    );
  if (!callout.closed || block.fold === undefined) {
    return content();
  }
  return renderFold({
    key: `${context.blockKey}:${block.fold.index}`,
    title: label,
    body: content,
    context,
  });
};

/** 中身のブロックの並びを、縦に並べた部品の木にする関数 */
const renderBlocks =
  (context: RenderContext) =>
  (blocks: ReplyBlock[]): UiNode =>
    h(
      context.elements.Box,
      { flexDirection: "column" },
      ...blocks.map((inner) => renderBlock({ block: inner, context })),
    );

/** `ReplyBlock` 1 つを部品の木にする */
export const renderBlock = (options: {
  block: ReplyBlock;
  context: RenderContext;
}): UiNode => {
  const { block, context } = options;
  const { Box, Text } = context.elements;
  switch (block.kind) {
    case "table":
      return renderTable(block, context);
    case "heading": {
      const text = block.heading?.text ?? "";
      const props = {
        bold: true,
        color: styleColor({ name: "heading", theme: context.theme }),
      };
      if (hasInline(text, context)) {
        return h(
          Box,
          { key: `heading-${block.line}` },
          renderTermText({
            elements: context.elements,
            line: text,
            marks: [],
            parts: context.parts,
            theme: context.theme,
            base: props,
          }),
        );
      }
      return h(Text, { key: `heading-${block.line}`, ...props }, text);
    }
    case "callout":
      return renderCallout(block, context);
    case "code":
      return renderCode(block, context);
    case "fold": {
      const fold = block.fold;
      if (fold === undefined) {
        return undefined;
      }
      return renderFold({
        key: `${context.blockKey}:${fold.index}`,
        title: fold.title,
        body: () =>
          h(
            Box,
            { flexDirection: "column", paddingLeft: 2 },
            ...fold.body.map((inner) => renderBlock({ block: inner, context })),
          ),
        context,
      });
    }
    case "steps":
      return renderSteps({ block, context, renderBody: renderBlocks(context) });
    case "tree":
      return renderTree({ block, context });
    case "stack":
      return renderStack({ block, context, renderBody: renderBlocks(context) });
    case "markdown":
      return renderMarkdown(block, context);
    default: {
      const unreachable: never = block.kind;
      return unreachable;
    }
  }
};

/** 子のノードの並び（`children` か `props.children`） */
const childrenOf = (node: unknown): unknown[] => {
  if (typeof node !== "object" || node === null) {
    return [];
  }
  const record = node as { children?: unknown; props?: { children?: unknown } };
  const children = record.children ?? record.props?.children;
  if (children === undefined) {
    return [];
  }
  return Array.isArray(children) ? children : [children];
};

/** 部品の木のノードの数・深さ・文字数を数え、`TREE_LIMITS` を超えたらその時点で数えるのをやめる */
export const countTree = (
  node: UiNode,
): { nodes: number; depth: number; chars: number; over: boolean } => {
  const count = { nodes: 0, depth: 0, chars: 0, over: false };
  const visit = (current: unknown, depth: number): void => {
    if (
      count.over ||
      current === undefined ||
      current === null ||
      current === false
    ) {
      return;
    }
    if (typeof current === "string" || typeof current === "number") {
      count.chars += String(current).length;
    } else {
      count.nodes += 1;
      count.depth = Math.max(count.depth, depth);
      for (const child of childrenOf(current)) {
        visit(child, depth + 1);
      }
    }
    count.over =
      count.nodes > TREE_LIMITS.nodes ||
      count.depth > TREE_LIMITS.depth ||
      count.chars > TREE_LIMITS.chars;
  };
  visit(node, 1);
  return count;
};

/** `AssistantMessage` の `ui.render` で、設定と用語集を読み込み、ブロックを部品の木にして返却する */
export async function renderReply(
  $: RenderEngine,
  e: RenderEvent,
  next: (e: RenderEvent) => Promise<UiNode>,
): Promise<UiNode> {
  let settings: StyleSettings;
  try {
    settings = await readSettings($);
  } catch (error) {
    if (!(error instanceof SettingsError)) {
      throw error;
    }
    $.ui.log(error.message, { to: "debug" });
    return next(e);
  }
  if (!settings.enabled || !settings.targets.includes("assistant")) {
    return next(e);
  }
  const text = e.props.text;
  const blocks = splitBlocks({ text, parts: settings.parts });
  const marks = await termMarksOf($, { settings, text });
  const elements = $.ui.resolve(e as never);
  const theme = (await $.settings.read({ key: "theme" })) as string | undefined;
  const columns = e.viewport?.columns;
  const context: RenderContext = {
    elements,
    surface: e.surface,
    ...(columns === undefined ? {} : { columns }),
    theme,
    blockKey: `${e.requestId ?? ""}:${hashText(text)}`,
    parts: settings.parts,
    marks,
    ui: {
      copy: (args) => $.ui.copy(args),
      invalidate: (event) => $.ui.invalidate(event),
    },
  };
  const tree = h(
    elements.Box,
    { flexDirection: "column" },
    ...blocks.map((block) => renderBlock({ block, context })),
    ...(settings.parts.footnote ? renderFootnotes({ elements, marks }) : []),
  );
  return countTree(tree).over ? next(e) : tree;
}
