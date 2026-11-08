import { test } from "vitest";
import {
  expectFindWords,
  expectFindWordsWhenNotationDiffers,
} from "../../helpers/find-words-cases.ts";

/** 照合の辞書の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDictionary = () => import("../../../../src/knowledge/dictionary.ts");

// 単語の区切りに一致する単語だけを返却する。対応ブラウザ（Chromium）の単語の区切りでも確認する（正常系）
test("test_find_words", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行・検証
  expectFindWords(findWords);
});

// 全角と半角・英字の大文字と小文字だけが違う単語を、元の文字列の位置で返却する。対応ブラウザ（Chromium）の単語の区切りでも確認する（正常系）
test("test_find_words_when_notation_differs", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行・検証
  expectFindWordsWhenNotationDiffers(findWords);
});
