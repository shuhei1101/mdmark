import { afterEach, expect, inject, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import type {
  DiffRevision,
  MdmarkComment,
  MdmarkIndex,
  MdmarkReferences,
  MountHandle,
} from "../../../src/index.ts";
import { VIEW_ICON_PATHS } from "../../../src/parts/view.ts";
import {
  INQUIRY_COUNT_TEXT,
  INQUIRY_HINT_TEXT,
  wrapHtml,
} from "../../unit/helpers/charts.ts";
import {
  INQUIRY_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";
import { stripSourceLine } from "../../unit/helpers/source-line.ts";
import {
  AVOID_DOC_ID,
  AVOID_EXPECTED_HTML,
  AVOID_INDEX,
  AVOID_MARKDOWN,
  DOC_ID,
  EXPECTED_HTML,
  INDEX,
  MARKDOWN,
  REFERENCES,
} from "./index-render.ts";

type Built = typeof import("../../../src/index.ts");

// 外部ライブラリの代役のモジュールの URL（手元の開発サーバーが配る）
const TEST_LIB_PATH = "/fixtures/test-lib.js";
const MISSING_LIB_PATH = "/fixtures/missing.js";
// 読み込み中の枠の文言
const LOADING_TEXT = "図を読み込んでいます";
// ダークとライトの `--mdmark-color-bg` の値
const DARK_BG = "#131316";
const LIGHT_BG = "#ffffff";

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
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "clipboard");
  history.replaceState(null, "", location.pathname);
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

/** 表の本文の行の指定した列のセル（隠れた行も含む）と、その列の見出し・集計のセルを返す */
function columnCells(el: Element, column: number): HTMLElement[] {
  const head = el.querySelectorAll<HTMLElement>("thead th")[column];
  const body = [...el.querySelectorAll<HTMLElement>("tbody tr")]
    .filter(
      (row) =>
        !row.classList.contains("mdmark-row-detail") &&
        !row.classList.contains("mdmark-table-empty"),
    )
    .map((row) => row.querySelectorAll<HTMLElement>("td")[column]);
  const total = el.querySelectorAll<HTMLElement>("tfoot td")[column];
  return [head, ...body, total].filter(
    (cell): cell is HTMLElement => cell !== undefined,
  );
}

/** 表の絞り込みのボタンを押して開き、含む文字の欄に文字を入れる */
function inputFilterText(table: Element, text: string): void {
  find<HTMLButtonElement>(table, "button.mdmark-filter").click();
  const input = find<HTMLInputElement>(table, ".mdmark-filter-drawer input");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 集計の行のセルの文字を、空白を除いて左から並べて返す */
function totalTexts(el: Element): string[] {
  return [...el.querySelectorAll("tfoot td")].map((cell) =>
    (cell.textContent ?? "").replace(/\s+/g, ""),
  );
}

/** `navigator.clipboard.writeText` を差し替える */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

// 絞り込みに合わせて件数を書き換え、列の表示のメニューで列を隠して既定に戻す（正常系）
test("test_normal_when_table_counted_and_columns_toggled", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      "<!-- table: data +count +columns hide=説明 filter=名前:text -->",
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を直す | 2026-10-10 |",
      "| りんご飴 | 描画の崩れを直す | 2026-10-20 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const count = find<HTMLElement>(el, ".mdmark-table-count");
  const hiddenOf = (column: number): boolean[] =>
    columnCells(el, column).map((cell) => cell.hasAttribute("hidden"));
  // 実行・検証: 描いた直後
  expect(count.getAttribute("aria-live")).toBe("polite");
  expect(count.textContent).toContain("3 / 3 件");
  expect(hiddenOf(1).every(Boolean)).toBe(true);
  // 実行・検証: 「りんご」で絞り込む
  inputFilterText(table, "りんご");
  expect(count.textContent).toContain("2 / 3 件");
  expect(count.textContent).toContain("3 件中 2 件を表示");
  // 実行・検証: 列の表示のメニューを開く
  const toggle = find<HTMLButtonElement>(el, "button.mdmark-columns-toggle");
  toggle.click();
  const menu = find<HTMLElement>(el, ".mdmark-columns-menu");
  const checkboxes = [
    ...menu.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ];
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(checkboxes[0]?.disabled).toBe(true);
  expect(menu.textContent).toContain("先頭の列は隠せません");
  // 実行・検証: 説明を入れて更新日を外す
  checkboxes[1]?.click();
  checkboxes[2]?.click();
  expect(hiddenOf(1).some(Boolean)).toBe(false);
  expect(hiddenOf(2).every(Boolean)).toBe(true);
  // 実行・検証: 既定に戻す
  find<HTMLButtonElement>(menu, "button.mdmark-columns-reset").click();
  expect(hiddenOf(1).every(Boolean)).toBe(true);
  expect(hiddenOf(2).some(Boolean)).toBe(false);
  // 実行・検証: Esc でメニューを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(menu.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

// 表示している行で集計した tfoot の行を置き、絞り込みで計算し直し、並べ替えでは動かさない（正常系）
test("test_normal_when_table_totals", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      "<!-- table: data +total +columns total=数量:sum,単価:avg,名前:count filter=名前:text -->",
      "",
      "| 名前 | 数量 | 単価 |",
      "| --- | --- | --- |",
      "| りんご | 10 | 100 |",
      "| みかん | 2 | 200 |",
      "| りんご飴 | 33 | 300 |",
      "| ぶどう | - | 400 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const table = find<HTMLElement>(el, ".mdmark-table");
  // 実行・検証: 描いた直後
  expect(totalTexts(el)).toEqual(["個数4", "合計45", "平均250"]);
  // 実行・検証: 「りんご」で絞り込む
  inputFilterText(table, "りんご");
  expect(totalTexts(el)).toEqual(["個数2", "合計43", "平均200"]);
  // 実行・検証: 一致する行が無い
  inputFilterText(table, "存在しない");
  expect(totalTexts(el)).toEqual(["個数0", "合計0", "平均—"]);
  inputFilterText(table, "");
  // 実行・検証: 数量の列の見出しを押して並べ替える
  find<HTMLButtonElement>(
    el.querySelectorAll("thead th")[1] as HTMLElement,
    "button.mdmark-sort",
  ).click();
  const footRow = find<HTMLElement>(el, "tfoot tr");
  expect(footRow.parentElement?.tagName).toBe("TFOOT");
  expect(find(el, "tbody").contains(footRow)).toBe(false);
  // 実行・検証: 単価を外す
  find<HTMLButtonElement>(el, "button.mdmark-columns-toggle").click();
  const checkboxes = [
    ...el.querySelectorAll<HTMLInputElement>(
      '.mdmark-columns-options input[type="checkbox"]',
    ),
  ];
  checkboxes[2]?.click();
  for (const cell of columnCells(el, 2)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
});

// 表示している行と列を TSV でクリップボードへ写し、ボタンで知らせる（正常系）
test("test_normal_when_table_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      "<!-- table: data +copy +columns hide=説明 filter=名前:text -->",
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を直す | 2026-10-10 |",
      "| りんご飴 | 描画の崩れを直す | 2026-10-20 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  inputFilterText(find<HTMLElement>(el, ".mdmark-table"), "りんご");
  const button = find<HTMLButtonElement>(el, "button.mdmark-copy");
  // 実行
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 写した中身と知らせ
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(
    "名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20",
  );
  expect(button.textContent).toContain("コピーしました");
  expect(find(el, ".mdmark-copy-status").textContent).toContain(
    "コピーしました",
  );
  // 実行・検証: 2 秒後に戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.textContent).toContain("表をコピー");
});

// クリップボードへの書き込みが拒まれたら、ボタンで知らせて次に押すまで残す（正常系）
test("test_normal_when_table_copy_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  stubClipboard(writeText);
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      "<!-- table: data +copy -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "| c | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const button = find<HTMLButtonElement>(el, "button.mdmark-copy");
  try {
    // 実行・検証: 押すと失敗を知らせ、2 秒後も変わらない
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toContain("コピーできませんでした");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(rejections).toHaveLength(0);
    // 実行・検証: もう一度押すと、書き込みをもう一度試す
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledTimes(2);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// URL の #ID が指す行を囲む閉じた表・節を開き、絞り込みを外して行へ移り、その行を強調する（正常系）
test("test_normal_when_table_row_linked", async () => {
  // 準備
  const el = createElement();
  history.replaceState(null, "", "#みかん");
  await mountTracked(el, {
    markdown: [
      "<!-- table: data +rowlink closed -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
      "## 節",
      "",
      "<!-- section: closed -->",
      "",
      "<!-- table: data +rowlink filter=名前:text -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| ぶどう | 1 |",
      "| もも | 2 |",
      "| なし | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const [first, second] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-table"),
  ] as [HTMLElement, HTMLElement];
  const targets = (): string[] =>
    [...el.querySelectorAll<HTMLElement>("tr[data-target]")].map(
      (row) => row.id,
    );
  // 実行・検証: 描いた後、閉じた表を開いてみかんの行を強調する
  expect(find(first, "details").hasAttribute("open")).toBe(true);
  expect(targets()).toEqual(["みかん"]);
  // 実行・検証: 表 B を絞り込んで #もも にする
  inputFilterText(second, "ぶどう");
  location.hash = "#もも";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["もも"]);
  });
  expect(find(el, '[id="section-節"]').hasAttribute("hidden")).toBe(false);
  for (const row of second.querySelectorAll<HTMLElement>(
    "tbody tr:not(.mdmark-table-empty)",
  )) {
    expect(row.hasAttribute("hidden")).toBe(false);
  }
  // 絞り込みのボタンが絞り込み中のままでない（見た目と読み上げの文字）
  const filterButton = find<HTMLElement>(second, "button.mdmark-filter");
  expect(filterButton.classList.contains("is-active")).toBe(false);
  expect(filterButton.textContent).not.toContain("（絞り込み中）");
  // 実行・検証: まとめた HTML の # の形
  location.hash = "#/a.md#みかん";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["みかん"]);
  });
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

// 索引の用語のやめた言い方に波線のマーカーを付け、フォーカスで代わりの用語のツールチップを出し、Esc で閉じる（正常系）
test("test_normal_when_avoided_term", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "## 節\n\nワークスペースと作業場と作業場を書く。行内のコードは `作業場` と書く。\n";
  // 実行
  await mountTracked(el, {
    markdown,
    index: AVOID_INDEX,
    docId: AVOID_DOC_ID,
  });
  // 検証
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual([
    "ワークスペース",
    "作業場",
  ]);
  // 用語は破線の下線のまま、最初の `作業場` だけがマーカーになる
  const [workspace, avoided] = terms as [HTMLElement, HTMLElement];
  expect(workspace.classList.contains("mdmark-term-avoided")).toBe(false);
  expect(getComputedStyle(workspace).textDecorationStyle).toBe("dashed");
  expect(avoided.classList.contains("mdmark-term-avoided")).toBe(true);
  expect(getComputedStyle(avoided).textDecorationStyle).toBe("wavy");
  expect(el.querySelectorAll(".mdmark-term-avoided")).toHaveLength(1);
  expect(find<HTMLElement>(el, "code").closest(".mdmark-term")).toBeNull();
  // フォーカスすると、語の `aria-describedby` が指す role="tooltip" のツールチップが開く
  const tip = document.getElementById(
    avoided.getAttribute("aria-describedby") ?? "",
  ) as HTMLElement;
  expect(isOpen(tip)).toBe(false);
  avoided.focus();
  expect(isOpen(tip)).toBe(true);
  expect(tip.getAttribute("role")).toBe("tooltip");
  expect(
    [...tip.querySelectorAll(".mdmark-term-tip-heading")].map(
      (heading) => heading.textContent,
    ),
  ).toEqual(["代わりの用語"]);
  expect(
    find<HTMLElement>(tip, ".mdmark-term-tip-replacement").textContent,
  ).toBe("ワークスペース");
  expect(find<HTMLElement>(tip, ".mdmark-term-tip-meaning").textContent).toBe(
    "話し合いの記録を置くフォルダ",
  );
  // Esc: ツールチップが消え、フォーカスが語に残る
  await userEvent.keyboard("{Escape}");
  expect(isOpen(tip)).toBe(false);
  expect(document.activeElement).toBe(avoided);
});

