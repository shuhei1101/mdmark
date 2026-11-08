import type { StateCore, Token } from "markdown-it";
import { featureOn } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** 表にしたコードブロックの `table_open` の `meta` に持たせる、記載したとおりの CSV */
export type CsvTableMeta = { rawCsv: string };

/** RFC 4180 の決まりで、CSV を行と値に分ける。末尾の改行は行にしない */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let at = 0;
  while (at < text.length) {
    const char = text[at] as string;
    if (quoted) {
      if (char === '"' && text[at + 1] === '"') {
        value += '"';
        at += 2;
        continue;
      }
      if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      at += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\r" && text[at + 1] === "\n") {
      // CRLF は次の `\n` で行を閉じる
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
    at += 1;
  }
  // 末尾に改行が無い最後の行
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
};

/** 値を、改行を `<br>` にした行内のトークンにする */
const cellInline = (state: StateCore, value: string): Token => {
  const inline = new state.Token("inline", "", 0);
  inline.content = value;
  inline.children = value.split(/\r?\n/).flatMap((line, index) => {
    const text = new state.Token("text", "", 0);
    text.content = line;
    if (index === 0) {
      return [text];
    }
    const hardbreak = new state.Token("hardbreak", "br", 0);
    return [hardbreak, text];
  });
  return inline;
};

/** 見出しの行と本文の行から、表のトークンの並びを作る */
const tableTokens = (options: {
  state: StateCore;
  fence: Token;
  rows: string[][];
}): Token[] => {
  const { state, fence, rows } = options;
  const level = fence.level;
  const tokens: Token[] = [];
  const push = (
    type: string,
    tag: string,
    nesting: 1 | 0 | -1,
    depth: number,
  ) => {
    const token = new state.Token(type, tag, nesting);
    token.block = true;
    token.level = level + depth;
    if (fence.map && nesting === 1) {
      token.map = [...fence.map];
    }
    tokens.push(token);
    return token;
  };
  const open = push("table_open", "table", 1, 0);
  open.meta = { rawCsv: fence.content } satisfies CsvTableMeta;
  const [head = [], ...body] = rows;
  push("thead_open", "thead", 1, 1);
  push("tr_open", "tr", 1, 2);
  for (const value of head) {
    push("th_open", "th", 1, 3);
    const inline = cellInline(state, value);
    inline.level = level + 4;
    tokens.push(inline);
    push("th_close", "th", -1, 3);
  }
  push("tr_close", "tr", -1, 2);
  push("thead_close", "thead", -1, 1);
  if (body.length) {
    push("tbody_open", "tbody", 1, 1);
    for (const row of body) {
      push("tr_open", "tr", 1, 2);
      for (const value of row) {
        push("td_open", "td", 1, 3);
        const inline = cellInline(state, value);
        inline.level = level + 4;
        tokens.push(inline);
        push("td_close", "td", -1, 3);
      }
      push("tr_close", "tr", -1, 2);
    }
    push("tbody_close", "tbody", -1, 1);
  }
  push("table_close", "table", -1, 0);
  return tokens;
};

/** `csv` がオンなら、言語 `csv` で中身が空でないコードブロックを、1 行目を見出しにした表のトークンにする。列の数が見出しと違う行はそろえて警告を差し込む */
export const buildCsvTables = (state: StateCore): void => {
  if (!featureOn(state, "csv")) {
    return;
  }
  state.tokens = state.tokens.flatMap((token) => {
    const language = token.info.trim().split(/\s+/)[0];
    if (token.type !== "fence" || language !== "csv" || !token.content.trim()) {
      return [token];
    }
    const rows = parseCsv(token.content);
    const width = rows[0]?.length ?? 0;
    const mismatched: number[] = [];
    const fitted = rows.map((row, index) => {
      if (row.length === width) {
        return row;
      }
      mismatched.push(index + 1);
      return Array.from({ length: width }, (_, column) => row[column] ?? "");
    });
    const tokens = tableTokens({ state, fence: token, rows: fitted });
    if (mismatched.length === 0) {
      return tokens;
    }
    const lines = mismatched.map((line) => `${line} 行目`).join("・");
    return [
      warningBlock(state, {
        message: `CSV の ${lines}の列の数が、見出しの行の ${width} 列と違います。見出しの列の数にそろえて表示しています。`,
      }),
      ...tokens,
    ];
  });
};
