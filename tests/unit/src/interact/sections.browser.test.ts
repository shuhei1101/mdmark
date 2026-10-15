import { afterEach, expect, test, vi } from "vitest";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** 節の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSections = () => import("../../../../src/interact/sections.ts");

const detachers: Array<() => void> = [];

/** 節の ID の中身の要素を返す */
function sectionBody(root: HTMLElement, id: string): HTMLElement {
  const body = root.querySelector<HTMLElement>(`[id="section-${id}"]`);
  if (!body) {
    throw new Error(`節の中身が無い: ${id}`);
  }
  return body;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  history.replaceState(null, "", location.pathname);
});

// 閉じた節を閉じ、押すと開く（正常系）
test("test_attach_sections", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "## 開く\n\n本文1\n\n## 閉じる\n\n<!-- section: closed -->\n\n本文2\n",
  );
  // 実行
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  // 検証
  const closed = sectionBody(root, "閉じる");
  expect(sectionBody(root, "開く").hasAttribute("hidden")).toBe(false);
  expect(closed.getAttribute("hidden")).toBe("until-found");
  const toggle = root.querySelector<HTMLButtonElement>(
    '[aria-controls="section-閉じる"]',
  );
  toggle?.click();
  expect(closed.hasAttribute("hidden")).toBe(false);
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
});

// 閉じた節の中の ID への hashchange で開く（正常系）
test("test_attach_sections_when_hash", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "## 親\n\n<!-- section: closed -->\n\n### 注意\n\n本文\n",
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const closed = sectionBody(root, "親");
  // 実行
  location.hash = "#注意";
  // 検証
  await vi.waitFor(() => {
    expect(closed.hasAttribute("hidden")).toBe(false);
  });
});

// 行の詳細を閉じ、押すと開く（正常系）
test("test_attach_sections_when_row_detail", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    [
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "",
      "<!-- row-detail: 2 -->",
      "",
      "詳細の段落",
      "",
      "<!-- /row-detail -->",
      "",
    ].join("\n"),
  );
  // 実行
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  // 検証
  const toggles = root.querySelectorAll<HTMLButtonElement>(
    "button.mdmark-row-toggle",
  );
  expect(toggles).toHaveLength(1);
  const rows = root.querySelectorAll("tbody tr:not(.mdmark-row-detail)");
  expect(rows[1]?.contains(toggles[0])).toBe(true);
  const detail = root.querySelector<HTMLElement>("tr.mdmark-row-detail");
  expect(detail?.hasAttribute("hidden")).toBe(true);
  toggles[0].click();
  expect(detail?.hasAttribute("hidden")).toBe(false);
});
