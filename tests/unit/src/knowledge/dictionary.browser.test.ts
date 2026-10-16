import { test } from "vitest";
import { expectFindWords } from "../../helpers/find-words-cases.ts";

/** 照合の辞書の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDictionary = () => import("../../../../src/knowledge/dictionary.ts");

// 語の区切りに揃う語だけを返す。対応ブラウザ（Chromium）の語の区切りでも確かめる（正常系）
test("test_find_words", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行・検証
  expectFindWords(findWords);
});
