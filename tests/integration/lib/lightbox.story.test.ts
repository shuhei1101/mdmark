import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 帯のボタンが 1 行に並ぶ画面
const WIDE_VIEWPORT = { width: 900, height: 600 };

/** ライトボックスのストーリーを開く */
function open(id: string, viewport = WIDE_VIEWPORT): Promise<Page> {
  return holder.openStory(`parts-lightbox--${id}`, viewport);
}

/** 帯のボタンの押せるかと出ているか */
async function readTools(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector(
      "dialog.mdmark-lightbox",
    ) as HTMLElement;
    const tool = (name: string) =>
      dialog.querySelector(`[data-tool="${name}"]`) as HTMLButtonElement | null;
    const visible = (element: Element | null) =>
      element !== null && (element as HTMLElement).offsetParent !== null;
    const pan = dialog.querySelector('[data-group="pan"]');
    return {
      label: dialog.getAttribute("aria-label"),
      count:
        dialog.querySelector(".mdmark-lightbox-count")?.textContent ?? null,
      navVisible: visible(dialog.querySelector(".mdmark-lightbox-nav")),
      prevDisabled: tool("prev")?.disabled ?? null,
      nextDisabled: tool("next")?.disabled ?? null,
      outDisabled: tool("out")?.disabled ?? null,
      inDisabled: tool("in")?.disabled ?? null,
      zoomText: tool("fit")?.textContent ?? null,
      zoomLabel: tool("fit")?.getAttribute("aria-label") ?? null,
      panVisible: visible(pan),
      closeLabel: tool("close")?.getAttribute("aria-label") ?? null,
      stageZoomed:
        dialog
          .querySelector(".mdmark-lightbox-stage")
          ?.classList.contains("is-zoomed") ?? false,
      stageLabel:
        dialog
          .querySelector(".mdmark-lightbox-stage")
          ?.getAttribute("aria-label") ?? null,
      caption:
        dialog.querySelector(".mdmark-lightbox-caption")?.textContent ?? "",
    };
  });
}

// 15 枚の 3 枚目は、全体が収まる倍率で前後のボタンを押せ、縮小を押せず、移動のボタンを出さない（Middle）
test("test_middle", async () => {
  // 準備・実行
  const page = await open("middle");
  // 検証
  const tools = await readTools(page);
  expect(tools.label).toBe("画像の拡大");
  expect(tools.count).toBe("3 / 15");
  expect(tools.prevDisabled).toBe(false);
  expect(tools.nextDisabled).toBe(false);
  expect(tools.outDisabled).toBe(true);
  expect(tools.inDisabled).toBe(false);
  expect(tools.zoomText).toBe("100%");
  expect(tools.panVisible).toBe(false);
  expect(tools.closeLabel).toBe("拡大を閉じる");
  expect(tools.caption).toBe("幅 240px");
  await expect(
    page
      .locator('[role="group"][aria-label="画像の送り"] button')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      ),
  ).resolves.toEqual(["前の画像", "次の画像"]);
  await expect(
    page.locator('[role="toolbar"]').getAttribute("aria-label"),
  ).resolves.toBe("画像の拡大の操作");
  // 帯は画像の上、キャプションは画像の下
  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().top ?? 0;
    return [
      top(".mdmark-lightbox-head"),
      top(".mdmark-lightbox-stage"),
      top(".mdmark-lightbox-caption"),
    ];
  });
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

// 1 枚目は、前の画像のボタンを押せない（First）
test("test_first", async () => {
  // 準備・実行
  const tools = await readTools(await open("first"));
  // 検証
  expect(tools.count).toBe("1 / 15");
  expect(tools.prevDisabled).toBe(true);
  expect(tools.nextDisabled).toBe(false);
});

