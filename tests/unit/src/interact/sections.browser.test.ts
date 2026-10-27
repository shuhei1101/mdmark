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

/** 節の ID の開閉のボタンを返す */
function sectionToggle(root: HTMLElement, id: string): HTMLButtonElement {
  const toggle = root.querySelector<HTMLButtonElement>(
    `[aria-controls="section-${id}"]`,
  );
  if (!toggle) {
    throw new Error(`開閉のボタンが無い: ${id}`);
  }
  return toggle;
}

/** 節の ID の開閉のボタンの `aria-expanded` を、渡した順に返す */
function expandedStates(root: HTMLElement, ids: string[]): string[] {
  return ids.map(
    (id) => sectionToggle(root, id).getAttribute("aria-expanded") ?? "",
  );
}

// Shift の開閉の確かめに使う入れ子の節（A の中に B、B の中に閉じた C、A の外に D）
const NESTED_MARKDOWN = [
  "## A",
  "",
  "本文A",
  "",
  "### B",
  "",
  "本文B",
  "",
  "#### C",
  "",
  "<!-- section: closed -->",
  "",
  "本文C",
  "",
  "## D",
  "",
  "本文D",
  "",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
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

// H1 の節も開閉する（正常系）
test("test_attach_sections_when_h1", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "# 手引き\n\n手引きの段落\n\n## 概要\n\n概要の段落\n",
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  // 実行
  sectionToggle(root, "手引き").click();
  // 検証
  const body = sectionBody(root, "手引き");
  expect(sectionToggle(root, "手引き").getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(body.getAttribute("hidden")).toBe("until-found");
  expect(body.contains(root.querySelector("h2"))).toBe(true);
});

// Shift を押しながら押すと、その節と入れ子の節を同じ状態にし、外の節は変えない（正常系）
test("test_attach_sections_when_shift_click", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(NESTED_MARKDOWN);
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const shiftClick = () =>
    sectionToggle(root, "a").dispatchEvent(
      new MouseEvent("click", { shiftKey: true, bubbles: true }),
    );
  // 実行・検証
  shiftClick();
  expect(expandedStates(root, ["a", "b", "c", "d"])).toEqual([
    "false",
    "false",
    "false",
    "true",
  ]);
  shiftClick();
  expect(expandedStates(root, ["a", "b", "c", "d"])).toEqual([
    "true",
    "true",
    "true",
    "true",
  ]);
  expect(sectionBody(root, "c").hasAttribute("hidden")).toBe(false);
});

// Shift を押しながら Enter・Space を押しても入れ子をまとめて開閉し、click を起こさない（正常系）
test("test_attach_sections_when_shift_key", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(NESTED_MARKDOWN);
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const toggle = sectionToggle(root, "a");
  let clicks = 0;
  toggle.addEventListener("click", () => {
    clicks += 1;
  });
  const press = (key: string): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", {
      key,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    toggle.dispatchEvent(event);
    return event;
  };
  // 実行・検証
  const enter = press("Enter");
  expect(expandedStates(root, ["a", "b", "c"])).toEqual([
    "false",
    "false",
    "false",
  ]);
  const space = press(" ");
  expect(expandedStates(root, ["a", "b", "c"])).toEqual([
    "true",
    "true",
    "true",
  ]);
  expect(enter.defaultPrevented).toBe(true);
  expect(space.defaultPrevented).toBe(true);
  expect(clicks).toBe(0);
});

// 外すと節の開閉の関数の控えから取り除く（正常系）
test("test_attach_sections_when_detached", async () => {
  // 準備
  const { attachSections, foldAllSections } = await loadSections();
  const { root } = createRoot("# 手引き\n\n## 導入\n\n導入の段落\n");
  const detach = attachSections({ root, sections: true, rowDetails: true });
  detach();
  // 実行
  foldAllSections({ root, open: false });
  // 検証
  expect(sectionBody(root, "導入").hasAttribute("hidden")).toBe(false);
});

// 入れ子の閉じた節を外側から開いて移る（正常系）
test("test_reveal_target", async () => {
  // 準備
  const { attachSections, revealTarget } = await loadSections();
  const { root } = createRoot(
    [
      "## A",
      "",
      "<!-- section: closed -->",
      "",
      "### B",
      "",
      "<!-- section: closed -->",
      "",
      "#### C",
      "",
      "本文C",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const scrollIntoView = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  const target = root.querySelector<HTMLElement>('h4[id="c"]');
  if (!target) {
    throw new Error("C の見出しが無い");
  }
  // 実行
  revealTarget(target);
  // 検証
  expect(sectionBody(root, "a").hasAttribute("hidden")).toBe(false);
  expect(sectionBody(root, "b").hasAttribute("hidden")).toBe(false);
  expect(expandedStates(root, ["a", "b"])).toEqual(["true", "true"]);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.contexts[0]).toBe(target);
});

// 表の行へはスクロールしない（正常系）
test("test_reveal_target_when_row", async () => {
  // 準備
  const { attachSections, revealTarget } = await loadSections();
  const { root } = createRoot(
    [
      "## A",
      "",
      "<!-- section: closed -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const scrollIntoView = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  const row = root.querySelector<HTMLElement>("tbody tr");
  if (!row) {
    throw new Error("表の行が無い");
  }
  // 実行
  revealTarget(row);
  // 検証
  expect(sectionBody(root, "a").hasAttribute("hidden")).toBe(false);
  expect(scrollIntoView).not.toHaveBeenCalled();
});

// すべて展開は全てを開き、すべて折りたたむは H1 だけ開く（正常系）
test("test_fold_all_sections", async () => {
  // 準備
  const { attachSections, foldAllSections } = await loadSections();
  const { root } = createRoot(
    [
      "# 手引き",
      "",
      "手引きの段落",
      "",
      "## 導入",
      "",
      "導入の段落",
      "",
      "### 注意",
      "",
      "<!-- section: closed -->",
      "",
      "注意の段落",
      "",
      "## 付録",
      "",
      "付録の段落",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const ids = ["手引き", "導入", "注意", "付録"];
  // 実行・検証
  foldAllSections({ root, open: true });
  expect(expandedStates(root, ids)).toEqual(["true", "true", "true", "true"]);
  foldAllSections({ root, open: false });
  expect(expandedStates(root, ids)).toEqual([
    "true",
    "false",
    "false",
    "false",
  ]);
});
