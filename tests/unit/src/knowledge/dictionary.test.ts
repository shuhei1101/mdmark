import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";
import type { MdmarkReferences } from "../../../../src/knowledge/references.ts";
import {
  expectFindWords,
  expectFindWordsWhenNotationDiffers,
} from "../../helpers/find-words-cases.ts";

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

// 正規化した後に同じになる語を 1 つの語にまとめ、優先の順で先の用語と表記を残す（正常系）
test("test_build_dictionary_when_notation_differs", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "api", path: "api.md", title: "API", aliases: ["ＡＰＩ"] }],
    terms: [
      { id: "mcp", term: "MCP", meaning: "索引の意味" },
      {
        id: "ws",
        term: "ワークスペース",
        aliases: ["WS"],
        meaning: "作業の置き場所",
        avoid: ["ws"],
      },
    ],
  };
  // 実行
  const dictionary = buildDictionary({
    index,
    ownGlossary: [
      { term: "ｍｃｐ", aliases: [], meaning: "表の意味", docId: "cur" },
    ],
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  // 正規化した語だけが入り、記載したままの表記は入らない
  expect(dictionary.words).toContain("mcp");
  expect(dictionary.words).toContain("api");
  for (const word of ["MCP", "ｍｃｐ", "ＡＰＩ"]) {
    expect(dictionary.words).not.toContain(word);
  }
  // 同じ語は索引の `terms` の用語を選び、記載した表記も先の側
  expect(dictionary.terms.get("mcp")).toEqual({
    id: "mcp",
    meaning: "索引の意味",
  });
  expect(dictionary.term("Ｍｃｐ")).toEqual({
    id: "mcp",
    meaning: "索引の意味",
  });
  expect(dictionary.written.get("mcp")).toBe("MCP");
  expect(dictionary.docs.get("api")?.map((doc) => doc.id)).toEqual(["api"]);
  // `ws` は用語の別名 `WS` と同じ語なので、やめた言い方に入らない
  expect(dictionary.avoided.size).toBe(0);
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

/** やめた言い方 `作業場` を 2 つの用語が持ち、`WS` は用語の別名と同じやめた言い方でもある索引 */
const AVOID_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を置くフォルダ",
      avoid: ["作業場", "WS"],
    },
    {
      id: "area",
      term: "作業スペース",
      meaning: "作業の場所",
      avoid: ["作業場"],
    },
  ],
};

// 索引の用語のやめた言い方を `avoided` に入れ、`words` には入れない（正常系）
test("test_build_dictionary_avoided", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  // 実行
  const dictionary = buildDictionary({
    index: AVOID_INDEX,
    ownGlossary: [],
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  // 同じやめた言い方は索引の `terms` で先の用語が代わりの用語で、別名と同じ `WS` は入らない
  expect([...dictionary.avoided]).toEqual([
    [
      "作業場",
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
      },
    ],
  ]);
  expect(dictionary.words).not.toContain("作業場");
});

// glossary がオフならやめた言い方を入れない（正常系）
test("test_build_dictionary_avoided_when_glossary_disabled", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  // 実行
  const dictionary = buildDictionary({
    index: AVOID_INDEX,
    ownGlossary: [],
    features: { ...DEFAULT_FEATURES, glossary: false },
  });
  // 検証
  expect(dictionary.avoided.size).toBe(0);
});

/** 索引の `docs` が `glossary`・`guide` の順で、用語 `フォルダ` が `作業場` をやめた言い方に持つ索引 */
const AVOID_TABLE_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "glossary", path: "glossary.md", title: "用語集" },
    { id: "guide", path: "guide.md", title: "ガイド" },
  ],
  terms: [
    { id: "folder", term: "フォルダ", meaning: "置き場所", avoid: ["作業場"] },
  ],
};

