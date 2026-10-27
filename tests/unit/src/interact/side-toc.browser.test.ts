import { afterEach, expect, test, vi } from "vitest";
import type { SideTocState } from "../../../../src/interact/side-toc.ts";
import { wrapHtml } from "../../helpers/charts.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** 右側の目次の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSideToc = () => import("../../../../src/interact/side-toc.ts");

/** 節の操作を読み込む */
const loadSections = () => import("../../../../src/interact/sections.ts");

/** 記法の操作をまとめて付ける処理を読み込む */
const loadInteractions = () => import("../../../../src/interact/index.ts");

const detachers: Array<() => void> = [];

/** 外す関数を控える（後始末で付けた順の逆に外す） */
function track(detach: () => void): void {
  detachers.push(detach);
}

/** 付けたときの右側の目次の状態を作る */
function createState(overrides: Partial<SideTocState> = {}): SideTocState {
  return { open: false, pinned: false, ...overrides };
}

/** 本文の高さを稼ぐ段落を並べた Markdown を返す（見出しを画面の上端へ送れるようにする） */
function filler(count = 30): string {
  return Array.from(
    { length: count },
    (_, index) => `段落 ${index + 1}\n`,
  ).join("\n");
}

/** 右側の目次の中で `aria-current` を持つ項目の `href` を返す */
function currentHrefs(aside: HTMLElement): string[] {
  return [...aside.querySelectorAll('a[aria-current="location"]')].map(
    (link) => link.getAttribute("href") ?? "",
  );
}

/** 右端の線が `data-current` を持つかを、上から順に返す */
function currentBars(aside: HTMLElement): boolean[] {
  return [...aside.querySelectorAll(".mdmark-side-toc-bar")].map((bar) =>
    bar.hasAttribute("data-current"),
  );
}

/** 右側の目次の中の要素を返す（無ければ例外） */
function find<T extends HTMLElement>(aside: HTMLElement, selector: string): T {
  const element = aside.querySelector<T>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

/** 本文の中の要素を返す（無ければ例外） */
function queryContent(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

/** 節の ID の開閉のボタンの `aria-expanded` を、渡した順に返す */
function expandedStates(root: HTMLElement, ids: string[]): string[] {
  return ids.map(
    (id) =>
      root
        .querySelector(`[aria-controls="section-${id}"]`)
        ?.getAttribute("aria-expanded") ?? "",
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const detach of detachers.splice(0).reverse()) {
    detach();
  }
  removeRoots();
  window.scrollTo(0, 0);
  history.replaceState(null, "", location.pathname);
});

// h1〜h3 を文書の順に集め、h4 と埋め込んだ HTML の中の見出しを除く（正常系）
test("test_collect_side_toc_headings", async () => {
  // 準備
  const { collectSideTocHeadings } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    [
      "# 手引き",
      "",
      "## 導入",
      "",
      "### 注意",
      "",
      "#### 細目",
      "",
      wrapHtml('<h2 id="embedded">埋め込み</h2>'),
    ].join("\n"),
  );
  track(attachSections({ root, sections: true, rowDetails: true }));
  // 実行
  const headings = collectSideTocHeadings(root);
  // 検証
  expect(headings).toEqual([
    { level: 1, id: "手引き", text: "手引き" },
    { level: 2, id: "導入", text: "導入" },
    { level: 3, id: "注意", text: "注意" },
  ]);
});

// 線より上にある最後の見出しを選ぶ（正常系）
test("test_pick_current_heading", async () => {
  // 準備
  const { pickCurrentHeading } = await loadSideToc();
  // 実行
  const id = pickCurrentHeading({
    headings: [
      { id: "a", top: -300 },
      { id: "b", top: 100 },
      { id: "c", top: 400 },
    ],
    line: 200,
    viewportHeight: 800,
  });
  // 検証
  expect(id).toBe("b");
});

// 線より上に見出しが無ければ画面の中の最初の見出しを選ぶ（正常系）
test("test_pick_current_heading_when_below_line", async () => {
  // 準備
  const { pickCurrentHeading } = await loadSideToc();
  // 実行
  const id = pickCurrentHeading({
    headings: [
      { id: "a", top: 300 },
      { id: "b", top: 600 },
    ],
    line: 200,
    viewportHeight: 800,
  });
  // 検証
  expect(id).toBe("a");
});

