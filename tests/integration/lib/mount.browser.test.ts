import { afterEach, expect, inject, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type {
  MdmarkIndex,
  MdmarkReferences,
  MountHandle,
} from "../../../src/index.ts";

type Built = typeof import("../../../src/index.ts");

// 外部ライブラリの代役のモジュールの URL（手元の開発サーバーが配る）
const TEST_LIB_PATH = "/fixtures/test-lib.js";
const MISSING_LIB_PATH = "/fixtures/missing.js";
// 読み込み中の枠の文言
const LOADING_TEXT = "図を読み込んでいます";

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];
const addedStyles: HTMLStyleElement[] = [];
let stylesheetLoaded: Promise<void> | undefined;
let built: Promise<Built> | undefined;

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

/** ビルドした CSS を 1 度だけ読み込む */
function loadStylesheet(): Promise<void> {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  return stylesheetLoaded;
}

/** ビルドした JS を 1 度だけ読み込み、CSS と合わせて使える状態にする */
async function loadBuilt(): Promise<Built> {
  await loadStylesheet();
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  return built;
}

/** 描く先の要素を作り、ページに置く */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を控える */
async function mountTracked(
  el: HTMLElement,
  opts: Parameters<Built["mount"]>[1],
): Promise<MountHandle> {
  const { mount } = await loadBuilt();
  const handle = mount(el, opts);
  handles.push(handle);
  return handle;
}

/** 要素の中を CSS セレクタで 1 つ引く（無ければ失敗する） */
function find<T extends Element>(el: Element, selector: string): T {
  const found = el.querySelector<T>(selector);
  if (!found) {
    throw new Error(`見つからない: ${selector}`);
  }
  return found;
}

/** 要素の直下の段落の文字を並べて返す（知らせの枠の中の段落は含めない） */
function paragraphTexts(el: Element): string[] {
  return [...el.querySelectorAll(":scope > p")].map((p) => p.textContent ?? "");
}

/** 印刷の前後のイベントを送る */
function sendPrintEvent(type: "beforeprint" | "afterprint"): void {
  window.dispatchEvent(new Event(type));
}

/** 外部ライブラリの代役のモジュールを読んだ要求の件数を数える */
function countRequests(path: string): number {
  return performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.endsWith(path)).length;
}

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  for (const style of addedStyles.splice(0)) {
    style.remove();
  }
  vi.restoreAllMocks();
});

// 要素の中に Markdown を HTML として描く（正常系）
test("test_normal", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    "# 見出し",
    "",
    "段落",
    "",
    "- 項目",
    "",
    "| 列A | 列B |",
    "| --- | ---: |",
    "| 1 | 2 |",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
    "[リンク](https://example.com/page)",
    "",
  ].join("\n");
  // 実行
  const handle = await mountTracked(el, { markdown });
  // 検証
  expect(el.classList.contains("mdmark")).toBe(true);
  for (const selector of ["h1", "p", "ul", "table", "pre > code.language-ts"]) {
    expect(el.querySelector(selector), selector).not.toBeNull();
  }
  expect(find(el, 'a[href^="https"]').getAttribute("href")).toBe(
    "https://example.com/page",
  );
  const cells = [...el.querySelectorAll("td")];
  expect(cells.map((td) => td.getAttribute("data-label"))).toEqual([
    "列A",
    "列B",
  ]);
  const rightAligned = find(el, "td:nth-child(2)");
  expect(rightAligned.classList.contains("mdmark-align-right")).toBe(true);
  expect(rightAligned.hasAttribute("style")).toBe(false);
  expect(typeof handle.update).toBe("function");
  expect(typeof handle.destroy).toBe("function");
});

// update で本文だけを描き直す（正常系）
test("test_normal_when_updated", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# 元の見出し\n\n段落\n" });
  // 実行
  handle.update("# 新しい見出し");
  // 検証
  expect(el.children).toHaveLength(1);
  expect(find(el, "h1").textContent).toBe("新しい見出し");
  expect(el.classList.contains("mdmark")).toBe(true);
});

