import { expect, test } from "vitest";
import { createFakeEngine } from "./fake-engine.ts";
import { GLOSSARY_CONFIG, GLOSSARY_FILES } from "./glossary-fixture.ts";

/** 用語集を集めて照合するモジュール（実装が無い間は各テストが個別に失敗する） */
const loadTerms = () => import("../../../../src/mdmark-style/terms.ts");

/** 用語集を読み込む */
const loadFixtureGlossary = async () => {
  const { loadGlossary } = await loadTerms();
  const $ = createFakeEngine({ files: GLOSSARY_FILES });
  return loadGlossary({ $, configPath: GLOSSARY_CONFIG });
};

// 索引・文書・エイリアスを集める（正常系）
test("test_load_glossary", async () => {
  // 実行
  const glossary = await loadFixtureGlossary();
  // 検証
  expect(glossary.index.terms).toHaveLength(2);
  expect(glossary.documents["guide.md"]).toContain("配信元");
  expect(glossary.aliases.map((alias) => alias.name)).toEqual(["アカウント"]);
});

// 設定ファイルが無い（異常系）
test("test_load_glossary_when_missing", async () => {
  // 準備
  const { GlossaryError, loadGlossary } = await loadTerms();
  const $ = createFakeEngine({ files: {} });
  // 実行・検証
  await expect(
    loadGlossary({ $, configPath: GLOSSARY_CONFIG }),
  ).rejects.toThrow(GlossaryError);
  await expect(
    loadGlossary({ $, configPath: GLOSSARY_CONFIG }),
  ).rejects.toThrow(GLOSSARY_CONFIG);
});

// 最初の出現だけに付ける（正常系）
test("test_match_terms", async () => {
  // 準備
  const { matchTerms } = await loadTerms();
  const glossary = await loadFixtureGlossary();
  // 実行
  const marks = matchTerms({ glossary, text: "mdmark の WS と WS、WSL" });
  // 検証
  expect(marks.map((mark) => [mark.title, mark.start, mark.footnote])).toEqual(
    [
      ["mdmark", 0, 1],
      ["WS", 9, 2],
    ],
  );
});

// 見出し・表・コード・リンクの中には付けない（正常系）
test("test_match_terms_when_excluded", async () => {
  // 準備
  const { matchTerms } = await loadTerms();
  const glossary = await loadFixtureGlossary();
  const text = [
    "## WS の作り方",
    "",
    "| 列 |",
    "| --- |",
    "| WS |",
    "",
    "`WS` と [WS](https://example.com/)",
  ].join("\n");
  // 実行
  const marks = matchTerms({ glossary, text });
  // 検証
  expect(marks).toEqual([]);
});

// 用語集の表の用語にも付ける（正常系）
test("test_match_terms_when_glossary_table", async () => {
  // 準備
  const { matchTerms } = await loadTerms();
  const glossary = await loadFixtureGlossary();
  // 実行
  const marks = matchTerms({ glossary, text: "配信元を足す" });
  // 検証
  expect(marks.map((mark) => mark.title)).toEqual(["配信元"]);
});
