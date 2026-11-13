import { afterEach, expect, test, vi } from "vitest";
import type { PartStates } from "../../../../src/interact/part-states.ts";
import type { SectionStates } from "../../../../src/interact/sections.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** セクションの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSections = () => import("../../../../src/interact/sections.ts");

/** 差分のブロックの処理を読み込む（見出しを包む `div` を作る） */
const loadDiffBlocks = () => import("../../../../src/parts/diff-blocks.ts");

const detachers: Array<() => void> = [];

/** セクションの ID の中身の要素を返却する */
function sectionBody(root: HTMLElement, id: string): HTMLElement {
  const body = root.querySelector<HTMLElement>(`[id="section-${id}"]`);
  if (!body) {
    throw new Error(`セクションの中身が無い: ${id}`);
  }
  return body;
}

/** セクションの ID の開閉のボタンを返却する */
function sectionToggle(root: HTMLElement, id: string): HTMLButtonElement {
  const toggle = root.querySelector<HTMLButtonElement>(
    `[aria-controls="section-${id}"]`,
  );
  if (!toggle) {
    throw new Error(`開閉のボタンが無い: ${id}`);
  }
  return toggle;
}

/** セクションの ID の開閉のボタンの `aria-expanded` を、指定した順に返却する */
function expandedStates(root: HTMLElement, ids: string[]): string[] {
  return ids.map(
    (id) => sectionToggle(root, id).getAttribute("aria-expanded") ?? "",
  );
}

// Shift の開閉の確認に使用する入れ子のセクション（A の中に B、B の中に閉じた C、A の外に D）
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
  '<!-- section: {"open": false} -->',
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

