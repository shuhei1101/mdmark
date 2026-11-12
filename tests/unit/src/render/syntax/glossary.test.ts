import { expect, test } from "vitest";
import { createEnv } from "../../../helpers/env.ts";

/** 用語集の表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGlossary = () =>
  import("../../../../../src/render/syntax/glossary.ts");

/** 解析器を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../../src/render/parser.ts");

/** 用語・別名・意味の列を持つ表のトークンの並び */
async function tableTokens(rows: string[]) {
  const { createParser } = await loadParser();
  const markdown = [
    "| 用語 | 別名 | 意味 |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  return createParser().parse(markdown, createEnv());
}

/** 用語・意味・やめた言い方の列を持つ表のトークンの並び */
async function avoidTableTokens(
  columns: [string, string, string],
  rows: string[],
) {
  const { createParser } = await loadParser();
  const markdown = [
    `| ${columns.join(" | ")} |`,
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  return createParser().parse(markdown, createEnv());
}

/** 用語集の表を含む文書。表の後の段落に別名が出る */
const GLOSSARY_MARKDOWN = [
  '<!-- glossary: {"term": {"column": "用語"}, "aliases": {"column": "別名"}, "meaning": {"column": "意味"}} -->',
  "",
  "| 用語 | 別名 | 意味 |",
  "| --- | --- | --- |",
  "| マーカー | マーク、オン・オフのマーカー | HTML コメントで記載する指定 |",
  "",
  "<!-- /glossary -->",
  "",
  "マークを記載する。",
  "",
].join("\n");

// 列を読み込み、別名を「、」「,」で区切る（「・」では区切らない）（正常系）
test("test_read_glossary_table", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| マーカー | マーク、オン・オフのマーカー | HTML コメントで記載する指定 |",
    "| 型 | 種類, タイプ | 値の分類 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    options: {
      term: { column: "用語" },
      aliases: { column: "別名" },
      meaning: { column: "意味" },
    },
    tokens,
    docId: "glossary",
  });
  // 検証
  expect(warning).toBeUndefined();
  expect(entries).toEqual([
    {
      term: "マーカー",
      aliases: ["マーク", "オン・オフのマーカー"],
      meaning: "HTML コメントで記載する指定",
      docId: "glossary",
      avoid: [],
    },
    {
      term: "型",
      aliases: ["種類", "タイプ"],
      meaning: "値の分類",
      docId: "glossary",
      avoid: [],
    },
  ]);
});

// 表に無い列名では用語を返却せず警告を返却する（異常系）
test("test_read_glossary_table_when_unknown_column", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| マーカー | マーク | HTML コメントで記載する指定 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    options: { term: { column: "用語" }, meaning: { column: "説明" } },
    tokens,
    docId: "",
  });
  // 検証
  expect(entries).toEqual([]);
  expect(warning).toContain("説明");
  expect(warning).toContain("用語");
  expect(warning).toContain("意味");
});

// 必須の meaning が無ければ用語を返却しない（異常系）
test("test_read_glossary_table_when_missing_arg", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| マーカー | マーク | HTML コメントで記載する指定 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    options: { term: { column: "用語" } },
    tokens,
    docId: "",
  });
  // 検証
  expect(entries).toEqual([]);
  expect(warning).toBeUndefined();
});

// マーカーを取り除き表を残し、用語を env に追加する（正常系）
test("test_glossary_rule", async () => {
  // 準備
  const { createParser } = await loadParser();
  const env = createEnv();
  // 実行
  const html = createParser().render(GLOSSARY_MARKDOWN, env);
  // 検証
  expect(html).toContain("<table");
  expect(html).not.toContain("<!--");
  expect(env.ownGlossary.map((entry) => entry.term)).toEqual(["マーカー"]);
});