// destroy で描いたものとイベントを片付ける（正常系）
test("test_normal_when_destroyed", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "<details><summary>s</summary>b</details>\n",
  });
  // 実行
  handle.destroy();
  handle.update("# 描かれない");
  // 検証
  expect(el.innerHTML).toBe("");
  expect(el.classList.contains("mdmark")).toBe(false);
  expect(() => sendPrintEvent("beforeprint")).not.toThrow();
});

// 描いた要素へもう一度 mount を呼ぶと、前の描画を片付けてから描く（正常系）
test("test_normal_when_mounted_twice", async () => {
  // 準備
  const el = createElement();
  const first = await mountTracked(el, { markdown: "段落 A\n" });
  await mountTracked(el, { markdown: "段落 B\n" });
  // 実行
  first.update("段落 C");
  // 検証
  expect(paragraphTexts(el)).toEqual(["段落 B"]);
});

// 未知の印を無視して描く（正常系）
test("test_normal_when_unknown_mark", async () => {
  // 準備
  const el = createElement();
  const markdown = "前の段落\n\n<!-- unknown: 1 -->\n\n後の段落\n";
  // 実行
  await mountTracked(el, { markdown });
  // 検証
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
  expect(el.innerHTML).not.toContain("<!--");
  expect(el.innerHTML).not.toContain("unknown");
});

// 文書に書いたスクリプトを落として描き、実行しない（正常系）
test("test_normal_when_script_in_markdown", async () => {
  // 準備
  const el = createElement();
  const ran = window as unknown as { __ran?: boolean };
  ran.__ran = false;
  const markdown = [
    "<script>window.__ran = true</script>",
    "",
    '<a onclick="window.__ran = true" href="#top">押す</a> <a href="javascript:window.__ran = true">js</a>',
    "",
    '<p style="position:fixed">style</p>',
    "",
    "<details><summary>s</summary>b</details>",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown });
  for (const link of el.querySelectorAll("a")) {
    link.click();
  }
  // 検証
  expect(el.querySelector("script")).toBeNull();
  expect(el.querySelector("[style]")).toBeNull();
  const attributeNames = [...el.querySelectorAll("*")].flatMap((node) =>
    node.getAttributeNames(),
  );
  expect(attributeNames.filter((name) => name.startsWith("on"))).toEqual([]);
  for (const link of el.querySelectorAll("a")) {
    expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  }
  expect(ran.__ran).toBe(false);
  expect(el.querySelector("details")).not.toBeNull();
  expect(el.querySelector("summary")).not.toBeNull();
});

// 印の無い文書では外部ライブラリを読まない（正常系）
// 注: 同じページで読んだモジュールは読み直されないため、外部ライブラリを読むテストより前に置く
test("test_normal_when_no_library_mark", async () => {
  // 準備
  const el = createElement();
  await loadBuilt();
  performance.clearResourceTimings();
  const config = { libraries: { "test-lib": TEST_LIB_PATH } };
  // 実行
  await mountTracked(el, { markdown: "段落\n", config });
  await new Promise((resolve) => setTimeout(resolve, 200));
  // 検証
  expect(countRequests(TEST_LIB_PATH)).toBe(0);
  expect(paragraphTexts(el)).toEqual(["段落"]);
});

