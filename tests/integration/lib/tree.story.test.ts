import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// フォルダとファイルに、種類ごとのアイコンを付けて並べる（Basic）
test("test_basic", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-filetree--basic");
  // 検証
  const tree = page.locator("ul.mdmark-tree");
  await expect(tree.getAttribute("aria-label")).resolves.toBe("ファイルツリー");
  await expect(tree.locator("li.mdmark-tree-folder").count()).resolves.toBe(2);
  await expect(tree.locator("li.mdmark-tree-file").count()).resolves.toBe(2);
  const icons = await tree.evaluate((element) => {
    const folder = element.querySelector(
      ".mdmark-tree-folder > .mdmark-tree-name",
    );
    const file = element.querySelector(".mdmark-tree-file > .mdmark-tree-name");
    return [folder, file].map((name) =>
      name ? getComputedStyle(name, "::before").maskImage : "",
    );
  });
  expect(icons[0]).toContain("data:image/svg+xml");
  expect(icons[1]).toContain("data:image/svg+xml");
  expect(icons[0]).not.toBe(icons[1]);
});

// 5 段の深い入れ子を、段ごとに字下げして並べる（Deep）
test("test_deep", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-filetree--deep");
  // 検証
  await expect(
    page.locator("ul.mdmark-tree ul ul ul ul").count(),
  ).resolves.toBe(1);
  const lefts = await page
    .locator(".mdmark-tree-name")
    .evaluateAll((names) =>
      names.map((name) => name.getBoundingClientRect().left),
    );
  for (let i = 1; i < lefts.length; i++) {
    expect(lefts[i] as number).toBeGreaterThan(lefts[i - 1] as number);
  }
});

// 名前が長く幅を超えても、名前が折り返し、横スクロールを出さない（LongName）
test("test_long_name", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-filetree--long-name");
  // 検証
  const fits = await page
    .locator("ul.mdmark-tree")
    .evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(fits).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
