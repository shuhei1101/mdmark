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

// まとめた HTML の # の形でも閉じた節を開く（正常系）
test("test_attach_sections_when_bundle_hash", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "## 親\n\n<!-- section: closed -->\n\n### 注意\n\n本文\n",
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const closed = sectionBody(root, "親");
  // 実行
  location.hash = "#/a.md#%E6%B3%A8%E6%84%8F";
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

// 行の詳細の開閉ボタンの名前にツールチップの文字を含めない（正常系）
test("test_attach_sections_when_row_has_term", async () => {
  // 準備
  const { mount } = await import("../../../../src/mount.ts");
  const markdown = [
    "| 名前 | 値 |",
    "| --- | --- |",
    "| 印 | 1 |",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 印 | HTML コメントで書く指定 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  const root = document.createElement("div");
  document.body.append(root);
  // 実行
  const handle = mount(root, { markdown });
  // 検証
  try {
    const toggle = root.querySelector<HTMLButtonElement>(
      "button.mdmark-row-toggle",
    );
    expect(root.querySelector("tbody td .mdmark-term")?.textContent).toBe("印");
    expect(toggle?.getAttribute("aria-label")).toBe("「印」の詳細");
  } finally {
    handle.destroy();
    root.remove();
  }
});

// 選ばれていないタブの中の ID への hashchange でそのタブを選ぶ（正常系）
test("test_attach_sections_when_hash_in_tab", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { attachTabs } = await import("../../../../src/interact/tabs.ts");
  const { root } = createRoot(
    [
      "<!-- tabs -->",
      "",
      "### macOS",
      "",
      "macOS の手順",
      "",
      "### Windows",
      "",
      "#### 補足",
      "",
      "<!-- section: closed -->",
      "",
      "##### 注意",
      "",
      "本文",
      "",
      "<!-- /tabs -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  detachers.push(attachTabs(root));
  const closed = sectionBody(root, "補足");
  const windows = [...root.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (tab) => tab.textContent === "Windows",
  );
  // 実行
  location.hash = "#注意";
  // 検証
  await vi.waitFor(() => {
    expect(windows?.getAttribute("aria-selected")).toBe("true");
  });
  expect(closed.hasAttribute("hidden")).toBe(false);
});
