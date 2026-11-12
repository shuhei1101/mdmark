import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows, resolveColor } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 図の枠のストーリーを開く。`zoom` を指定しないストーリーは、収まる倍率になるまで待つ */
async function openFrame(id: string, fitted: boolean): Promise<Page> {
  const page = await holder.openStory(`parts-diagramframe--${id}`);
  if (fitted) {
    await page.waitForFunction(() =>
      (
        document.querySelector<HTMLElement>(".mdmark-diagram-stage")?.style
          .transform ?? ""
      ).startsWith("scale("),
    );
  }
  return page;
}

/** 表示するノードの既定の線（`inset 0 0 0 1px` の `--mdmark-color-border`）の computed の `box-shadow` */
async function defaultBoxShadow(page: Page): Promise<string> {
  const border = await resolveColor(page, "var(--mdmark-color-border)");
  return `${border} 0px 0px 0px 1px inset`;
}

/** 表示するノード（`selector` の中のもの）の computed の `box-shadow` */
function boxShadow(page: Page, selector = ".mdmark-diagram-box") {
  return page
    .locator(selector)
    .evaluate((box) => getComputedStyle(box).boxShadow);
}

/** スクリーンリーダー向けの名前を持つボタンの状態 */
function tool(page: Page, name: string) {
  return page.locator(`button[aria-label="${name}"]`);
}

// 開いたときは全体が収まる倍率で、縮小は押せず（倍率のボタンは押せるが何も変わらない）、移動のボタンを出さない（Fit）
test("test_fit", async () => {
  // 準備・実行
  const page = await openFrame("fit", true);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "100%",
  );
  const size = await tool(page, "拡大").evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(size).toEqual({ width: 28, height: 28 });
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
  // 面に包まない表示するノードは、既定の線で描く
  await expect(boxShadow(page)).resolves.toBe(await defaultBoxShadow(page));
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

// 上限（定義の大きさの 3 倍）では、拡大を押せない（Max）
test("test_max", async () => {
  // 準備・実行
  const page = await openFrame("max", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "300%",
  );
  await expect(tool(page, "拡大").isDisabled()).resolves.toBe(true);
});

// 狭い枠では、凡例が折り返し、ボタンの帯は移動のボタンまで 1 行に収め、横にはみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openFrame("narrow", false);
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "125%",
  );
  const rows = await page
    .locator(".mdmark-diagram-tools button")
    .evaluateAll(
      (buttons) =>
        new Set(
          buttons
            .filter((button) => button.getClientRects().length > 0)
            .map((button) => Math.round(button.getBoundingClientRect().top)),
        ).size,
    );
  expect(rows).toBe(1);
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

// 利用側の枠を持つ面で `--mdmark-diagram-box-shadow: none` を指定すると、表示するノードの線が無い（InFramedSurface）
test("test_in_framed_surface", async () => {
  // 準備・実行
  const page = await openFrame("in-framed-surface", true);
  // 検証
  await expect(boxShadow(page)).resolves.toBe("none");
});

// 枠を持つ面の中の図を全画面で開くと、面の値を受け継がず、モーダルの中の表示するノードに既定の線がある（InFramedSurfaceFullscreen）
test("test_in_framed_surface_fullscreen", async () => {
  // 準備・実行
  const page = await openFrame("in-framed-surface-fullscreen", false);
  // 検証
  await expect(
    boxShadow(page, ".mdmark-diagram-dialog .mdmark-diagram-box"),
  ).resolves.toBe(await defaultBoxShadow(page));
});

/** `--mdmark-diagram-max-height` の既定（36rem）の px */
const MAX_HEIGHT_PX = 576;

/** 表示する枠の今の倍率での図の高さ（大きさのノードの `style.height`）と、表示する枠の `clientHeight` */
function viewportHeights(page: Page) {
  return page.locator(".mdmark-diagram-viewport").evaluate((viewport) => {
    const sizer = viewport.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    return {
      content: Number.parseFloat(sizer?.style.height ?? ""),
      client: viewport.clientHeight,
    };
  });
}

// 利用側が高さを広げると、36rem を超えて定義の高さ × 倍率まで広がる（Fit から拡大した状態）
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

// 印刷では、attachDiagrams が適用したインラインの高さと上限を削除し、表示する枠の高さが定義の高さ × 倍率になる（Fit から拡大した状態）
test("test_fit_when_printed", async () => {
  // 準備: 大きさのノードの高さが、開いたときの枠のインラインの高さを超えるまで拡大する
  const page = await openFrame("fit", true);
  const viewport = page.locator(".mdmark-diagram-viewport");
  const opened = await viewport.evaluate((element) =>
    Number.parseFloat(element.style.height),
  );
  for (let i = 0; i < 10; i += 1) {
    if ((await viewportHeights(page)).content > opened + 1) {
      break;
    }
    await tool(page, "拡大").click();
  }
  const { content } = await viewportHeights(page);
  expect(content).toBeGreaterThan(opened + 1);
  // 実行
  await page.emulateMedia({ media: "print" });
  // 検証
  const { client } = await viewportHeights(page);
  expect(Math.abs(client - content)).toBeLessThanOrEqual(1);
});