// ブラウザで配布物の render を呼んでも、やめた言い方つきの出力が固定値と等しい（正常系）
test("test_normal_when_avoided_term_in_browser", async () => {
  // 準備
  const { render } = await loadBuilt();
  // 実行
  const html = render(AVOID_MARKDOWN, {
    index: AVOID_INDEX,
    docId: AVOID_DOC_ID,
  });
  // 検証
  expect(stripSourceLine(html)).toBe(AVOID_EXPECTED_HTML);
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

// ブラウザで配布物の render を呼んでも、索引つきの出力が固定値と等しい（正常系）
test("test_normal_when_index_in_browser", async () => {
  // 準備
  const { render } = await loadBuilt();
  // 実行
  const html = render(MARKDOWN, {
    index: INDEX,
    docId: DOC_ID,
    references: REFERENCES,
  });
  // 検証
  expect(stripSourceLine(html)).toBe(EXPECTED_HTML);
});

/** 幅 600px の描く先の要素に、幅 1100・高さ 560 のフロー図を描き、図と表示する枠を返す */
async function mountFlow(
  options: { index?: MdmarkIndex; extra?: string } = {},
): Promise<{
  el: HTMLElement;
  figure: HTMLElement;
  viewport: HTMLElement;
}> {
  const el = createElement();
  el.style.width = "600px";
  el.style.setProperty("--mdmark-padding", "0");
  await mountTracked(el, {
    markdown: `${wrapDirective("flow", INQUIRY_TEXT)}\n${options.extra ?? ""}`,
    ...(options.index ? { index: options.index } : {}),
  });
  const figure = find<HTMLElement>(el, "figure.mdmark-diagram");
  const viewport = find<HTMLElement>(
    figure,
    '[role="group"][aria-roledescription="図"]',
  );
  return { el, figure, viewport };
}

/** 読み上げの名前でボタンを探す */
function buttonOf(root: ParentNode, name: string): HTMLButtonElement {
  return find<HTMLButtonElement>(
    root as Element,
    `button[aria-label="${name}"]`,
  );
}

/** 図の倍率（図の本体に掛けた `scale()`） */
function scaleOf(figure: Element): number {
  const stage = find<HTMLElement>(figure, ".mdmark-diagram-stage");
  return new DOMMatrixReadOnly(getComputedStyle(stage).transform).a;
}

/** 倍率のボタン（読み上げの名前が `倍率 {今の倍率}。全体が収まる倍率に戻す`） */
function zoomButton(figure: Element): HTMLButtonElement {
  return find<HTMLButtonElement>(figure, 'button[aria-label^="倍率"]');
}

/** 倍率の表示の文字 */
function zoomText(figure: Element): string {
  return zoomButton(figure).textContent ?? "";
}

// 図を収まる倍率で描き、右上のボタンとキーで拡大・縮小・戻す。ホイールは受け取らない（正常系）
test("test_normal_when_diagram_zoomed", async () => {
  // 準備
  const { figure, viewport } = await mountFlow();
  const sizer = find<HTMLElement>(figure, ".mdmark-diagram-sizer");
  // 描いた直後の倍率は収まる倍率で、図の幅が表示する枠の幅を超えない
  await vi.waitFor(() => {
    expect(scaleOf(figure)).toBeLessThan(1);
  });
  const fit = scaleOf(figure);
  expect(Number.parseInt(zoomText(figure), 10)).toBeLessThan(100);
  expect(sizer.getBoundingClientRect().width).toBeLessThanOrEqual(
    viewport.clientWidth + 1,
  );
  // 右上のボタンは縮小・倍率・拡大・全画面の 4 つで、戻すのボタンは無い。縮小だけが押せない
  const tools = [
    ...figure.querySelectorAll<HTMLButtonElement>(
      '[data-group="zoom"] button, [data-group="screen"] button',
    ),
  ];
  expect(
    tools.map((tool) => tool.getAttribute("aria-label")?.split("。")[0]),
  ).toEqual(["縮小", `倍率 ${zoomText(figure)}`, "拡大", "全画面で開く"]);
  expect(tools.filter((tool) => tool.disabled)).toEqual([
    buttonOf(figure, "縮小"),
  ]);
  expect(figure.querySelector('[data-tool="fit"]')).toBe(zoomButton(figure));
  expect(zoomButton(figure).getAttribute("aria-label")).toBe(
    `倍率 ${zoomText(figure)}。全体が収まる倍率に戻す`,
  );
  // 今の名前の一部で、getByRole の部分一致で見つかる
  expect(
    page.getByRole("button", { name: /全体が収まる倍率に戻す/ }).element(),
  ).toBe(zoomButton(figure));
  for (const tool of figure.querySelectorAll("button.mdmark-diagram-tool")) {
    expect(tool.getAttribute("aria-label")).toBeTruthy();
  }
  // 実行・検証: 拡大のボタンで 1.25 倍
  buttonOf(figure, "拡大").click();
  expect(scaleOf(figure) / fit).toBeCloseTo(1.25, 2);
  expect(zoomButton(figure).getAttribute("aria-label")).toBe(
    `倍率 ${zoomText(figure)}。全体が収まる倍率に戻す`,
  );
  const afterButton = zoomText(figure);
  // 表示する枠にフォーカスして + で、さらに 1.25 倍
  viewport.focus();
  await userEvent.keyboard("+");
  expect(scaleOf(figure) / fit).toBeCloseTo(1.25 * 1.25, 2);
  expect(zoomText(figure)).not.toBe(afterButton);
  expect(zoomButton(figure).getAttribute("aria-label")).toContain(
    zoomText(figure),
  );
  // ホイールは倍率を変えず、既定の動きも止めない
  const before = scaleOf(figure);
  const wheel = new WheelEvent("wheel", {
    deltaY: -100,
    bubbles: true,
    cancelable: true,
  });
  viewport.dispatchEvent(wheel);
  expect(scaleOf(figure)).toBe(before);
  expect(wheel.defaultPrevented).toBe(false);
  // 0 で、描いた直後の倍率と位置に戻る
  await userEvent.keyboard("0");
  expect(scaleOf(figure)).toBeCloseTo(fit, 4);
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
  // 拡大して動かしてから倍率のボタンを押すと、描いた直後の倍率と位置に戻る
  buttonOf(figure, "拡大").click();
  buttonOf(figure, "拡大").click();
  viewport.scrollLeft = 120;
  zoomButton(figure).click();
  expect(scaleOf(figure)).toBeCloseTo(fit, 4);
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
});

// 拡大した図を、余白のドラッグ・矢印キー・移動のボタンで動かし、文字の上では動かさず文字を選ばせる（正常系）
test("test_normal_when_diagram_panned", async () => {
  // 準備
  const { figure, viewport } = await mountFlow();
  buttonOf(figure, "拡大").click();
  buttonOf(figure, "拡大").click();
  const panGroup = find<HTMLElement>(figure, '[data-group="pan"]');
  expect(panGroup.hidden).toBe(false);
  // 余白を 100px 左へドラッグすると、図が 100px 動き、文字は選ばれない
  const start = viewport.scrollLeft;
  await userEvent.dragAndDrop(viewport, viewport, {
    sourcePosition: { x: 300, y: 4 },
    targetPosition: { x: 200, y: 4 },
  });
  expect(viewport.scrollLeft - start).toBe(100);
  expect(getSelection()?.toString()).toBe("");
  expect(getComputedStyle(viewport).cursor).toBe("grab");
  const name = find<HTMLElement>(
    figure,
    '[data-node="mcp"] .mdmark-diagram-node-name',
  );
  expect(getComputedStyle(name).cursor).toBe("text");
  // 箱の名前の上のドラッグは、図を動かさず、名前の文字を選ばせる
  const moved = viewport.scrollLeft;
  await userEvent.dragAndDrop(name, name, {
    sourcePosition: { x: 1, y: 5 },
    targetPosition: { x: 60, y: 5 },
  });
  expect(viewport.scrollLeft).toBe(moved);
  expect(getSelection()?.toString()).toContain("窓口");
  // 矢印キーで 80px、下の移動のボタンで縦に 80px
  getSelection()?.removeAllRanges();
  viewport.focus();
  viewport.scrollLeft = 0;
  await userEvent.keyboard("{ArrowRight}");
  expect(viewport.scrollLeft).toBe(80);
  const top = viewport.scrollTop;
  buttonOf(figure, "下へ動かす").click();
  expect(viewport.scrollTop - top).toBe(80);
  // 収まる倍率に戻すと、移動のボタンが出ない
  zoomButton(figure).click();
  expect(panGroup.hidden).toBe(true);
});

/** 図の `tip` を持つ線のラベルを全て返す */
function tipLabels(root: ParentNode): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(".mdmark-diagram-label.has-tip"),
  ];
}

/** 持ち主が指すツールチップ */
function tipOf(owner: Element): HTMLElement {
  const id = owner.getAttribute("aria-describedby") ?? "";
  const tip = document.getElementById(id);
  if (!tip) {
    throw new Error(`ツールチップが無い: ${id}`);
  }
  return tip;
}