// 用語集の表のやめた言い方を `avoided` に入れ、索引の `terms`、索引の `docs` の順の文書の表の順で代わりの用語を選ぶ（正常系）
test("test_build_dictionary_avoided_from_glossary", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  const references: MdmarkReferences = {
    backlinks: {},
    glossary: [
      {
        term: "ワークスペース",
        aliases: [],
        meaning: "作業の置き場所",
        docId: "glossary",
        avoid: ["作業場", "ワーク場"],
      },
      // 描く文書の表の用語も参照の表に入っている（描く文書の表と同じ用語）
      {
        term: "下書き",
        aliases: [],
        meaning: "書きかけの文書",
        docId: "guide",
        avoid: ["草稿", "ワーク場"],
      },
    ],
  };
  // 実行
  const dictionary = buildDictionary({
    index: AVOID_TABLE_INDEX,
    docId: "guide",
    ownGlossary: [
      {
        term: "下書き",
        aliases: [],
        meaning: "書きかけの文書",
        docId: "guide",
        avoid: ["草稿", "ワーク場"],
      },
    ],
    references,
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  // `作業場` は索引の `フォルダ`、`ワーク場` は索引の `docs` で先の `glossary` の表の `ワークスペース`、`草稿` は描く文書の表の `下書き`
  expect(Object.fromEntries(dictionary.avoided)).toEqual({
    作業場: { id: "folder", term: "フォルダ", meaning: "置き場所" },
    ワーク場: {
      id: "glossary:glossary:ワークスペース",
      term: "ワークスペース",
      meaning: "作業の置き場所",
    },
    草稿: {
      id: "glossary:guide:下書き",
      term: "下書き",
      meaning: "書きかけの文書",
    },
  });
  expect(dictionary.avoided.size).toBe(3);
  for (const word of ["作業場", "ワーク場", "草稿"]) {
    expect(dictionary.words).not.toContain(word);
  }
});

// 描く文書が索引の `docs` に無いときは、描く文書の表のやめた言い方をほかの文書の表より先にする（正常系）
test("test_build_dictionary_avoided_own_table_first_when_not_in_index", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "glossary", path: "glossary.md", title: "用語集" }],
  };
  const references: MdmarkReferences = {
    backlinks: {},
    glossary: [
      {
        term: "ワークスペース",
        aliases: [],
        meaning: "作業の置き場所",
        docId: "glossary",
        avoid: ["ワーク場"],
      },
    ],
  };
  // 実行
  const dictionary = buildDictionary({
    index,
    ownGlossary: [
      {
        term: "下書き",
        aliases: [],
        meaning: "書きかけの文書",
        docId: "",
        avoid: ["ワーク場"],
      },
    ],
    references,
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  expect(dictionary.avoided.get("ワーク場")?.term).toBe("下書き");
});

// `avoid` が無い用語集の表の用語は、やめた言い方を持たないものとして扱う（正常系）
test("test_build_dictionary_avoided_when_glossary_entry_without_avoid", async () => {
  // 準備
  const { buildDictionary } = await loadDictionary();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "glossary", path: "glossary.md", title: "用語集" }],
  };
  const references: MdmarkReferences = {
    backlinks: {},
    glossary: [
      {
        term: "ワークスペース",
        aliases: [],
        meaning: "作業の置き場所",
        docId: "glossary",
      },
      {
        term: "下書き",
        aliases: [],
        meaning: "書きかけの文書",
        docId: "glossary",
        avoid: ["草稿"],
      },
    ],
  };
  // 実行
  const dictionary = buildDictionary({
    index,
    ownGlossary: [],
    references,
    features: { ...DEFAULT_FEATURES },
  });
  // 検証
  expect([...dictionary.avoided.keys()]).toEqual(["草稿"]);
  expect(dictionary.avoided.get("草稿")?.term).toBe("下書き");
  expect(dictionary.words).toContain("ワークスペース");
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

// 全角と半角・英字の大文字と小文字だけが違う語を、元の文字列の位置で返す（正常系）
test("test_find_words_when_notation_differs", async () => {
  // 準備
  const { findWords } = await loadDictionary();
  // 実行・検証
  expectFindWordsWhenNotationDiffers(findWords);
});

// 照合・点検・検索の前に、全角と半角・英字の大文字と小文字・前後の空白をそろえる（正常系）
test("test_normalize_word", async () => {
  // 準備
  const { normalizeWord } = await loadDictionary();
  // 実行・検証
  expect(normalizeWord("　Ｗｏｒｋ Place ")).toBe("work place");
  expect(normalizeWord("ﾜｰｸｽﾍﾟｰｽ")).toBe("ワークスペース");
  expect(normalizeWord("㍻")).toBe("平成");
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

// `Intl.Segmenter` を持たない環境で、全角の英数字の連なりも 1 語にする（正常系）
test("test_word_starts_without_intl_segmenter_when_fullwidth", async () => {
  await withoutIntlSegmenter(async () => {
    // 準備・実行
    const { wordStarts } = await loadFreshDictionary(
      "without-intl-segmenter-word-starts-fullwidth",
    );
    const starts = wordStarts("ＷＳＬ2を見る");
    // 検証
    expect(starts).toEqual([0, 4, 5, 6]);
  });
});
