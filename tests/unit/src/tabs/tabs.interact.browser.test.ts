import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** タブの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTabs = () => import("../../../../src/tabs/tabs.interact.ts");

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

/** タブ 1 組の HTML（`group` が無ければ `data-group` を付けない） */
function tabsHtml(titles: string[], group?: string): string {
  const attribute =
    group === undefined
      ? ""
      : ` data-group="${group.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`;
  const panels = titles
    .map(
      (title) =>
        `<div class="mdmark-tab-panel"><p class="mdmark-tab-title">${title}</p><p>${title} の手順</p></div>`,
    )
    .join("");
  return `<div class="mdmark-tabs"${attribute}>${panels}</div>`;
}

/** 描いた要素の中の `mdmark-tabs` のうち `index` 番目で、選んでいるタブの名前 */
function selectedTitle(root: HTMLElement, index: number): string | undefined {
  return root
    .querySelectorAll(".mdmark-tabs")
    [index]?.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
}

/** 描いた要素の中の `mdmark-tabs` のうち `index` 番目で、名前のタブ */
function tabOf(root: HTMLElement, index: number, name: string): HTMLElement {
  const tab = [
    ...(root
      .querySelectorAll(".mdmark-tabs")
      [index]?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
  ].find((candidate) => candidate.textContent === name);
  if (!tab) {
    throw new Error(`タブが無い: ${name}`);
  }
  return tab;
}

/** `window.localStorage` を読み込むと `SecurityError` を投げる状態にし、元に戻す関数を返却する */
function blockLocalStorage(): () => void {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  return () => {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    } else {
      Reflect.deleteProperty(window, "localStorage");
    }
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  localStorage.clear();
  vi.restoreAllMocks();
  history.replaceState(null, "", location.pathname);
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

// 同じ組のタブを統一して残す（正常系）
test("test_attach_tabs_when_group_synced", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const first = createRootFromHtml(
    tabsHtml(["macOS", "Windows"], "os") + tabsHtml(["macOS", "Linux"], "os"),
  );
  const second = createRootFromHtml(
    tabsHtml(["macOS", "Windows"], "os") + tabsHtml(["macOS", "Windows"]),
  );
  detachers.push(attachTabs(first), attachTabs(second));
  // 実行
  tabOf(first, 0, "Windows").click();
  // 検証
  expect(selectedTitle(first, 0)).toBe("Windows");
  expect(selectedTitle(second, 0)).toBe("Windows");
  expect(selectedTitle(first, 1)).toBe("macOS");
  expect(selectedTitle(second, 1)).toBe("macOS");
  expect(document.activeElement).toBe(tabOf(first, 0, "Windows"));
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("Windows");
});

// 残したタブ名のタブを選んで付ける（正常系）
test("test_attach_tabs_when_choice_saved", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  localStorage.setItem("mdmark-tabs:os", "Windows");
  localStorage.setItem("mdmark-tabs:lang", "Go");
  const root = createRootFromHtml(
    tabsHtml(["macOS", "Windows"], "os") +
      tabsHtml(["Python", "TypeScript"], "lang"),
  );
  // 実行
  detachers.push(attachTabs(root));
  // 検証
  expect(selectedTitle(root, 0)).toBe("Windows");
  expect(selectedTitle(root, 1)).toBe("Python");
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("Windows");
  expect(localStorage.getItem("mdmark-tabs:lang")).toBe("Go");
});

// 削除したタブは統一する対象から削除される（正常系）
test("test_attach_tabs_when_detached", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const first = createRootFromHtml(tabsHtml(["macOS", "Windows"], "os"));
  const second = createRootFromHtml(tabsHtml(["macOS", "Windows"], "os"));
  const detachFirst = attachTabs(first);
  detachers.push(attachTabs(second));
  detachFirst();
  // 実行
  tabOf(second, 0, "Windows").click();
  // 検証
  expect(selectedTitle(second, 0)).toBe("Windows");
  expect(first.querySelector('[role="tablist"]')).toBeNull();
  expect(first.querySelector("[hidden]")).toBeNull();
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("Windows");
});