// 文書に外部ライブラリの印があるときだけ、そのモジュールを読んで印の場所に描かせる（正常系）
test("test_normal_when_library_mark", async () => {
  // 準備
  const el = createElement();
  await loadBuilt();
  performance.clearResourceTimings();
  const markdown = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
  const config = { libraries: { "test-lib": TEST_LIB_PATH } };
  // 実行
  await mountTracked(el, { markdown, config });
  // 検証
  const slot = find<HTMLElement>(el, "[data-mdmark-slot]");
  expect(slot.classList.contains("mdmark-embed")).toBe(true);
  expect(slot.getAttribute("role")).toBe("status");
  expect(slot.textContent).toBe(LOADING_TEXT);
  await expect.poll(() => slot.textContent).toBe("drawn:a,b");
  expect(countRequests(TEST_LIB_PATH)).toBe(1);
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 印刷の機能がオンのとき、印刷の前に閉じた折り畳みを開き、印刷の後に戻す（正常系）
test("test_normal_when_printed", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "<details><summary>閉</summary>x</details>\n\n<details open><summary>開</summary>y</details>\n";
  await mountTracked(el, { markdown });
  const [closed, opened] = [...el.querySelectorAll("details")];
  // 実行・検証
  sendPrintEvent("beforeprint");
  expect(closed?.open).toBe(true);
  expect(opened?.open).toBe(true);
  sendPrintEvent("afterprint");
  expect(closed?.open).toBe(false);
  expect(opened?.open).toBe(true);
});

// 設定でオンの機能を、文書の印でその文書だけオフにする（正常系）
test("test_normal_when_feature_disabled_by_mark", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "<!-- features: -print -->\n\n<details><summary>s</summary>b</details>\n";
  await mountTracked(el, { markdown, config: { features: { print: true } } });
  // 実行
  sendPrintEvent("beforeprint");
  // 検証
  expect(find<HTMLDetailsElement>(el, "details").open).toBe(false);
  expect(el.innerHTML).not.toContain("features");
});

// 設定でオフの機能を、文書の印でその文書だけオンにする。知らない機能名は無視する（正常系）
test("test_normal_when_feature_enabled_by_mark", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "<!-- features: +print +unknown -->\n\n<details><summary>s</summary>b</details>\n";
  await mountTracked(el, { markdown, config: { features: { print: false } } });
  // 実行
  sendPrintEvent("beforeprint");
  // 検証
  expect(find<HTMLDetailsElement>(el, "details").open).toBe(true);
  expect(el.innerHTML).not.toContain("features");
  expect(el.innerHTML).not.toContain("unknown");
});

// 使う側のページが層の外に書いた CSS と変数の上書きが、mdmark の CSS に勝つ（正常系）
test("test_normal_when_theme_overridden", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: "[リンク](https://example.com/)\n" });
  const style = document.createElement("style");
  style.textContent =
    "a { text-decoration-line: none } .mdmark { --mdmark-color-link: rgb(4, 5, 6) }";
  document.head.append(style);
  addedStyles.push(style);
  // 実行
  const computed = getComputedStyle(find(el, "a"));
  // 検証
  expect(computed.textDecorationLine).toBe("none");
  expect(computed.color).toBe("rgb(4, 5, 6)");
});

// 外部ライブラリを読めない印の場所だけを知らせの枠にし、ほかは描く（異常系）
test("test_error_when_library_not_found", async () => {
  // 準備
  const el = createElement();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const markdown = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
  const config = { libraries: { "test-lib": MISSING_LIB_PATH } };
  const { mount } = await loadBuilt();
  let handle: MountHandle | undefined;
  // 実行
  expect(() => {
    handle = mount(el, { markdown, config });
  }).not.toThrow();
  if (handle) {
    handles.push(handle);
  }
  // 検証
  const notice = await vi.waitFor(() => find(el, ".mdmark-notice"));
  expect(notice.getAttribute("role")).toBe("status");
  expect(find(notice, ".mdmark-notice-title").textContent).toBe(
    "この図を表示できません",
  );
  expect(find(notice, "p").textContent).toBe(
    "表示に使うライブラリ（test-lib）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。",
  );
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
  expect(errorSpy).toHaveBeenCalledTimes(1);
  const args = errorSpy.mock.calls[0] ?? [];
  expect(args).toContain("test-lib");
  expect(args).toContain(`${location.origin}${MISSING_LIB_PATH}`);
  expect(args.some((arg) => arg instanceof Error)).toBe(true);
});

