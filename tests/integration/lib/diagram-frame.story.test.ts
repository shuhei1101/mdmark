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

/** リサイズハンドル（フォーカスできる separator）が、描いた直後から高さの値（aria-valuenow・aria-valuemin・aria-valuemax）を持つ */
async function expectResizeValues(page: Page): Promise<void> {
  const values = await page
    .locator(".mdmark-diagram-resize")
    .evaluate((handle) => ({
      now: Number(handle.getAttribute("aria-valuenow")),
      min: Number(handle.getAttribute("aria-valuemin")),
      max: Number(handle.getAttribute("aria-valuemax")),
      text: handle.getAttribute("aria-valuetext"),
    }));
  expect(values.min).toBeGreaterThan(0);
  expect(values.now).toBeGreaterThanOrEqual(values.min);
  expect(values.max).toBeGreaterThanOrEqual(values.now);
  expect(values.text).toBe(`${values.now}px`);
}

/** スクリーンリーダー向けの名前を持つボタンの状態 */
function tool(page: Page, name: string) {
  return page.locator(`button[aria-label="${name}"]`);
}

/** 右上のパネルの見えているボタンの、スクリーンリーダー向けの名前（「。」より前）・上端・大きさ（DOM の順） */
function visibleTools(page: Page) {
  return page.locator(".mdmark-diagram-tools button").evaluateAll((buttons) =>
    buttons
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          name: button.getAttribute("aria-label")?.split("。")[0] ?? "",
          top: Math.round(rect.top),
          width: rect.width,
          height: rect.height,
        };
      }),
  );
}

/** 表示する枠が `data-at-fit` を持つかと、縦のはみ出しの計算値 */
function viewportState(page: Page) {
  return page.locator(".mdmark-diagram-viewport").evaluate((viewport) => ({
    atFit: viewport.hasAttribute("data-at-fit"),
    overflowY: getComputedStyle(viewport).overflowY,
  }));
}

// 開いたときは全体が収まる倍率で、右上のパネルは倍率のボタンと開閉のボタンだけに畳み（倍率のボタンは押せるが何も変わらない）、縦にスクロールしない（Fit）
test("test_fit", async () => {
  // 準備・実行
  const page = await openFrame("fit", true);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "100%",
  );
  const shownTools = await visibleTools(page);
  expect(shownTools.map((item) => item.name)).toEqual([
    "倍率 100%",
    "表示の操作を開く",
  ]);
  await expect(
    tool(page, "表示の操作を開く").getAttribute("aria-expanded"),
  ).resolves.toBe("false");
  await expect(viewportState(page)).resolves.toEqual({
    atFit: true,
    overflowY: "hidden",
  });
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
  await expect(page.locator('[data-group="pan"]').count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
  // 面に包まない表示するノードは、既定の線で描く
  await expect(boxShadow(page)).resolves.toBe(await defaultBoxShadow(page));
});

// 縦に長い図は、全体が収まる倍率でも表示する枠に縦に収まらないため、data-at-fit を持たずに縦にもスクロールする（FitTall）
test("test_fit_tall", async () => {
  // 準備・実行
  const page = await openFrame("fit-tall", true);
  // 検証
  await expect(viewportState(page)).resolves.toEqual({
    atFit: false,
    overflowY: "auto",
  });
  const sizes = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((viewport) => ({
      client: viewport.clientHeight,
      scroll: viewport.scrollHeight,
    }));
  expect(sizes.client).toBe(160);
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
});

// 1 段拡大してパネルを開いた状態は、縮小・倍率・拡大・全画面・開閉のボタンを 1 行に並べ、縦にもスクロールできる（Zoomed）
test("test_zoomed", async () => {
  // 準備・実行
  const page = await openFrame("zoomed", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "125%",
  );
  const shownTools = await visibleTools(page);
  expect(shownTools.map((item) => item.name)).toEqual([
    "縮小",
    "倍率 125%",
    "拡大",
    "全画面で開く",
    "表示の操作を閉じる",
  ]);
  expect(new Set(shownTools.map((item) => item.top)).size).toBe(1);
  await expect(
    tool(page, "表示の操作を閉じる").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(page.locator('[data-group="pan"]').count()).resolves.toBe(0);
  await expect(viewportState(page)).resolves.toEqual({
    atFit: false,
    overflowY: "auto",
  });
  await expectResizeValues(page);
});

// 上限（全体が収まる倍率の 5 倍）では、拡大を押せない（Max）
test("test_max", async () => {
  // 準備・実行
  const page = await openFrame("max", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "500%",
  );
  await expect(tool(page, "拡大").isDisabled()).resolves.toBe(true);
  await expect(tool(page, "縮小").isDisabled()).resolves.toBe(false);
});

// 下限（全体が収まる倍率の 0.25 倍）では、縮小を押せず、表示する枠は data-at-fit を持つ（Min）
test("test_min", async () => {
  // 準備・実行
  const page = await openFrame("min", false);
  // 検証
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "25%",
  );
  await expect(tool(page, "縮小").isDisabled()).resolves.toBe(true);
  await expect(tool(page, "拡大").isDisabled()).resolves.toBe(false);
  await expect(viewportState(page)).resolves.toEqual({
    atFit: true,
    overflowY: "hidden",
  });
});

