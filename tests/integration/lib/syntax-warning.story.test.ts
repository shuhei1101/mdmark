import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 書き方の警告のストーリーを開く */
async function open(id: string) {
  const page = await holder.openStory(`parts-syntaxwarning--${id}`);
  return { page, warning: page.locator(".mdmark-syntax-warning") };
}

/** 枠が `role="note"` で題が「書き方の警告」、枠が破線であることを確かめる */
async function expectFrame(
  warning: import("playwright").Locator,
): Promise<void> {
  await expect(warning.getAttribute("role")).resolves.toBe("note");
  await expect(
    warning.locator(".mdmark-syntax-warning-title").innerText(),
  ).resolves.toBe("書き方の警告");
  await expect(
    warning.evaluate((el) => getComputedStyle(el).borderTopStyle),
  ).resolves.toBe("dashed");
}

// 表の印に知らない種類を書いたときは、印と本文だけを出す（UnknownKind）
test("test_unknown_kind", async () => {
  // 準備・実行
  const { warning } = await open("unknown-kind");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- table: unknown +sort -->",
  );
  await expect(warning.locator("ul").count()).resolves.toBe(0);
});

// 知らない機能とキーを書いたときは、本文の後に項目を並べる（Items）
test("test_items", async () => {
  // 準備・実行
  const { warning } = await open("items");
  // 検証
  await expectFrame(warning);
  const labels = await warning.locator("li > code:first-child").allInnerTexts();
  expect(labels).toEqual(["+unknown", "size="]);
});

// 切れた図表の参照は、印を持たず本文だけを出す（BrokenReference）
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
  expect(items[0]?.startsWith("1 つ目の World:")).toBe(true);
  expect(items[1]?.startsWith("2 つ目の 2:")).toBe(true);
});

// 印が長く枠の幅を超えても、印が枠の中で折り返し、横スクロールを出さない（LongMark）
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

// 用語集の表の印に表に無い列名を書いたときは、列名と表の列を出す（GlossaryColumn）
test("test_glossary_column", async () => {
  // 準備・実行
  const { page, warning } = await open("glossary-column");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- glossary: term=用語 meaning=説明 -->",
  );
  const text = await warning.innerText();
  expect(text).toContain("説明");
  expect(text).toContain("この表からは用語を入れずに描いています");
  await expect(warning.locator("ul").count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 用語集の表の印に必須の meaning= を書いていないときは、指し方を出す（GlossaryMissingArg）
test("test_glossary_missing_arg", async () => {
  // 準備・実行
  const { page, warning } = await open("glossary-missing-arg");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- glossary: term=用語 -->",
  );
  const text = await warning.innerText();
  expect(text).toContain("meaning=");
  expect(text).toContain("この表からは用語を入れずに描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューの印の group= が表に無い列を指すときは、表の列を並べて表で描くことを伝える（ViewGroupColumn）
test("test_view_group_column", async () => {
  // 準備・実行
  const { page, warning } = await open("view-group-column");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- view: group=優先度 -->",
  );
  const text = await warning.innerText();
  expect(text).toContain("優先度");
  expect(text).toContain("ボードにせず、表で描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューの印の範囲に表が無いときは、表を書くよう伝える（ViewNoTable）
test("test_view_no_table", async () => {
  // 準備・実行
  const { page, warning } = await open("view-no-table");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- view: group=状態 -->",
  );
  const text = await warning.innerText();
  expect(text).toContain("項目にする表がありません");
  expect(text).toContain("範囲の中身はそのまま描いています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ビューの印の icons= に使えないアイコンを書いたときは、使えるアイコンを並べる（ViewUnknownIcon）
test("test_view_unknown_icon", async () => {
  // 準備・実行
  const { page, warning } = await open("view-unknown-icon");
  // 検証
  await expectFrame(warning);
  await expect(warning.locator("p code").first().innerText()).resolves.toBe(
    "<!-- view: group=状態 icons=完了:rocket -->",
  );
  const text = await warning.innerText();
  expect(text).toContain("rocket");
  expect(text).toContain("circle-dashed");
  expect(text).toContain("ban");
  expect(text).toContain("既定のアイコンを付けています");
  await expect(pageOverflows(page)).resolves.toBe(false);
});
