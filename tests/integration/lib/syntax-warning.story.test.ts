import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 記載の警告のストーリーを開く */
async function open(id: string) {
  const page = await holder.openStory(`parts-syntaxwarning--${id}`);
  return { page, warning: page.locator(".mdmark-syntax-warning") };
}

/** 枠が `role="note"` でタイトルが「記載の警告」、枠が破線であることを確認する */
async function expectFrame(
  warning: import("playwright").Locator,
): Promise<void> {
  await expect(warning.getAttribute("role")).resolves.toBe("note");
  await expect(
    warning.locator(".mdmark-syntax-warning-title").innerText(),
  ).resolves.toBe("記載の警告");
  await expect(
    warning.evaluate((el) => getComputedStyle(el).borderTopStyle),
  ).resolves.toBe("dashed");
}

// マーカーの値の型が合わないときは、マーカーと本文だけを出す（TypeMismatch）
test("test_type_mismatch", async () => {
  // 準備・実行
  const { warning } = await open("type-mismatch");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- tabs: {"collapse": "closed"} -->',
  );
  await expect(warning.innerText()).resolves.toContain("collapse");
  await expect(warning.locator("ul").count()).resolves.toBe(0);
});

// マーカーの引数を JSON として読めないときは、読めない位置の文字と原因を出す（InvalidJson）
test("test_invalid_json", async () => {
  // 準備・実行
  const { page, warning } = await open("invalid-json");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- details: {"title": 補足} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain("11 文字目");
  expect(text).toContain("既定の設定で描いています");
  await expect(warning.locator("ul").count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 値の --> でコメントが閉じたときは、閉じる理由と --\u003e の記載方法を出す（CommentEndInValue）
test("test_comment_end_in_value", async () => {
  // 準備・実行
  const { page, warning } = await open("comment-end-in-value");
  // 検証
  await expectFrame(warning);
  const text = await warning.innerText();
  expect(text).toContain("コメントがそこで閉じます");
  expect(text).toContain("--\\u003e");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 拡張のマーカーの引数が今の書き方のときは、例と mdmark upgrade の移行の報告を出す（LegacyExtension）
test("test_legacy_extension", async () => {
  // 準備・実行
  const { page, warning } = await open("legacy-extension");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- greet: world -->",
  );
  const text = await warning.innerText();
  expect(text).toContain('<!-- greet: {"target": "world"} -->');
  expect(text).toContain("mdmark upgrade");
  await expect(warning.locator("ul").count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 表のマーカーに読み込めない指定を複数記載したときは、本文の後に項目を並べる（Items）
test("test_items", async () => {
  // 準備・実行
  const { warning } = await open("items");
  // 検証
  await expectFrame(warning);
  const labels = await warning.locator("li > code:first-child").allInnerTexts();
  expect(labels).toEqual(["columns.数量.total[0].calc", "columns.名前.hidden"]);
});

// 切れた図表の参照は、マーカーを持たず本文だけを出す（BrokenReference）
test("test_broken_reference", async () => {
  // 準備・実行
  const { warning } = await open("broken-reference");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "#fig-missing",
  );
  await expect(warning.locator("ul").count()).resolves.toBe(0);
});

// 拡張の引数が Schema に合わないときは、issue ごとの項目を並べる（ExtensionSchema）
test("test_extension_schema", async () => {
  // 準備・実行
  const { warning } = await open("extension-schema");
  // 検証
  await expectFrame(warning);
  const items = await warning.locator("li").allInnerTexts();
  expect(items).toHaveLength(2);
  expect(items[0]?.startsWith("target:")).toBe(true);
  expect(items[1]?.startsWith("count:")).toBe(true);
});

// マーカーが長く枠の幅を超えても、マーカーが枠の中で折り返し、横スクロールを出さない（LongMark）
test("test_long_mark", async () => {
  // 準備・実行
  const { page, warning } = await open("long-mark");
  // 検証
  const lines = await warning
    .locator("p code")
    .first()
    .evaluate((element) => element.getClientRects().length);
  expect(lines).toBeGreaterThan(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 用語集の表のマーカーに表に無い列名を記載したときは、列名と表の列を出す（GlossaryColumn）
test("test_glossary_column", async () => {
  // 準備・実行
  const { page, warning } = await open("glossary-column");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "説明"}} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain("説明");
  expect(text).toContain("この表からは用語を入れずに描いています");
  await expect(warning.locator("ul").count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 用語集の表のマーカーに必須の meaning を記載していないときは、指し方を出す（GlossaryMissingArg）
test("test_glossary_missing_arg", async () => {
  // 準備・実行
  const { page, warning } = await open("glossary-missing-arg");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- glossary: {"term": {"column": "用語"}} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain('"meaning": {"column": "列名"}');
  expect(text).toContain("この表からは用語を入れずに描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューのマーカーの board.group.column が表に無い列を指すときは、表の列を並べて表で描くことを伝える（ViewGroupColumn）
test("test_view_group_column", async () => {
  // 準備・実行
  const { page, warning } = await open("view-group-column");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- view: {"board": {"group": {"column": "優先度"}}} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain("優先度");
  expect(text).toContain("ボードにせず、表で描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューのマーカーの範囲に表が無いときは、表を記載するよう伝える（ViewNoTable）
test("test_view_no_table", async () => {
  // 準備・実行
  const { page, warning } = await open("view-no-table");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- view: {"board": {"group": {"column": "状態"}}} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain("項目にする表がありません");
  expect(text).toContain("範囲の中身はそのまま描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューのマーカーの board.values.{値}.icon に使用できないアイコンを記載したときは、使用できるアイコンを並べる（ViewUnknownIcon）
test("test_view_unknown_icon", async () => {
  // 準備・実行
  const { page, warning } = await open("view-unknown-icon");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    '<!-- view: {"board": {"group": {"column": "状態"}, "values": {"完了": {"icon": "rocket"}}}} -->',
  );
  const text = await warning.innerText();
  expect(text).toContain("rocket");
  expect(text).toContain("circle-dashed");
  expect(text).toContain("ban");
  expect(text).toContain("既定のアイコンを付けています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 新しい記法の記載の警告を、ほかの警告と同じ枠で出す（IconName・IconNotInLucide・ColumnsCount・IncludeMissing・IncludeCircular・CsvColumns）
test("test_new_syntax_warnings", async () => {
  for (const [id, words] of [
    ["icon-name", ["icon:Rocket!", "Rocket!", "rocket"]],
    ["icon-not-in-lucide", ["icon:no-such-icon", "https://lucide.dev/icons/"]],
    ["columns-count", ["<!-- columns -->", "4 列", "2〜3"]],
    ["include-missing", ["src/app.ts", "12 行", "20〜22"]],
    ["include-circular", ["a.md → b.md → a.md"]],
    ["csv-columns", ["2 行目", "3 行目", "3 列"]],
  ] as const) {
    // 準備・実行
    const { page, warning } = await open(id);
    // 検証
    await expectFrame(warning);
    const text = await warning.innerText();
    for (const word of words) {
      expect(text).toContain(word);
    }
    await expect(pageOverflows(page)).resolves.toBe(false);
  }
});
