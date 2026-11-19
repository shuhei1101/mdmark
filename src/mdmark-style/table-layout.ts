/** 罫線と余白の幅を数えるときの、列ごとの幅（左右の空白と区切りの線） */
const COLUMN_PADDING = 3;

/** 列を縮めるときに残す最小の幅 */
const MIN_COLUMN_WIDTH = 4;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** 端末で 2 桁を使う文字（East Asian Width の W・F と絵文字） */
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}/u;

/** 幅を持たない結合文字 */
const ZERO_WIDTH = /^[\p{Mn}\p{Me}​-‏]+$/u;

/** 書記素 1 つの表示幅 */
const graphemeWidth = (grapheme: string): number => {
  if (ZERO_WIDTH.test(grapheme)) {
    return 0;
  }
  return WIDE.test(grapheme) ? 2 : 1;
};

/** 文字列の端末の表示幅を数える */
export const displayWidth = (text: string): number => {
  let width = 0;
  for (const { segment } of SEGMENTER.segment(text)) {
    width += graphemeWidth(segment);
  }
  return width;
};

/** 空白と全角の文字の境で単語に分ける。空白は前の単語の後ろに付けたまま残す */
const splitWords = (text: string): string[] => {
  const words: string[] = [];
  let current = "";
  for (const { segment } of SEGMENTER.segment(text)) {
    const wide = graphemeWidth(segment) === 2;
    if (wide) {
      if (current !== "") {
        words.push(current);
      }
      words.push(segment);
      current = "";
    } else if (segment === " ") {
      words.push(`${current} `);
      current = "";
    } else {
      current += segment;
    }
  }
  if (current !== "") {
    words.push(current);
  }
  return words;
};

/** 1 つで列の幅を超える単語を、幅ごとに分ける */
const breakWord = (word: string, width: number): string[] => {
  const pieces: string[] = [];
  let current = "";
  for (const { segment } of SEGMENTER.segment(word)) {
    if (current !== "" && displayWidth(current + segment) > width) {
      pieces.push(current);
      current = "";
    }
    current += segment;
  }
  if (current !== "") {
    pieces.push(current);
  }
  return pieces;
};

/** セルの文字列を列の幅に収まる行に折り返す。1 つの単語が列の幅を超えるときだけ単語の途中で折り返す */
export const wrapCell = (options: {
  text: string;
  width: number;
}): string[] => {
  const { text, width } = options;
  const lines: string[] = [];
  let current = "";
  for (const word of splitWords(text)) {
    const trimmed = word.trimEnd();
    if (displayWidth(current + trimmed) <= width) {
      current += word;
      continue;
    }
    if (current.trimEnd() !== "") {
      lines.push(current.trimEnd());
    }
    current = "";
    if (displayWidth(trimmed) <= width) {
      current = word;
      continue;
    }
    const pieces = breakWord(trimmed, width);
    lines.push(...pieces.slice(0, -1));
    current = `${pieces.at(-1) ?? ""}${word.endsWith(" ") ? " " : ""}`;
  }
  if (current.trimEnd() !== "") {
    lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
};

/** その列の最も長い単語の幅 */
const longestWord = (cells: string[]): number =>
  Math.max(
    0,
    ...cells.flatMap((cell) =>
      splitWords(cell).map((word) => displayWidth(word.trimEnd())),
    ),
  );

/** 列ごとの中身の幅から列の幅を決める。罫線を含めた幅が `columns` を超えるときは、広い列から縮めて収める */
export const fitColumns = (options: {
  cells: string[][];
  columns?: number;
  wrap: boolean;
}): number[] => {
  const { cells, columns, wrap } = options;
  const count = Math.max(0, ...cells.map((row) => row.length));
  const columnCells = Array.from({ length: count }, (_, column) =>
    cells.map((row) => row[column] ?? ""),
  );
  const widths = columnCells.map((column) =>
    Math.max(0, ...column.map(displayWidth)),
  );
  if (!wrap || columns === undefined) {
    return widths;
  }
  // その列の最も長い単語の幅と MIN_COLUMN_WIDTH の小さい方（1 以上）よりは縮めない
  const floors = columnCells.map((column, index) =>
    Math.min(
      widths[index] ?? 0,
      Math.max(1, Math.min(longestWord(column), MIN_COLUMN_WIDTH)),
    ),
  );
  const total = () =>
    widths.reduce((sum, width) => sum + width, 0) + count * COLUMN_PADDING + 1;
  while (total() > columns) {
    let widest = -1;
    for (const [index, width] of widths.entries()) {
      if (
        width > (floors[index] ?? 0) &&
        (widest < 0 || width > (widths[widest] ?? 0))
      ) {
        widest = index;
      }
    }
    if (widest < 0) {
      break;
    }
    widths[widest] = (widths[widest] ?? 0) - 1;
  }
  return widths;
};