// 閉じたセクションを閉じ、押すと開く（正常系）
test("test_attach_sections", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## 開く\n\n本文1\n\n## 閉じる\n\n<!-- section: {"open": false} -->\n\n本文2\n',
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

// 閉じたセクションの中の ID への hashchange で開く（正常系）
test("test_attach_sections_when_hash", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## 親\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
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

// まとめた HTML の # の構造でも閉じたセクションを開く（正常系）
test("test_attach_sections_when_bundle_hash", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## 親\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
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
      '<!-- row-detail: {"at": 2} -->',
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
    "| マーカー | 1 |",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| マーカー | HTML コメントで記載する指定 |",
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
    expect(root.querySelector("tbody td .mdmark-term")?.textContent).toBe(
      "マーカー",
    );
    expect(toggle?.getAttribute("aria-label")).toBe("「マーカー」の詳細");
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
      '<!-- section: {"open": false} -->',
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

// H1 のセクションも開閉する（正常系）
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

// 差分のブロックに包まれた見出しのセクションも開閉する（正常系）
test("test_attach_sections_when_diff_block", async () => {
  // 準備: 見出しを追加のブロックの `div` で包む
  const { attachSections } = await loadSections();
  const { renderDiffBlock } = await loadDiffBlocks();
  const { root } = createRoot("## 新しいセクション\n\n段落\n");
  const heading = root.querySelector("h2");
  if (heading === null) {
    throw new Error("見出しが描かれていない");
  }
  const template = document.createElement("template");
  template.innerHTML = renderDiffBlock({
    kind: "add",
    unit: "block",
    html: heading.outerHTML,
  });
  const wrapper = template.content.firstElementChild;
  if (wrapper === null) {
    throw new Error("包みが作れていない");
  }
  heading.replaceWith(wrapper);
  // 実行
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  // 検証
  expect(wrapper.querySelector("h2 .mdmark-section-toggle")).not.toBeNull();
  sectionToggle(root, "新しいセクション").click();
  expect(
    sectionToggle(root, "新しいセクション").getAttribute("aria-expanded"),
  ).toBe("false");
  const body = wrapper.nextElementSibling;
  expect(body?.classList.contains("mdmark-section-body")).toBe(true);
  expect(body?.getAttribute("hidden")).toBe("until-found");
});

// Shift を押しながら押すと、そのセクションと入れ子のセクションを同じ状態にし、外のセクションは変えない（正常系）
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

// Shift を押しながら Enter・Space を押しても入れ子をまとめて開閉し、click を発生させない（正常系）
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

// 削除するとセクションの開閉の関数の記録から取り除く（正常系）
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

// 記録した開閉で始める（正常系）
test("test_attach_sections_when_states", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const markdown =
    '## 甲\n\n<!-- section: {"open": false} -->\n\n本文甲\n\n## 乙\n\n本文乙\n';
  const states: SectionStates = new Map();
  const first = createRoot(markdown).root;
  const detachFirst = attachSections({
    root: first,
    sections: true,
    rowDetails: true,
    states,
  });
  sectionToggle(first, "甲").click();
  sectionToggle(first, "乙").click();
  detachFirst();
  first.remove();
  const { root } = createRoot(markdown);
  // 実行
  detachers.push(
    attachSections({ root, sections: true, rowDetails: true, states }),
  );
  // 検証
  expect(sectionBody(root, "甲").hasAttribute("hidden")).toBe(false);
  expect(expandedStates(root, ["甲"])).toEqual(["true"]);
  expect(sectionBody(root, "乙").getAttribute("hidden")).toBe("until-found");
  expect(states.get("section-甲")).toEqual({ open: true, marker: "closed" });
});

// data-section が記録したときと違うセクションはマーカーのとおりに始める（正常系）
test("test_attach_sections_when_marker_changed", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const states: SectionStates = new Map([
    ["section-甲", { open: true, marker: "open" }],
  ]);
  const { root } = createRoot(
    '## 甲\n\n<!-- section: {"open": false} -->\n\n本文甲\n',
  );
  // 実行
  detachers.push(
    attachSections({ root, sections: true, rowDetails: true, states }),
  );
  // 検証
  expect(sectionBody(root, "甲").getAttribute("hidden")).toBe("until-found");
  expect(expandedStates(root, ["甲"])).toEqual(["false"]);
});

// ページ内検索で開いたセクションを記録する（正常系）
test("test_attach_sections_when_beforematch", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const states: SectionStates = new Map();
  const { root } = createRoot(
    '## 甲\n\n<!-- section: {"open": false} -->\n\n本文甲\n',
  );
  detachers.push(
    attachSections({ root, sections: true, rowDetails: true, states }),
  );
  // 実行
  sectionBody(root, "甲").dispatchEvent(new Event("beforematch"));
  // 検証
  expect(states.get("section-甲")).toEqual({ open: true, marker: "closed" });
});

// revealHash が false なら付けたときに #ID で開かず、hashchange では開く（正常系）
test("test_attach_sections_when_reveal_hash_off", async () => {
  // 準備
  const { attachSections } = await loadSections();
  history.replaceState(null, "", "#注意");
  const { root } = createRoot(
    '## 親\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
  );
  // 実行
  detachers.push(
    attachSections({
      root,
      sections: true,
      rowDetails: true,
      revealHash: false,
    }),
  );
  // 検証
  const closed = sectionBody(root, "親");
  expect(closed.getAttribute("hidden")).toBe("until-found");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  await vi.waitFor(() => {
    expect(closed.hasAttribute("hidden")).toBe(false);
  });
});