// 全画面のボタンで図をモーダルに開き、Esc でツールチップ→モーダルの順に閉じる（正常系）
test("test_normal_when_diagram_fullscreen", async () => {
  // 準備
  const { el, figure } = await mountFlow();
  // ポインターを図から離しておく（前のテストの位置が図の上だと、図のツールチップが開き、閉じるのを待つ）
  await userEvent.unhover(document.body);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const added: string[] = [];
  const removed: string[] = [];
  const addListener = document.addEventListener.bind(document);
  const removeListener = document.removeEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation(
    (
      type: string,
      ...rest: [EventListenerOrEventListenerObject, ...unknown[]]
    ) => {
      added.push(type);
      return addListener(
        type,
        ...(rest as [EventListenerOrEventListenerObject]),
      );
    },
  );
  vi.spyOn(document, "removeEventListener").mockImplementation(
    (
      type: string,
      ...rest: [EventListenerOrEventListenerObject, ...unknown[]]
    ) => {
      removed.push(type);
      return removeListener(
        type,
        ...(rest as [EventListenerOrEventListenerObject]),
      );
    },
  );
  const opener = buttonOf(figure, "全画面で開く");
  // 実行
  opener.click();
  // 検証: 題・図・凡例と閉じるボタンを持つモーダル
  const dialog = find<HTMLDialogElement>(el, "dialog[open]");
  expect(dialog.querySelector(".mdmark-diagram-head")).not.toBeNull();
  expect(dialog.querySelector(".mdmark-diagram-stage")).not.toBeNull();
  expect(dialog.querySelector('ul[aria-label="凡例"]')).not.toBeNull();
  expect(buttonOf(dialog, "全画面を閉じる")).not.toBeNull();
  const modalViewport = find<HTMLElement>(
    dialog,
    '[aria-roledescription="図"]',
  );
  const box = dialog.getBoundingClientRect();
  const inner = modalViewport.getBoundingClientRect();
  expect(inner.left).toBeGreaterThanOrEqual(box.left);
  expect(inner.right).toBeLessThanOrEqual(box.right);
  expect(inner.bottom).toBeLessThanOrEqual(box.bottom);
  // tip を持つ線にフォーカスして Esc: ツールチップだけが閉じる
  const label = tipLabels(dialog)[0];
  if (!label) {
    throw new Error("tip を持つ線のラベルが無い");
  }
  label.focus();
  const tip = tipOf(label);
  expect(tip.hidden).toBe(false);
  await userEvent.keyboard("{Escape}");
  expect(tip.hidden).toBe(true);
  expect(dialog.open).toBe(true);
  // もう一度 Esc: モーダルが閉じ、フォーカスが全画面のボタンへ戻る
  await userEvent.keyboard("{Escape}");
  expect(el.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
  // モーダルのために付けた document の keydown の受け取りが外れている
  expect(removed.filter((type) => type === "keydown")).toHaveLength(
    added.filter((type) => type === "keydown").length,
  );
});

/** 索引: 用語 `意思決定モデル` を持つ */
const TERM_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [],
  terms: [
    {
      id: "dm",
      term: "意思決定モデル",
      meaning: "選択肢から選ぶだけの、速く安い判断用の AI",
    },
  ],
};

