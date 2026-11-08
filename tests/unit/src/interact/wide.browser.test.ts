import { afterEach, expect, test } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** wide の範囲の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadWide = () => import("../../../../src/interact/wide.ts");

const detachers: Array<() => void> = [];

/** 本文の幅を越える表を中に持つ、2 つの wide の範囲の HTML */
const RANGES_HTML = [
  '<div class="mdmark-wide-range" data-state="wide"><table><tr><td style="width:2000px">a</td></tr></table></div>',
  '<div class="mdmark-wide-range" data-state="narrow"><table><tr><td style="width:2000px">b</td></tr></table></div>',
].join("");

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** 次の描画の後まで待つ（ResizeObserver の通知を待つ） */
function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

// ボタンを配置して状態を入れ替える（正常系）
test("test_attach_wide_toggles", async () => {
  // 準備
  addStyles();
  const { attachWideToggles } = await loadWide();
  const root = createRootFromHtml(RANGES_HTML);
  root.style.width = "1600px";
  // 実行
  detachers.push(attachWideToggles(root));
  const ranges = [...root.querySelectorAll<HTMLElement>(".mdmark-wide-range")];
  const buttons = ranges.map((range) =>
    range.previousElementSibling?.querySelector<HTMLButtonElement>(
      "button.mdmark-wide-toggle",
    ),
  );
  const before = buttons.map((button) => button?.getAttribute("aria-pressed"));
  buttons[0]?.click();
  // 検証
  expect(before).toEqual(["true", "false"]);
  expect(ranges[0]?.dataset.state).toBe("narrow");
  expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
});

// 親が狭い幅では帯を隠す（正常系）
test("test_attach_wide_toggles_when_narrow_host", async () => {
  // 準備
  addStyles();
  const { attachWideToggles } = await loadWide();
  const root = createRootFromHtml(RANGES_HTML);
  // 描く先の要素の親を本文の幅にする
  const parent = document.createElement("div");
  parent.style.width = "320px";
  root.before(parent);
  parent.append(root);
  // 実行
  detachers.push(attachWideToggles(root));
  await nextFrame();
  // 検証
  const bars = [...root.querySelectorAll<HTMLElement>(".mdmark-wide-bar")];
  expect(bars).toHaveLength(2);
  for (const bar of bars) {
    expect(bar.hidden).toBe(true);
  }
  parent.replaceWith(root);
  parent.remove();
});