// セレクタの記号を含む組の名前でも統一する（正常系）
test("test_attach_tabs_when_group_has_quote", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const group = 'a"b\\c]';
  const first = createRootFromHtml(tabsHtml(["macOS", "Windows"], group));
  const second = createRootFromHtml(tabsHtml(["macOS", "Windows"], group));
  detachers.push(attachTabs(first), attachTabs(second));
  // 実行
  tabOf(first, 0, "Windows").click();
  // 検証
  expect(selectedTitle(first, 0)).toBe("Windows");
  expect(selectedTitle(second, 0)).toBe("Windows");
  expect(localStorage.getItem(`mdmark-tabs:${group}`)).toBe("Windows");
});

// 残したタブ名を返却する（正常系）
test("test_load_tab_choice", async () => {
  // 準備
  const { loadTabChoice } = await loadTabs();
  localStorage.setItem("mdmark-tabs:os", "Windows");
  // 実行
  const name = loadTabChoice("os");
  // 検証
  expect(name).toBe("Windows");
});

// localStorage を取り出せなければ undefined を返却する（異常系）
test("test_load_tab_choice_when_storage_unavailable", async () => {
  // 準備
  const { loadTabChoice } = await loadTabs();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const restore = blockLocalStorage();
  try {
    // 実行
    const name = loadTabChoice("os");
    // 検証
    expect(name).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    restore();
  }
});

// タブ名を残す（正常系）
test("test_save_tab_choice", async () => {
  // 準備
  const { saveTabChoice } = await loadTabs();
  // 実行
  saveTabChoice({ group: "os", name: "Windows" });
  // 検証
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("Windows");
});

// localStorage を取り出せなければ記載せずに続ける（異常系）
test("test_save_tab_choice_when_storage_unavailable", async () => {
  // 準備
  const { saveTabChoice } = await loadTabs();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const restore = blockLocalStorage();
  try {
    // 実行・検証
    expect(() => saveTabChoice({ group: "os", name: "Windows" })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    restore();
  }
});

/** 見出しを 1 つ持つタブの中身の HTML */
function panelWithHeading(title: string, heading?: string): string {
  const body =
    heading === undefined ? "" : `<h3 id="${heading}">${heading}</h3>`;
  return `<div class="mdmark-tab-panel"><p class="mdmark-tab-title">${title}</p><p>${title} の手順</p>${body}</div>`;
}

// URL の #ID が指す要素を含むタブを、残したタブ名より先に選ぶ（正常系）
test("test_attach_tabs_when_hash_in_tab", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  localStorage.setItem("mdmark-tabs:os", "macOS");
  const root = createRootFromHtml(
    `<div class="mdmark-tabs" data-group="os">${panelWithHeading("macOS")}${panelWithHeading("Windows", "注意")}</div>`,
  );
  const scrolled = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => undefined);
  history.replaceState(null, "", "#注意");
  // 実行
  detachers.push(attachTabs(root));
  // 検証
  expect(selectedTitle(root, 0)).toBe("Windows");
  expect(scrolled).toHaveBeenCalledTimes(1);
  expect(scrolled.mock.contexts[0]).toBe(root.querySelector("h3"));
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("macOS");
});

