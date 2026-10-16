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

/** 用語集の表を含む文書。表の後の段落に別名が出る */
const GLOSSARY_MARKDOWN = [
  "<!-- glossary: term=用語 aliases=別名 meaning=意味 -->",
  "",
  "| 用語 | 別名 | 意味 |",
  "| --- | --- | --- |",
  "| 印 | マーク、オン・オフの印 | HTML コメントで書く指定 |",
  "",
  "<!-- /glossary -->",
  "",
  "マークを書く。",
  "",
].join("\n");

// 列を読み、別名を「、」「,」で区切る（「・」では区切らない）（正常系）
test("test_read_glossary_table", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| 印 | マーク、オン・オフの印 | HTML コメントで書く指定 |",
    "| 型 | 種類, タイプ | 値の分類 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    args: {
      args: [],
      keys: { term: "用語", aliases: "別名", meaning: "意味" },
    },
    tokens,
    docId: "glossary",
  });
  // 検証
  expect(warning).toBeUndefined();
  expect(entries).toEqual([
    {
      term: "印",
      aliases: ["マーク", "オン・オフの印"],
      meaning: "HTML コメントで書く指定",
      docId: "glossary",
    },
    {
      term: "型",
      aliases: ["種類", "タイプ"],
      meaning: "値の分類",
      docId: "glossary",
    },
  ]);
});

// 表に無い列名では用語を返さず警告を返す（異常系）
test("test_read_glossary_table_when_unknown_column", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| 印 | マーク | HTML コメントで書く指定 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    args: { args: [], keys: { term: "用語", meaning: "説明" } },
    tokens,
    docId: "",
  });
  // 検証
  expect(entries).toEqual([]);
  expect(warning).toContain("説明");
  expect(warning).toContain("用語");
  expect(warning).toContain("意味");
});

// 必須の meaning= が無ければ警告を返す（異常系）
test("test_read_glossary_table_when_missing_arg", async () => {
  // 準備
  const { readGlossaryTable } = await loadGlossary();
  const tokens = await tableTokens([
    "| 印 | マーク | HTML コメントで書く指定 |",
  ]);
  // 実行
  const { entries, warning } = readGlossaryTable({
    args: { args: [], keys: { term: "用語" } },
    tokens,
    docId: "",
  });
  // 検証
  expect(entries).toEqual([]);
  expect(warning).toContain("meaning=");
});

// 印を取り除き表を残し、用語を env に足す（正常系）
test("test_glossary_rule", async () => {
  // 準備
  const { createParser } = await loadParser();
  const env = createEnv();
  // 実行
  const html = createParser().render(GLOSSARY_MARKDOWN, env);
  // 検証
  expect(html).toContain("<table");
  expect(html).not.toContain("<!--");
  expect(env.ownGlossary.map((entry) => entry.term)).toEqual(["印"]);
});

// glossary がオフなら用語を足さない（正常系）
test("test_glossary_rule_when_disabled", async () => {
  // 準備
  const { createParser } = await loadParser();
  const parser = createParser();
  const onEnv = createEnv();
  const offEnv = createEnv();
  const markdown = `<!-- features: -glossary -->\n\n${GLOSSARY_MARKDOWN}`;
  // 実行
  parser.render(GLOSSARY_MARKDOWN, onEnv);
  const html = parser.render(markdown, offEnv);
  // 検証
  // 印が無ければ用語を足す同じ表で、印があると足さない
  expect(onEnv.ownGlossary).toHaveLength(1);
  expect(html).toContain("<table");
  expect(html).not.toContain("<!--");
  expect(offEnv.ownGlossary).toEqual([]);
});