// 線・箱・箱の中の用語に、ポインターとフォーカスでツールチップを出し、Esc で消す（正常系）
test("test_normal_when_diagram_tooltip", async () => {
  // 準備
  const { el, figure } = await mountFlow({
    index: TERM_INDEX,
    extra: "\n図の外の意思決定モデル。\n",
  });
  // 線のラベルにポインターを乗せ、ツールチップの上へ動かしても出したままにする
  const label = tipLabels(figure)[0];
  if (!label) {
    throw new Error("tip を持つ線のラベルが無い");
  }
  await userEvent.hover(label);
  const wireTip = tipOf(label);
  expect(wireTip.hidden).toBe(false);
  expect(wireTip.textContent).toContain("件名・本文・送り主のアドレス");
  await userEvent.hover(wireTip);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(wireTip.hidden).toBe(false);
  // LLM の箱の印にフォーカスすると、入力・処理・出力を出す。io を持たない箱に印は無い
  const info = buttonOf(figure, "「分類」の入力・処理・出力");
  info.focus();
  const ioTip = tipOf(info);
  expect(ioTip.hidden).toBe(false);
  expect(ioTip.querySelectorAll("dt")).toHaveLength(3);
  expect([...ioTip.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(
    ["入力", "処理", "出力"],
  );
  expect(
    figure.querySelector('[data-node="mcp"] .mdmark-diagram-info'),
  ).toBeNull();
  // Esc でツールチップを消し、フォーカスを印に残す
  await userEvent.keyboard("{Escape}");
  expect(ioTip.hidden).toBe(true);
  expect(document.activeElement).toBe(info);
  // 箱の中の用語は、本文の用語と同じ破線の下線で、ポインターで意味を出す
  const term = find<HTMLElement>(figure, ".mdmark-diagram-node .mdmark-term");
  await userEvent.hover(term);
  expect(tipOf(term).hidden).toBe(false);
  expect(tipOf(term).textContent).toContain("選択肢から選ぶだけの");
  const outside = find<HTMLElement>(el, ":scope > p .mdmark-term");
  expect(getComputedStyle(term).textDecorationStyle).toBe("dashed");
  expect(getComputedStyle(outside).textDecorationStyle).toBe("dashed");
});

/** 操作できる部品を描いた要素と、その要素の部品の要素 */
async function mountParam(): Promise<{ el: HTMLElement; param: HTMLElement }> {
  const el = createElement();
  await mountTracked(el, { markdown: wrapDirective("param", STRENGTH_TEXT) });
  return { el, param: find<HTMLElement>(el, ".mdmark-param") };
}

/** スライダーのボタンを押して、今の値を写すボタンを返す */
function copyButtonOf(param: ParentNode): HTMLButtonElement {
  const found = [...param.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("写す"),
  );
  if (!found) {
    throw new Error("今の値を写すボタンが無い");
  }
  return found;
}

// スライダーの値でグラフを描き直し、今の値を JSON でクリップボードへ写す（正常系）
test("test_normal_when_param", async () => {
  // 準備
  const { param } = await mountParam();
  const written: string[] = [];
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
    async (text) => {
      written.push(text);
    },
  );
  const slider = find<HTMLInputElement>(param, 'input[type="range"]');
  // 実行: スライダーを 7 にして、→ を押す
  slider.focus();
  slider.value = "7";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await userEvent.keyboard("{ArrowRight}");
  // 検証: 今の値とグラフが 8 で描き直され、題と凡例は 1 つずつのまま
  expect(find(param, ".mdmark-param-knob output").textContent).toBe("8");
  expect(find(param, "svg[role=img]").getAttribute("aria-label")).toContain(
    "今の値（8）: 0・55・80・91・96・98",
  );
  expect(param.querySelectorAll(".mdmark-diagram-head")).toHaveLength(1);
  expect(param.querySelectorAll(".mdmark-diagram-legend")).toHaveLength(1);
  // 今の値を写すと、JSON を書き、写したことを出す
  copyButtonOf(param).click();
  await vi.waitFor(() => {
    expect(find(param, '[role="status"]').textContent).toContain(
      "クリップボードに写しました",
    );
  });
  expect(JSON.parse(written[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
});

// 書き込みを拒まれたら、書けなかったことと選んで写せる JSON を出す（異常系）
test("test_error_when_clipboard_denied", async () => {
  // 準備
  const { param } = await mountParam();
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
    new DOMException("denied", "NotAllowedError"),
  );
  const slider = find<HTMLInputElement>(param, 'input[type="range"]');
  slider.value = "8";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  // 実行
  copyButtonOf(param).click();
  // 検証
  await vi.waitFor(() => {
    expect(find(param, '[role="status"]').textContent).toContain(
      "クリップボードへ書けませんでした",
    );
  });
  const fallback = find<HTMLElement>(param, "pre");
  expect(fallback.hidden).toBe(false);
  expect(fallback.getAttribute("tabindex")).toBe("0");
  expect(JSON.parse(fallback.textContent ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
  // その後もスライダーを動かすとグラフが描き直される
  slider.value = "3";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  expect(find(param, "svg[role=img]").getAttribute("aria-label")).toContain(
    "今の値（3）",
  );
});

/** 描く先の要素の幅を 600px にして、埋め込んだ HTML の文書を描く */
async function mountEmbedded(markdown: string): Promise<HTMLElement> {
  const el = createElement();
  el.style.width = "600px";
  el.style.setProperty("--mdmark-padding", "0");
  await mountTracked(el, { markdown });
  return el;
}

// 埋め込んだ HTML の中のチャートだけに拡大・縮小・移動を付け、列より広い HTML を中で横にスクロールさせる（正常系）
test("test_normal_when_embedded_chart", async () => {
  // 準備
  const markdown = [
    wrapHtml(
      `<p>チャートの前の段落</p>\n<mdmark-chart>\n${INQUIRY_COUNT_TEXT}\n</mdmark-chart>`,
    ),
    wrapHtml('<div style="width: 900px">列より広い HTML</div>'),
  ].join("\n");
  // 実行
  const el = await mountEmbedded(markdown);
  // 検証
  const [chartHtml, wideHtml] =
    el.querySelectorAll<HTMLElement>("div.mdmark-html");
  if (!chartHtml || !wideHtml) {
    throw new Error("埋め込んだ HTML が描かれていない");
  }
  const figure = find<HTMLElement>(chartHtml, "figure.mdmark-diagram");
  expect(figure.getAttribute("data-diagram")).toBe("chart");
  await vi.waitFor(() => {
    expect(scaleOf(figure)).toBeLessThanOrEqual(1);
  });
  expect(
    [
      ...figure.querySelectorAll<HTMLButtonElement>(
        '[data-group="zoom"] button, [data-group="screen"] button',
      ),
    ].map((tool) => tool.getAttribute("aria-label")?.split("。")[0]),
  ).toEqual([
    "縮小",
    expect.stringMatching(/^倍率 \d+%$/),
    "拡大",
    "全画面で開く",
  ]);
  const before = scaleOf(figure);
  buttonOf(figure, "拡大").click();
  expect(scaleOf(figure) / before).toBeCloseTo(1.25, 2);
  // 同じ HTML の中の段落には、拡大・縮小のボタンが無い
  expect(chartHtml.querySelectorAll("button")).toHaveLength(
    figure.querySelectorAll("button").length,
  );
  expect(find(chartHtml, "p").querySelector("button")).toBeNull();
  // 幅 900px の HTML だけが、中で横にスクロールする
  await vi.waitFor(() => {
    expect(wideHtml.classList.contains("is-wide")).toBe(true);
  });
  expect(wideHtml.getAttribute("tabindex")).toBe("0");
  expect(chartHtml.classList.contains("is-wide")).toBe(false);
  expect(chartHtml.hasAttribute("tabindex")).toBe(false);
});

// data-hint のブロックは右上の印、行内は要素そのものでツールチップを開き、印の外では開かない（正常系）
test("test_normal_when_embedded_hint", async () => {
  // 準備
  const body = [
    '<div data-hint="返信の種類を 1 つ選ぶ" style="display: inline-block; padding: 1rem 2rem">自動返信</div>',
    '<p>問い合わせは <span data-hint="本文を読んで種類を決める処理">分類</span> する。</p>',
  ].join("\n");
  const markdown = `${wrapHtml(body)}\n${wrapDirective("flow", INQUIRY_HINT_TEXT)}`;
  // ポインターを前のテストの位置から離しておく
  await userEvent.unhover(document.body);
  const el = await mountEmbedded(markdown);
  const block = find<HTMLElement>(el, ".mdmark-hint-block");
  const mark = find<HTMLElement>(block, ".mdmark-hint-mark");
  const inline = find<HTMLElement>(el, ".mdmark-hint-inline");
  const tips = (): HTMLElement[] => [
    ...el.querySelectorAll<HTMLElement>('[role="tooltip"]'),
  ];
  // 実行・検証: 文字の上では開かず、ポインターの形は help でない
  await userEvent.hover(block);
  expect(tips().every((tip) => tip.hidden)).toBe(true);
  expect(getComputedStyle(block).cursor).not.toBe("help");
  // 印の上で、data-hint の文を出す
  await userEvent.hover(mark);
  expect(tipOf(mark).hidden).toBe(false);
  expect(tipOf(mark).textContent).toBe("返信の種類を 1 つ選ぶ");
  // 行内の要素: フォーカスで開き、Esc で消えてフォーカスが残る
  inline.focus();
  expect(tipOf(inline).hidden).toBe(false);
  expect(tipOf(inline).textContent).toBe("本文を読んで種類を決める処理");
  await userEvent.keyboard("{Escape}");
  expect(tipOf(inline).hidden).toBe(true);
  expect(document.activeElement).toBe(inline);
  expect(getComputedStyle(inline).cursor).not.toBe("help");
  // 図の箱の hint: 名前の上では開かず、右上の印の上で hint の文を出す
  const name = find<HTMLElement>(
    el,
    '[data-node="mcp"] .mdmark-diagram-node-name',
  );
  const info = find<HTMLElement>(
    el,
    'button[aria-label="「窓口の MCP」の説明"]',
  );
  await userEvent.hover(name);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(tipOf(info).hidden).toBe(true);
  await userEvent.hover(info);
  expect(tipOf(info).hidden).toBe(false);
  expect(tipOf(info).textContent).toContain("保存と送信のツールだけを持つ");
  // ページの中のツールチップの id が重ならない
  const ids = [...el.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

// ─── 差分 ───

/** `content` が受けた引数 */
type ContentCall = { docId: string; revisionId: string };

/** 呼ばれた引数を記録する取り出し元 */
type RecordingSource = {
  revisionsCalls: string[];
  contentCalls: ContentCall[];
  revisions: (docId: string) => Promise<DiffRevision[]>;
  content: (target: ContentCall) => Promise<string>;
};

// 新しい順の 3 つのリビジョン
const DIFF_REVISIONS = [
  { id: "r3", at: "2026-10-20T02:05:00Z", label: "足す", author: "田中" },
  { id: "r2", at: "2026-10-19T07:40:00Z", label: "件数を直す", author: "鈴木" },
  { id: "r1", at: "2026-10-18T00:12:00Z", label: "初版", author: "佐藤" },
];

// リビジョンごとの本文: r2 から r3 で語 `差分` を `変更` に書き換え、行を 1 つ足し、別の行を 1 つ消す
const DIFF_CONTENTS: Record<string, string> = {
  r1: "# ガイド\n\n初版の行\n終わり\n",
  r2: "# ガイド\n\n差分を色分けして読む。\n消す行\n終わり\n",
  r3: "# ガイド\n\n変更を色分けして読む。\n終わり\n足す行\n",
};

/** 呼ばれた引数を記録し、本文をすぐに返す取り出し元を作る */
function createDiffSource(
  override: Partial<RecordingSource> = {},
  revisions: unknown = DIFF_REVISIONS,
  contents: Record<string, string> = DIFF_CONTENTS,
): RecordingSource {
  const source: RecordingSource = {
    revisionsCalls: [],
    contentCalls: [],
    revisions: async (docId) => {
      source.revisionsCalls.push(docId);
      return revisions as DiffRevision[];
    },
    content: async (target) => {
      source.contentCalls.push(target);
      return contents[target.revisionId] ?? "";
    },
  };
  return Object.assign(source, override);
}

/** 取り出し元を渡して文書を描く。文書は `h1` で始まり、本文の段落を 1 つ持つ */
async function mountDiff(
  source: RecordingSource,
  markdown = "# ガイド\n\n本文の段落。\n",
): Promise<HTMLElement> {
  const el = createElement();
  await mountTracked(el, { markdown, docId: "guide", diffSource: source });
  return el;
}

/** 「変更を見る」のボタン */
function diffToggle(el: HTMLElement): HTMLButtonElement {
  return find<HTMLButtonElement>(el, ".mdmark-diff-toggle");
}

/** `ラベルの文字` を持つ label が指す select */
function diffSelect(el: HTMLElement, labelText: string): HTMLSelectElement {
  const label = [...el.querySelectorAll("label")].find(
    (candidate) => candidate.textContent?.trim() === labelText,
  );
  return find<HTMLSelectElement>(el, `#${CSS.escape(label?.htmlFor ?? "")}`);
}

/** 差分の行が描かれるのを待つ */
async function waitForDiffLines(el: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-diff-line")).not.toBeNull();
  });
}

/** `document.body` の直下のミニマップの帯 */
function minimapBands(): HTMLElement[] {
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      ":scope > .mdmark-diff-minimap",
    ),
  ];
}

/** 選ぶ欄の選択肢 1 つが選べないか */
function isDisabled(select: HTMLSelectElement, value: string): boolean {
  return [...select.options].find((option) => option.value === value)
    ?.disabled as boolean;
}

// 取り出し元を渡して描き、「変更を見る」で一番新しい 2 つのリビジョンの差分を出す（正常系）
test("test_normal_when_diff_opened", async () => {
  // 準備
  const source = createDiffSource();
  const el = await mountDiff(source);
  // 検証: mount の直後は取り出し元を呼ばず、h1 の後ろにボタンがある
  const toggle = diffToggle(el);
  expect(source.revisionsCalls).toEqual([]);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(find(el, "h1").nextElementSibling?.contains(toggle)).toBe(true);
  // 実行
  toggle.click();
  await waitForDiffLines(el);
  // 検証: 本文が隠れ、見出しは残る
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(find<HTMLElement>(el, ":scope > p").hidden).toBe(true);
  expect(find<HTMLElement>(el, "h1").hidden).toBe(false);
  // 取り出し元の呼び出し
  expect(source.revisionsCalls).toEqual(["guide"]);
  expect(source.contentCalls).toHaveLength(2);
  expect(source.contentCalls).toContainEqual({
    docId: "guide",
    revisionId: "r2",
  });
  expect(source.contentCalls).toContainEqual({
    docId: "guide",
    revisionId: "r3",
  });
  // 選ぶ欄
  const before = diffSelect(el, "前のリビジョン");
  const after = diffSelect(el, "後のリビジョン");
  expect(before.value).toBe("r2");
  expect(after.value).toBe("r3");
  expect(isDisabled(before, "r3")).toBe(true);
  expect(isDisabled(after, "r2")).toBe(true);
  expect(isDisabled(after, "r1")).toBe(true);
  // 差分の行
  const del = find(el, '.mdmark-diff-line[data-kind="del"]');
  const add = find(el, '.mdmark-diff-line[data-kind="add"]');
  expect(find(del, ".mdmark-diff-sign").textContent).toBe("-");
  expect(find(add, ".mdmark-diff-sign").textContent).toBe("+");
  expect(
    [...el.querySelectorAll("del.mdmark-diff-word")].map((e) => e.textContent),
  ).toEqual(["差分"]);
  expect(
    [...el.querySelectorAll("ins.mdmark-diff-word")].map((e) => e.textContent),
  ).toEqual(["変更"]);
  expect(find(el, '[role="status"]').textContent).toBe(
    "削除した行 2・追加した行 2",
  );
  // ミニマップ
  await vi.waitFor(() => {
    expect(minimapBands()).toHaveLength(1);
    expect(
      minimapBands()[0]?.querySelector(
        '.mdmark-diff-minimap-mark[data-kind="del"]',
      ),
    ).not.toBeNull();
    expect(
      minimapBands()[0]?.querySelector(
        '.mdmark-diff-minimap-mark[data-kind="add"]',
      ),
    ).not.toBeNull();
  });
  expect(minimapBands()[0]?.getAttribute("aria-hidden")).toBe("true");
});

// 前のリビジョンを選び直すと、その 2 つの差分に描き直す（正常系）
test("test_normal_when_revision_reselected", async () => {
  // 準備
  const source = createDiffSource();
  const el = await mountDiff(source);
  diffToggle(el).click();
  await waitForDiffLines(el);
  source.contentCalls.length = 0;
  // 実行
  const before = diffSelect(el, "前のリビジョン");
  await userEvent.selectOptions(before, "r1");
  // 検証
  await vi.waitFor(() => {
    expect(el.textContent).toContain("初版の行");
  });
  expect(source.contentCalls.map((call) => call.revisionId).sort()).toEqual([
    "r1",
    "r3",
  ]);
  const after = diffSelect(el, "後のリビジョン");
  expect(after.value).toBe("r3");
  expect(isDisabled(after, "r1")).toBe(true);
  expect(el.textContent).not.toContain("消す行");
});

// リビジョンが 1 つなら本文を取り出さず、比較対象が無いことを出す（正常系）
test("test_normal_when_single_revision", async () => {
  // 準備
  const source = createDiffSource({}, [DIFF_REVISIONS[2]]);
  const el = await mountDiff(source);
  // 実行
  diffToggle(el).click();
  // 検証
  await vi.waitFor(() => {
    expect(el.textContent).toContain(
      "この文書のリビジョンは 1 つだけのため、比較対象のリビジョンがありません。",
    );
  });
  expect(source.contentCalls).toEqual([]);
  expect(el.querySelector("select")).toBeNull();
  expect(minimapBands()).toHaveLength(0);
});

// 選んだ 2 つの本文が同じなら、行を出さずに変更が無いことを出す（正常系）
test("test_normal_when_no_change", async () => {
  // 準備
  const same = "# ガイド\n\n同じ本文\n";
  const source = createDiffSource({}, DIFF_REVISIONS.slice(1), {
    r1: same,
    r2: same,
  });
  const el = await mountDiff(source);
  // 実行
  diffToggle(el).click();
  // 検証
  await vi.waitFor(() => {
    expect(el.textContent).toContain(
      "選んだ 2 つのリビジョンの本文に、変更はありません。",
    );
  });
  expect(el.querySelector(".mdmark-diff-line")).toBeNull();
  expect(minimapBands()).toHaveLength(0);
  expect(el.querySelector("select")).not.toBeNull();
});

// `Intl.Segmenter` を持たないブラウザでは、対の行を文字ごとに比べる（正常系）
test("test_normal_when_segmenter_missing", async () => {
  // 準備
  const segmenter = Intl.Segmenter;
  const source = createDiffSource();
  const el = await mountDiff(source);
  Reflect.deleteProperty(Intl, "Segmenter");
  try {
    // 実行
    expect(() => diffToggle(el).click()).not.toThrow();
    await waitForDiffLines(el);
    // 検証: 変わった文字だけが del・ins で囲まれる
    expect(
      [...el.querySelectorAll("del.mdmark-diff-word")]
        .map((e) => e.textContent)
        .join(""),
    ).toBe("差分");
    expect(
      [...el.querySelectorAll("ins.mdmark-diff-word")]
        .map((e) => e.textContent)
        .join(""),
    ).toBe("変更");
  } finally {
    Object.defineProperty(Intl, "Segmenter", {
      value: segmenter,
      configurable: true,
      writable: true,
    });
  }
});

/** 埋め込んだ HTML の範囲を、`html` のコードブロックで包む */
function diffRange(body: string): string {
  return ["<!-- html -->", "```html", body, "```", "<!-- /html -->"].join("\n");
}

/** 表の 1 つのセルが数を持つ埋め込んだ HTML */
function diffTable(count: number): string {
  return `<table><tr><td>${count}</td></tr></table>`;
}

// 変えた埋め込んだ HTML の範囲を、ソースの色分けから前と後のプレビューへ切り替えて戻す（正常系）
test("test_normal_when_html_previewed", async () => {
  // 準備
  const before = [
    "# 表",
    diffRange(diffTable(120)),
    "中間",
    diffRange("<p>同じ</p>"),
    "末尾",
    "",
  ].join("\n");
  const after = [
    "# 表",
    diffRange(diffTable(150)),
    "中間",
    diffRange("<p>同じ</p>"),
    "末尾",
    diffRange("<p>新しい</p>"),
    "",
  ].join("\n");
  const source = createDiffSource({}, DIFF_REVISIONS.slice(1), {
    r1: before,
    r2: after,
  });
  const el = await mountDiff(source, "# 表\n\n本文\n");
  // 実行: 差分を開く
  diffToggle(el).click();
  await waitForDiffLines(el);
  // 検証: 各範囲に HTML のラベルがあり、見方のボタンは変えた範囲だけが持つ
  const ranges = [...el.querySelectorAll<HTMLElement>(".mdmark-diff-html")];
  expect(ranges).toHaveLength(3);
  expect(
    ranges.map(
      (range) => range.querySelector(".mdmark-diff-html-label")?.textContent,
    ),
  ).toEqual(["HTML", "HTML", "HTML"]);
  const switchers = ranges.map((range) =>
    range.querySelector('[role="group"][aria-label="HTML の見方"]'),
  );
  expect(switchers.map((found) => found !== null)).toEqual([true, false, true]);
  const first = ranges[0] as HTMLElement;
  const third = ranges[2] as HTMLElement;
  const sourceButton = find<HTMLButtonElement>(first, '[data-view="source"]');
  const previewButton = find<HTMLButtonElement>(
    first,
    '[data-view="rendered"]',
  );
  expect(sourceButton.getAttribute("aria-pressed")).toBe("true");
  expect(find<HTMLElement>(first, '[data-pane="rendered"]').hidden).toBe(true);
  expect(first.querySelectorAll(".mdmark-diff-line").length).toBeGreaterThan(0);
  // 実行: プレビューを押す
  previewButton.click();
  find<HTMLButtonElement>(third, '[data-view="rendered"]').click();
  // 検証: 前と後の表が並び、前のセルが元の数、後のセルが変えた数を持つ
  expect(previewButton.getAttribute("aria-pressed")).toBe("true");
  const sides = [...first.querySelectorAll<HTMLElement>(".mdmark-diff-side")];
  expect(sides).toHaveLength(2);
  expect(sides[0]?.querySelector("td")?.textContent).toBe("120");
  expect(sides[1]?.querySelector("td")?.textContent).toBe("150");
  expect(third.textContent).toContain(
    "前のリビジョンには、この範囲がありません",
  );
  // 実行: ソースを押す
  sourceButton.click();
  // 検証: 色分けの行に戻る
  expect(sourceButton.getAttribute("aria-pressed")).toBe("true");
  expect(find<HTMLElement>(first, '[data-pane="source"]').hidden).toBe(false);
  expect(find<HTMLElement>(first, '[data-pane="rendered"]').hidden).toBe(true);
});

// 長い文書の差分で、ミニマップの帯を押す・押したまま動かすと差分を送る（正常系）
test("test_normal_when_scrolled_by_minimap", async () => {
  // 準備
  const lines = (changed: boolean) => {
    const out = ["# 長い文書", ""];
    for (let index = 0; index < 120; index += 1) {
      out.push(`変えない行 ${index}`);
      if (index === 10 && changed) {
        out.push("前半で足した行");
      }
      if (index === 110 && changed) {
        out.push("後半で足した行");
      }
    }
    return `${out.join("\n")}\n`;
  };
  const source = createDiffSource({}, DIFF_REVISIONS.slice(1), {
    r1: lines(false),
    r2: lines(true),
  });
  const el = await mountDiff(source, "# 長い文書\n\n本文\n");
  window.scrollTo(0, 0);
  diffToggle(el).click();
  await waitForDiffLines(el);
  await vi.waitFor(() => {
    expect(minimapBands()).toHaveLength(1);
  });
  const band = minimapBands()[0] as HTMLElement;
  // 検証: 帯は画面の右端に、画面の高さいっぱいで置かれる
  expect(band.getAttribute("aria-hidden")).toBe("true");
  const rect = band.getBoundingClientRect();
  expect(getComputedStyle(band).position).toBe("fixed");
  expect(
    Math.abs(rect.right - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(rect.height - window.innerHeight)).toBeLessThanOrEqual(1);
  /** 変えた行が画面に入っているか */
  const visible = (text: string): boolean => {
    const line = [
      ...el.querySelectorAll<HTMLElement>(".mdmark-diff-line"),
    ].find((candidate) => candidate.textContent?.includes(text));
    const box = line?.getBoundingClientRect();
    return (
      box !== undefined && box.top >= 0 && box.bottom <= window.innerHeight
    );
  };
  const frame = () =>
    find<HTMLElement>(band, ".mdmark-diff-minimap-view").getBoundingClientRect()
      .top;
  const frameAtTop = frame();
  // 実行: 後半の印の位置を押す
  const lastMark = [
    ...band.querySelectorAll<HTMLElement>(".mdmark-diff-minimap-mark"),
  ].at(-1);
  const markRect = (lastMark as HTMLElement).getBoundingClientRect();
  await userEvent.click(band, {
    position: { x: 5, y: markRect.top - rect.top + markRect.height / 2 },
  });
  // 検証
  await vi.waitFor(() => {
    expect(visible("後半で足した行")).toBe(true);
  });
  await vi.waitFor(() => {
    expect(frame()).toBeGreaterThan(frameAtTop);
  });
  // 実行: 帯を押したまま上へ動かす
  await userEvent.dragAndDrop(band, band, {
    sourcePosition: { x: 5, y: rect.height * 0.9 },
    targetPosition: { x: 5, y: 2 },
  });
  // 検証
  await vi.waitFor(() => {
    expect(visible("前半で足した行")).toBe(true);
  });
});

// 「変更を見る」を押し直すと差分とミニマップを片付けて本文に戻す（正常系）
test("test_normal_when_diff_closed", async () => {
  // 準備
  const source = createDiffSource();
  const el = await mountDiff(source);
  const toggle = diffToggle(el);
  toggle.click();
  await waitForDiffLines(el);
  // 実行
  toggle.focus();
  toggle.click();
  // 検証
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  expect(el.querySelector(".mdmark-diff-line")).toBeNull();
  expect(el.querySelector("select")).toBeNull();
  expect(minimapBands()).toHaveLength(0);
  expect(find<HTMLElement>(el, ":scope > p").hidden).toBe(false);
});

// 取り出し元の待ちの間に destroy すると、後から返った結果を描かない（正常系）
test("test_normal_when_destroyed_while_waiting", async () => {
  // 準備
  let release: (value: DiffRevision[]) => void = () => {};
  const source = createDiffSource({
    revisions: (docId) => {
      source.revisionsCalls.push(docId);
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "# ガイド\n\n本文の段落。\n",
    docId: "guide",
    diffSource: source,
  });
  // 実行
  diffToggle(el).click();
  // 検証: 待ちが 1 秒を過ぎると読み込み中が出る
  await vi.waitFor(
    () => {
      expect(el.textContent).toContain("変更を読み込んでいます");
    },
    { timeout: 3000 },
  );
  // 実行: 片付けた後に、一覧が返る
  handle.destroy();
  release(DIFF_REVISIONS);
  await new Promise((resolve) => setTimeout(resolve, 100));
  // 検証
  expect(el.innerHTML).toBe("");
  expect(source.contentCalls).toEqual([]);
});

// `revisions` が reject すると差分の場所を知らせの枠にし、本文は残す（異常系）
test("test_error_when_revisions_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("network");
  const source = createDiffSource({
    revisions: async () => {
      throw error;
    },
  });
  const el = await mountDiff(source);
  // 実行
  expect(() => diffToggle(el).click()).not.toThrow();
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-notice")).not.toBeNull();
  });
  const notice = find(el, ".mdmark-notice");
  expect(notice.getAttribute("role")).toBe("status");
  expect(find(notice, ".mdmark-notice-title").textContent).toBe(
    "変更の履歴を表示できません",
  );
  expect(find(notice, "p").textContent).toBe(
    "リビジョンの一覧を取り出せませんでした。時間をおいて、変更を開き直してください。",
  );
  expect(source.contentCalls).toEqual([]);
  // 押し直すと、本文が開く前と同じに出る
  diffToggle(el).click();
  expect(find<HTMLElement>(el, ":scope > p").hidden).toBe(false);
  expect(consoleError).toHaveBeenCalledTimes(1);
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  expect(args.some((arg) => String(arg).includes("revisions"))).toBe(true);
  expect(args.some((arg) => String(arg).includes("guide"))).toBe(true);
});

// `content` が 1 つのリビジョンで reject すると、選ぶ欄を残して知らせの枠を出し、選び直せば差分を出す（異常系）
test("test_error_when_content_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("content");
  const source = createDiffSource();
  const original = source.content;
  source.content = async (target) => {
    if (target.revisionId === "r1") {
      source.contentCalls.push(target);
      throw error;
    }
    return original(target);
  };
  const el = await mountDiff(source);
  diffToggle(el).click();
  await waitForDiffLines(el);
  // 実行: 本文を返せない r1 を選ぶ
  await userEvent.selectOptions(diffSelect(el, "前のリビジョン"), "r1");
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-notice")).not.toBeNull();
  });
  const notice = find(el, ".mdmark-notice");
  expect(find(notice, ".mdmark-notice-title").textContent).toBe(
    "このリビジョンの本文を表示できません",
  );
  expect(find(notice, "p").textContent).toBe(
    "「2026/10/18 09:12 初版（佐藤）」の本文を取り出せませんでした。別のリビジョンを選んでください。",
  );
  expect(el.querySelector("select")).not.toBeNull();
  expect(minimapBands()).toHaveLength(0);
  expect(find(el, '[role="status"]').textContent).toBe("");
  // 実行: r2 を選び直す
  await userEvent.selectOptions(diffSelect(el, "前のリビジョン"), "r2");
  // 検証
  await waitForDiffLines(el);
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  expect(el.textContent).toContain("差分");
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  for (const word of ["content", "guide", "r1"]) {
    expect(args.some((arg) => String(arg).includes(word))).toBe(true);
  }
});