// 線より上にも画面の中にも見出しが無ければ選ばない（正常系）
test("test_pick_current_heading_when_none", async () => {
  // 準備
  const { pickCurrentHeading } = await loadSideToc();
  // 実行
  const id = pickCurrentHeading({
    headings: [{ id: "a", top: 900 }],
    line: 200,
    viewportHeight: 800,
  });
  // 検証
  expect(id).toBeUndefined();
});

// 本文を列に包み、見出しを入れ子にした右側の目次を置く（正常系）
test("test_attach_side_toc", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("# 手引き\n\n## 導入\n\n### 注意\n");
  // 実行
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  // 検証
  expect(root.children).toHaveLength(2);
  expect(root.children[0]?.matches("div.mdmark-content")).toBe(true);
  expect(root.children[1]?.matches("aside.mdmark-side-toc")).toBe(true);
  expect(result.content).toBe(root.children[0]);
  expect(result.aside).toBe(root.children[1]);
  const hrefs = [...root.querySelectorAll(".mdmark-side-toc-list a")].map(
    (link) => link.getAttribute("href"),
  );
  expect(hrefs).toEqual(["#手引き", "#導入", "#注意"]);
  expect(result.aside?.getAttribute("data-mode")).toBe("hover");
});

// 見出しが無ければ何も置かない（正常系）
test("test_attach_side_toc_when_no_headings", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("段落だけ\n");
  const before = root.innerHTML;
  // 実行
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  // 検証
  expect(result.content).toBe(root);
  expect(result.aside).toBeUndefined();
  expect(root.innerHTML).toBe(before);
});

// 目次を出すボタン・ピン止め・Esc で状態を切り替えて控える（正常系）
test("test_attach_side_toc_when_toggled", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("# 手引き\n\n## 導入\n");
  const state = createState();
  const result = attachSideToc({
    el: root,
    mode: "fixed",
    sections: true,
    state,
  });
  track(result.detach);
  const aside = result.aside as HTMLElement;
  const toggle = find<HTMLButtonElement>(aside, ".mdmark-side-toc-toggle");
  const pin = find<HTMLButtonElement>(aside, ".mdmark-side-toc-pin");
  const panel = find<HTMLElement>(aside, ".mdmark-side-toc-panel");
  // 実行・検証
  toggle.click();
  expect(aside.hasAttribute("data-open")).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  pin.click();
  expect(aside.hasAttribute("data-pinned")).toBe(true);
  expect(pin.getAttribute("aria-pressed")).toBe("true");
  panel.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(aside.hasAttribute("data-open")).toBe(false);
  expect(document.activeElement).toBe(toggle);
  expect(state).toEqual({ open: false, pinned: true });
});

// 保った状態で付け直すと同じ出し方で出す（正常系）
test("test_attach_side_toc_when_state_kept", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("# 手引き\n\n## 導入\n");
  // 実行
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState({ open: true, pinned: true }),
  });
  track(result.detach);
  // 検証
  expect(result.aside?.hasAttribute("data-open")).toBe(true);
  expect(result.aside?.hasAttribute("data-pinned")).toBe(true);
});

// 閉じた節の中の見出しの項目を押すと節を開いて移る（正常系）
test("test_attach_side_toc_when_link_into_closed_section", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "## 導入\n\n<!-- section: closed -->\n\n### 注意\n\n本文\n",
  );
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  track(
    attachSections({
      root: result.content,
      sections: true,
      rowDetails: true,
    }),
  );
  const scrollIntoView = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  const link = find<HTMLAnchorElement>(
    result.aside as HTMLElement,
    'a[href="#注意"]',
  );
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  // 実行
  link.dispatchEvent(click);
  // 検証
  const body = queryContent(root, '[id="section-導入"]');
  expect(body.hasAttribute("hidden")).toBe(false);
  expect(scrollIntoView.mock.contexts).toContain(
    queryContent(root, '[id="注意"]'),
  );
  expect(click.defaultPrevented).toBe(false);
});