// 狭い枠では、凡例が折り返し、パネルはボタンを 24px 四方にして 1 行に収め、横にはみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openFrame("narrow", false);
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
  await expect(page.locator(".mdmark-diagram-zoom").innerText()).resolves.toBe(
    "125%",
  );
  const shownTools = await visibleTools(page);
  expect(shownTools).toHaveLength(5);
  expect(new Set(shownTools.map((item) => item.top)).size).toBe(1);
  expect(
    shownTools
      .filter((item) => !item.name.startsWith("倍率"))
      .map(({ width, height }) => ({ width, height })),
  ).toEqual(Array(4).fill({ width: 24, height: 24 }));
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
  await tool(page, "表示の操作を開く").click();
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
  await tool(page, "表示の操作を開く").click();
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
  // リサイズハンドルは表示する枠の下の高さ 24px 以上の帯で、中央に 40×4 の横棒がある
  const [handleBox, viewportBox, barBox] = await Promise.all(
    [
      ".mdmark-diagram-resize",
      ".mdmark-diagram-viewport",
      ".mdmark-diagram-resize-bar",
    ].map((selector) =>
      page
        .locator(selector)
        .evaluate((node) => node.getBoundingClientRect().toJSON() as DOMRect),
    ),
  );
  const strip = {
    height: handleBox.height,
    belowViewport: handleBox.top >= viewportBox.bottom - 1,
    barWidth: barBox.width,
    barHeight: barBox.height,
    barOffset: Math.abs(
      barBox.left + barBox.width / 2 - (handleBox.left + handleBox.width / 2),
    ),
  };
  expect(strip.height).toBeGreaterThanOrEqual(24);
  expect(strip.belowViewport).toBe(true);
  expect(strip.barWidth).toBeCloseTo(40, 0);
  expect(strip.barHeight).toBeCloseTo(4, 0);
  expect(strip.barOffset).toBeLessThanOrEqual(1);
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

// リサイズハンドルにポインターを乗せると、中央の横棒の色が --mdmark-color-text になる（ResizeHandleHover）
test("test_resize_handle_hover", async () => {
  // 準備
  const page = await openFrame("resize-handle-hover", true);
  const bar = page.locator(".mdmark-diagram-resize-bar");
  const muted = await resolveColor(page, "var(--mdmark-color-muted)");
  const text = await resolveColor(page, "var(--mdmark-color-text)");
  const barColor = () =>
    bar.evaluate((node) => getComputedStyle(node).backgroundColor);
  await expect(barColor()).resolves.toBe(muted);
  // 実行
  await page.locator(".mdmark-diagram-resize").hover();
  // 検証
  await expect(barColor()).resolves.toBe(text);
});