// `revisions` が形に合わない値を返すと、取り出せないときと同じ知らせの枠を出す（異常系）
test("test_error_when_revisions_malformed", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const malformed = [{ id: "r1" }, DIFF_REVISIONS[1]];
  const source = createDiffSource({}, malformed);
  const el = await mountDiff(source);
  // 実行
  expect(() => diffToggle(el).click()).not.toThrow();
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-notice")).not.toBeNull();
  });
  expect(find(el, ".mdmark-notice-title").textContent).toBe(
    "変更の履歴を表示できません",
  );
  expect(source.contentCalls).toEqual([]);
  const args = consoleError.mock.calls.flat();
  for (const word of ["revisions", "guide"]) {
    expect(args.some((arg) => String(arg).includes(word))).toBe(true);
  }
  expect(args.some((arg) => arg instanceof TypeError)).toBe(true);
});

// 取り出し元を渡して `docId` を渡さないと、何も描かずに TypeError を投げる（異常系）
test("test_error_when_doc_id_missing", async () => {
  // 準備
  const source = createDiffSource();
  const el = createElement();
  el.innerHTML = "<p>前の中身</p>";
  const { mount } = await loadBuilt();
  // 実行・検証
  expect(() => mount(el, { markdown: "# ガイド", diffSource: source })).toThrow(
    /docId/,
  );
  expect(() => mount(el, { markdown: "# ガイド", diffSource: source })).toThrow(
    TypeError,
  );
  expect(el.innerHTML).toBe("<p>前の中身</p>");
  expect(el.classList.contains("mdmark")).toBe(false);
  expect(source.revisionsCalls).toEqual([]);
});

