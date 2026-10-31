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

/** `--mdmark-diagram-max-height` の既定（36rem）の px */
const MAX_HEIGHT_PX = 576;

/** 表示する枠の今の倍率での図の高さ（大きさの箱の `style.height`）と、表示する枠の `clientHeight` */
function viewportHeights(page: Page) {
  return page.locator(".mdmark-diagram-viewport").evaluate((viewport) => {
    const sizer = viewport.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    return {
      content: Number.parseFloat(sizer?.style.height ?? ""),
      client: viewport.clientHeight,
    };
  });
}

// 使う側が高さを広げると、36rem を超えて定義の高さ × 倍率まで広がる（Fit から拡大した状態）
test("test_fit_when_resized", async () => {
  // 準備: 定義の高さ × 倍率が 36rem を超えるまで拡大する
  const page = await openFrame("fit", true);
  for (let i = 0; i < 10; i += 1) {
    if ((await viewportHeights(page)).content > MAX_HEIGHT_PX) {
      break;
    }
    await tool(page, "拡大").click();
  }
  const { content } = await viewportHeights(page);
  expect(content).toBeGreaterThan(MAX_HEIGHT_PX);
  // 実行: 表示する枠につまみを当て、高さを定義の高さ × 倍率にする
  await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((viewport, height) => {
      viewport.style.resize = "vertical";
      viewport.style.height = `${height}px`;
    }, content);
  // 検証
  const { client } = await viewportHeights(page);
  expect(client).toBeGreaterThan(MAX_HEIGHT_PX);
  expect(Math.abs(client - content)).toBeLessThanOrEqual(1);
});

// 印刷では、表示する枠の高さが定義の高さ × 倍率になる（Max）
test("test_max_when_printed", async () => {
  // 準備
  const page = await openFrame("max", false);
  // 実行
  await page.emulateMedia({ media: "print" });
  // 検証
  const { content, client } = await viewportHeights(page);
  expect(content).toBe(560 * 3);
  expect(Math.abs(client - content)).toBeLessThanOrEqual(1);
});