// 最後の画像は、次の画像のボタンを押せない（Last）
test("test_last", async () => {
  // 準備・実行
  const tools = await readTools(await open("last"));
  // 検証
  expect(tools.count).toBe("15 / 15");
  expect(tools.prevDisabled).toBe(false);
  expect(tools.nextDisabled).toBe(true);
});

// 画像が 1 枚のときは、前後のボタンと枚数を出さない（Single）
test("test_single", async () => {
  // 準備・実行
  const tools = await readTools(await open("single"));
  // 検証
  expect(tools.navVisible).toBe(false);
  expect(tools.closeLabel).toBe("拡大を閉じる");
  expect(tools.caption).toBe("中央に置いた画面");
});

// 250% に拡大したときは、移動のボタンを出し、画像の場所に読み上げの名前を付ける（Zoomed）
test("test_zoomed", async () => {
  // 準備・実行
  const page = await open("zoomed");
  // 検証
  const tools = await readTools(page);
  expect(tools.zoomText).toBe("250%");
  expect(tools.zoomLabel).toBe("倍率 250%。全体が収まる倍率に戻す");
  expect(tools.outDisabled).toBe(false);
  expect(tools.inDisabled).toBe(false);
  expect(tools.panVisible).toBe(true);
  expect(tools.stageZoomed).toBe(true);
  expect(tools.stageLabel).toBe("拡大した画像。ドラッグか矢印キーで動かす");
  await expect(
    page
      .locator('[data-group="pan"] button')
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      ),
  ).resolves.toEqual(["左へ動かす", "上へ動かす", "下へ動かす", "右へ動かす"]);
  await expect(
    page.locator(".mdmark-lightbox-stage").getAttribute("tabindex"),
  ).resolves.toBe("0");
});

// 上限の 300% では、拡大を押せない（Max）
test("test_max", async () => {
  // 準備・実行
  const tools = await readTools(await open("max"));
  // 検証
  expect(tools.zoomText).toBe("300%");
  expect(tools.inDisabled).toBe(true);
  expect(tools.outDisabled).toBe(false);
  expect(tools.panVisible).toBe(true);
});

// 長いキャプションは、画面の幅の中で折り返す（LongCaption）
test("test_long_caption", async () => {
  // 準備・実行
  const page = await open("long-caption", { width: 420, height: 600 });
  // 検証
  const caption = await page.evaluate(() => {
    const element = document.querySelector(
      ".mdmark-lightbox-caption",
    ) as HTMLElement;
    const dialog = document.querySelector(
      "dialog.mdmark-lightbox",
    ) as HTMLElement;
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      right: element.getBoundingClientRect().right,
      dialogRight: dialog.getBoundingClientRect().right,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  expect(caption.height).toBeGreaterThan(caption.lineHeight * 1.5);
  expect(caption.right).toBeLessThanOrEqual(caption.dialogRight + 1);
  expect(caption.scrollWidth).toBeLessThanOrEqual(caption.clientWidth);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 幅の狭い画面では、帯を折り返し、送りと閉じるのボタンを両端に残す（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  // ストーリーは幅 390px の枠で描くため、描く先の要素の余白を足した幅の画面で開く
  const page = await open("narrow", { width: 480, height: 600 });
  // 検証
  const layout = await page.evaluate(() => {
    const head = document.querySelector(".mdmark-lightbox-head") as HTMLElement;
    const prev = head.querySelector('[data-tool="prev"]') as HTMLElement;
    const close = head.querySelector('[data-tool="close"]') as HTMLElement;
    const headBox = head.getBoundingClientRect();
    return {
      prevGap: prev.getBoundingClientRect().left - headBox.left,
      closeGap: headBox.right - close.getBoundingClientRect().right,
      closeRight: close.getBoundingClientRect().right,
      headRight: headBox.right,
    };
  });
  expect(layout.prevGap).toBeLessThan(32);
  expect(layout.closeGap).toBeLessThan(32);
  expect(layout.closeRight).toBeLessThanOrEqual(layout.headRight);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
