import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

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

/** `window.localStorage` を読むと `SecurityError` を投げる状態にし、元に戻す関数を返す */
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

// 同じ組のタブを揃えて残す（正常系）
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

// 外したタブは揃える対象から外れる（正常系）
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

// セレクタの記号を含む組の名前でも揃える（正常系）
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

// 残したタブ名を返す（正常系）
test("test_load_tab_choice", async () => {
  // 準備
  const { loadTabChoice } = await loadTabs();
  localStorage.setItem("mdmark-tabs:os", "Windows");
  // 実行
  const name = loadTabChoice("os");
  // 検証
  expect(name).toBe("Windows");
});

// localStorage を取り出せなければ undefined を返す（異常系）
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

// localStorage を取り出せなければ書かずに続ける（異常系）
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
