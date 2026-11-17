import type { StateCore, Token } from "markdown-it";
import { warningBlock } from "../shared/syntax-warning.syntax.ts";
import { featureOn } from "../shared/tokens.syntax.ts";

/** 表にしたコードブロックの `table_open` の `meta` に持たせる、記載したとおりの CSV */
export type CsvTableMeta = { rawCsv: string };

/** CSV を読み進める途中の状態 */
type CsvReader = {
  text: string;
  at: number;
  rows: string[][];
  row: string[];
  value: string;
  quoted: boolean;
};

/** 読んでいる値を行に入れ、行を閉じる */
const endRow = (reader: CsvReader): void => {
  reader.row.push(reader.value);
  reader.rows.push(reader.row);
  reader.row = [];
  reader.value = "";
};

/** 引用符の中の文字を 1 つ読み、次の位置へ進める。`""` は `"` 1 つにする */
const readQuoted = (reader: CsvReader): void => {
  const char = reader.text[reader.at] as string;
  if (char === '"' && reader.text[reader.at + 1] === '"') {
    reader.value += '"';
    reader.at += 2;
    return;
  }
  if (char === '"') {
    reader.quoted = false;
  } else {
    reader.value += char;
  }
  reader.at += 1;
};

/** 引用符の外の文字を 1 つ読み、次の位置へ進める */
const readPlain = (reader: CsvReader): void => {
  const char = reader.text[reader.at] as string;
  if (char === '"') {
    reader.quoted = true;
  } else if (char === ",") {
    reader.row.push(reader.value);
    reader.value = "";
  } else if (char === "\r" && reader.text[reader.at + 1] === "\n") {
    // CRLF は次の `\n` で行を閉じる
  } else if (char === "\n") {
    endRow(reader);
  } else {
    reader.value += char;
  }
  reader.at += 1;
};

/** RFC 4180 の決まりで、CSV を行と値に分ける。末尾の改行は行にしない */
export const parseCsv = (text: string): string[][] => {
  const reader: CsvReader = {
    text,
    at: 0,
    rows: [],
    row: [],
    value: "",
    quoted: false,
  };
  while (reader.at < text.length) {
    if (reader.quoted) {
      readQuoted(reader);
    } else {
      readPlain(reader);
    }
  }
  // 末尾に改行が無い最後の行
  if (reader.value !== "" || reader.row.length > 0) {
    endRow(reader);
  }
  return reader.rows;
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

/** 表のトークンの開閉（`nesting`）と、表の開始から数えた深さ */
type TagPlace = { nesting: 1 | -1; depth: number };

/** 見出しの行と本文の行から、表のトークンの並びを作る */
const tableTokens = (options: {
  state: StateCore;
  fence: Token;
  rows: string[][];
}): Token[] => {
  const { state, fence, rows } = options;
  const level = fence.level;
  const tokens: Token[] = [];
  const push = (type: string, tag: string, place: TagPlace) => {
    const token = new state.Token(type, tag, place.nesting);
    token.block = true;
    token.level = level + place.depth;
    if (fence.map && place.nesting === 1) {
      token.map = [...fence.map];
    }
    tokens.push(token);
    return token;
  };
  const open = push("table_open", "table", { nesting: 1, depth: 0 });
  open.meta = { rawCsv: fence.content } satisfies CsvTableMeta;
  const [head = [], ...body] = rows;
  push("thead_open", "thead", { nesting: 1, depth: 1 });
  push("tr_open", "tr", { nesting: 1, depth: 2 });
  for (const value of head) {
    push("th_open", "th", { nesting: 1, depth: 3 });
    const inline = cellInline(state, value);
    inline.level = level + 4;
    tokens.push(inline);
    push("th_close", "th", { nesting: -1, depth: 3 });
  }
  push("tr_close", "tr", { nesting: -1, depth: 2 });
  push("thead_close", "thead", { nesting: -1, depth: 1 });
  if (body.length) {
    push("tbody_open", "tbody", { nesting: 1, depth: 1 });
    for (const row of body) {
      push("tr_open", "tr", { nesting: 1, depth: 2 });
      for (const value of row) {
        push("td_open", "td", { nesting: 1, depth: 3 });
        const inline = cellInline(state, value);
        inline.level = level + 4;
        tokens.push(inline);
        push("td_close", "td", { nesting: -1, depth: 3 });
      }
      push("tr_close", "tr", { nesting: -1, depth: 2 });
    }
    push("tbody_close", "tbody", { nesting: -1, depth: 1 });
  }
  push("table_close", "table", { nesting: -1, depth: 0 });
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
