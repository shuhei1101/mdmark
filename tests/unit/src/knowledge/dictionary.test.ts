import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";
import type { MdmarkReferences } from "../../../../src/knowledge/references.ts";
import { expectFindWords } from "../../helpers/find-words-cases.ts";

/** 照合の辞書の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDictionary = () => import("../../../../src/knowledge/dictionary.ts");

/** 文書 `api`（別名 `公開関数`）だけを持つ索引 */
const API_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: "api", path: "api.md", title: "API", aliases: ["公開関数"] }],
};

// 同じ語は索引 → 描く文書の表 → ほかの文書の表の順で選ぶ（正常系）
test("test_build_dictionary", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "g1", path: "g1.md", title: "G1" },
      { id: "g2", path: "g2.md", title: "G2" },
      { id: "cur", path: "cur.md", title: "描く文書" },
    ],
    terms: [{ id: "mark", term: "印", meaning: "索引の意味" }],
  };
  // 参照の表は索引の `docs` で後の文書から並べ、並びでなく `docs` の順で選ぶことを確かめる
  const references: MdmarkReferences = {
    backlinks: {},
    glossary: [
      { term: "印", aliases: [], meaning: "g2 の印", docId: "g2" },
      { term: "マーク", aliases: [], meaning: "g2 のマーク", docId: "g2" },
      { term: "印", aliases: [], meaning: "g1 の印", docId: "g1" },
      { term: "マーク", aliases: [], meaning: "g1 のマーク", docId: "g1" },
    ],
  };
  // 実行
  const dictionary = buildDictionary({
    index,
    docId: "cur",
    ownGlossary: [
      { term: "印", aliases: [], meaning: "描く文書の印", docId: "cur" },
    ],
    references,
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  expect(dictionary.terms.get("印")?.meaning).toBe("索引の意味");
  expect(dictionary.terms.get("マーク")).toEqual({
    id: "glossary:g1:マーク",
    meaning: "g1 のマーク",
  });
  expect(dictionary.words).toEqual(["マーク", "印"]);
});

// backlinks がオフなら文書の別名を入れない（正常系）
test("test_build_dictionary_when_backlinks_disabled", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  // 実行
  const dictionary = buildDictionary({
    index: API_INDEX,
    ownGlossary: [],
    features: { ...DEFAULT_FEATURES, backlinks: false },
  });
  // 検証
  expect(dictionary.docs.size).toBe(0);
  expect(dictionary.words).not.toContain("公開関数");
});

// 描く文書自身の別名は入れない（正常系）
test("test_build_dictionary_excludes_self", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  // 実行
  const dictionary = buildDictionary({
    index: API_INDEX,
    docId: "api",
    ownGlossary: [],
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  expect(dictionary.docs.has("公開関数")).toBe(false);
});

// 語の区切りに揃う語だけを返す（正常系）
test("test_find_words", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行・検証
  expectFindWords(findWords);
});

// 重なる語は長い語を選ぶ（正常系）
test("test_find_words_prefers_longer", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行
  const found = findWords("オン・オフの印を書く", ["オン・オフの印", "印"]);
  // 検証
  expect(found.map((item) => item.word)).toEqual(["オン・オフの印"]);
});

/** `Intl.Segmenter` を取り除いた間だけ `run` を流し、終わったら戻す */
async function withoutIntlSegmenter(run: () => Promise<void>): Promise<void> {
  const original = Intl.Segmenter;
  Reflect.deleteProperty(Intl, "Segmenter");
  try {
    await run();
  } finally {
    Object.defineProperty(Intl, "Segmenter", {
      value: original,
      configurable: true,
      writable: true,
    });
  }
}

/** ほかのテストと共有しない新しいモジュールとして、照合の辞書の処理を読み込む（`key` ごとに別のモジュールになる） */
const loadFreshDictionary = (key: string) =>
  import(
    /* @vite-ignore */ `../../../../src/knowledge/dictionary.ts?${key}`
  ) as Promise<typeof import("../../../../src/knowledge/dictionary.ts")>;

// `Intl.Segmenter` を持たない環境で、英数字の語の一部を照合しない（正常系）
test("test_find_words_without_intl_segmenter", async () => {
  await withoutIntlSegmenter(async () => {
    // 準備・実行
    const { findWords } = await loadFreshDictionary(
      "without-intl-segmenter-find-words",
    );
    const found = findWords("ワークスペースをWSLに置く", [
      "ワークスペース",
      "WS",
    ]);
    // 検証
    expect(found).toEqual([{ start: 0, end: 7, word: "ワークスペース" }]);
  });
});

// `Intl.Segmenter` を持たない環境で、英数字の連なりを 1 語、それ以外を 1 文字ずつ区切る（正常系）
test("test_word_starts_without_intl_segmenter", async () => {
  await withoutIntlSegmenter(async () => {
    // 準備・実行
    const { wordStarts } = await loadFreshDictionary(
      "without-intl-segmenter-word-starts",
    );
    const starts = wordStarts("印刷をWSL2で😀見る");
    // 検証
    expect(starts).toEqual([0, 1, 2, 3, 7, 8, 10, 11]);
  });
});
