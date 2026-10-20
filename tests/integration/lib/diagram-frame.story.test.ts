import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 図の枠のストーリーを開く。`zoom` を渡さないストーリーは、収まる倍率になるまで待つ */
async function openFrame(id: string, fitted: boolean): Promise<Page> {
  const page = await holder.openStory(`parts-diagramframe--${id}`);
  if (fitted) {
    await page.waitForFunction(
      () =>
        document.querySelector(".mdmark-diagram-zoom")?.textContent !== "100%",
    );
  }
  return page;
}

/** 読み上げの名前を持つボタンの状態 */
function tool(page: Page, name: string) {
  return page.locator(`button[aria-label="${name}"]`);
}

// 開いたときは全体が収まる倍率で、縮小は押せず（倍率のボタンは押せるが何も変わらない）、移動のボタンを出さない（Fit）
test("test_fit", async () => {
  // 準備・実行
  const page = await openFrame("fit", true);
  // 検証
  await expect(tool(page, "縮小").isDisabled()).resolves.toBe(true);
  await expect(tool(page, "拡大").isDisabled()).resolves.toBe(false);
  // 戻すのボタンは倍率のボタンにまとまり、今の名前の一部で探せる
  const zoom = page.getByRole("button", { name: "全体が収まる倍率に戻す" });
  await expect(zoom.count()).resolves.toBe(1);
  await expect(zoom.isDisabled()).resolves.toBe(false);
  const shown = await zoom.innerText();
  await expect(zoom.getAttribute("aria-label")).resolves.toBe(
    `倍率 ${shown}。全体が収まる倍率に戻す`,
  );
  await zoom.click();
  await expect(zoom.innerText()).resolves.toBe(shown);
  await expect(page.locator('[data-group="pan"]').isVisible()).resolves.toBe(
    false,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 1 段拡大して動かした状態は、移動のボタンを出す（Zoomed）
test("test_zoomed", async () => {
  // 準備・実行
  const page = await openFrame("zoomed", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "125%",
  );
  await expect(page.locator('[data-group="pan"]').isVisible()).resolves.toBe(
    true,
  );
});

// 上限の 300% では、拡大を押せない（Max）
test("test_max", async () => {
  // 準備・実行
  const page = await openFrame("max", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "300%",
  );
  await expect(tool(page, "拡大").isDisabled()).resolves.toBe(true);
});

// 狭い枠では、ボタンの帯と凡例が折り返し、横にはみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openFrame("narrow", false);
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
  const legend = await page
    .locator(".mdmark-diagram-legend")
    .evaluate((element) => ({
      wraps: element.getBoundingClientRect().height > 40,
      inside: element.scrollWidth <= element.clientWidth + 1,
    }));
  expect(legend).toEqual({ wraps: true, inside: true });
});

// 全画面のモーダルの中は、全画面のボタンの位置に閉じるボタンがある（Fullscreen）
test("test_fullscreen", async () => {
  // 準備・実行
  const page = await openFrame("fullscreen", true);
  // 検証
  await expect(tool(page, "全画面を閉じる").count()).resolves.toBe(1);
  await expect(tool(page, "全画面で開く").count()).resolves.toBe(0);
});
