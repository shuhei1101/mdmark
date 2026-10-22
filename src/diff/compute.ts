import { diffChars, diffLines, diffWords } from "diff";

/** 比べた結果の 1 つの切れ */
export type DiffChange = {
  /** 切れの文字 */
  value: string;
  /** 後にだけある切れか */
  added: boolean;
  /** 前にだけある切れか */
  removed: boolean;
};

/** 行と語の比較。既定は jsdiff を包む `jsdiffEngine`、単体テストで差し替える */
export type DiffEngine = {
  /** 行ごとに比べる */
  lines: (pair: { before: string; after: string }) => DiffChange[];
  /** 語ごとに比べる。`segmenter` が無いときは 1 文字ずつ比べる */
  words: (pair: {
    before: string;
    after: string;
    segmenter: Intl.Segmenter | undefined;
  }) => DiffChange[];
};

/** 差分の行の切れ（語）。対の行で変わった語だけ `changed` が true */
export type DiffPart = { text: string; changed: boolean };

/** 比べた 1 行 */
export type DiffLine = {
  /** 同じ行・前にだけある行・後にだけある行 */
  kind: "same" | "del" | "add";
  /** 行の文字を切った並び。対にならない行は 1 つだけで `changed` が false */
  parts: DiffPart[];
};

/** 行の塊か、埋め込んだ HTML の範囲の塊 */
export type DiffBlock =
  | { type: "lines"; lines: DiffLine[] }
  | {
      type: "html";
      lines: DiffLine[];
      /** 範囲の行に `same` 以外があるか */
      changed: boolean;
      /** 前のリビジョンの範囲の `html` のコードブロックの中身。範囲が無ければ `null` */
      before: string | null;
      /** 後のリビジョンの範囲の `html` のコードブロックの中身。範囲が無ければ `null` */
      after: string | null;
    };

/** 比べた結果 */
export type DiffResult = {
  /** 上から順の塊 */
  blocks: DiffBlock[];
  /** 削除した行と追加した行の数。どちらも 0 なら変更が無い */
  counts: { del: number; add: number };
};

/** jsdiff の `diffLines`・`diffWords`・`diffChars` を包んだ既定の計算 */
export const jsdiffEngine: DiffEngine = {
  lines: ({ before, after }) => diffLines(before, after),
  words: ({ before, after, segmenter }) =>
    segmenter === undefined
      ? diffChars(before, after)
      : diffWords(before, after, { intlSegmenter: segmenter }),
};

/** 埋め込んだ HTML の範囲の始まりと終わりの印 */
const HTML_OPEN = "<!-- html -->";
const HTML_CLOSE = "<!-- /html -->";

/** `html` のコードブロックの囲み */
const FENCE_PATTERN = /^\s*(```|~~~)/;

/** 切れの値を行に分ける。末尾の改行で出る空の行は数えない */
function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines;
}

/** 行ごとの比較の結果を、消した行を先・足した行を後に並べた行の並びにする。対の行は語ごとに比べる */
function toLines(options: {
  changes: DiffChange[];
  segmenter: Intl.Segmenter | undefined;
  engine: DiffEngine;
}): DiffLine[] {
  const { changes, segmenter, engine } = options;
  const out: DiffLine[] = [];
  /** 変えた塊 1 つ分の消した行と足した行 */
  let dels: string[] = [];
  let adds: string[] = [];
  const flush = (): void => {
    const pairs = dels.map((text, position) => {
      const added = adds[position];
      return added === undefined
        ? undefined
        : engine.words({ before: text, after: added, segmenter });
    });
    dels.forEach((text, position) => {
      const words = pairs[position];
      out.push({
        kind: "del",
        parts:
          words === undefined
            ? [{ text, changed: false }]
            : partsOf(words, "removed"),
      });
    });
    adds.forEach((text, position) => {
      const words = pairs[position];
      out.push({
        kind: "add",
        parts:
          words === undefined
            ? [{ text, changed: false }]
            : partsOf(words, "added"),
      });
    });
    dels = [];
    adds = [];
  };
  for (const change of changes) {
    if (change.removed) {
      dels.push(...splitLines(change.value));
    } else if (change.added) {
      adds.push(...splitLines(change.value));
    } else {
      flush();
      for (const text of splitLines(change.value)) {
        out.push({ kind: "same", parts: [{ text, changed: false }] });
      }
    }
  }
  flush();
  return out;
}

/** 語ごとの比較の結果から、片側（消した側は `removed`、足した側は `added`）の切れの並びを作る */
function partsOf(changes: DiffChange[], side: "removed" | "added"): DiffPart[] {
  const other = side === "removed" ? "added" : "removed";
  return changes
    .filter((change) => !change[other])
    .map((change) => ({ text: change.value, changed: change[side] }));
}

/** 行の文字をつなぐ */
function textOf(line: DiffLine): string {
  return line.parts.map((part) => part.text).join("");
}

/** 範囲の側の行から、`html` のコードブロックの中身を取り出す。範囲の行が無ければ `null` */
function extractHtml(lines: DiffLine[]): string | null {
  if (lines.length === 0) {
    return null;
  }
  const texts = lines.map(textOf);
  const open = texts.findIndex((text) => FENCE_PATTERN.test(text));
  let close = -1;
  for (let index = texts.length - 1; index > open; index -= 1) {
    if (FENCE_PATTERN.test(texts[index] ?? "")) {
      close = index;
      break;
    }
  }
  if (open < 0 || close < 0) {
    return "";
  }
  return texts.slice(open + 1, close).join("\n");
}

/** 行の並びを、埋め込んだ HTML の範囲の塊とその外の行の塊に分ける */
function toBlocks(lines: DiffLine[]): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  let range: DiffLine[] | undefined;
  /** 範囲の塊を閉じる */
  const closeRange = (): void => {
    if (range === undefined) {
      return;
    }
    const beforeLines = range.filter((line) => line.kind !== "add");
    const afterLines = range.filter((line) => line.kind !== "del");
    blocks.push({
      type: "html",
      lines: range,
      changed: range.some((line) => line.kind !== "same"),
      before: extractHtml(beforeLines),
      after: extractHtml(afterLines),
    });
    range = undefined;
  };
  for (const line of lines) {
    const text = textOf(line).trim();
    if (range === undefined && text === HTML_OPEN) {
      range = [line];
    } else if (range !== undefined) {
      range.push(line);
      if (text === HTML_CLOSE) {
        closeRange();
      }
    } else {
      const last = blocks.at(-1);
      if (last?.type === "lines") {
        last.lines.push(line);
      } else {
        blocks.push({ type: "lines", lines: [line] });
      }
    }
  }
  closeRange();
  return blocks;
}

/** 2 つの Markdown のソースを行ごとに比べ、対の行を語ごとに比べ、埋め込んだ HTML の範囲を塊に分ける */
export function computeDiff(options: {
  /** 前の Markdown */
  before: string;
  /** 後の Markdown */
  after: string;
  /** 語の区切り。持たないブラウザでは `undefined` */
  segmenter: Intl.Segmenter | undefined;
  /** 比較の計算。既定は `jsdiffEngine` */
  engine?: DiffEngine;
}): DiffResult {
  const { before, after, segmenter, engine = jsdiffEngine } = options;
  const lines = toLines({
    changes: engine.lines({ before, after }),
    segmenter,
    engine,
  });
  const counts = {
    del: lines.filter((line) => line.kind === "del").length,
    add: lines.filter((line) => line.kind === "add").length,
  };
  return { blocks: toBlocks(lines), counts };
}