// 入れ子のタブを外側から選ぶ（正常系）
test("test_reveal_tab_target", async () => {
  // 準備
  const { attachTabs, revealTabTarget } = await loadTabs();
  const inner = `<div class="mdmark-tabs">${panelWithHeading("新")}${panelWithHeading("旧", "注意")}</div>`;
  const root = createRootFromHtml(
    `<div class="mdmark-tabs" data-group="os">${panelWithHeading("macOS")}<div class="mdmark-tab-panel"><p class="mdmark-tab-title">Windows</p>${inner}</div></div>`,
  );
  detachers.push(attachTabs(root));
  const heading = root.querySelector("h3");
  if (!heading) {
    throw new Error("見出しが無い");
  }
  // 実行
  revealTabTarget(heading);
  // 検証
  const [outer, nested] = [...root.querySelectorAll(".mdmark-tabs")];
  const selected = (tabs: Element): string | undefined =>
    tabs.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
  expect(selected(outer)).toBe("Windows");
  expect(selected(nested)).toBe("旧");
  expect(heading.closest("[hidden]")).toBeNull();
  expect(localStorage.getItem("mdmark-tabs:os")).toBeNull();
});

// タブの外の要素では何もしない（正常系）
test("test_reveal_tab_target_when_outside", async () => {
  // 準備
  const { attachTabs, revealTabTarget } = await loadTabs();
  const root = createRootFromHtml(
    `<h2 id="外">外</h2><div class="mdmark-tabs">${panelWithHeading("macOS")}${panelWithHeading("Windows")}</div>`,
  );
  detachers.push(attachTabs(root));
  const heading = root.querySelector("h2");
  if (!heading) {
    throw new Error("見出しが無い");
  }
  // 実行・検証
  expect(() => revealTabTarget(heading)).not.toThrow();
  expect(selectedTitle(root, 0)).toBe("macOS");
});

/** 外側の macOS の中に内側のタブを持ち、外側の 2 つ目のタブ名を強調した文書 */
const NESTED_TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "<!-- tabs -->",
  "",
  "#### zsh",
  "",
  "zsh の手順",
  "",
  "#### bash",
  "",
  "bash の手順",
  "",
  "<!-- /tabs -->",
  "",
  "### **Windows**",
  "",
  "Windows の手順",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

// 入れ子のタブをそれぞれの並びで切り替え、強調したタブ名をボタンに残す（正常系）
test("test_attach_tabs_when_nested", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const { root } = createRoot(NESTED_TABS_MARKDOWN);
  // 実行
  detachers.push(attachTabs(root));
  // 検証: 外側と内側の並びがあり、強調したタブ名の strong を残す
  const lists = [...root.querySelectorAll('[role="tablist"]')];
  expect(lists).toHaveLength(2);
  const tabsOf = (list: Element | undefined): HTMLButtonElement[] => [
    ...(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []),
  ];
  const [outer, inner] = lists.map((list) => tabsOf(list));
  expect(outer.map((tab) => tab.textContent)).toEqual(["macOS", "Windows"]);
  expect(inner.map((tab) => tab.textContent)).toEqual(["zsh", "bash"]);
  expect(outer[1]?.querySelector("strong")).not.toBeNull();
  // 実行・検証: 内側の bash を押しても外側の選択は変わらない
  inner[1]?.click();
  expect(inner[1]?.getAttribute("aria-selected")).toBe("true");
  expect(outer[0]?.getAttribute("aria-selected")).toBe("true");
  // 実行・検証: 内側の矢印は内側の並びの中だけで動く
  inner[1]?.focus();
  press("ArrowRight");
  expect(document.activeElement).toBe(inner[0]);
});

// タブ名のリンクはボタンでは文字にし、中身のタブ名には残す（正常系）
test("test_attach_tabs_when_link_title", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const { root } = createRoot(
    [
      "<!-- tabs -->",
      "",
      "### [設定](https://example.com)",
      "",
      "設定の手順",
      "",
      "### **案 B**",
      "",
      "案 B の手順",
      "",
      "<!-- /tabs -->",
      "",
    ].join("\n"),
  );
  // 実行
  detachers.push(attachTabs(root));
  // 検証
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  expect(tabs.map((tab) => tab.textContent)).toEqual(["設定", "案 B"]);
  expect(tabs[0]?.querySelector("a")).toBeNull();
  expect(tabs[1]?.querySelector("strong")).not.toBeNull();
  expect(
    root.querySelector(".mdmark-tab-panel .mdmark-tab-title a"),
  ).not.toBeNull();
});

