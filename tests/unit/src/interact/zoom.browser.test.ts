import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 拡大・縮小・移動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadZoom = () => import("../../../../src/interact/zoom.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 図の帯と同じ並びの、移動・拡大と縮小のボタン（`data-tool` で見分ける） */
const TOOLS_HTML = [
  '<div class="tools">',
  '<div data-group="pan" hidden>',
  '<button type="button" data-tool="left" aria-label="左へ動かす"></button>',
  '<button type="button" data-tool="up" aria-label="上へ動かす"></button>',
  '<button type="button" data-tool="down" aria-label="下へ動かす"></button>',
  '<button type="button" data-tool="right" aria-label="右へ動かす"></button>',
  "</div>",
  '<div data-group="zoom">',
  '<button type="button" data-tool="out" aria-label="縮小"></button>',
  '<button type="button" data-tool="fit" aria-label="倍率 100%。全体が収まる倍率に戻す">100%</button>',
  '<button type="button" data-tool="in" aria-label="拡大"></button>',
  "</div>",
  "</div>",
].join("");

/** 幅 600px・高さ 400px の表示する枠に、幅 1100・高さ 300 の中身を置き、拡大・縮小・移動を付ける */
async function setUp(
  onChange?: (zoom: number, fit: number) => void,
  percentBase?: "fit" | "content",
) {
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    ...(onChange ? { onChange } : {}),
    ...(percentBase ? { percentBase } : {}),
  });
  detachers.push(() => zoom.detach());
  return { root, tools, viewport, zoom };
}

/** 読み上げの名前でボタンを探す */
function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) {
    throw new Error(`ボタンが無い: ${name}`);
  }
  return found;
}

/** 倍率のボタンの文字 */
function zoomText(root: ParentNode): string {
  return root.querySelector('[data-tool="fit"]')?.textContent ?? "";
}

// 収まる倍率で始め、拡大・縮小と戻す（正常系）
test("test_attach_zoom", async () => {
  // 準備
  const onChange = vi.fn();
  const { root, viewport } = await setUp(onChange);
  // 検証: 収まる倍率で始める
  expect(zoomText(root)).toBe("55%");
  expect(button(root, "縮小").disabled).toBe(true);
  // 実行
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe("68%");
  // 実行
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(zoomText(root)).toBe("55%");
  const zooms = onChange.mock.calls.map(([zoom]) => Math.round(zoom * 100));
  expect(zooms).toEqual(expect.arrayContaining([68, 55]));
});

// 全体が収まる倍率を 100% として出す（正常系）
test("test_attach_zoom_when_percent_base_fit", async () => {
  // 準備
  const { root } = await setUp(undefined, "fit");
  // 検証: 収まる倍率を 100% で始める
  expect(zoomText(root)).toBe("100%");
  // 実行
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe("125%");
  expect(
    root.querySelector('[data-tool="fit"]')?.getAttribute("aria-label"),
  ).toBe("倍率 125%。全体が収まる倍率に戻す");
});

// 拡大中だけ移動のボタンを出し、矢印キーとドラッグで動かす（正常系）
test("test_attach_zoom_when_panned", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { root, viewport } = await setUp();
  const panGroup = root.querySelector<HTMLElement>('[data-group="pan"]');
  button(root, "拡大").click();
  button(root, "拡大").click();
  const before = viewport.scrollLeft;
  // 実行: 矢印キー
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(panGroup?.hidden).toBe(false);
  expect(viewport.scrollLeft - before).toBe(80);
  // 実行: 左へ 40px ドラッグ
  const afterKey = viewport.scrollLeft;
  const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
  viewport.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 300 }),
  );
  viewport.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientX: 260 }),
  );
  viewport.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientX: 260 }),
  );
  // 検証
  expect(viewport.scrollLeft - afterKey).toBe(40);
});

// 外すと操作が効かない（正常系）
test("test_attach_zoom_when_detached", async () => {
  // 準備
  const { root, zoom } = await setUp();
  const before = zoomText(root);
  // 実行
  zoom.detach();
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe(before);
});

// しきい値までのドラッグでは動かさず、超えたら動かして onPanStart を呼ぶ（正常系）
test("test_attach_zoom_when_drag_threshold", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  let panStarts = 0;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    onPanStart: () => {
      panStarts += 1;
    },
  });
  detachers.push(() => zoom.detach());
  button(root, "拡大").click();
  button(root, "拡大").click();
  viewport.scrollLeft = 200;
  const before = viewport.scrollLeft;
  const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
  // 実行: 2px だけ動かして離す
  content.dispatchEvent(new PointerEvent("pointerdown", { ...point, clientX: 300 }));
  content.dispatchEvent(new PointerEvent("pointermove", { ...point, clientX: 298 }));
  content.dispatchEvent(new PointerEvent("pointerup", { ...point, clientX: 298 }));
  // 検証
  expect(viewport.scrollLeft).toBe(before);
  expect(panStarts).toBe(0);
  // 実行: 40px 左へ動かして離す
  content.dispatchEvent(new PointerEvent("pointerdown", { ...point, clientX: 300 }));
  content.dispatchEvent(new PointerEvent("pointermove", { ...point, clientX: 260 }));
  content.dispatchEvent(new PointerEvent("pointerup", { ...point, clientX: 260 }));
  // 検証
  expect(viewport.scrollLeft).toBeGreaterThan(before);
  expect(panStarts).toBe(1);
});

// fitHeight の関数が true を返すようになった後の refit() で、倍率を保ち下限を高さで求め直す（正常系）
test("test_attach_zoom_when_refit", async () => {
  // 準備
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 500px; height: 1600px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  let useHeight = false;
  const zooms: number[] = [];
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 500, height: 1600 },
    tools,
    fitHeight: () => useHeight,
    onChange: (value) => {
      zooms.push(value);
    },
  });
  detachers.push(() => zoom.detach());
  const fitBefore = zoom.fit();
  const outBefore = button(root, "縮小").disabled;
  // 実行
  useHeight = true;
  zoom.refit();
  // 検証
  expect(fitBefore).toBe(1);
  expect(outBefore).toBe(true);
  expect(zoom.fit()).toBeCloseTo(viewport.clientHeight / 1600, 5);
  expect(zooms.at(-1) ?? 1).toBe(1);
  expect(button(root, "縮小").disabled).toBe(false);
});
