import type { StateCore, Token } from "markdown-it";
import type { MarkOptions } from "../render/mark-options.ts";
import type { Mark } from "../render/marks.ts";
import {
  unclosedWarning,
  warningBlock,
} from "../shared/syntax-warning.syntax.ts";
import {
  envOf,
  featureOn,
  findClose,
  markOf,
  textOf,
} from "../shared/tokens.syntax.ts";
import type { MdmarkGlossaryEntry } from "./references.ts";

/** 用語集の表の 1 行から読み込んだ用語と、その行の文書の中の行番号（1 から） */
export type GlossaryRow = {
  entry: MdmarkGlossaryEntry;
  line: number;
};

/** 別名・やめた言い方のセルを区切る文字（「、」と「,」。「・」は別名の中の文字として扱う） */
const ALIAS_SEPARATOR = /[、,]/;

/** 別名・やめた言い方のセルを区切り、前後の空白を落として空のものを除く */
function splitCell(cell: string): string[] {
  return cell
    .split(ALIAS_SEPARATOR)
    .map((word) => word.trim())
    .filter(Boolean);
}

/** 表のトークンから読み込んだ、見出しのセルの文字と本文の行 */
type ReadTable = {
  columns: string[];
  rows: Array<{ cells: string[]; line: number }>;
};

/** 表を読み進める途中の状態 */
type TableReader = {
  tables: ReadTable[];
  table: ReadTable | undefined;
  inHead: boolean;
  row: { cells: string[]; line: number } | undefined;
};

/** 表・見出し・行の開閉のトークンを読む。開閉のトークンでなければ `false` */
function readStructure(reader: TableReader, token: Token): boolean {
  switch (token.type) {
    case "table_open":
      reader.table = { columns: [], rows: [] };
      reader.tables.push(reader.table);
      return true;
    case "thead_open":
      reader.inHead = true;
      return true;
    case "thead_close":
      reader.inHead = false;
      return true;
    case "tr_open":
      if (!reader.inHead) {
        reader.row = { cells: [], line: (token.map?.[0] ?? 0) + 1 };
        reader.table?.rows.push(reader.row);
      }
      return true;
    default:
      return false;
  }
}

/** 見出しのセルの文字を列に、本文のセルの文字を行に追加する */
function readCell(
  reader: TableReader,
  token: Token,
  inline: Token | undefined,
): void {
  if (token.type !== "th_open" && token.type !== "td_open") {
    return;
  }
  const text = inline ? textOf(inline).trim() : "";
  if (token.type === "th_open") {
    reader.table?.columns.push(text);
  } else {
    reader.row?.cells.push(text);
  }
}

/** トークンの並びの中の表を、見出しのセルの文字と本文の行（セルの文字と行番号）に読み込む */
function readTables(tokens: Token[]): ReadTable[] {
  const reader: TableReader = {
    tables: [],
    table: undefined,
    inHead: false,
    row: undefined,
  };
  for (const [position, token] of tokens.entries()) {
    if (!readStructure(reader, token)) {
      readCell(reader, token, tokens[position + 1]);
    }
  }
  return reader.tables;
}

/** 表に無い列名を指したときの記載の警告の本文 */
function unknownColumnMessage(
  argName: string,
  name: string,
  columns: string[],
): string {
  const list = columns.map((column) => `\`${column}\``).join("・");
  return `の \`${argName}.column\` の列 \`${name}\` が表にありません。表の列は ${list} です。列名を修正してください。この表からは用語を入れずに描いています。`;
}

/** 用語集の表の列を指す引数と、必須か */
const GLOSSARY_COLUMNS = [
  ["term", true],
  ["meaning", true],
  ["aliases", false],
  ["avoid", false],
] as const;

/** マーカーの設定が指す列名から、引数ごとの列の位置を読み込む。誤りがあれば最初の誤りを `problem` に返却する（必須の欠けは、マーカーの JSON Schema の記載の警告で通知してあるため空文字） */
function columnPositions(
  spec: MarkOptions,
  columns: string[],
): { positions: Record<string, number> } | { problem: string } {
  const positions: Record<string, number> = {};
  let problem: string | undefined;
  for (const [argName, required] of GLOSSARY_COLUMNS) {
    const name = (spec[argName] as { column?: unknown } | undefined)?.column;
    if (typeof name !== "string" || name === "") {
      if (required) {
        problem ??= "";
      }
      continue;
    }
    const position = columns.indexOf(name);
    if (position === -1) {
      problem ??= unknownColumnMessage(argName, name, columns);
    } else {
      positions[argName] = position;
    }
  }
  return problem === undefined ? { positions } : { problem };
}