// すべて折りたたみ・すべて展開で節をまとめて開閉する（正常系）
test("test_attach_side_toc_when_fold_all", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    "# 手引き\n\n## 導入\n\n導入の段落\n\n### 前提\n\n前提の段落\n",
  );
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  track(
    attachSections({
      root: result.content,
      sections: true,
      rowDetails: true,
    }),
  );
  const aside = result.aside as HTMLElement;
  const ids = ["手引き", "導入", "前提"];
  // 実行・検証
  find<HTMLButtonElement>(aside, '[data-fold-all="close"]').click();
  expect(expandedStates(root, ids)).toEqual(["true", "false", "false"]);
  find<HTMLButtonElement>(aside, '[data-fold-all="open"]').click();
  expect(expandedStates(root, ids)).toEqual(["true", "true", "true"]);
});

// 節の開閉がオフならすべて展開・すべて折りたたむを置かない（正常系）
test("test_attach_side_toc_when_sections_off", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("# 手引き\n\n## 導入\n");
  // 実行
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: false,
    state: createState(),
  });
  track(result.detach);
  // 検証
  expect(result.aside?.querySelector("[data-fold-all]")).toBeNull();
});

// スクロールすると今いる節の項目を付け替える（正常系）
test("test_attach_side_toc_when_scrolled", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot(
    ["一つ目", "二つ目", "三つ目"]
      .map((title) => `## ${title}\n\n${filler()}`)
      .join("\n"),
  );
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  const aside = result.aside as HTMLElement;
  // 実行
  queryContent(root, '[id="二つ目"]').scrollIntoView();
  // 検証
  await vi.waitFor(() => {
    expect(currentHrefs(aside)).toEqual(["#二つ目"]);
  });
  expect(currentBars(aside)).toEqual([false, true, false]);
  expect(find(aside, ".mdmark-side-toc-current").textContent).toBe("二つ目");
});

// 外すと包む前の子の並びへ戻す（正常系）
test("test_attach_side_toc_when_detached", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot("# 手引き\n\n## 導入\n");
  const before = [...root.children];
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  // 実行
  result.detach();
  // 検証
  expect([...root.children]).toEqual(before);
  expect(root.querySelector("aside")).toBeNull();
});

// 選ばれていないタブの中の見出しを今いる節に数えない（正常系）
test("test_attach_side_toc_when_heading_in_unselected_tab", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachInteractions } = await loadInteractions();
  const { root, features } = createRoot(
    [
      "# 手引き",
      "",
      filler(),
      "<!-- tabs -->",
      "",
      "## macOS",
      "",
      "### macOS の手順",
      "",
      filler(),
      "## Windows",
      "",
      "### Windows の手順",
      "",
      filler(),
      "<!-- /tabs -->",
      "",
    ].join("\n"),
  );
  track(attachInteractions({ root, features, placement: "top" }));
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  const aside = result.aside as HTMLElement;
  const macos = queryContent(root, 'h3[id^="macos"]');
  // 実行
  macos.scrollIntoView();
  // 検証
  await vi.waitFor(() => {
    expect(currentHrefs(aside)).toEqual([`#${macos.id}`]);
  });
});

// すべて折りたたむと、閉じた節に入った見出しから今いる節を決め直す（正常系）
test("test_attach_side_toc_when_fold_all_moves_current", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    [
      "# 手引き",
      "",
      filler(),
      "## 導入",
      "",
      filler(),
      "### 前提",
      "",
      filler(),
    ].join("\n"),
  );
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  track(
    attachSections({
      root: result.content,
      sections: true,
      rowDetails: true,
    }),
  );
  const aside = result.aside as HTMLElement;
  queryContent(root, '[id="前提"]').scrollIntoView();
  await vi.waitFor(() => {
    expect(currentHrefs(aside)).toEqual(["#前提"]);
  });
  // 実行
  find<HTMLButtonElement>(aside, '[data-fold-all="close"]').click();
  // 検証
  await vi.waitFor(() => {
    const hrefs = currentHrefs(aside);
    expect(hrefs).toHaveLength(1);
    expect(["#手引き", "#導入"]).toContain(hrefs[0]);
  });
});
