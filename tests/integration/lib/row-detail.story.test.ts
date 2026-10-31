import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 閉じた行の詳細は、開閉のボタンだけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-rowdetail--closed");
  // 検証
  const button = page.locator("button.mdmark-row-toggle");
  await expect(button.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "「table」の詳細",
  );
  const detail = page.locator("tr.mdmark-row-detail");
  await expect(detail.getAttribute("hidden")).resolves.not.toBeNull();
  await expect(detail.isVisible()).resolves.toBe(false);
});

// 開いた行の詳細は、行の下に詳細が表の幅いっぱいに出る（Open）
test("test_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-rowdetail--open");
  // 検証
  await expect(
    page.locator("button.mdmark-row-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  const detail = page.locator("tr.mdmark-row-detail");
  await expect(detail.isVisible()).resolves.toBe(true);
  await expect(detail.locator("td").getAttribute("colspan")).resolves.toBe("3");
  const layout = await page.evaluate(() => {
    const row = document
      .querySelector("#storybook-root tbody tr:not(.mdmark-row-detail)")
      ?.getBoundingClientRect();
    const detail = document
      .querySelector("#storybook-root tr.mdmark-row-detail")
      ?.getBoundingClientRect();
    return {
      below: (detail?.top ?? 0) >= (row?.bottom ?? 0) - 1,
      sameWidth: Math.abs((detail?.width ?? 0) - (row?.width ?? 1)) < 2,
    };
  });
  expect(layout.below).toBe(true);
  expect(layout.sameWidth).toBe(true);
});

// 最終列を畳んだ表で開いた行の詳細は、詳細の中身の上に説明の見出しと中身を出す（OpenWithFoldedColumn）
test("test_open_with_folded_column", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-rowdetail--open-with-folded-column",
  );
  // 検証
  await expect(
    page.locator("button.mdmark-row-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  const detail = page.locator("tr.mdmark-row-detail");
  await expect(detail.isVisible()).resolves.toBe(true);
  const part = detail.locator(".mdmark-fold-part");
  await expect(part.locator(".mdmark-fold-name").innerText()).resolves.toBe(
    "説明",
  );
  await expect(part.locator(".mdmark-fold-value").innerText()).resolves.toBe(
    "並べ替え・ピン止め・絞り込みを付けた表を描く",
  );
  // 最終列は詳細の中身の上に出る
  const layout = await detail.evaluate((row) => {
    const partRect = row
      .querySelector(".mdmark-fold-part")
      ?.getBoundingClientRect();
    const cell = row.querySelector("td");
    const body = [...(cell?.children ?? [])].find(
      (child) => !child.classList.contains("mdmark-fold-part"),
    );
    return {
      bodyExists: body !== undefined,
      above:
        (partRect?.bottom ?? 0) <= (body?.getBoundingClientRect().top ?? 0) + 1,
    };
  });
  expect(layout.bodyExists).toBe(true);
  expect(layout.above).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