/** `### {タイトル}` で区切ったタブの範囲の Markdown。`group` が無ければ組を持たない */
function tabsRange(titles: string[], group?: string): string {
  return [
    group === undefined ? "<!-- tabs -->" : `<!-- tabs: group=${group} -->`,
    "",
    ...titles.flatMap((title) => [`### ${title}`, "", `${title} の手順`, ""]),
    "<!-- /tabs -->",
    "",
  ].join("\n");
}

/** 描いた要素の中の `i` 番目のタブ群で、選んでいるタブの名前 */
function selectedTab(el: Element, i: number): string | null | undefined {
  return el
    .querySelectorAll(".mdmark-tabs")
    [i]?.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
}

/** 描いた要素の中の `i` 番目のタブ群で、名前のタブ */
function tabNamed(el: Element, i: number, name: string): HTMLElement {
  const tab = [
    ...(el
      .querySelectorAll(".mdmark-tabs")
      [i]?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
  ].find((candidate) => candidate.textContent === name);
  if (!tab) {
    throw new Error(`タブが無い: ${name}`);
  }
  return tab;
}

// 同じ group のタブ群を同じタブ名へ揃え、選んだタブ名を localStorage に残す（正常系）
test("test_normal_when_tab_group_synced", async () => {
  // 準備
  localStorage.clear();
  const el = createElement();
  const markdown = [
    tabsRange(["macOS", "Windows"], "os"),
    tabsRange(["macOS", "Windows"], "os"),
    tabsRange(["macOS", "Linux"], "os"),
    tabsRange(["macOS", "Windows"]),
  ].join("\n");
  await mountTracked(el, { markdown });
  // 検証: 押す前は残していない
  expect(localStorage.getItem("mdmark-tabs:os")).toBeNull();
  expect([0, 1, 2, 3].map((i) => selectedTab(el, i))).toEqual([
    "macOS",
    "macOS",
    "macOS",
    "macOS",
  ]);
  // 実行
  const windows = tabNamed(el, 0, "Windows");
  windows.click();
  // 検証
  for (const i of [0, 1]) {
    const tab = tabNamed(el, i, "Windows");
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(tab.getAttribute("tabindex")).toBe("0");
    const panels = [
      ...(el
        .querySelectorAll(".mdmark-tabs")
        [i]?.querySelectorAll<HTMLElement>('[role="tabpanel"]') ?? []),
    ];
    expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual([
      true,
      false,
    ]);
  }
  expect(selectedTab(el, 2)).toBe("macOS");
  expect(selectedTab(el, 3)).toBe("macOS");
  expect(document.activeElement).toBe(windows);
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("Windows");
});

// localStorage に残したタブ名のタブを選んで描き、本文を差し替えても同じタブを選ぶ（正常系）
test("test_normal_when_tab_choice_restored", async () => {
  // 準備
  localStorage.setItem("mdmark-tabs:os", "Windows");
  localStorage.setItem("mdmark-tabs:lang", "Go");
  const el = createElement();
  const markdown = [
    tabsRange(["macOS", "Windows"], "os"),
    tabsRange(["Python", "TypeScript"], "lang"),
    tabsRange(["macOS", "Windows"]),
  ].join("\n");
  const handle = await mountTracked(el, { markdown });
  // 検証: 描いた直後
  const windowsPanel = [
    ...(el
      .querySelectorAll(".mdmark-tabs")[0]
      ?.querySelectorAll<HTMLElement>('[role="tabpanel"]') ?? []),
  ];
  expect(selectedTab(el, 0)).toBe("Windows");
  expect(windowsPanel.map((panel) => panel.hasAttribute("hidden"))).toEqual([
    true,
    false,
  ]);
  expect(selectedTab(el, 1)).toBe("Python");
  expect(selectedTab(el, 2)).toBe("macOS");
  // 実行: 同じ本文で描き直す
  handle.update(markdown);
  // 検証
  expect(selectedTab(el, 0)).toBe("Windows");
  expect(localStorage.getItem("mdmark-tabs:lang")).toBe("Go");
});

// localStorage を取り出せなくても、同じ組のタブを揃えて切り替える（正常系）
test("test_normal_when_storage_unavailable", async () => {
  // 準備
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  try {
    const el = createElement();
    const markdown = [
      tabsRange(["macOS", "Windows"], "os"),
      tabsRange(["macOS", "Windows"], "os"),
    ].join("\n");
    // 実行・検証: 描く
    await mountTracked(el, { markdown });
    expect(selectedTab(el, 0)).toBe("macOS");
    expect(selectedTab(el, 1)).toBe("macOS");
    // 実行・検証: 押す
    tabNamed(el, 0, "Windows").click();
    expect(selectedTab(el, 0)).toBe("Windows");
    expect(selectedTab(el, 1)).toBe("Windows");
    expect(warn).toHaveBeenCalled();
    expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  } finally {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    } else {
      Reflect.deleteProperty(window, "localStorage");
    }
  }
});

// ─── ビューとコメント ───

/** 題・状態・担当の列と 5 行を持つ表。状態は上から未着手・進行中・未着手・完了・進行中、担当は佐藤・鈴木・佐藤・田中・鈴木 */
const VIEW_TABLE = [
  "| 題 | 状態 | 担当 |",
  "| --- | --- | --- |",
  "| 配色の変数を洗い出す | 未着手 | 佐藤 |",
  "| 余白の変数を決める | 進行中 | 鈴木 |",
  "| 印刷の見え方を確かめる | 未着手 | 佐藤 |",
  "| 配色を直す | 完了 | 田中 |",
  "| 表を絞り込む | 進行中 | 鈴木 |",
].join("\n");

/** ビューの印の引数を指定して、表を印で囲んだ文書にする */
function viewMarkdown(args: string): string {
  return `<!-- view: ${args} -->\n\n${VIEW_TABLE}\n\n<!-- /view -->\n`;
}

/** コメントを付ける段落の文字 */
const COMMENT_TEXT = "描いた文書の見た目はテーマの変数で変える。";

/** コメントの本文 */
const COMMENT_BODY = "ここは <b>太字</b> にしたい";

/** `テーマの変数` に付いたコメント */
const THEME_COMMENT: MdmarkComment = {
  id: "c1",
  quote: "テーマの変数",
  prefix: "描いた文書の見た目は",
  suffix: "で変える。",
  body: "読み込んだコメント",
};

/** ビルドした配布物のファイルを、名前ごとに別の URL で配る URL にする（別の名前は、ページの中の読み込み済みのモジュールを共有しない） */
function namedDistUrl(name: string, file: string): string {
  return `/fixtures/dist/${name}${inject("builtRoot")}/dist/${file}`;
}

/** 名前ごとに別の URL で配るビルドした JS を読み込む。`blocked` はビューとコメントの部品のモジュールを 404 にして配る */
async function loadNamedBuilt(name: string): Promise<Built> {
  await loadStylesheet();
  return import(/* @vite-ignore */ namedDistUrl(name, "index.js"));
}

/** ボードの列の見出しの値を、並びの順に返す */
function viewColumnNames(el: Element): string[] {
  return [...el.querySelectorAll(".mdmark-view-column-name")].map(
    (name) => name.textContent ?? "",
  );
}

/** ビューの切り替えのボタンを返す */
function viewSwitchButton(
  el: Element,
  mode: "board" | "table",
): HTMLButtonElement {
  return find<HTMLButtonElement>(
    el,
    `.mdmark-view-switch button[data-mode="${mode}"]`,
  );
}

/** ビューの表形式の本文の行のうち、隠れていない行の数 */
function viewVisibleRows(el: Element): number {
  return [...el.querySelectorAll<HTMLElement>(".mdmark-view-table tbody tr")]
    .filter((row) => !row.classList.contains("mdmark-table-empty"))
    .filter((row) => !row.hidden).length;
}

/** 要素の中の最初の文字の節の、始まりと終わりの位置の間を選ぶ */
function selectText(element: Element, start: number, end: number): void {
  const text = element.firstChild;
  if (!text) {
    throw new Error("選ぶ文字が無い");
  }
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** 隠れていないコメントのボタンを返す（無ければ `undefined`） */
function visibleCommentButton(): HTMLElement | undefined {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
}

/** 少し待つ（出ないことを確かめる前に、選びの受け取りが動き終わるのを待つ） */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

/** `console.error` に出た引数を 1 つの文字にする */
function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");
}

/** 読み書きの関数。`save` は受けた下書きに `id: "c1"` を足して返す */
function createCommentStore(loaded: MdmarkComment[] = []) {
  return {
    load: vi.fn(async (_target: { docId: string }) => loaded),
    save: vi.fn(
      async (target: {
        docId: string;
        comment: Omit<MdmarkComment, "id">;
      }): Promise<MdmarkComment> => ({ id: "c1", ...target.comment }),
    ),
  };
}