/** 名前と値の 3 行を持つ、名前の列を絞り込む表の Markdown */
const FILTER_TABLE_MARKDOWN = [
  "<!-- table: data filter=名前 -->",
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| りんご | 10 |",
  "| みかん | 2 |",
  "| りんご飴 | 33 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 3 つのタブを持つ Markdown */
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

/** 表の本文の行の指定した列の文字を、上から並べて返す */
function columnTexts(el: Element, column: number): string[] {
  return [...el.querySelectorAll("tbody tr")]
    .filter(
      (row) =>
        !row.classList.contains("mdmark-row-detail") &&
        !row.classList.contains("mdmark-table-empty"),
    )
    .map((row) => row.querySelectorAll("td")[column]?.textContent ?? "");
}

/** 表の本文の行のうち、隠れていないものの数 */
function visibleRows(el: Element): number {
  return [...el.querySelectorAll<HTMLElement>("tbody tr")].filter(
    (row) =>
      !row.classList.contains("mdmark-row-detail") &&
      !row.classList.contains("mdmark-table-empty") &&
      !row.hidden,
  ).length;
}

// 表の見出しで並べ替えを 3 状態で切り替え、絞り込みのドロワーで絞って外す（正常系）
test("test_normal_when_table_sorted_and_filtered", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: FILTER_TABLE_MARKDOWN });
  const valueHead = el.querySelectorAll("thead th")[1] as HTMLElement;
  const sortButton = find<HTMLButtonElement>(valueHead, "button.mdmark-sort");
  // 実行・検証: 値の列の見出しを 3 回押す
  sortButton.click();
  expect(columnTexts(el, 1)).toEqual(["2", "10", "33"]);
  expect(valueHead.getAttribute("aria-sort")).toBe("ascending");
  sortButton.click();
  expect(columnTexts(el, 1)).toEqual(["33", "10", "2"]);
  expect(valueHead.getAttribute("aria-sort")).toBe("descending");
  sortButton.click();
  expect(columnTexts(el, 1)).toEqual(["10", "2", "33"]);
  expect(valueHead.hasAttribute("aria-sort")).toBe(false);
  // 実行・検証: 名前の列の絞り込みのボタンを押す
  const filterButtons =
    el.querySelectorAll<HTMLButtonElement>(".mdmark-filter");
  expect(filterButtons).toHaveLength(1);
  const filterButton = filterButtons[0] as HTMLButtonElement;
  expect(el.querySelectorAll("thead th")[0]?.contains(filterButton)).toBe(true);
  filterButton.click();
  const drawer = find<HTMLElement>(el, ".mdmark-filter-drawer");
  expect(filterButton.getAttribute("aria-expanded")).toBe("true");
  expect(drawer.hasAttribute("hidden")).toBe(false);
  expect(document.activeElement).toBe(find(drawer, ".mdmark-filter-search"));
  // 実行・検証: りんごを選ぶ
  const apple = [...drawer.querySelectorAll("label")].find(
    (label) => label.textContent?.trim() === "りんご",
  )?.control as HTMLInputElement;
  apple.click();
  expect(visibleRows(el)).toBe(1);
  expect(
    columnTexts(el, 0).filter(
      (_, i) => !el.querySelectorAll<HTMLElement>("tbody tr")[i]?.hidden,
    ),
  ).toEqual(["りんご"]);
  // 実行・検証: 絞り込みを外す
  const clear = [...drawer.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("絞り込みを外す"),
  );
  clear?.click();
  for (const checkbox of drawer.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )) {
    expect(checkbox.checked).toBe(false);
  }
  expect(visibleRows(el)).toBe(3);
  // 実行・検証: ドロワーの外を押す
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(drawer.hasAttribute("hidden")).toBe(true);
  expect(filterButton.getAttribute("aria-expanded")).toBe("false");
});

