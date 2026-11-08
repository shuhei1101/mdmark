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
    "<!-- chart: a -->",
    "",
    "<!-- table: data -->",
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
    markdown: `<!-- features: +html-scripts -->\n\n${range}`,
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
  const offByMarker = `<!-- features: -html-scripts -->\n\n${rangeScriptDoc("ts", ESCAPED_SCRIPT)}`;
  const cssOnly = rangeScriptDoc("css", ".toggle { color: red; }");
  const outside = ["```ts", ESCAPED_SCRIPT, "```", ""].join("\n");
  // 実行
  const results = [offByMarker, cssOnly, outside].map((markdown) =>
    collectRangeScripts({ markdown, config: on }),
  );
  // 検証
  expect(results).toEqual([[], [], []]);
});