// ビューの印で囲んだ表をボード表示で描き、表形式と切り替える（正常系）
test("test_normal_when_view_drawn", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, { markdown: viewMarkdown("group=状態") });
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-view-switch")).not.toBeNull(),
  );
  const view = find(el, ".mdmark-view");
  expect(viewSwitchButton(view, "board").getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(viewColumnNames(view)).toEqual(["未着手", "進行中", "完了"]);
  expect(
    [...view.querySelectorAll(".mdmark-view-column-head svg")].map(
      (icon) => icon.innerHTML,
    ),
  ).toEqual([
    VIEW_ICON_PATHS["circle-dashed"],
    VIEW_ICON_PATHS["circle-dot"],
    VIEW_ICON_PATHS["circle-check"],
  ]);
  expect(
    [...view.querySelectorAll(".mdmark-view-column-count")].map(
      (count) => count.textContent,
    ),
  ).toEqual(["2", "2", "1"]);
  const firstCard = find(view, ".mdmark-view-card");
  expect(firstCard.querySelector(".mdmark-view-card-title")?.textContent).toBe(
    "配色の変数を洗い出す",
  );
  expect(
    [...firstCard.querySelectorAll("dt")].map((name) => name.textContent),
  ).toEqual(["担当"]);
  expect(
    view.querySelector(
      '.mdmark-view > input, .mdmark-view > [type="search"], .mdmark-view-count',
    ),
  ).toBeNull();
  // 実行
  viewSwitchButton(view, "table").click();
  // 検証
  expect(viewVisibleRows(view)).toBe(5);
  expect(find<HTMLElement>(view, ".mdmark-view-board").hidden).toBe(true);
});

// filter= の列だけを絞り込み、ボードには当てず、表形式に戻すと絞り込みが残る（正常系）
test("test_normal_when_view_filtered", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: viewMarkdown("group=状態 default=table filter=担当"),
  });
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-view-switch")).not.toBeNull(),
  );
  const view = find(el, ".mdmark-view");
  // 検証
  const buttons = view.querySelectorAll("thead th button.mdmark-filter");
  expect(buttons).toHaveLength(1);
  expect(buttons[0]?.closest("th")?.cellIndex).toBe(2);
  // 実行
  find<HTMLButtonElement>(view, "button.mdmark-filter").click();
  const label = [...view.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.includes("佐藤"),
  );
  (label?.control as HTMLInputElement | null)?.click();
  // 検証
  expect(viewVisibleRows(view)).toBe(2);
  expect(find(view, "button.mdmark-filter").className).toContain("is-active");
  // 実行
  viewSwitchButton(view, "board").click();
  // 検証
  expect(view.querySelectorAll(".mdmark-view-card")).toHaveLength(5);
  expect(
    [...view.querySelectorAll(".mdmark-view-column-count")].map(
      (count) => count.textContent,
    ),
  ).toEqual(["2", "2", "1"]);
  // 実行
  viewSwitchButton(view, "table").click();
  // 検証
  expect(viewVisibleRows(view)).toBe(2);
});

// 表に無い group の列と知らない絞り込みの種類に書き方の警告を出し、表形式で描く（正常系）
test("test_normal_when_view_syntax_invalid", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: viewMarkdown("group=優先度 filter=担当:range"),
  });
  // 検証
  const view = find(el, ".mdmark-view");
  const warnings = [...el.querySelectorAll(".mdmark-syntax-warning")];
  expect(warnings.length).toBeGreaterThanOrEqual(1);
  const text = warnings.map((warning) => warning.textContent).join(" ");
  expect(text).toContain("優先度");
  expect(text).toContain("range");
  for (const warning of warnings) {
    expect(
      warning.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
  expect(viewVisibleRows(view)).toBe(5);
  const board = viewSwitchButton(view, "board");
  expect(board.disabled).toBe(true);
  const reason = board.getAttribute("aria-describedby") ?? "";
  expect(el.querySelector(`#${CSS.escape(reason)}`)?.textContent).toContain(
    "優先度",
  );
  expect(view.querySelectorAll("button.mdmark-filter")).toHaveLength(0);
});

// views がオフのときは、印の範囲の表を普通の表で描き、ビューの部品のモジュールを読まない（正常系）
test("test_normal_when_views_disabled", async () => {
  // 準備
  const fresh = await loadNamedBuilt("views-disabled");
  const el = createElement();
  // 実行
  const handle = fresh.mount(el, {
    markdown: viewMarkdown("group=状態"),
    config: { features: { views: false } },
  });
  handles.push(handle);
  await settle();
  // 検証
  expect(el.querySelector(".mdmark-view")).toBeNull();
  expect(el.querySelector(".mdmark-view-switch")).toBeNull();
  expect(el.querySelector(".mdmark-view-board")).toBeNull();
  expect(el.querySelectorAll("table tbody tr")).toHaveLength(5);
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  expect(
    countRequests(`/views-disabled${inject("builtRoot")}/dist/view.js`),
  ).toBe(0);
});

// 選んだ文字にコメントを書いて保存し、印と吹き出しで読む（正常系）
test("test_normal_when_comment_added", async () => {
  // 準備
  const el = createElement();
  const store = createCommentStore();
  await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() => expect(store.load).toHaveBeenCalledTimes(1));
  expect(store.load).toHaveBeenCalledWith({ docId: "guide" });
  const paragraph = find(el, "p");
  // 実行
  selectText(paragraph, 10, 16);
  // 検証
  await vi.waitFor(() => expect(visibleCommentButton()).toBeDefined());
  // 実行
  window.getSelection()?.removeAllRanges();
  // 検証
  await vi.waitFor(() => expect(visibleCommentButton()).toBeUndefined());
  // 実行
  selectText(paragraph, 10, 16);
  await vi.waitFor(() => expect(visibleCommentButton()).toBeDefined());
  visibleCommentButton()?.click();
  const form = find(document.body, ".mdmark-comment-form");
  const field = find<HTMLTextAreaElement>(form, "textarea");
  field.value = COMMENT_BODY;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  find<HTMLButtonElement>(form, ".is-primary").click();
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  expect(store.save).toHaveBeenCalledTimes(1);
  expect(store.save).toHaveBeenCalledWith({
    docId: "guide",
    comment: {
      quote: "テーマの変数",
      prefix: "描いた文書の見た目は",
      suffix: "で変える。",
      body: COMMENT_BODY,
    },
  });
  const mark = find<HTMLElement>(el, "mark.mdmark-comment-mark");
  expect(mark.textContent).toBe("テーマの変数");
  expect(document.activeElement).toBe(mark);
  // 実行
  await userEvent.keyboard("{Enter}");
  // 検証
  const bubble = find(document.body, ".mdmark-comment-bubble");
  expect(bubble.querySelector("b")).toBeNull();
  expect(bubble.querySelector(".mdmark-comment-body")?.textContent).toBe(
    COMMENT_BODY,
  );
  // 実行
  await userEvent.keyboard("{Escape}");
  // 検証
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
  expect(document.activeElement).toBe(mark);
});

// 読んだコメントに印を付け、update の後も前後の文字で付き直し、見つからないものは末尾の一覧に出す（正常系）
test("test_normal_when_comments_reanchored", async () => {
  // 準備
  const el = createElement();
  const store = createCommentStore([THEME_COMMENT]);
  const handle = await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")?.textContent).toBe(
      "テーマの変数",
    ),
  );
  // 実行
  handle.update(`別の段落\n\n${COMMENT_TEXT}\n`);
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")?.textContent).toBe(
      "テーマの変数",
    ),
  );
  expect(store.load).toHaveBeenCalledTimes(2);
  // 実行
  handle.update("描いた文書の見た目は CSS 変数 で変える。\n");
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-comment-orphans")).not.toBeNull(),
  );
  expect(el.querySelector("mark")).toBeNull();
  const orphans = find(el, ".mdmark-comment-orphans");
  expect(el.lastElementChild).toBe(orphans);
  expect(orphans.textContent).toContain("テーマの変数");
  expect(orphans.textContent).toContain("読み込んだコメント");
});

// comments が既定のオフのときは、読み書きの関数を渡しても呼ばず、ボタンを出さない（正常系）
test("test_normal_when_comments_disabled", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const store = createCommentStore();
  await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    docId: "guide",
    commentStore: store,
  });
  // 実行
  selectText(find(el, "p"), 10, 16);
  await settle();
  // 検証
  expect(store.load).not.toHaveBeenCalled();
  expect(visibleCommentButton()).toBeUndefined();
  expect(spy).not.toHaveBeenCalled();
});

// save が reject すると、入力欄と本文を残して知らせを出し、印を付けない（異常系）
test("test_error_when_comment_save_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const store = createCommentStore();
  store.save.mockRejectedValue(new Error("network"));
  await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() => expect(store.load).toHaveBeenCalledTimes(1));
  selectText(find(el, "p"), 10, 16);
  await vi.waitFor(() => expect(visibleCommentButton()).toBeDefined());
  visibleCommentButton()?.click();
  const form = find(document.body, ".mdmark-comment-form");
  const field = find<HTMLTextAreaElement>(form, "textarea");
  field.value = COMMENT_BODY;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  // 実行
  find<HTMLButtonElement>(form, ".is-primary").click();
  // 検証
  await vi.waitFor(() =>
    expect(find(form, '[role="alert"]').textContent).toMatch(
      /^コメントを保存できませんでした。/,
    ),
  );
  expect(document.querySelector(".mdmark-comment-form")).toBe(form);
  expect(field.value).toBe(COMMENT_BODY);
  expect(el.querySelector("mark")).toBeNull();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("save");
  expect(loggedText(spy)).toContain("guide");
  expect(loggedText(spy)).toContain("network");
});

// comments がオンで読み書きの関数を渡さないと、ボタンを出さず、console.error に 1 回だけ出す（異常系）
test("test_error_when_comment_store_missing", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const markdown = `${COMMENT_TEXT}\n`;
  const handle = await mountTracked(el, {
    markdown,
    config: { features: { comments: true } },
  });
  // 実行
  handle.update(markdown);
  selectText(find(el, "p"), 10, 16);
  await settle();
  // 検証
  expect(visibleCommentButton()).toBeUndefined();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("commentStore");
  expect(find(el, "p").textContent).toBe(COMMENT_TEXT);
});

// 読み書きの関数を渡して docId を渡さないと、何も描かずに TypeError を投げる（異常系）
test("test_error_when_comment_doc_id_missing", async () => {
  // 準備
  const { mount } = await loadBuilt();
  const el = createElement();
  el.className = "前の class";
  el.innerHTML = "<p>前の中身</p>";
  const store = createCommentStore();
  // 実行・検証
  const mounting = () =>
    mount(el, {
      markdown: `${COMMENT_TEXT}\n`,
      config: { features: { comments: true } },
      commentStore: store,
    });
  expect(mounting).toThrow(TypeError);
  expect(mounting).toThrow("docId");
  expect(el.innerHTML).toBe("<p>前の中身</p>");
  expect(el.className).toBe("前の class");
  expect(store.load).not.toHaveBeenCalled();
});