// はみ出す表にだけピン止めのボタンを出し、押した列までを左端に留める（正常系）
test("test_normal_when_table_pinned", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  const headers = Array.from({ length: 10 }, (_, i) => `列の名前${i + 1}`);
  const wideRows = Array.from(
    { length: 30 },
    (_, row) =>
      `| ${headers.map((_h, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
  );
  const markdown = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...wideRows,
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 印 | 目印 |",
    "| 枠 | 囲み |",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const [wide, narrow] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-table"),
  ] as [HTMLElement, HTMLElement];
  const widePins =
    wide.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  // 実行・検証: はみ出す表の各列にだけボタンが出る
  await vi.waitFor(() => {
    expect(widePins).toHaveLength(10);
    for (const pin of widePins) {
      expect(pin.hasAttribute("hidden")).toBe(false);
    }
  });
  for (const pin of narrow.querySelectorAll<HTMLButtonElement>(
    "button.mdmark-pin",
  )) {
    expect(pin.hasAttribute("hidden")).toBe(true);
  }
  const firstRow = wide.querySelector("tbody tr") as HTMLElement;
  const positions = () =>
    [...firstRow.querySelectorAll("td")].map(
      (cell) => getComputedStyle(cell).position,
    );
  const headPositions = () =>
    [...wide.querySelectorAll("thead th")].map(
      (cell) => getComputedStyle(cell).position,
    );
  // 実行・検証: 2 列目のピン止めを押す
  const second = widePins[1] as HTMLButtonElement;
  second.click();
  expect(second.getAttribute("aria-pressed")).toBe("true");
  expect(positions().slice(0, 3)).toEqual(["sticky", "sticky", "static"]);
  expect(new Set(headPositions())).toEqual(new Set(["sticky"]));
  // 実行・検証: もう一度押す
  second.click();
  expect(second.getAttribute("aria-pressed")).toBe("false");
  expect(positions().slice(0, 2)).toEqual(["static", "static"]);
  expect(new Set(headPositions())).toEqual(new Set(["sticky"]));
});

// タブの範囲にタブの並びを付け、押すか矢印キーで切り替える（正常系）
test("test_normal_when_tabs_switched", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: TABS_MARKDOWN });
  const tablist = find(el, '[role="tablist"]');
  const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = [...el.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  // 検証: 描いた直後
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    "macOS",
    "Windows",
    "Linux",
  ]);
  expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
  expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual([
    false,
    true,
    true,
  ]);
  // 実行・検証: Windows を押す
  tabs[1]?.click();
  expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual([
    true,
    false,
    true,
  ]);
  expect(panels[1]?.textContent).toContain("Windows の手順");
  // 実行・検証: 右の矢印キー
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  expect(document.activeElement).toBe(tabs[2]);
  expect(tabs[2]?.getAttribute("aria-selected")).toBe("true");
});

// 見出しで節を、行のボタンで行の詳細を開閉し、閉じた節の中への #ID でその節を開く（正常系）
test("test_normal_when_sections_and_row_details_toggled", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    "## 概要",
    "",
    "概要の段落",
    "",
    "## 補足",
    "",
    "<!-- section: closed -->",
    "",
    "補足の段落",
    "",
    "### 注意",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- row-detail: 2 -->",
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const toggleOf = (id: string) =>
    find<HTMLButtonElement>(el, `[aria-controls="section-${id}"]`);
  const bodyOf = (id: string) => find<HTMLElement>(el, `[id="section-${id}"]`);
  try {
    // 検証: 描いた直後
    expect(bodyOf("補足").getAttribute("hidden")).toBe("until-found");
    expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("false");
    // 実行・検証: 概要の開閉を押す
    toggleOf("概要").click();
    expect(bodyOf("概要").hasAttribute("hidden")).toBe(true);
    expect(toggleOf("概要").getAttribute("aria-expanded")).toBe("false");
    // 実行・検証: 2 行目の詳細のボタンを押す
    const rowToggles = el.querySelectorAll<HTMLButtonElement>(
      "button.mdmark-row-toggle",
    );
    expect(rowToggles).toHaveLength(1);
    const rows = el.querySelectorAll("tbody tr:not(.mdmark-row-detail)");
    expect(rows[1]?.contains(rowToggles[0] as Node)).toBe(true);
    const detail = find<HTMLElement>(el, "tr.mdmark-row-detail");
    expect(detail.hasAttribute("hidden")).toBe(true);
    rowToggles[0]?.click();
    expect(detail.hasAttribute("hidden")).toBe(false);
    expect(rowToggles[0]?.getAttribute("aria-expanded")).toBe("true");
    // 実行・検証: #注意 へ移る
    location.hash = "#注意";
    await vi.waitFor(() => {
      expect(bodyOf("補足").hasAttribute("hidden")).toBe(false);
    });
    expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("true");
  } finally {
    history.replaceState(null, "", location.pathname);
  }
});

// 印刷の前にタブの全ての中身と閉じた記法を開き、印刷の後に戻す（正常系）
test("test_normal_when_printed_with_syntax", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    "<!-- tabs -->",
    "",
    "### 一つ目",
    "",
    "一つ目の中身",
    "",
    "### 二つ目",
    "",
    "二つ目の中身",
    "",
    "<!-- /tabs -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    "<!-- table: data closed -->",
    "",
    "| 版 | 日付 |",
    "| --- | --- |",
    "| v1 | 2026-10-10 |",
    "",
    "<!-- /table -->",
    "",
    "> [!NOTE]-",
    "> 補足の本文",
    "",
    "## 閉じた節",
    "",
    "<!-- section: closed -->",
    "",
    "節の中身",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
  tabs[1]?.click();
  const panels = [...el.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const section = find<HTMLElement>(el, "[id^='section-']");
  const detail = find<HTMLElement>(el, "tr.mdmark-row-detail");
  const details = [
    ...el.querySelectorAll<HTMLDetailsElement>(
      "details.mdmark-table-details, details.markdown-alert",
    ),
  ];
  expect(details).toHaveLength(2);
  // 実行・検証: 印刷の前
  sendPrintEvent("beforeprint");
  for (const panel of panels) {
    expect(panel.hasAttribute("hidden")).toBe(false);
  }
  expect(
    [...el.querySelectorAll(".mdmark-tab-title")].map(
      (title) => title.textContent,
    ),
  ).toEqual(["一つ目", "二つ目"]);
  expect(section.hasAttribute("hidden")).toBe(false);
  expect(detail.hasAttribute("hidden")).toBe(false);
  for (const element of details) {
    expect(element.open).toBe(true);
  }
  // 実行・検証: 印刷の後
  sendPrintEvent("afterprint");
  expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual([
    true,
    false,
  ]);
  expect(section.getAttribute("hidden")).toBe("until-found");
  expect(detail.hasAttribute("hidden")).toBe(true);
  for (const element of details) {
    expect(element.open).toBe(false);
  }
});

// update の後も記法の操作が働き、destroy の後は document の受け取りが外れている（正常系）
test("test_normal_when_updated_with_syntax", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: FILTER_TABLE_MARKDOWN });
  find<HTMLButtonElement>(el, "button.mdmark-filter").click();
  const removeSpy = vi.spyOn(document, "removeEventListener");
  // 実行
  handle.update(
    "<!-- tabs -->\n\n### 一つ目\n\n一つ目の中身\n\n### 二つ目\n\n二つ目の中身\n\n<!-- /tabs -->\n",
  );
  // 検証
  const types = removeSpy.mock.calls.map(([type]) => type);
  expect(types).toContain("pointerdown");
  expect(types).toContain("keydown");
  const tabs = [...el.querySelectorAll<HTMLElement>('[role="tab"]')];
  tabs[1]?.click();
  expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  handle.destroy();
  expect(() => window.dispatchEvent(new Event("hashchange"))).not.toThrow();
});

/** 索引: 用語 `索引` と、文書 `arch`・`api`（別名 `公開関数`）・`index-ref`（別名 `索引`） */
const GLOSSARY_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    {
      id: "api",
      path: "api.md",
      title: "API",
      description: "mount と render の引数",
      aliases: ["公開関数"],
    },
    {
      id: "index-ref",
      path: "索引.md",
      title: "索引のリファレンス",
      aliases: ["索引"],
    },
  ],
  terms: [
    {
      id: "index",
      term: "索引",
      meaning: "文書と用語を並べた YAML のファイル",
    },
  ],
};

/** ツールチップが開いているか（表示されているか） */
function isOpen(tip: Element): boolean {
  return getComputedStyle(tip).display !== "none";
}

// 索引の用語と文書の別名に下線を引き、ポインター・フォーカス・Tab・Esc でツールチップを操作する（正常系）
test("test_normal_when_glossary", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "## 節\n\n索引を読み、索引をもう一度書く。公開関数を使う。\n";
  // 実行
  await mountTracked(el, { markdown, index: GLOSSARY_INDEX, docId: "arch" });
  // 検証
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual(["索引", "公開関数"]);
  // 索引: 「用語」の意味と「関連文書」がこの順に並ぶ
  const indexTip = find<HTMLElement>(el, ".mdmark-term-tip");
  const headings = [...indexTip.querySelectorAll(".mdmark-term-tip-heading")];
  expect(headings.map((heading) => heading.textContent)).toEqual([
    "用語",
    "関連文書",
  ]);
  expect(indexTip.textContent).toContain("文書と用語を並べた YAML のファイル");
  const indexLink = find<HTMLAnchorElement>(indexTip, "a");
  expect(indexLink.getAttribute("href")).toBe("../索引.md");
  expect(indexLink.textContent).toBe("索引のリファレンス");
  // 公開関数: フォーカスすると「関連文書」だけのツールチップが開き、Tab で中のリンクへ移る
  const term = terms[1] as HTMLElement;
  const apiTip = find<HTMLElement>(
    term.closest(".mdmark-term-wrap") as HTMLElement,
    ".mdmark-term-tip",
  );
  term.focus();
  expect(isOpen(apiTip)).toBe(true);
  expect(
    [...apiTip.querySelectorAll(".mdmark-term-tip-heading")].map(
      (heading) => heading.textContent,
    ),
  ).toEqual(["関連文書"]);
  await userEvent.keyboard("{Tab}");
  const apiLink = find<HTMLAnchorElement>(apiTip, "a");
  expect(document.activeElement).toBe(apiLink);
  expect(apiLink.getAttribute("href")).toBe("../api.md");
  expect(isOpen(apiTip)).toBe(true);
  // Esc: ツールチップが消え、フォーカスが語に戻る
  await userEvent.keyboard("{Escape}");
  expect(isOpen(apiTip)).toBe(false);
  expect(document.activeElement).toBe(term);
});

/** 参照の表: `arch` を `api`・`guide` が参照している */
const BACKLINKS_REFERENCES: MdmarkReferences = {
  backlinks: { arch: ["api", "guide"], api: ["arch"], guide: [] },
  glossary: [],
};

/** 索引: 3 つの文書 */
const BACKLINKS_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API" },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
};

// 参照の表から、文書の末尾に関連文書の一覧を置き、update の後も置き直す（正常系）
test("test_normal_when_backlinks", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "本文の段落です。\n",
    index: BACKLINKS_INDEX,
    docId: "arch",
    references: BACKLINKS_REFERENCES,
  });
  /** 末尾の一覧の題とリンクを返す */
  const readList = (): { title: string; links: Array<string | null> } => {
    const nav = el.lastElementChild as HTMLElement;
    const titleId = nav.getAttribute("aria-labelledby") ?? "";
    return {
      title: document.getElementById(titleId)?.textContent ?? "",
      links: [...nav.querySelectorAll("a")].map(
        (link) => `${link.textContent}:${link.getAttribute("href")}`,
      ),
    };
  };
  // 検証（描いた直後）
  expect(el.lastElementChild?.matches("nav.mdmark-backlinks")).toBe(true);
  expect(readList()).toEqual({
    title: "関連文書",
    links: ["API:../api.md", "使い方:../使い方/guide.md"],
  });
  // 実行
  handle.update("# 見出しだけ\n");
  // 検証（update の後）
  expect(el.querySelectorAll("nav.mdmark-backlinks")).toHaveLength(1);
  expect(readList().links).toEqual([
    "API:../api.md",
    "使い方:../使い方/guide.md",
  ]);
});
