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