// 機能 diagram-resize がオフの図は、表示する枠の下端にリサイズハンドルが無い（ResizeOff）
test("test_resize_off", async () => {
  // 準備・実行
  const page = await openFrame("resize-off", true);
  // 検証
  await expect(page.locator(".mdmark-diagram-resize").count()).resolves.toBe(0);
  await expect(tool(page, "拡大").count()).resolves.toBe(1);
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

// 種類 map で開いたパネルは、先頭に外へ戻る（押せない）・全て開く・全て閉じる・配置と選択を元に戻す（押せない）を並べ、1 行に収める（Map）
test("test_map", async () => {
  // 準備・実行
  const page = await openFrame("map-tools", false);
  // 検証
  const shownTools = await visibleTools(page);
  expect(shownTools.map((item) => item.name).slice(0, 4)).toEqual([
    "外へ戻る",
    "全て開く",
    "全て閉じる",
    "配置と選択を元に戻す",
  ]);
  expect(new Set(shownTools.map((item) => item.top)).size).toBe(1);
  await expect(tool(page, "外へ戻る").isDisabled()).resolves.toBe(true);
  await expect(tool(page, "配置と選択を元に戻す").isDisabled()).resolves.toBe(
    true,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 種類 map で外のグループの中へ入った状態は、畳んだパネルに外へ戻る（押せる）・倍率・開閉のボタンを並べる（MapInGroup）
test("test_map_in_group", async () => {
  // 準備・実行
  const page = await openFrame("map-in-group", false);
  // 検証
  const shownTools = await visibleTools(page);
  expect(shownTools.map((item) => item.name)).toEqual([
    "外へ戻る",
    expect.stringMatching(/^倍率 \d+%$/),
    "表示の操作を開く",
  ]);
  await expect(tool(page, "外へ戻る").isDisabled()).resolves.toBe(false);
});

// 範囲の外の純粋な Mermaid を描いた map の図は、タイトルが図の種類の名前（PlainMap）
test("test_plain_map", async () => {
  // 準備・実行
  const page = await openFrame("plain-map", false);
  // 検証
  await expect(
    page
      .locator('figure.mdmark-diagram[data-diagram="map"] figcaption')
      .innerText(),
  ).resolves.toBe("シーケンス図");
});

/** 要素の矩形（ページの座標） */
function boxOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });
}

/** 2 つの矩形が重なるか */
function boxesOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

// 種類 map で書き出すボタンを押した状態は、全画面のボタンの隣に開いた書き出すボタンと「SVG」「PNG」の要素を出す（MapExportOpen）
test("test_map_export_open", async () => {
  // 準備・実行
  const page = await openFrame("map-export-open", false);
  // 検証
  const names = (await visibleTools(page)).map((item) => item.name);
  expect(names[0]).toBe("一覧で表示");
  expect(names[names.indexOf("全画面で開く") + 1]).toBe("図を書き出す");
  const button = tool(page, "図を書き出す");
  await expect(button.getAttribute("aria-expanded")).resolves.toBe("true");
  await expect(button.getAttribute("aria-haspopup")).resolves.toBeNull();
  const panel = page.locator(".mdmark-diagram-export");
  await expect(panel.isVisible()).resolves.toBe(true);
  await expect(panel.getAttribute("popover")).resolves.toBeNull();
  await expect(panel.locator("button").allInnerTexts()).resolves.toEqual([
    "SVG",
    "PNG",
  ]);
  const panelBox = await boxOf(page, ".mdmark-diagram-export");
  const viewportBox = await boxOf(page, ".mdmark-diagram-viewport");
  expect(panelBox.top).toBeGreaterThanOrEqual(viewportBox.top);
  expect(panelBox.right).toBeLessThanOrEqual(viewportBox.right + 1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 種類 map で一覧の表示にした状態は、押したボタンと一覧を出し、図を隠す（MapListView）
test("test_map_list_view", async () => {
  // 準備・実行
  const page = await openFrame("map-list-view", false);
  // 検証
  await expect(
    tool(page, "一覧で表示").getAttribute("aria-pressed"),
  ).resolves.toBe("true");
  await expect(tool(page, "一覧で表示").isVisible()).resolves.toBe(true);
  await expect(
    page.locator(".mdmark-diagram-viewport [role=tree]").count(),
  ).resolves.toBe(1);
  await expect(page.locator(".mdmark-diagram-sizer").isVisible()).resolves.toBe(
    false,
  );
  const first = await boxOf(page, '[role="treeitem"]');
  const tools = await boxOf(page, ".mdmark-diagram-tools");
  expect(boxesOverlap(first, tools)).toBe(false);
});

// 幅 390px で一覧の表示にした状態は、変更のバッジを持つ最初の項目がパネルと重ならず、横にはみ出さない（MapListViewNarrow）
test("test_map_list_view_narrow", async () => {
  // 準備・実行
  // 幅 390px の置き場所（ストーリーの枠）とページの余白が収まる画面で開く
  const page = await holder.openStory(
    "parts-diagramframe--map-list-view-narrow",
    {
      width: 480,
      height: 844,
    },
  );
  // 検証
  const first = await boxOf(page, '[role="treeitem"]');
  const tools = await boxOf(page, ".mdmark-diagram-tools");
  expect(boxesOverlap(first, tools)).toBe(false);
  await expect(
    page
      .locator('[role="treeitem"]')
      .first()
      .locator(".mdmark-map-change")
      .innerText(),
  ).resolves.toBe("追加");
  const tree = await page
    .locator('[role="tree"]')
    .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(tree).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 種類 map のガントチャートは、書き出すボタンがあり、一覧の表示のボタンが無い（MapNoList）
test("test_map_no_list", async () => {
  // 準備・実行
  const page = await openFrame("map-no-list", false);
  // 検証
  const names = (await visibleTools(page)).map((item) => item.name);
  expect(names).toContain("図を書き出す");
  expect(names).not.toContain("一覧で表示");
});

// PNG にできなかった後の状態は、要素を開いたまま「SVG」「PNG」の下に案内の文を出す（MapExportFailed）
test("test_map_export_failed", async () => {
  // 準備・実行
  const page = await openFrame("map-export-failed", false);
  // 検証
  await expect(
    tool(page, "図を書き出す").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  const status = page.locator('.mdmark-diagram-export [role="status"]');
  await expect(status.innerText()).resolves.toBe(
    "この大きさの図は PNG にできません。SVG で書き出してください。",
  );
  const png = await boxOf(page, '[data-export="png"]');
  const text = await boxOf(page, '.mdmark-diagram-export [role="status"]');
  expect(text.top).toBeGreaterThanOrEqual(png.bottom - 1);
});