/** 表の本文の行から用語を読み込む。用語か意味が空の行は飛ばす */
function tableRows(
  table: ReadTable,
  positions: Record<string, number>,
  docId: string,
): GlossaryRow[] {
  const cellOf = (cells: string[], argName: string): string =>
    cells[positions[argName] ?? -1] ?? "";
  return table.rows.flatMap((row): GlossaryRow[] => {
    const term = cellOf(row.cells, "term");
    const meaning = cellOf(row.cells, "meaning");
    if (term === "" || meaning === "") {
      return [];
    }
    return [
      {
        entry: {
          term,
          aliases: splitCell(cellOf(row.cells, "aliases")),
          meaning,
          docId,
          avoid: splitCell(cellOf(row.cells, "avoid")),
        },
        line: row.line,
      },
    ];
  });
}

/** 範囲の中のトークンの表から、用語・意味・別名・やめた言い方の列を読み込んで行ごとの用語を返却する。誤りがあれば表ごとに用語を入れず、最初の誤りを警告にする */
export function readGlossaryRows(options: {
  options: MarkOptions;
  tokens: Token[];
  docId: string;
}): { rows: GlossaryRow[]; warning?: string } {
  const { options: spec, tokens, docId } = options;
  const rows: GlossaryRow[] = [];
  let warning: string | undefined;
  for (const table of readTables(tokens)) {
    const read = columnPositions(spec, table.columns);
    if ("problem" in read) {
      if (read.problem !== "") {
        warning ??= read.problem;
      }
      continue;
    }
    rows.push(...tableRows(table, read.positions, docId));
  }
  return warning === undefined ? { rows } : { rows, warning };
}

/** 用語集の表を読み込んで用語を返却する。表に無い列名と必須の指定の欠けは、用語を返却せず記載の警告の本文を返却する */
export function readGlossaryTable(options: {
  /** マーカーの設定 */
  options: MarkOptions;
  /** 範囲の中のトークン */
  tokens: Token[];
  /** 表を持つ文書の `id`（索引を指定しないときは空文字） */
  docId: string;
}): { entries: MdmarkGlossaryEntry[]; warning?: string } {
  const { rows, warning } = readGlossaryRows(options);
  const entries = rows.map((row) => row.entry);
  return warning === undefined ? { entries } : { entries, warning };
}

/** 範囲の中の表から用語を読み込んで `env.ownGlossary` に追加し、範囲の前に差し込む警告を返却する。表の中の単語には、下線を付けない */
function collectGlossary(
  state: StateCore,
  range: { token: Token; mark: Mark; tokens: Token[]; closed: boolean },
): Token[] {
  const env = envOf(state);
  const { token, mark, tokens, closed } = range;
  const { rows, warning } = readGlossaryRows({
    options: mark.options,
    tokens,
    docId: env.docId ?? "",
  });
  const out: Token[] = [];
  if (!closed) {
    out.push(warningBlock(state, unclosedWarning(mark), token));
  }
  if (warning !== undefined) {
    out.push(warningBlock(state, { mark: mark.raw, message: warning }, token));
  }
  for (const row of rows) {
    env.ownGlossary.push(row.entry);
    env.glossaryLines?.push(row.line);
  }
  for (const inline of tokens) {
    for (const child of inline.children ?? []) {
      child.meta = { ...child.meta, mdmarkNoTerms: true };
    }
  }
  return out;
}

/** `glossary` のマーカーの範囲を取り除き、中の表を普通の表として残し、読み込んだ用語を `env.ownGlossary` に追加する（行番号は `env.glossaryLines` に同じ並びで追加する） */
export function glossaryRule(state: StateCore): void {
  const enabled = featureOn(state, "glossary");
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let position = 0; position < tokens.length; position++) {
    const token = tokens[position];
    const mark = markOf(token);
    if (!token || mark?.name !== "glossary") {
      if (token) {
        out.push(token);
      }
      continue;
    }
    if (mark.closing) {
      continue;
    }
    const close = findClose(tokens, position, "glossary");
    const end = close === -1 ? tokens.length : close;
    const range = tokens.slice(position + 1, end);
    if (enabled) {
      out.push(
        ...collectGlossary(state, {
          token,
          mark,
          tokens: range,
          closed: close !== -1,
        }),
      );
    }
    out.push(...range);
    position = end;
  }
  state.tokens = out;
}
