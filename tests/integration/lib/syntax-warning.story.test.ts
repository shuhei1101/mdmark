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
