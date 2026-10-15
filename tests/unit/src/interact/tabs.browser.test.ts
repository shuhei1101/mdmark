import { afterEach, expect, test } from "vitest";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** タブの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTabs = () => import("../../../../src/interact/tabs.ts");

const detachers: Array<() => void> = [];

/** 3 つの中身を持つタブの文書 */
const TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "macOS の手順",
  "",
  "### Windows",
  "",
  "Windows の手順",
  "",
  "### Linux",
  "",
  "Linux の手順",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

/** 今フォーカスのある要素にキーを押す */
function press(key: string): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true }),
  );
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

// 押すと矢印キーで切り替わる（正常系）
test("test_attach_tabs", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const { root } = createRoot(TABS_MARKDOWN);
  detachers.push(attachTabs(root));
  const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  /** 位置のタブだけが選ばれ、フォーカスがあり、その中身だけが見えている */
  const expectSelected = (index: number): void => {
    tabs.forEach((tab, i) => {
      expect(tab.getAttribute("aria-selected")).toBe(String(i === index));
    });
    expect(document.activeElement).toBe(tabs[index]);
    panels.forEach((panel, i) => {
      expect(panel.hasAttribute("hidden")).toBe(i !== index);
    });
  };
  // 実行・検証
  expect(tabs).toHaveLength(3);
  tabs[1].click();
  expectSelected(1);
  press("ArrowRight");
  expectSelected(2);
  press("End");
  expectSelected(2);
  press("Home");
  expectSelected(0);
});
