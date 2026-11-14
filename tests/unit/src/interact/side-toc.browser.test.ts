import { afterEach, expect, test, vi } from "vitest";
import type { SideTocState } from "../../../../src/interact/side-toc.ts";
import { wrapHtml } from "../../helpers/charts.ts";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 右側の目次の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSideToc = () => import("../../../../src/interact/side-toc.ts");

/** セクションの操作を読み込む */
const loadSections = () => import("../../../../src/interact/sections.ts");

/** 差分のブロックの部品を読み込む */
const loadDiffBlocks = () => import("../../../../src/parts/diff-blocks.ts");

/** 記法の操作をまとめて付ける処理を読み込む */
const loadInteractions = () => import("../../../../src/interact/index.ts");

const detachers: Array<() => void> = [];

/** 削除する関数を記録する（後始末で付けた順の逆に削除する） */
function track(detach: () => void): void {
  detachers.push(detach);
}

/** 付けたときの右側の目次の状態を作る */
function createState(overrides: Partial<SideTocState> = {}): SideTocState {
  return { open: false, pinned: false, ...overrides };
}

/** 本文の高さを稼ぐ段落を並べた Markdown を返却する（見出しを画面の上端へスクロールできるようにする） */
function filler(count = 30): string {
  return Array.from(
    { length: count },
    (_, index) => `段落 ${index + 1}\n`,
  ).join("\n");
}

/** 右側の目次の中で `aria-current` を持つ項目の `href` を返却する */
function currentHrefs(aside: HTMLElement): string[] {
  return [...aside.querySelectorAll('a[aria-current="location"]')].map(
    (link) => link.getAttribute("href") ?? "",
  );
}

/** 右端の線が `data-current` を持つかを、上から順に返却する */
function currentBars(aside: HTMLElement): boolean[] {
  return [...aside.querySelectorAll(".mdmark-side-toc-bar")].map((bar) =>
    bar.hasAttribute("data-current"),
  );
}