// 入れ子の閉じたセクションを外側から開いて移る（正常系）
test("test_reveal_target", async () => {
  // 準備
  const { attachSections, revealTarget } = await loadSections();
  const { root } = createRoot(
    [
      "## A",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "### B",
      "",
      '<!-- section: {"open": false} -->',
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
      '<!-- section: {"open": false} -->',
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

// 見出しを指定すると、囲むセクションに加えて見出し自身の閉じたセクションも開く（正常系）
test("test_reveal_target_when_heading", async () => {
  // 準備
  const { attachSections, revealTarget } = await loadSections();
  const { root } = createRoot(
    [
      "## A",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "### B",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "本文B",
      "",
      "## E",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "段落E",
      "",
      "### F",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "本文F",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  const heading = root.querySelector<HTMLElement>('h3[id="b"]');
  const paragraph = [...root.querySelectorAll<HTMLElement>("p")].find(
    (candidate) => candidate.textContent === "段落E",
  );
  if (!heading || !paragraph) {
    throw new Error("B の見出しか E の段落が無い");
  }
  // 実行: 見出しを指定する
  revealTarget(heading);
  // 検証: 囲むセクションと見出し自身のセクションが開く
  expect(sectionBody(root, "a").hasAttribute("hidden")).toBe(false);
  expect(sectionBody(root, "b").hasAttribute("hidden")).toBe(false);
  expect(expandedStates(root, ["a", "b"])).toEqual(["true", "true"]);
  // 実行: 閉じたセクションの中の段落を指定する
  revealTarget(paragraph);
  // 検証: 段落を囲むセクションだけが開き、後ろの見出しのセクションは開かない
  expect(sectionBody(root, "e").hasAttribute("hidden")).toBe(false);
  expect(sectionBody(root, "f").hasAttribute("hidden")).toBe(true);
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
      '<!-- section: {"open": false} -->',
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

// 閉じたセクションと閉じた行の詳細を開き、スクロールしない（正常系）
test("test_open_enclosing", async () => {
  // 準備: 閉じた `## A` の中の表の、閉じた行の詳細の中の段落
  const { attachSections, openEnclosing } = await loadSections();
  const { root } = createRoot(
    [
      "## A",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      '<!-- row-detail: {"at": 1} -->',
      "",
      "詳細の段落",
      "",
      "<!-- /row-detail -->",
      "",
    ].join("\n"),
  );
  detachers.push(attachSections({ root, sections: true, rowDetails: true }));
  const scrollIntoView = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  const detail = root.querySelector<HTMLElement>("tr.mdmark-row-detail");
  const target = detail?.querySelector<HTMLElement>("p");
  const rowToggle = root.querySelector<HTMLButtonElement>(
    "button.mdmark-row-toggle",
  );
  if (!detail || !target || !rowToggle) {
    throw new Error("行の詳細の段落か開閉のボタンが無い");
  }
  expect(sectionBody(root, "a").hasAttribute("hidden")).toBe(true);
  expect(detail.hasAttribute("hidden")).toBe(true);
  // 実行
  openEnclosing(target);
  // 検証
  expect(sectionBody(root, "a").hasAttribute("hidden")).toBe(false);
  expect(detail.hasAttribute("hidden")).toBe(false);
  expect(expandedStates(root, ["a"])).toEqual(["true"]);
  expect(rowToggle.getAttribute("aria-expanded")).toBe("true");
  expect(scrollIntoView).not.toHaveBeenCalled();
});

// 記録した行の詳細の開閉で始め、押した開閉を記録する（正常系）
test("test_attach_sections_when_row_detail_states", async () => {
  // 準備
  const { attachSections } = await loadSections();
  const markdown = [
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    '<!-- row-detail: {"at": 2} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  const partStates: PartStates = new Map();
  const first = createRoot(markdown).root;
  const detachFirst = attachSections({
    root: first,
    sections: true,
    rowDetails: true,
    partStates,
  });
  first.querySelector<HTMLButtonElement>("button.mdmark-row-toggle")?.click();
  detachFirst();
  first.remove();
  const { root } = createRoot(markdown);
  // 実行
  detachers.push(
    attachSections({ root, sections: true, rowDetails: true, partStates }),
  );
  // 検証
  const toggle = root.querySelector<HTMLButtonElement>(
    "button.mdmark-row-toggle",
  );
  expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  expect(
    root
      .querySelector<HTMLElement>("tr.mdmark-row-detail")
      ?.hasAttribute("hidden"),
  ).toBe(false);
});