// 部品のモジュールを読めないと、ビューの印の場所は表のまま残し、コメントのボタンを出さず、console.error に出す（異常系）
test("test_error_when_part_module_unavailable", async () => {
  // 準備
  const blocked = await loadNamedBuilt("blocked");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const store = createCommentStore();
  const markdown = `${viewMarkdown("group=状態")}\n${COMMENT_TEXT}\n`;
  // 実行
  const handle = blocked.mount(el, {
    markdown,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  handles.push(handle);
  // 検証
  await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  await settle();
  expect(spy).toHaveBeenCalledTimes(2);
  expect(el.querySelectorAll("table tbody tr")).toHaveLength(5);
  expect(el.querySelector(".mdmark-view-switch")).toBeNull();
  expect(el.querySelector(".mdmark-view-board")).toBeNull();
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  expect(spy.mock.calls.map((call) => call.map(String).join(" "))).toEqual([
    expect.stringMatching(/view .*\/blocked\/.*\/view\.js/),
    expect.stringMatching(/comments .*\/blocked\/.*\/comments\.js/),
  ]);
  // 元のエラーを最後の引数に含む
  for (const call of spy.mock.calls) {
    expect(call.at(-1)).toBeInstanceOf(Error);
  }
  expect(find(el, "p:last-of-type").textContent).toBe(COMMENT_TEXT);
  // 実行
  selectText(find(el, "p:last-of-type"), 10, 16);
  await settle();
  // 検証
  expect(visibleCommentButton()).toBeUndefined();
  expect(store.load).not.toHaveBeenCalled();
});

/** ツールチップの置く側を確かめる索引: 用語 `索引` */
const PLACEMENT_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [{ id: "arch", path: "設計/arch.md", title: "アーキテクチャ" }],
  terms: [
    {
      id: "index",
      term: "索引",
      meaning: "文書と用語を並べた YAML のファイル",
    },
  ],
};

/** ツールチップの置く側を確かめる文書: 1 行目の用語、2 つ目の節の用語・`tip` を持つ線のフロー図・`data-hint` を持つ `div`。`tail` を渡すと、末尾に用語を足す */
function placementMarkdown(options: { tail: boolean }): string {
  const filler = Array.from({ length: 80 }, (_, i) => `詰め物の段落 ${i}\n`);
  return [
    "索引を 1 行目に置く。",
    "",
    "## 節",
    "",
    "索引を 2 つ目の節に置く。",
    "",
    wrapDirective("flow", INQUIRY_TEXT),
    wrapHtml(
      '<div data-hint="ブロックの説明" style="width: 20rem; padding: 1rem">ブロックの文字</div>',
    ),
    ...(options.tail ? [...filler, "## 末尾", "", "末尾の索引。", ""] : []),
  ].join("\n");
}

/** 持ち主が指すツールチップ（用語は同じ枠の中のツールチップ） */
function tooltipOf(owner: HTMLElement): HTMLElement {
  const tip = owner.classList.contains("mdmark-term")
    ? owner.closest(".mdmark-term-wrap")?.querySelector(".mdmark-term-tip")
    : document.getElementById(owner.getAttribute("aria-describedby") ?? "");
  if (!(tip instanceof HTMLElement)) {
    throw new Error("ツールチップが無い");
  }
  return tip;
}

/** 持ち主を画面の中ほど（`block` が `end` なら下端）へ送り、ポインターを乗せて、持ち主とツールチップの枠を返す */
async function hoverAndMeasure(
  owner: HTMLElement,
  block: "center" | "end",
): Promise<{ owner: DOMRect; tip: DOMRect }> {
  owner.scrollIntoView({ block });
  await userEvent.hover(owner);
  return {
    owner: owner.getBoundingClientRect(),
    tip: tooltipOf(owner).getBoundingClientRect(),
  };
}

/** 文書の持ち主: 用語の並びと、2 つ目の節の線のラベル・ヒントの印 */
function placementOwners(el: HTMLElement): {
  terms: HTMLElement[];
  label: HTMLElement;
  mark: HTMLElement;
} {
  return {
    terms: [...el.querySelectorAll<HTMLElement>(".mdmark-term")],
    label: find<HTMLElement>(el, ".mdmark-diagram-label.has-tip"),
    mark: find<HTMLElement>(el, ".mdmark-hint-mark"),
  };
}

// ツールチップを持ち主の上に出し、上に収まらない語だけ下に出す（正常系（ツールチップを上に出す））
test("test_normal_when_tooltip_above", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: placementMarkdown({ tail: false }),
    index: PLACEMENT_INDEX,
    docId: "arch",
  });
  const { terms, label, mark } = placementOwners(el);
  const [firstTerm, sectionTerm] = terms as [HTMLElement, HTMLElement];
  // 実行・検証: 2 つ目の節の用語・線のラベル・ヒントの印は、持ち主の上に出る
  for (const owner of [sectionTerm, label, mark]) {
    const rects = await hoverAndMeasure(owner, "center");
    expect(rects.tip.bottom).toBeLessThanOrEqual(rects.owner.top);
  }
  // 実行・検証: 1 行目の用語は上に収まらないので、語の下に出る
  window.scrollTo(0, 0);
  await userEvent.hover(firstTerm);
  const termRect = firstTerm.getBoundingClientRect();
  const tipRect = tooltipOf(firstTerm).getBoundingClientRect();
  expect(tipRect.height).toBeGreaterThan(0);
  expect(tipRect.top).toBeGreaterThanOrEqual(termRect.bottom);
  expect(tipRect.top).toBeGreaterThanOrEqual(0);
});

// tooltips.placement が bottom のときは持ち主の下に出し、下に収まらない語だけ上に出す。知らない値は top として扱う（正常系（ツールチップを下に出す設定））
test("test_normal_when_tooltip_placement_bottom", async () => {
  // 準備
  const markdown = placementMarkdown({ tail: true });
  const el = createElement();
  await mountTracked(el, {
    markdown,
    index: PLACEMENT_INDEX,
    docId: "arch",
    config: { tooltips: { placement: "bottom" } },
  });
  const { terms, label, mark } = placementOwners(el);
  const [, sectionTerm, tailTerm] = terms as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  // 実行・検証: 2 つ目の節の用語・線のラベル・ヒントの印は、持ち主の下に出る
  for (const owner of [sectionTerm, label, mark]) {
    const rects = await hoverAndMeasure(owner, "center");
    expect(rects.tip.top).toBeGreaterThanOrEqual(rects.owner.bottom);
  }
  // 実行・検証: 画面の下端にある末尾の用語は下に収まらないので、語の上に出る
  const tail = await hoverAndMeasure(tailTerm, "end");
  expect(tail.tip.bottom).toBeLessThanOrEqual(tail.owner.top);
  expect(tail.tip.bottom).toBeLessThanOrEqual(window.innerHeight);
  // 実行・検証: 知らない値は top として扱い、語の上に出る
  const el2 = createElement();
  await mountTracked(el2, {
    markdown,
    index: PLACEMENT_INDEX,
    docId: "arch",
    config: { tooltips: { placement: "left" } },
  });
  const unknownTerm = placementOwners(el2).terms[1] as HTMLElement;
  const unknown = await hoverAndMeasure(unknownTerm, "center");
  expect(unknown.tip.bottom).toBeLessThanOrEqual(unknown.owner.top);
});

/** 元の行番号を持つ要素の位置と色 */
function snapshotBlocks(el: Element): Array<{
  top: number;
  height: number;
  color: string;
}> {
  return ["h1", "p", ".mdmark-table", "pre"].map((selector) => {
    const block = find(el, selector);
    const rect = block.getBoundingClientRect();
    return {
      top: rect.top,
      height: rect.height,
      color: getComputedStyle(block).color,
    };
  });
}

// 描いたブロックと差し替えた本文のブロックが、元の行番号を持ち、見た目は変わらない（正常系）
test("test_normal_when_source_lines", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    "# 見出し",
    "",
    "段落",
    "",
    "| 列A | 列B |",
    "| --- | ---: |",
    "| 1 | 2 |",
    "<!-- code: lines -->",
    "```ts",
    "const a = 1;",
    "```",
    "",
  ].join("\n");
  const sourceLines = () =>
    ["h1", "p", ".mdmark-table", "pre"].map((selector) =>
      find(el, selector).getAttribute("data-source-line"),
    );
  // 実行・検証: 描いた直後
  const handle = await mountTracked(el, { markdown });
  expect(sourceLines()).toEqual(["0", "2", "4", "8"]);
  // 属性を取り除いても、位置と色の計算値は変わらない
  const withAttributes = snapshotBlocks(el);
  for (const element of el.querySelectorAll("[data-source-line]")) {
    element.removeAttribute("data-source-line");
  }
  expect(snapshotBlocks(el)).toEqual(withAttributes);
  // 実行・検証: 頭に 2 行足して差し替える
  handle.update(`\n\n${markdown}`);
  expect(sourceLines()).toEqual(["2", "4", "6", "10"]);
});

/** 描く先を包む要素（`wrap`）と描く先（`el`）を置き、`body` の class と OS の配色を先に決めて見本の Markdown を描く */
async function mountThemed(options: {
  bodyClass: string;
  colorScheme: "light" | "dark";
}): Promise<{ wrap: HTMLElement; el: HTMLElement }> {
  const wrap = createElement();
  const el = document.createElement("div");
  wrap.append(el);
  document.body.className = options.bodyClass;
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: options.colorScheme }],
  });
  await mountTracked(el, {
    markdown: "# 見出し\n\n段落\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n",
  });
  return { wrap, el };
}

/** `body` の class と、OS の配色・印刷のメディアの切り替えを元に戻す */
async function resetThemed(): Promise<void> {
  document.body.className = "";
  await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
}

/** 描く先の要素の `--mdmark-color-bg` の計算値 */
function readBackground(el: HTMLElement): string {
  return getComputedStyle(el).getPropertyValue("--mdmark-color-bg").trim();
}

// OS の配色がライトでも、祖先の `vscode-dark` でダークの値を当て、class を外すと戻す（正常系）
test("test_normal_when_parent_class_dark", async () => {
  // 準備・実行
  const { el } = await mountThemed({
    bodyClass: "vscode-dark",
    colorScheme: "light",
  });
  try {
    // 検証
    expect(readBackground(el)).toBe(DARK_BG);
    document.body.className = "vscode-light";
    expect(readBackground(el)).toBe(LIGHT_BG);
    document.body.className = "vscode-high-contrast";
    expect(readBackground(el)).toBe(DARK_BG);
    document.body.className = "vscode-high-contrast vscode-high-contrast-light";
    expect(readBackground(el)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

// OS の配色がダークでも、祖先の `vscode-light` でライトにし、`mdmark-theme-light` は `vscode-dark` に勝つ（正常系）
test("test_normal_when_parent_class_light", async () => {
  // 準備・実行
  const { wrap, el } = await mountThemed({
    bodyClass: "vscode-light",
    colorScheme: "dark",
  });
  try {
    // 検証
    expect(readBackground(el)).toBe(LIGHT_BG);
    document.body.className = "vscode-dark";
    wrap.className = "mdmark-theme-light";
    expect(readBackground(el)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

// 祖先の class でダークにしても、印刷では明るい配色にする（正常系）
test("test_normal_when_parent_class_dark_printed", async () => {
  // 準備・実行
  const { wrap, el } = await mountThemed({
    bodyClass: "vscode-dark",
    colorScheme: "light",
  });
  try {
    wrap.className = "mdmark-theme-dark";
    expect(readBackground(el)).toBe(DARK_BG);
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    // 検証
    expect(readBackground(el)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});
