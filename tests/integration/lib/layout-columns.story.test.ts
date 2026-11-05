import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 列の左端と上端 */
async function readColumns(page: Page) {
  return page.locator(".mdmark-layout-column").evaluateAll((columns) =>
    columns.map((column) => {
      const rect = column.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
      };
    }),
  );
}

// 2 列を等しい幅で横に並べる（Two）
test("test_two", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-layoutcolumns--two", {
    width: 1000,
    height: 400,
  });
  // 検証
  const [left, right] = await readColumns(page);
  expect(left?.top).toBe(right?.top);
  expect(
    Math.abs((left?.width ?? 0) - (right?.width ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(right?.left).toBeGreaterThan(left?.left ?? 0);
});

// 3 列を等しい幅で横に並べる（Three）
test("test_three", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-layoutcolumns--three", {
    width: 1000,
    height: 400,
  });
  // 検証
  const columns = await readColumns(page);
  expect(columns).toHaveLength(3);
  expect(new Set(columns.map((column) => column.top)).size).toBe(1);
});

// 描く先の要素が 390px のときは縦に積む（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-layoutcolumns--narrow", {
    width: 1000,
    height: 400,
  });
  // 検証
  const [left, right] = await readColumns(page);
  expect(right?.top).toBeGreaterThan(left?.top ?? 0);
  expect(right?.left).toBe(left?.left);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