/** 右側の目次の中の要素を返却する（無ければ例外） */
function find<T extends HTMLElement>(aside: HTMLElement, selector: string): T {
  const element = aside.querySelector<T>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

/** 本文の中の要素を返却する（無ければ例外） */
function queryContent(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

/** セクションの ID の開閉のボタンの `aria-expanded` を、指定した順に返却する */
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

// 本文を列に包み、見出しを入れ子にした右側の目次を配置する（正常系）
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

// 見出しが無ければ何も配置しない（正常系）
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

// 目次を出すボタン・ピン止め・Esc で状態を切り替えて記録する（正常系）
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

// 保った状態でもう一度付けると同じ出し方で出す（正常系）
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

// 閉じたセクションの中の見出しの項目を押すとセクションを開いて移る（正常系）
test("test_attach_side_toc_when_link_into_closed_section", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## 導入\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
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

// 項目の href を書き換えても、data-heading-id の見出しへセクションを開いて移る（正常系）
test("test_attach_side_toc_when_href_rewritten", async () => {
  // 準備
  const { attachSideToc } = await loadSideToc();
  const { attachSections } = await loadSections();
  const { root } = createRoot(
    '## 導入\n\n<!-- section: {"open": false} -->\n\n### 注意\n\n本文\n',
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
    'a[data-heading-id="注意"]',
  );
  link.setAttribute("href", "#/a.md#注意");
  // 実行
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  // 検証
  expect(queryContent(root, '[id="section-導入"]').hasAttribute("hidden")).toBe(
    false,
  );
  expect(scrollIntoView.mock.contexts).toContain(
    queryContent(root, '[id="注意"]'),
  );
});

// すべて折りたたみ・すべて展開でセクションをまとめて開閉する（正常系）
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

// セクションの開閉がオフならすべて展開・すべて折りたたむを配置しない（正常系）
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

// スクロールすると今いるセクションの項目を付け替える（正常系）
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

// 削除すると包む前の子の並びへ戻す（正常系）
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

// 選ばれていないタブの中の見出しを今いるセクションに数えない（正常系）
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

// すべて折りたたむと、閉じたセクションに入った見出しから今いるセクションをもう一度決める（正常系）
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

/** ルートの文字の大きさ（px）。`--mdmark-space` などの rem を px にする */
function rootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/** 見出しが 3 つの、画面より長い本文の Markdown を返却する */
function longDocument(): string {
  return ["一つ目", "二つ目", "三つ目"]
    .map((title) => `## ${title}\n\n${filler()}`)
    .join("\n");
}

/** aside に入れた CSS 変数の値を返却する */
function panelVariable(aside: HTMLElement, name: string): string {
  return aside.style.getPropertyValue(name);
}

// hover で開く目次の枠の位置を、見えている枠の上端と右端の線から決める（正常系）
test("test_attach_side_toc_when_hover_panel_placed", async () => {
  // 準備
  addStyles();
  const { attachSideToc } = await loadSideToc();
  const box = document.createElement("div");
  box.style.cssText =
    "position: fixed; top: 100px; left: 0; width: calc(100% - 40px); height: 400px; overflow-y: auto;";
  document.body.append(box);
  track(() => box.remove());
  const { root } = createRoot(longDocument());
  box.append(root);
  // aside の右端に依らないことを確認するため、描く先の要素をスクロールする要素より狭くして左に配置する
  root.style.width = "50%";
  root.style.setProperty("--mdmark-sticky-top", "8px");
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  const aside = result.aside as HTMLElement;
  const space =
    Number.parseFloat(
      getComputedStyle(root).getPropertyValue("--mdmark-space"),
    ) * rootFontSize();
  const expectedTop = `${100 + 8 + space}px`;
  // スクロールする要素の右端（スクロールバーを除き、画面からはみ出す分は画面の端）から 1rem
  const { clientWidth } = document.documentElement;
  const boxRect = box.getBoundingClientRect();
  const boxRight = Math.min(
    boxRect.left + box.clientLeft + box.clientWidth,
    clientWidth,
  );
  const expectedEnd = () => `${clientWidth - boxRight + rootFontSize()}px`;
  // 実行・検証: 付けた直後
  expect(panelVariable(aside, "--mdmark-side-toc-panel-top")).toBe(expectedTop);
  expect(panelVariable(aside, "--mdmark-side-toc-panel-end")).toBe(
    expectedEnd(),
  );
  // 実行・検証: 要素を下へスクロールした後
  box.scrollTop = 300;
  box.dispatchEvent(new Event("scroll"));
  await vi.waitFor(() => {
    expect(panelVariable(aside, "--mdmark-side-toc-panel-top")).toBe(
      expectedTop,
    );
  });
  // 実行・検証: 削除した後は、要素を動かしても値をもう一度決めない
  result.detach();
  box.style.top = "50px";
  window.dispatchEvent(new Event("resize"));
  box.dispatchEvent(new Event("scroll"));
  expect(panelVariable(aside, "--mdmark-side-toc-panel-top")).toBe(expectedTop);
});

// hover で開く目次の枠に、右端の線の上端から線 3 本分まで届く高さの下限を入れる（正常系）
test("test_attach_side_toc_when_hover_panel_reaches_rail", async () => {
  // 準備
  addStyles();
  const { attachSideToc } = await loadSideToc();
  const spacer = document.createElement("div");
  spacer.style.height = "200px";
  document.body.prepend(spacer);
  track(() => spacer.remove());
  const { root } = createRoot(longDocument());
  // 広い幅（48rem 以上）にして、右端の線を出す（テストの画面の既定の幅は狭い幅の帯になる）
  root.style.width = "1000px";
  // 文書の後ろの余白: 描いた文書が画面の上へ抜けるまでスクロールできるようにする
  const after = document.createElement("div");
  after.style.height = "3000px";
  document.body.append(after);
  track(() => after.remove());
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  const aside = result.aside as HTMLElement;
  const rail = find(aside, ".mdmark-side-toc-rail");
  const top = Number.parseFloat(
    panelVariable(aside, "--mdmark-side-toc-panel-top"),
  );
  // 検証: 文書の先頭では、右端の線の上端から 2rem の位置まで届く高さ
  expect(rail.getBoundingClientRect().height).toBeGreaterThan(0);
  expect(panelVariable(aside, "--mdmark-side-toc-panel-min-height")).toBe(
    `${rail.getBoundingClientRect().top + 2 * rootFontSize() - top}px`,
  );
  // 実行: 文書の末尾までスクロールする
  window.scrollTo(0, document.documentElement.scrollHeight);
  // 検証: 右端の線の上端が枠の上端に留まるため、線から 2rem の位置まで届く高さ
  await vi.waitFor(() => {
    expect(panelVariable(aside, "--mdmark-side-toc-panel-min-height")).toBe(
      `${2 * rootFontSize()}px`,
    );
  });
});

// 右端の線の位置と高さを、aside の上端・見えている枠の上端と下端から決める（正常系）
test("test_attach_side_toc_when_hover_rail_placed", async () => {
  // 準備
  addStyles();
  const { attachSideToc } = await loadSideToc();
  const box = document.createElement("div");
  box.style.cssText =
    "position: fixed; top: 100px; left: 0; width: 1000px; height: 400px; overflow-y: auto;";
  document.body.append(box);
  track(() => box.remove());
  const before = document.createElement("div");
  before.style.height = "200px";
  const after = document.createElement("div");
  after.style.height = "450px";
  const { root } = createRoot(longDocument());
  box.append(before, root, after);
  root.style.setProperty("--mdmark-sticky-top", "8px");
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  track(result.detach);
  const aside = result.aside as HTMLElement;
  const rail = find(aside, ".mdmark-side-toc-rail");
  const space =
    Number.parseFloat(
      getComputedStyle(root).getPropertyValue("--mdmark-space"),
    ) * rootFontSize();
  const fixedTop = 100 + 8 + space;
  // 検証: スクロールの前は aside の上端
  expect(panelVariable(aside, "--mdmark-side-toc-rail-top")).toBe(
    `${aside.getBoundingClientRect().top}px`,
  );
  expect(
    Number.parseFloat(panelVariable(aside, "--mdmark-side-toc-rail-top")),
  ).toBeGreaterThan(
    Number.parseFloat(panelVariable(aside, "--mdmark-side-toc-panel-top")),
  );
  // 実行: 描く先の要素の下端が見えている枠の下端より 50px 下にある位置（文書の末尾の手前）までスクロールする
  box.scrollTop += root.getBoundingClientRect().bottom - (100 + 400) - 50;
  box.dispatchEvent(new Event("scroll"));
  // 検証
  await vi.waitFor(() => {
    expect(panelVariable(aside, "--mdmark-side-toc-rail-top")).toBe(
      `${fixedTop}px`,
    );
  });
  expect(panelVariable(aside, "--mdmark-side-toc-rail-height")).toBe(
    `${100 + 400 - fixedTop - space}px`,
  );
  expect(aside.hasAttribute("data-rail-outside")).toBe(false);
  expect(rail.getBoundingClientRect().top).toBeCloseTo(fixedTop, 0);
  // 実行: 描く先の要素の下の要素まで（要素の末尾まで）スクロールする
  box.scrollTop = box.scrollHeight;
  box.dispatchEvent(new Event("scroll"));
  // 検証: 描く先の要素の下端が線の上端より上にあるため、線を出さない
  await vi.waitFor(() => {
    expect(panelVariable(aside, "--mdmark-side-toc-rail-height")).toBe("0px");
  });
  expect(aside.hasAttribute("data-rail-outside")).toBe(true);
  expect(getComputedStyle(rail).display).toBe("none");
});

// 差分のミニマップの帯が出たときと消えたときに、スクロールせずに右端の位置をもう一度決める（正常系）
test("test_attach_side_toc_when_hover_edge_avoids_minimap", async () => {
  // 準備
  addStyles();
  const { attachSideToc } = await loadSideToc();
  const { root } = createRoot(longDocument());
  root.style.width = "600px";
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  const aside = result.aside as HTMLElement;
  const minimap = document.createElement("div");
  minimap.className = "mdmark-diff-minimap";
  minimap.style.cssText =
    "position: fixed; top: 0; right: 0; bottom: 0; width: 14px;";
  // 描いた直後のレイアウトで出る scroll を数えないよう、次の描画を待ってから受け取る
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const scroll = vi.fn();
  const resize = vi.fn();
  window.addEventListener("scroll", scroll);
  window.addEventListener("resize", resize);
  track(() => {
    window.removeEventListener("scroll", scroll);
    window.removeEventListener("resize", resize);
  });
  // 実行・検証: 帯を追加した後は、帯の左端から 8px 左（画面の幅が小数のとき、`clientWidth` の丸めの差が出ないよう帯の左端から決める）
  document.body.append(minimap);
  track(() => minimap.remove());
  await vi.waitFor(() => {
    const { left } = minimap.getBoundingClientRect();
    expect(panelVariable(aside, "--mdmark-side-toc-panel-end")).toBe(
      `${document.documentElement.clientWidth - (left - 8)}px`,
    );
  });
  // 実行・検証: 帯を削除した後は、画面の右端（スクロールバーを除く）から 1rem
  minimap.remove();
  await vi.waitFor(() => {
    expect(panelVariable(aside, "--mdmark-side-toc-panel-end")).toBe(
      `${rootFontSize()}px`,
    );
  });
  expect(scroll).not.toHaveBeenCalled();
  expect(resize).not.toHaveBeenCalled();
  // 実行・検証: 削除した後は、帯を追加しても値をもう一度決めない
  const before = panelVariable(aside, "--mdmark-side-toc-panel-end");
  result.detach();
  document.body.append(minimap);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(panelVariable(aside, "--mdmark-side-toc-panel-end")).toBe(before);
});

// 画面の右端より右へはみ出すスクロールする要素では、画面の端から右端の位置を決める（正常系）
test("test_attach_side_toc_when_hover_edge_clamped", async () => {
  // 準備
  addStyles();
  const { attachSideToc } = await loadSideToc();
  const box = document.createElement("div");
  box.style.cssText =
    "position: fixed; top: 0; left: 0; width: calc(100% + 100px); height: 400px; overflow-y: auto;";
  document.body.append(box);
  track(() => box.remove());
  const { root } = createRoot(longDocument());
  box.append(root);
  // 実行
  const result = attachSideToc({
    el: root,
    mode: "hover",
    sections: true,
    state: createState(),
  });
  // 検証
  const aside = result.aside as HTMLElement;
  expect(panelVariable(aside, "--mdmark-side-toc-panel-end")).toBe(
    `${rootFontSize()}px`,
  );
});

/** 段落の HTML */
function paragraph(text: string): string {
  return `<p>${text}</p>`;
}

/** 見出しの HTML（`id` を持つ） */
function heading(level: 1 | 2 | 3, text: string): string {
  return `<h${level} id="${text}">${text}</h${level}>`;
}

/** `renderDiffBlock` で包んだブロックの HTML */
async function diffBlock(kind: "add" | "del", html: string): Promise<string> {
  const { renderDiffBlock } = await loadDiffBlocks();
  return renderDiffBlock({ kind, unit: "block", html });
}

// 色分けしたブロックを持つセクションと、その祖先の見出しを集める（正常系）
test("test_find_changed_headings", async () => {
  // 準備
  const { findChangedHeadings } = await loadSideToc();
  const root = createRootFromHtml(
    [
      heading(1, "文書"),
      heading(2, "A"),
      paragraph("変えていない段落"),
      heading(2, "B"),
      await diffBlock("add", paragraph("書き換えた段落")),
      heading(3, "B1"),
      paragraph("変えていない段落"),
    ].join(""),
  );
  // 実行
  const changed = findChangedHeadings(root);
  // 検証
  expect([...changed].sort()).toEqual(["B", "文書"].sort());
});

// 見出しごと削除したセクションは祖先にだけ付け、前のセクションに付けない（正常系）
test("test_find_changed_headings_when_section_deleted", async () => {
  // 準備
  const { findChangedHeadings } = await loadSideToc();
  const root = createRootFromHtml(
    [
      heading(1, "文書"),
      heading(2, "A"),
      heading(3, "A1"),
      paragraph("変えていない段落"),
      await diffBlock("del", heading(2, "E")),
      await diffBlock("del", paragraph("削除した段落")),
      heading(2, "C"),
      paragraph("変えていない段落"),
    ].join(""),
  );
  // 実行
  const changed = findChangedHeadings(root);
  // 検証
  expect([...changed]).toEqual(["文書"]);
});

// 見出しの文字を書き換えたときは新しい見出しに付ける（正常系）
test("test_find_changed_headings_when_heading_rewritten", async () => {
  // 準備
  const { findChangedHeadings } = await loadSideToc();
  const root = createRootFromHtml(
    [
      heading(1, "文書"),
      await diffBlock("del", heading(2, "古い名前")),
      await diffBlock("add", heading(2, "新しい名前")),
    ].join(""),
  );
  // 実行
  const changed = findChangedHeadings(root);
  // 検証
  expect([...changed].sort()).toEqual(["文書", "新しい名前"].sort());
});

// 色分けしたブロックが無ければ何も集めない（正常系）
test("test_find_changed_headings_when_no_diff", async () => {
  // 準備
  const { findChangedHeadings } = await loadSideToc();
  const root = createRootFromHtml(
    [heading(1, "文書"), heading(2, "A"), paragraph("段落")].join(""),
  );
  // 実行
  const changed = findChangedHeadings(root);
  // 検証
  expect(changed.size).toBe(0);
});

// 色分けしたブロックを持つセクションの見出しに changed を付ける（正常系）
test("test_collect_side_toc_headings_when_changed", async () => {
  // 準備
  const { collectSideTocHeadings } = await loadSideToc();
  const root = createRootFromHtml(
    [
      heading(1, "手引き"),
      heading(2, "導入"),
      paragraph("変えていない段落"),
      heading(2, "使用方法"),
      await diffBlock("add", paragraph("追加した段落")),
    ].join(""),
  );
  // 実行
  const headings = collectSideTocHeadings(root);
  // 検証
  expect(headings).toEqual([
    { level: 1, id: "手引き", text: "手引き", changed: true },
    { level: 2, id: "導入", text: "導入" },
    { level: 2, id: "使用方法", text: "使用方法", changed: true },
  ]);
});
