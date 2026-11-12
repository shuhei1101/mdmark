import { expect, test } from "vitest";

/** 書き出しで埋めるものを文書から取得する処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadUsed = () => import("../../../../src/render/used.ts");

/** 範囲の言語とコードを持つ `<!-- html -->` の範囲 */
function rangeScriptDoc(lang: string, code: string): string {
  return [
    "<!-- html -->",
    "",
    "```html",
    '<button class="toggle" type="button">開く</button>',
    "```",
    "",
    `\`\`\`${lang}`,
    code,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
}

/** `'` と `<` を含む `ts` のコード */
const ESCAPED_SCRIPT =
  "export default (root: HTMLElement): void => { if (1 < 2) root.title = 'a'; };";

// 対応表にあるマーカーだけを取得する（正常系）
test("test_used_library_marks", async () => {
  // 準備
  const { usedLibraryMarks } = await loadUsed();
  const markdown = [
    '<!-- chart: {"data": "a"} -->',
    "",
    '<!-- table: {"kind": "data"} -->',
    "",
    "<!-- unknown -->",
    "",
  ].join("\n");
  // 実行
  const marks = usedLibraryMarks([markdown], { chart: "chart.js" });
  // 検証
  expect([...marks]).toEqual(["chart"]);
});

// 設定か文書のマーカーでオンの文書の範囲の `ts` を、エスケープを戻して返却する（正常系）
test("test_collect_range_scripts", async () => {
  // 準備
  const { collectRangeScripts } = await loadUsed();
  const range = rangeScriptDoc("ts", ESCAPED_SCRIPT);
  // 実行
  const byConfig = collectRangeScripts({
    markdown: range,
    config: { features: { "html-scripts": true } },
  });
  const byMarker = collectRangeScripts({
    markdown: `<!-- features: {"html-scripts": true} -->\n\n${range}`,
    config: {},
  });
  // 検証
  const expected = [{ lang: "ts", source: `${ESCAPED_SCRIPT}\n` }];
  expect(byConfig).toEqual(expected);
  expect(byMarker).toEqual(expected);
});

// オフか、範囲に `ts`・`js` が無いと空（正常系）
test("test_collect_range_scripts_when_off_or_no_script", async () => {
  // 準備
  const { collectRangeScripts } = await loadUsed();
  const on = { features: { "html-scripts": true } };
  const offByMarker = `<!-- features: {"html-scripts": false} -->\n\n${rangeScriptDoc("ts", ESCAPED_SCRIPT)}`;
  const cssOnly = rangeScriptDoc("css", ".toggle { color: red; }");
  const outside = ["```ts", ESCAPED_SCRIPT, "```", ""].join("\n");
  // 実行
  const results = [offByMarker, cssOnly, outside].map((markdown) =>
    collectRangeScripts({ markdown, config: on }),
  );
  // 検証
  expect(results).toEqual([[], [], []]);
});

// mermaid のコードブロックがある文書があれば true、機能を解除した文書だけなら false（正常系）
test("test_uses_mermaid", async () => {
  // 準備
  const { usesMermaid } = await loadUsed();
  const mermaid = ["```mermaid", "flowchart LR", "```", ""].join("\n");
  const ts = ["```ts", "const a = 1;", "```", ""].join("\n");
  const disabled = `<!-- features: {"mermaid": false} -->\n\n${mermaid}`;
  // 実行
  const results = [
    usesMermaid({ markdowns: [mermaid, ts], config: {} }),
    usesMermaid({ markdowns: [disabled], config: {} }),
    usesMermaid({
      markdowns: [mermaid],
      config: { features: { mermaid: false } },
    }),
  ];
  // 検証
  expect(results).toEqual([true, false, false]);
});

// 色分けの対象の言語だけを取得し、機能を解除した文書は取得しない（正常系）
test("test_used_syntax_languages", async () => {
  // 準備
  const { usedSyntaxLanguages } = await loadUsed();
  const first = [
    "```ts",
    "const a = 1;",
    "```",
    "",
    "```yml",
    "a: 1",
    "```",
    "",
    "```text",
    "plain",
    "```",
    "",
    '<pre><code class="language-python">x</code></pre>',
    "",
  ].join("\n");
  const second = [
    '<!-- features: {"syntax": false} -->',
    "",
    "```sql",
    "select 1;",
    "```",
    "",
  ].join("\n");
  // 実行
  const languages = usedSyntaxLanguages({
    markdowns: [first, second],
    config: {},
  });
  // 検証
  expect(languages).toEqual(["typescript", "yaml"]);
});

// 別名とファイル名付きの言語をモジュール名にして取得する（正常系）
test("test_used_syntax_languages_when_aliases_and_file_name", async () => {
  // 準備
  const { usedSyntaxLanguages } = await loadUsed();
  const markdown = [
    "```dockerfile",
    "FROM node:22",
    "```",
    "",
    "```patch",
    "-a",
    "+b",
    "```",
    "",
    "```ts:app.ts",
    "const a = 1;",
    "```",
    "",
  ].join("\n");
  // 実行
  const languages = usedSyntaxLanguages({ markdowns: [markdown], config: {} });
  // 検証
  expect(languages).toEqual(["diff", "dockerfile", "typescript"]);
});

// 設定で機能を解除すると何も取得しない（正常系）
test("test_used_syntax_languages_when_disabled", async () => {
  // 準備
  const { usedSyntaxLanguages } = await loadUsed();
  const markdown = ["```ts", "const a = 1;", "```", ""].join("\n");
  // 実行
  const languages = usedSyntaxLanguages({
    markdowns: [markdown],
    config: { features: { syntax: false } },
  });
  // 検証
  expect(languages).toEqual([]);
});
