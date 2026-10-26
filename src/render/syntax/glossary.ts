import type { StateCore, Token } from "markdown-it";
import type { MdmarkMarkArgs } from "../../extensions.ts";
import type { MdmarkGlossaryEntry } from "../../knowledge/references.ts";
import { envOf, featureOn, findClose, markOf, textOf } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** 用語集の表の 1 行から読んだ用語と、その行の文書の中の行番号（1 から） */
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

/** 表のトークンから読んだ、見出しのセルの文字と本文の行 */
type ReadTable = {
  columns: string[];
  rows: Array<{ cells: string[]; line: number }>;
};

/** トークンの並びの中の表を、見出しのセルの文字と本文の行（セルの文字と行番号）に読む */
function readTables(tokens: Token[]): ReadTable[] {
  const tables: ReadTable[] = [];
  let table: ReadTable | undefined;
  let inHead = false;
  let row: { cells: string[]; line: number } | undefined;
  for (const [position, token] of tokens.entries()) {
    if (token.type === "table_open") {
      table = { columns: [], rows: [] };
      tables.push(table);
    } else if (token.type === "thead_open") {
      inHead = true;
    } else if (token.type === "thead_close") {
      inHead = false;
    } else if (token.type === "tr_open" && !inHead) {
      row = { cells: [], line: (token.map?.[0] ?? 0) + 1 };
      table?.rows.push(row);
    } else if (token.type === "th_open" || token.type === "td_open") {
      const inline = tokens[position + 1];
      const text = inline ? textOf(inline).trim() : "";
      if (token.type === "th_open") {
        table?.columns.push(text);
      } else {
        row?.cells.push(text);
      }
    }
  }
  return tables;
}

/** 表に無い列名を指したときの書き方の警告の本文 */
function unknownColumnMessage(
  argName: string,
  name: string,
  columns: string[],
): string {
  const list = columns.map((column) => `\`${column}\``).join("・");
  return `の \`${argName}=\` の列 \`${name}\` が表にありません。表の列は ${list} です。列名を直してください。この表からは用語を入れずに描いています。`;
}

/** 必須の指定が無いときの書き方の警告の本文 */
function missingArgMessage(argName: string): string {
  const column = argName === "term" ? "用語" : "意味";
  return `に \`${argName}=\` がありません。${column}の列を \`${argName}=列名\` で指してください。この表からは用語を入れずに描いています。`;
}

/** 範囲の中のトークンの表から、用語・意味・別名・やめた言い方の列を読んで行ごとの用語を返す。誤りがあれば表ごとに用語を入れず、最初の誤りを警告にする */
export function readGlossaryRows(options: {
  args: MdmarkMarkArgs;
  tokens: Token[];
  docId: string;
}): { rows: GlossaryRow[]; warning?: string } {
  const { args, tokens, docId } = options;
  const rows: GlossaryRow[] = [];
  let warning: string | undefined;
  for (const table of readTables(tokens)) {
    const positions: Record<string, number> = {};
    let problem: string | undefined;
    for (const [argName, required] of [
      ["term", true],
      ["meaning", true],
      ["aliases", false],
      ["avoid", false],
    ] as const) {
      const name = args.keys[argName];
      if (name === undefined || name === "") {
        if (required && problem === undefined) {
          problem = missingArgMessage(argName);
        }
        continue;
      }
      const position = table.columns.indexOf(name);
      if (position === -1) {
        problem ??= unknownColumnMessage(argName, name, table.columns);
      } else {
        positions[argName] = position;
      }
    }
    if (problem !== undefined) {
      warning ??= problem;
      continue;
    }
    for (const row of table.rows) {
      const term = row.cells[positions.term ?? -1] ?? "";
      const meaning = row.cells[positions.meaning ?? -1] ?? "";
      // 用語か意味が空の行は飛ばす
      if (term === "" || meaning === "") {
        continue;
      }
      rows.push({
        entry: {
          term,
          aliases: splitCell(row.cells[positions.aliases ?? -1] ?? ""),
          meaning,
          docId,
          avoid: splitCell(row.cells[positions.avoid ?? -1] ?? ""),
        },
        line: row.line,
      });
    }
  }
  return warning === undefined ? { rows } : { rows, warning };
}

/** 用語集の表を読んで用語を返す。表に無い列名と必須の指定の欠けは、用語を返さず書き方の警告の本文を返す */
export function readGlossaryTable(options: {
  /** 印の引数 */
  args: MdmarkMarkArgs;
  /** 範囲の中のトークン */
  tokens: Token[];
  /** 表を持つ文書の `id`（索引を渡さないときは空文字） */
  docId: string;
}): { entries: MdmarkGlossaryEntry[]; warning?: string } {
  const { rows, warning } = readGlossaryRows(options);
  const entries = rows.map((row) => row.entry);
  return warning === undefined ? { entries } : { entries, warning };
}

/** `glossary` の印の範囲を取り除き、中の表を普通の表として残し、読んだ用語を `env.ownGlossary` に足す（行番号は `env.glossaryLines` に同じ並びで足す） */
export function glossaryRule(state: StateCore): void {
  const env = envOf(state);
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
      const { rows, warning } = readGlossaryRows({
        args: mark.args,
        tokens: range,
        docId: env.docId ?? "",
      });
      if (close === -1) {
        out.push(warningBlock(state, unclosedWarning(mark)));
      }
      if (warning !== undefined) {
        out.push(warningBlock(state, { mark: mark.raw, message: warning }));
      }
      for (const row of rows) {
        env.ownGlossary.push(row.entry);
        env.glossaryLines?.push(row.line);
      }
      // 表の中の語には、下線を引かない
      for (const inline of range) {
        for (const child of inline.children ?? []) {
          child.meta = { ...child.meta, mdmarkNoTerms: true };
        }
      }
    }
    out.push(...range);
    position = end;
  }
  state.tokens = out;
}