/** 段落を 30 個持つ `長文` と段落を 1 つ持つ `短文` のタブ 1 組の HTML（段落は高さ 40px） */
function heightTabsHtml(group?: string): string {
  const attribute = group === undefined ? "" : ` data-group="${group}"`;
  const paragraph = '<p style="height: 40px; margin: 0">段落</p>';
  return `<div class="mdmark-tabs"${attribute}><div class="mdmark-tab-panel"><p class="mdmark-tab-title">長文</p>${paragraph.repeat(30)}</div><div class="mdmark-tab-panel"><p class="mdmark-tab-title">短文</p>${paragraph}</div></div>`;
}

/** 高さ 1200px の空の要素の HTML */
const SPACER_HTML = '<div style="height: 1200px"></div>';

/** スクロールのアンカリングを持たないブラウザ（Safari）と同じく、画面全体のアンカリングを止め、戻す関数を返却する */
function disableScrollAnchoring(): () => void {
  document.documentElement.style.overflowAnchor = "none";
  return () => {
    document.documentElement.style.removeProperty("overflow-anchor");
  };
}

/** 要素の画面の上端からの位置 */
function topOf(element: Element): number {
  return element.getBoundingClientRect().top;
}

// 高さの違うタブへ切り替えても、押したタブのボタンの画面の位置を保つ（正常系）
test("test_attach_tabs_when_position_kept", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const root = createRootFromHtml(
    `<div class="scroller" style="height: 600px; overflow-y: auto; overflow-anchor: none">${SPACER_HTML}${heightTabsHtml()}${SPACER_HTML}</div>`,
  );
  detachers.push(attachTabs(root));
  const scroller = root.querySelector<HTMLElement>(".scroller");
  if (!scroller) {
    throw new Error("スクロールする要素が無い");
  }
  const short = tabOf(root, 0, "短文");
  scroller.scrollTop += topOf(short) - topOf(scroller) - 300;
  const before = topOf(short);
  // 実行
  short.click();
  // 検証
  expect(Math.abs(topOf(short) - before)).toBeLessThanOrEqual(1);
  // 実行
  const long = tabOf(root, 0, "長文");
  const beforeLong = topOf(long);
  long.click();
  // 検証
  expect(Math.abs(topOf(long) - beforeLong)).toBeLessThanOrEqual(1);
});

// 上にある同じ組のタブの高さが変わっても、押したタブのボタンの位置を保つ（正常系）
test("test_attach_tabs_when_group_above_shrinks", async () => {
  // 準備
  detachers.push(disableScrollAnchoring());
  const { attachTabs } = await loadTabs();
  const root = createRootFromHtml(
    `${heightTabsHtml("len")}${SPACER_HTML}${heightTabsHtml("len")}${SPACER_HTML}`,
  );
  detachers.push(attachTabs(root));
  const short = tabOf(root, 1, "短文");
  window.scrollBy(0, topOf(short) - 300);
  const before = topOf(short);
  // 実行
  short.click();
  // 検証
  expect(selectedTitle(root, 0)).toBe("短文");
  expect(selectedTitle(root, 1)).toBe("短文");
  expect(Math.abs(topOf(short) - before)).toBeLessThanOrEqual(1);
  window.scrollTo(0, 0);
});

// 文書が縮んで戻しきれないときはスクロール位置の上限で止まる（正常系）
test("test_attach_tabs_when_cannot_restore", async () => {
  // 準備
  detachers.push(disableScrollAnchoring());
  const { attachTabs } = await loadTabs();
  const root = createRootFromHtml(`${SPACER_HTML}${heightTabsHtml()}`);
  detachers.push(attachTabs(root));
  const short = tabOf(root, 0, "短文");
  window.scrollBy(0, topOf(short) - 300);
  // 実行
  short.click();
  // 検証
  const max = document.documentElement.scrollHeight - window.innerHeight;
  expect(Math.abs(window.scrollY - max)).toBeLessThanOrEqual(1);
  const top = topOf(short);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(window.innerHeight);
  window.scrollTo(0, 0);
});