// glossary がオフなら用語を追加しない（正常系）
test("test_glossary_rule_when_disabled", async () => {
  // 準備
  const { createParser } = await loadParser();
  const parser = createParser();
  const onEnv = createEnv();
  const offEnv = createEnv();
  const markdown = `<!-- features: {"glossary": false} -->\n\n${GLOSSARY_MARKDOWN}`;
  // 実行
  parser.render(GLOSSARY_MARKDOWN, onEnv);
  const html = parser.render(markdown, offEnv);
  // 検証
  // マーカーが無ければ用語を追加する同じ表で、マーカーがあると追加しない
  expect(onEnv.ownGlossary).toHaveLength(1);
  expect(html).toContain("<table");
  expect(html).not.toContain("<!--");
  expect(offEnv.ownGlossary).toEqual([]);
});

/** やめた言い方の列を持つ用語集の表を含む文書。表の後の段落に用語とやめた言い方が出る */
const AVOID_GLOSSARY_MARKDOWN = [
  '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}, "avoid": {"column": "やめた言い方"}} -->',
  "",
  "| 用語 | 意味 | やめた言い方 |",
  "| --- | --- | --- |",
  "| ワークスペース | 作業の配置場所 | 作業場、ワーク場 |",
  "",
  "<!-- /glossary -->",
  "",
  "ワークスペースと作業場を記載する。",
  "",
].join("\n");

// やめた言い方の列を用語の `avoid` に持たせて env に追加する（正常系）
test("test_glossary_rule_keeps_avoid", async () => {
  // 準備
  const { createParser } = await loadParser();
  const env = createEnv();
  // 実行
  createParser().render(AVOID_GLOSSARY_MARKDOWN, env);
  // 検証
  expect(env.ownGlossary).toHaveLength(1);
  expect(env.ownGlossary[0]?.term).toBe("ワークスペース");
  expect(env.ownGlossary[0]?.avoid).toEqual(["作業場", "ワーク場"]);
});

// やめた言い方の列を「、」「,」で区切って読み込み、用語の別名には入れない（正常系）
test("test_read_glossary_rows_with_avoid", async () => {
  // 準備
  const { readGlossaryRows } = await loadGlossary();
  const tokens = await avoidTableTokens(
    ["用語", "意味", "やめた言い方"],
    ["| ワークスペース | 作業の配置場所 | 作業場、ワーク場, |"],
  );
  // 実行
  const { rows, warning } = readGlossaryRows({
    options: {
      term: { column: "用語" },
      meaning: { column: "意味" },
      avoid: { column: "やめた言い方" },
    },
    tokens,
    docId: "glossary",
  });
  // 検証
  expect(warning).toBeUndefined();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.entry.avoid).toEqual(["作業場", "ワーク場"]);
  expect(rows[0]?.entry.aliases).toEqual([]);
});

// avoid が無ければやめた言い方を空にする（正常系）
test("test_read_glossary_rows_without_avoid", async () => {
  // 準備
  const { readGlossaryRows, readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| マーカー | マーク | HTML コメントで記載する指定 |",
  ]);
  const options = {
    term: { column: "用語" },
    aliases: { column: "別名" },
    meaning: { column: "意味" },
  };
  // 実行
  const { rows } = readGlossaryRows({ options, tokens, docId: "glossary" });
  const { entries } = readGlossaryTable({
    options,
    tokens,
    docId: "glossary",
  });
  // 検証
  expect(rows).toHaveLength(1);
  expect(rows[0]?.entry.avoid).toEqual([]);
  expect(rows[0]?.entry).toEqual(entries[0]);
});

// avoid が表に無い列名なら行を返却せず警告を返却する（異常系）
test("test_read_glossary_rows_when_unknown_avoid_column", async () => {
  // 準備
  const { readGlossaryRows } = await loadGlossary();
  const tokens = await tableTokens([
    "| マーカー | マーク | HTML コメントで記載する指定 |",
  ]);
  // 列は 用語・別名・意味 の並びで、旧称 は無い
  // 実行
  const { rows, warning } = readGlossaryRows({
    options: {
      term: { column: "用語" },
      meaning: { column: "意味" },
      avoid: { column: "旧称" },
    },
    tokens,
    docId: "",
  });
  // 検証
  expect(rows).toEqual([]);
  expect(warning).toContain("avoid.column");
  expect(warning).toContain("旧称");
  expect(warning).toContain("用語");
  expect(warning).toContain("別名");
  expect(warning).toContain("意味");
});