/** 表示する枠の高さと、全体が収まる倍率を確認する値（表示する枠の幅と高さ・図の大きさ） */
function frameSizes(page: Page) {
  return page.locator(".mdmark-diagram-viewport").evaluate((viewport) => {
    const sizer = viewport.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    const stage = viewport.querySelector<HTMLElement>(".mdmark-diagram-stage");
    return {
      height: viewport.getBoundingClientRect().height,
      clientWidth: viewport.clientWidth,
      clientHeight: viewport.clientHeight,
      sizerWidth: Number.parseFloat(sizer?.style.width ?? ""),
      sizerHeight: Number.parseFloat(sizer?.style.height ?? ""),
      scale: stage
        ? new DOMMatrixReadOnly(getComputedStyle(stage).transform).a
        : 0,
    };
  });
}

// リサイズハンドルで表示する枠を低くした状態は、全体が収まる倍率を幅と高さで求め、倍率のボタンは 100%（Resized）
test("test_resized", async () => {
  // 準備・実行
  const page = await openFrame("resized", true);
  // 検証
  // 保った高さ 240px は、図の全体が収まる高さ（狭い画面では幅で決まる高さ）を超えない
  const sizes = await frameSizes(page);
  expect(sizes.height).toBeLessThanOrEqual(241);
  expect(sizes.height).toBeGreaterThan(0);
  expect(sizes.sizerWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
  expect(sizes.sizerHeight).toBeLessThanOrEqual(sizes.clientHeight + 1);
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "100%",
  );
  const handle = page.locator(".mdmark-diagram-resize");
  await expect(handle.getAttribute("role")).resolves.toBe("separator");
  await expect(handle.isVisible()).resolves.toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// リサイズハンドルにフォーカスした状態は、フォーカスの枠が見える（ResizeHandleFocused）
test("test_resize_handle_focused", async () => {
  // 準備・実行
  const page = await openFrame("resize-handle-focused", false);
  // 図の操作を付けた後にハンドルへフォーカスを適用するため、該当するまで待つ
  await page.waitForFunction(
    () => document.activeElement?.matches(".mdmark-diagram-resize") === true,
  );
  // 検証
  const focus = await page
    .locator(".mdmark-diagram-resize")
    .evaluate((handle) => {
      const style = getComputedStyle(handle);
      return {
        focused: document.activeElement === handle,
        outline: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
  expect(focus.focused).toBe(true);
  expect(focus.outline).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);
});

// 機能 diagram-resize がオフの図は、右下にリサイズハンドルが無い（ResizeOff）
test("test_resize_off", async () => {
  // 準備・実行
  const page = await openFrame("resize-off", true);
  // 検証
  await expect(page.locator(".mdmark-diagram-resize").count()).resolves.toBe(0);
  await expect(tool(page, "拡大").count()).resolves.toBe(1);
});

// ノードも線も 1 種類ずつのフロー図は、凡例の項目が無く、凡例の場所を取らない（NoLegendItems）
test("test_no_legend_items", async () => {
  // 準備・実行
  const page = await openFrame("no-legend-items", true);
  // 検証
  const legend = page.locator('[aria-label="凡例"]');
  await expect(legend.locator("li").count()).resolves.toBe(0);
  await expect(legend.isVisible()).resolves.toBe(false);
  const gap = await page.locator("figure.mdmark-diagram").evaluate((figure) => {
    const box = figure
      .querySelector(".mdmark-diagram-box")
      ?.getBoundingClientRect();
    return box ? figure.getBoundingClientRect().bottom - box.bottom : -1;
  });
  expect(gap).toBeLessThanOrEqual(16);
});

// 種類 mermaid は題名だけのタイトルで、範囲と更新日を出さず、凡例の場所を取らない（Mermaid）
test("test_mermaid", async () => {
  // 準備・実行
  const page = await openFrame("mermaid", true);
  // 検証
  const figure = page.locator("figure.mdmark-diagram");
  await expect(figure.getAttribute("data-diagram")).resolves.toBe("mermaid");
  await expect(figure.locator("figcaption").innerText()).resolves.toBe(
    "問い合わせの受付",
  );
  await expect(figure.locator("figcaption time").count()).resolves.toBe(0);
  await expect(page.locator('[aria-label="凡例"]').isVisible()).resolves.toBe(
    false,
  );
  await expect(figure.locator(".mdmark-mermaid svg").count()).resolves.toBe(1);
});

// 指で図を動かす操作中は、表示するノードの線がリンクの色の 2px で、表示する枠の touch-action が none（TouchActive）
test("test_touch_active", async () => {
  // 準備・実行
  const page = await openFrame("touch-active", false);
  // 検証
  const link = await resolveColor(page, "var(--mdmark-color-link)");
  await expect(boxShadow(page)).resolves.toBe(`${link} 0px 0px 0px 2px inset`);
  await expect(
    page
      .locator(".mdmark-diagram-viewport")
      .evaluate((viewport) => getComputedStyle(viewport).touchAction),
  ).resolves.toBe("none");
  await expect(
    page.locator(".mdmark-diagram-box").getAttribute("data-touch-active"),
  ).resolves.toBe("");
});
