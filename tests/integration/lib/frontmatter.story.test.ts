import { afterAll, beforeAll, expect, test } from "vitest";
import {
  createBrowserHolder,
  pageOverflows,
  resolveColorIn,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 閉じた状態は、控えめな文字の色の見出し `フロントマター` だけを出し、押すと中身を出す（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-frontmatter--closed");
  // 検証
  const details = page.locator("details.mdmark-frontmatter");
  await expect(
    details.evaluate((element) => (element as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "フロントマター",
  );
  await expect(
    details
      .locator("summary")
      .evaluate((element) => getComputedStyle(element).color),
  ).resolves.toBe(
    await resolveColorIn(page, ".mdmark", "var(--mdmark-color-muted)"),
  );
  await expect(details.locator("h1, h2, h3, h4, h5, h6").count()).resolves.toBe(
    0,
  );
  await expect(details.locator("pre").isVisible()).resolves.toBe(false);
  // 実行
  await details.locator("summary").click();
  // 検証
  await expect(details.locator("pre").isVisible()).resolves.toBe(true);
});

// open を指定した状態は、yaml のコードブロックの中身を出す（Open）
test("test_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-frontmatter--open");
  // 検証
  const code = page.locator("details.mdmark-frontmatter code.language-yaml");
  await expect(code.isVisible()).resolves.toBe(true);
  await expect(code.innerText()).resolves.toContain("title: 問い合わせの受付");
  await expect(code.innerText()).resolves.toContain("tags: [サポート, 手順]");
});

// 入れ子のオブジェクトとリストは、字下げを保ったまま出す（Nested）
test("test_nested", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-frontmatter--nested");
  // 検証
  const text = await page
    .locator("details.mdmark-frontmatter code.language-yaml")
    .innerText();
  expect(text).toContain("owner:\n  name: サポート担当\n  team: 窓口");
  expect(text).toContain("steps:\n  - 受け付ける\n  - 振り分ける");
});

// 区切りの無い長い値は、390px の画面幅でもページを横にはみ出させない（LongValue）
test("test_long_value", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-frontmatter--long-value", {
    width: 390,
    height: 844,
  });
  // 検証
  await expect(
    page.locator("details.mdmark-frontmatter pre").isVisible(),
  ).resolves.toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
