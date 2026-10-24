import { expect } from "vitest";

/** 語の区切りで語を照合する関数（`findWords` と同じ形） */
type FindWords = (
  text: string,
  words: string[],
) => Array<{ start: number; end: number; word: string }>;

/** 区切りに揃う語だけを返すことを確かめる。区切り方は実行環境の辞書に依るため、Node とブラウザの両方で呼ぶ */
export function expectFindWords(findWords: FindWords): void {
  const words = ["印", "ワークスペース", "WS"];
  // `印刷` の `印` は入らない
  expect(findWords("本文の印は印刷でも使う", words)).toEqual([
    { start: 3, end: 4, word: "印" },
  ]);
  expect(findWords("ワークスペースにWSを置く", words)).toEqual([
    { start: 0, end: 7, word: "ワークスペース" },
    { start: 8, end: 10, word: "WS" },
  ]);
}

/** 全角と半角・英字の大文字と小文字だけが違う語を、元の文字列の位置で返すことを確かめる。区切り方は実行環境の辞書に依るため、Node とブラウザの両方で呼ぶ */
export function expectFindWordsWhenNotationDiffers(findWords: FindWords): void {
  const words = ["ワークスペース", "ws", "MCP"];
  // 半角カナの `ﾜｰｸｽﾍﾟｰｽ`（8 文字）は正規化すると 7 文字になるが、位置は元の文字列のまま
  expect(findWords("ﾜｰｸｽﾍﾟｰｽとＷＳ", words)).toEqual([
    { start: 0, end: 8, word: "ワークスペース" },
    { start: 9, end: 11, word: "ws" },
  ]);
  expect(findWords("mcp と Mcp", words)).toEqual([
    { start: 0, end: 3, word: "MCP" },
    { start: 6, end: 9, word: "MCP" },
  ]);
}
