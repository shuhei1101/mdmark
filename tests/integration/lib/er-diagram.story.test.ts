import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 全体が収まる倍率を当て終えるまで待つ */
async function waitFitted(
  page: Awaited<ReturnType<typeof holder.openStory>>,
): Promise<void> {
  await page.waitForFunction(() =>
    (
      document.querySelector<HTMLElement>(".mdmark-diagram-stage")?.style
        .transform ?? ""
    ).startsWith("scale("),
  );
}

// テーブル・列のマーカー・関係の線と多重度を描き、全ての列を出す（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-erdiagram--default");
  await waitFitted(page);
  // 検証
  await expect(page.locator(".mdmark-diagram-er-table").count()).resolves.toBe(
    4,
  );
  await expect(
    page
      .locator(
        '.mdmark-diagram-er-table[data-node="orders"] .mdmark-diagram-er-column',
      )
      .evaluateAll(
        (rows) => rows.filter((row) => row.getClientRects().length > 0).length,
      ),
  ).resolves.toBe(8);
  await expect(
    page
      .locator('.mdmark-diagram-er-table[data-node="customers"]')
      .getAttribute("data-color"),
  ).resolves.toBe("blue");
  await expect(
    page
      .locator('.mdmark-diagram-er-table[data-node="orders"]')
      .getAttribute("data-color"),
  ).resolves.toBe("orange");
  await expect(
    page.locator('g[data-er-relation] path[data-line="er"]').count(),
  ).resolves.toBe(3);
  await expect(
    page
      .locator('abbr.mdmark-diagram-er-key[title="主キー"]')
      .first()
      .innerText(),
  ).resolves.toBe("PK");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// color で種類の既定の色を上書きし、種類の無いテーブルは札を出さない（Colors）
test("test_colors", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-erdiagram--colors");
  await waitFitted(page);
  // 検証
  await expect(
    page
      .locator('.mdmark-diagram-er-table[data-node="products"]')
      .getAttribute("data-color"),
  ).resolves.toBe("green");
  const items = page.locator(
    '.mdmark-diagram-er-table[data-node="order_items"]',
  );
  await expect(items.getAttribute("data-color")).resolves.toBe("purple");
  await expect(items.locator(".mdmark-diagram-er-kind").count()).resolves.toBe(
    0,
  );
});

// 畳んだテーブルは主キーと外部キーの列と非表示の行だけを出す（Folded）
test("test_folded", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-erdiagram--folded");
  await waitFitted(page);
  // 検証
  const orders = page.locator('.mdmark-diagram-er-table[data-node="orders"]');
  await expect(
    orders
      .locator(".mdmark-diagram-er-column")
      .evaluateAll(
        (rows) => rows.filter((row) => row.getClientRects().length > 0).length,
      ),
  ).resolves.toBe(2);
  await expect(
    orders.locator(".mdmark-diagram-er-rest").innerText(),
  ).resolves.toBe("非表示 6 列");
  await expect(
    orders.locator(".mdmark-diagram-er-fold").getAttribute("aria-expanded"),
  ).resolves.toBe("false");
});

// 定義を読めないときは、図の代わりに書き方の警告を出す（Invalid）
test("test_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-erdiagram--invalid");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain("ER 図の部品の定義を読めません");
  await expect(page.locator("figure.mdmark-diagram").count()).resolves.toBe(0);
});