/** 次の描画のフレームを 2 回待つ */
async function nextFrames(): Promise<void> {
  for (let count = 0; count < 2; count += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

// スクロールのアンカリングを持つブラウザでも、補正が二重に効かず押したタブのボタンの位置を保つ（正常系）
test("test_attach_tabs_when_position_kept_with_anchoring", async () => {
  // 準備
  const { attachTabs } = await loadTabs();
  const root = createRootFromHtml(
    `${heightTabsHtml("len")}${SPACER_HTML}${heightTabsHtml("len")}${SPACER_HTML}`,
  );
  detachers.push(attachTabs(root));
  const short = tabOf(root, 1, "短文");
  window.scrollBy(0, topOf(short) - 300);
  const before = topOf(short);
  // 実行: 上にある同じ組のタブと押したタブがどちらも縮む
  short.click();
  await nextFrames();
  // 検証
  expect(Math.abs(topOf(short) - before)).toBeLessThanOrEqual(1);
  // 実行: 上にある同じ組のタブと押したタブがどちらも伸びる
  const long = tabOf(root, 1, "長文");
  const beforeLong = topOf(long);
  long.click();
  await nextFrames();
  // 検証
  expect(Math.abs(topOf(long) - beforeLong)).toBeLessThanOrEqual(1);
  window.scrollTo(0, 0);
});

/** 7 つのタブ（それぞれ幅 100px）を持つ、幅 320px の並びの HTML。並びは折り返さず並びの中で横にスクロールする */
function overflowTablistHtml(selected: number): string {
  const buttons = Array.from(
    { length: 7 },
    (_, index) =>
      `<button class="mdmark-tab" type="button" role="tab" aria-selected="${index === selected}" tabindex="${index === selected ? 0 : -1}" style="flex: none; width: 100px">第 ${index + 1} 章</button>`,
  ).join("");
  return `<div class="mdmark-tabs"><div class="mdmark-tablist" role="tablist" style="display: flex; flex-wrap: nowrap; overflow-x: auto; width: 320px">${buttons}</div></div>`;
}

/** 描いた要素の中の並び */
function tablistOf(root: HTMLElement): HTMLElement {
  const tablist = root.querySelector<HTMLElement>('[role="tablist"]');
  if (!tablist) {
    throw new Error("並びが無い");
  }
  return tablist;
}

/** 並びを包む要素の、向きの端のボタン */
function scrollButtonOf(
  tablist: HTMLElement,
  dir: "start" | "end",
): HTMLButtonElement {
  const button = tablist.parentElement?.querySelector<HTMLButtonElement>(
    `.mdmark-tablist-scroll[data-dir="${dir}"]`,
  );
  if (!button) {
    throw new Error(`端のボタンが無い: ${dir}`);
  }
  return button;
}

/** 並びの位置のタブを選んだ状態にする */
function markSelected(tablist: HTMLElement, selected: number): void {
  tablist
    .querySelectorAll<HTMLElement>('[role="tab"]')
    .forEach((tab, index) => {
      tab.setAttribute("aria-selected", String(index === selected));
    });
}

/** 位置のタブのボタン */
function tabAt(tablist: HTMLElement, index: number): HTMLElement {
  const tab = tablist.querySelectorAll<HTMLElement>('[role="tab"]')[index];
  if (!tab) {
    throw new Error(`タブが無い: ${index}`);
  }
  return tab;
}

// 右の外にある選んだタブを入れる（正常系）
test("test_reveal_selected_tab", async () => {
  // 準備
  addStyles();
  const { attachTablistScroll, revealSelectedTab } = await loadTabs();
  const root = createRootFromHtml(overflowTablistHtml(0));
  const tablist = tablistOf(root);
  detachers.push(attachTablistScroll(tablist));
  tablist.scrollLeft = 0;
  markSelected(tablist, 4);
  const scrollY = window.scrollY;
  // 実行
  revealSelectedTab(tablist);
  // 検証
  const end = scrollButtonOf(tablist, "end");
  const right = tablist.getBoundingClientRect().right - end.offsetWidth;
  expect(
    Math.abs(tabAt(tablist, 4).getBoundingClientRect().right - right),
  ).toBeLessThanOrEqual(1);
  expect(window.scrollY).toBe(scrollY);
});

// 見える範囲にあれば動かさない（正常系）
test("test_reveal_selected_tab_when_visible", async () => {
  // 準備
  addStyles();
  const { attachTablistScroll, revealSelectedTab } = await loadTabs();
  const root = createRootFromHtml(overflowTablistHtml(0));
  const tablist = tablistOf(root);
  detachers.push(attachTablistScroll(tablist));
  tablist.scrollLeft = 0;
  markSelected(tablist, 1);
  // 実行
  revealSelectedTab(tablist);
  // 検証
  expect(tablist.scrollLeft).toBe(0);
});

// 配置の無い並びは動かさない（正常系）
test("test_reveal_selected_tab_when_not_laid_out", async () => {
  // 準備
  const { revealSelectedTab } = await loadTabs();
  const holder = document.createElement("div");
  holder.innerHTML = overflowTablistHtml(6);
  const tablist = tablistOf(holder);
  // 実行・検証
  expect(() => revealSelectedTab(tablist)).not.toThrow();
  expect(tablist.scrollLeft).toBe(0);
});

// 最後のタブは並びを右端まで動かして入れる（正常系）
test("test_reveal_selected_tab_when_last", async () => {
  // 準備
  addStyles();
  const { attachTablistScroll, revealSelectedTab } = await loadTabs();
  const root = createRootFromHtml(overflowTablistHtml(0));
  const tablist = tablistOf(root);
  detachers.push(attachTablistScroll(tablist));
  tablist.scrollLeft = 0;
  markSelected(tablist, 6);
  // 実行
  revealSelectedTab(tablist);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // 検証
  expect(
    Math.abs(tablist.scrollLeft - (tablist.scrollWidth - tablist.clientWidth)),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      tabAt(tablist, 6).getBoundingClientRect().right -
        tablist.getBoundingClientRect().right,
    ),
  ).toBeLessThanOrEqual(1);
  expect(scrollButtonOf(tablist, "end").hidden).toBe(true);
});

// 残りがある側のボタンだけを出し、押すと並びを動かす（正常系）
test("test_attach_tablist_scroll", async () => {
  // 準備
  addStyles();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
  const { attachTablistScroll } = await loadTabs();
  const root = createRootFromHtml(overflowTablistHtml(0));
  const tablist = tablistOf(root);
  detachers.push(attachTablistScroll(tablist));
  await nextFrames();
  const start = scrollButtonOf(tablist, "start");
  const end = scrollButtonOf(tablist, "end");
  // 検証: 付けた直後
  expect(start.hidden).toBe(true);
  expect(end.hidden).toBe(false);
  for (const button of [start, end]) {
    expect(button.getAttribute("aria-hidden")).toBe("true");
    expect(button.getAttribute("tabindex")).toBe("-1");
  }
  const first = tabAt(tablist, 0);
  first.focus();
  // 実行
  end.click();
  await nextFrames();
  // 検証: 押した後
  expect(
    Math.abs(tablist.scrollLeft - tablist.clientWidth * 0.8),
  ).toBeLessThanOrEqual(1);
  expect(start.hidden).toBe(false);
  expect(first.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(first);
});

// 幅が 0 から変わったときに選んだタブを入れる（正常系）
test("test_attach_tablist_scroll_when_laid_out_later", async () => {
  // 準備
  addStyles();
  const { attachTablistScroll } = await loadTabs();
  const holder = document.createElement("div");
  holder.className = "mdmark";
  holder.innerHTML = overflowTablistHtml(6);
  const tablist = tablistOf(holder);
  const detach = attachTablistScroll(tablist);
  // 実行
  document.body.append(holder);
  await nextFrames();
  // 検証
  const list = tablist.getBoundingClientRect();
  const tab = tabAt(tablist, 6).getBoundingClientRect();
  expect(tab.left).toBeGreaterThanOrEqual(list.left - 1);
  expect(tab.right).toBeLessThanOrEqual(list.right + 1);
  expect(scrollButtonOf(tablist, "end").hidden).toBe(true);
  expect(scrollButtonOf(tablist, "start").hidden).toBe(false);
  detach();
  holder.remove();
});

// 返った関数で並びを元に戻す（正常系）
test("test_attach_tablist_scroll_when_detached", async () => {
  // 準備
  const { attachTablistScroll } = await loadTabs();
  const root = createRootFromHtml(overflowTablistHtml(0));
  const tablist = tablistOf(root);
  const parent = tablist.parentElement;
  const detach = attachTablistScroll(tablist);
  // 実行
  detach();
  // 検証
  expect(root.querySelector(".mdmark-tablist-wrap")).toBeNull();
  expect(root.querySelector(".mdmark-tablist-scroll")).toBeNull();
  expect(tablist.parentElement).toBe(parent);
  expect(parent?.firstElementChild).toBe(tablist);
});

/** 7 つの長いタブ名のタブ 1 組の HTML（`attribute` を `mdmark-tabs` に付ける） */
function manyTabsHtml(attribute: string): string {
  const panels = Array.from(
    { length: 7 },
    (_, index) =>
      `<div class="mdmark-tab-panel"><p class="mdmark-tab-title">第 ${index + 1} 章 とても長いタブ名</p><p>第 ${index + 1} 章の中身</p></div>`,
  ).join("");
  return `<div class="mdmark-tabs"${attribute}>${panels}</div>`;
}

// はみ出す並びで選んだタブを見える範囲へ入れ、data-wrap のタブ群には付けない（正常系）
test("test_attach_tabs_when_tablist_overflows", async () => {
  // 準備
  addStyles();
  const { attachTabs } = await loadTabs();
  const root = createRootFromHtml(
    `<div style="width: 320px">${manyTabsHtml(' data-group="many"')}${manyTabsHtml(' data-group="many"')}${manyTabsHtml(" data-wrap")}</div>`,
  );
  detachers.push(attachTabs(root));
  await nextFrames();
  const scrollY = window.scrollY;
  tabOf(root, 0, "第 1 章 とても長いタブ名").focus();
  // 実行
  press("End");
  await nextFrames();
  // 検証
  const lists = [...root.querySelectorAll<HTMLElement>('[role="tablist"]')];
  expect(lists).toHaveLength(3);
  for (const index of [0, 1]) {
    const tablist = lists[index];
    expect(
      tablist?.parentElement?.classList.contains("mdmark-tablist-wrap"),
    ).toBe(true);
    const list = tablist?.getBoundingClientRect();
    const tab = tabOf(
      root,
      index,
      "第 7 章 とても長いタブ名",
    ).getBoundingClientRect();
    expect(tab.left).toBeGreaterThanOrEqual((list?.left ?? 0) - 1);
    expect(tab.right).toBeLessThanOrEqual((list?.right ?? 0) + 1);
  }
  const wrapped = root.querySelectorAll(".mdmark-tabs")[2];
  expect(wrapped?.querySelector(".mdmark-tablist-wrap")).toBeNull();
  expect(wrapped?.querySelector(".mdmark-tablist-scroll")).toBeNull();
  expect(lists[2]?.scrollLeft).toBe(0);
  expect(window.scrollY).toBe(scrollY);
});
