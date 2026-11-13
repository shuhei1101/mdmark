import { afterEach, expect, inject, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import type {
  DiffRevision,
  MdmarkAlias,
  MdmarkComment,
  MdmarkIndex,
  MdmarkReferences,
  MountHandle,
} from "../../../src/index.ts";
import { VIEW_ICON_PATHS } from "../../../src/parts/view.ts";
import {
  ADDED_CHART_DEFINITIONS,
  INQUIRY_COUNT_TEXT,
  INQUIRY_HINT_TEXT,
  wrapHtml,
} from "../../unit/helpers/charts.ts";
import {
  INQUIRY_GROUPS_TEXT,
  INQUIRY_TEXT,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";
import { erText, foldEr, shopErFolded } from "../../unit/helpers/er.ts";
import {
  CONFIG as MAP_CONFIG,
  DATA as MAP_DATA,
  FLOW as MAP_FLOW,
  SEQUENCE as MAP_SEQUENCE,
  mapRange,
} from "../../unit/helpers/map.ts";
import { stripSourceLine } from "../../unit/helpers/source-line.ts";
import {
  ALIAS_EXPECTED_HTML,
  ALIAS_MARKDOWN,
  ALIASES,
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
// 色分けのライブラリ（`@highlightjs/cdn-assets` の `es/`）を手元の開発サーバーが配る URL。名前ごとに別の URL にして、ページの中の読み込み済みのモジュールを分ける
const HIGHLIGHT_BASE = "/fixtures/highlightjs/";
// 色分けのライブラリを配らない URL（404 を返却する）
const MISSING_HIGHLIGHT_URL = "/fixtures/missing/";
// 読み込み中のブロックの文言
const LOADING_TEXT = "図を読み込んでいます";
// ダークとライトの `--mdmark-color-bg` の値
const DARK_BG = "#131316";
const LIGHT_BG = "#ffffff";
// ライトの `--mdmark-color-surface` の値
const LIGHT_SURFACE = "#f4f4f5";

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

/** ビルドした JS を 1 度だけ読み込み、CSS と合わせて使用できる状態にする */
async function loadBuilt(): Promise<Built> {
  await loadStylesheet();
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  return built;
}

/** 描く先の要素を作り、ページに配置する */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を記録する */
async function mountTracked(
  el: HTMLElement,
  opts: Parameters<Built["mount"]>[1],
): Promise<MountHandle> {
  const { mount } = await loadBuilt();
  const handle = mount(el, opts);
  handles.push(handle);
  return handle;
}

/** 要素の中を CSS セレクタで 1 つ参照する（無ければ失敗する） */
function find<T extends Element>(el: Element, selector: string): T {
  const found = el.querySelector<T>(selector);
  if (!found) {
    throw new Error(`見つからない: ${selector}`);
  }
  return found;
}

/** 要素の直下の段落の文字を並べて返却する（通知ブロックの中の段落は含めない） */
function paragraphTexts(el: Element): string[] {
  return [...el.querySelectorAll(":scope > p")].map((p) => p.textContent ?? "");
}

/** 印刷の前後のイベントを送信する */
function sendPrintEvent(type: "beforeprint" | "afterprint"): void {
  window.dispatchEvent(new Event(type));
}

/** 外部ライブラリの代役のモジュールを読み込んだ要求の件数を数える */
function countRequests(path: string): number {
  return performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.endsWith(path)).length;
}

/** 色分けのライブラリを `name` の名前で配る `es/` フォルダの URL（`syntax.url` に指定する） */
function highlightUrl(name: string): string {
  return `${HIGHLIGHT_BASE}${name}/es/`;
}

/** 色分けのライブラリを読み込んだ要求の URL を、並べ替えて返却する */
function highlightRequests(name: string): string[] {
  const prefix = `${location.origin}${highlightUrl(name)}`;
  return performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(prefix))
    .sort();
}

/** 色分けの対象の見本: マーカーを持たない `ts`、`<!-- code: {"lines": {}} -->` の直後に 3 行のブロックスカラーを持つ `yml`、色分けしない `text` のコードブロック */
const HIGHLIGHT_MARKDOWN = [
  "```ts",
  "const count: number = 1;",
  "```",
  "",
  '<!-- code: {"lines": {}} -->',
  "",
  "```yml",
  "body: |",
  "  一行目",
  "  二行目",
  "  三行目",
  "```",
  "",
  "```text",
  "plain",
  "```",
  "",
].join("\n");

/** `code` の HTML を、文書の順に並べて返却する */
function codeHtmls(el: Element): string[] {
  return [...el.querySelectorAll("code")].map((code) => code.outerHTML);
}

/** class が `hljs-` で始まる `span` を持つ `code` の言語の class を、文書の順に並べて返却する */
function coloredLanguages(el: Element): string[] {
  return [...el.querySelectorAll("code")]
    .filter((code) => code.querySelector('span[class^="hljs-"]') !== null)
    .map((code) => code.className);
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

// update で本文だけを再描画する（正常系）
test("test_normal_when_updated", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# 元の見出し\n\n段落\n" });
  // 実行
  handle.update("# 新しい見出し");
  // 検証
  const headings = el.querySelectorAll(".mdmark-content h1");
  expect(headings).toHaveLength(1);
  expect(headings[0]?.textContent).toBe("新しい見出し");
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

// 未知のマーカーを無視して描く（正常系）
test("test_normal_when_unknown_mark", async () => {
  // 準備
  const el = createElement();
  const markdown = '前の段落\n\n<!-- unknown: {"size": 1} -->\n\n後の段落\n';
  // 実行
  await mountTracked(el, { markdown });
  // 検証
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
  expect(el.innerHTML).not.toContain("<!--");
  expect(el.innerHTML).not.toContain("unknown");
});

// 文書に記載したスクリプトを落として描き、実行しない（正常系）
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

// マーカーの無い文書では外部ライブラリを読み込まない（正常系）
// 注: 同じページで読み込んだモジュールは再読み込みされないため、外部ライブラリを読み込むテストより前に配置する
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

// 文書に外部ライブラリのマーカーがあるときだけ、そのモジュールを読み込んでマーカーの場所に描かせる（正常系）
test("test_normal_when_library_mark", async () => {
  // 準備
  const el = createElement();
  await loadBuilt();
  performance.clearResourceTimings();
  const markdown =
    '前の段落\n\n<!-- test-lib: {"items": ["a", "b"]} -->\n\n後の段落\n';
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

// 引数が JSON のオブジェクトでない外部ライブラリのマーカーは、モジュールを読み込まずに記載の警告を描く（正常系）
test("test_normal_when_legacy_library_args", async () => {
  // 準備
  const el = createElement();
  await loadBuilt();
  performance.clearResourceTimings();
  const markdown = "前の段落\n\n<!-- test-lib: a b -->\n\n後の段落\n";
  const config = { libraries: { "test-lib": TEST_LIB_PATH } };
  // 実行
  await mountTracked(el, { markdown, config });
  // 検証
  const warning = find<HTMLElement>(el, ".mdmark-syntax-warning");
  expect(warning.textContent).toContain(
    "JSON のオブジェクトで記載してください",
  );
  expect(warning.textContent).toContain("mdmark upgrade");
  expect(el.querySelector("[data-mdmark-slot]")).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(countRequests(TEST_LIB_PATH)).toBe(0);
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

// 設定でオンの機能を、文書のマーカーでその文書だけオフにする（正常系）
test("test_normal_when_feature_disabled_by_mark", async () => {
  // 準備
  const el = createElement();
  const markdown =
    '<!-- features: {"print": false} -->\n\n<details><summary>s</summary>b</details>\n';
  await mountTracked(el, { markdown, config: { features: { print: true } } });
  // 実行
  sendPrintEvent("beforeprint");
  // 検証
  expect(find<HTMLDetailsElement>(el, "details").open).toBe(false);
  expect(el.innerHTML).not.toContain("features");
});

// 設定でオフの機能を、文書のマーカーでその文書だけオンにする。知らない機能名は無視する（正常系）
test("test_normal_when_feature_enabled_by_mark", async () => {
  // 準備
  const el = createElement();
  const markdown =
    '<!-- features: {"print": true, "unknown": true} -->\n\n<details><summary>s</summary>b</details>\n';
  await mountTracked(el, { markdown, config: { features: { print: false } } });
  // 実行
  sendPrintEvent("beforeprint");
  // 検証
  expect(find<HTMLDetailsElement>(el, "details").open).toBe(true);
  expect(el.innerHTML).not.toContain("features");
  expect(el.innerHTML).not.toContain("unknown");
});

// 利用側のページが層の外に記載した CSS と変数の上書きが、mdmark の CSS に勝つ（正常系）
test("test_normal_when_theme_overridden", async () => {
  // 準備
  const el = createElement();
  // リンク 1 つだけの段落はカードにするため、文の中にリンクを配置する
  await mountTracked(el, {
    markdown: "詳しくは [リンク](https://example.com/) を確認する。\n",
  });
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

// 外部ライブラリを読み込めないマーカーの場所だけを通知ブロックにし、ほかは描く（異常系）
test("test_error_when_library_not_found", async () => {
  // 準備
  const el = createElement();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const markdown =
    '前の段落\n\n<!-- test-lib: {"items": ["a", "b"]} -->\n\n後の段落\n';
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
    "表示に使用するライブラリ（test-lib）を読み込めませんでした。ネットワークにつながっているかを確認して、ページを再読み込みしてください。",
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
  '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}} -->',
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

/** 表の本文の行の指定した列の文字を、上から並べて返却する */
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

// 表の見出しで並べ替えを 3 状態で切り替え、絞り込みのドロワーで絞って除外する（正常系）
test("test_normal_when_table_sorted_and_filtered", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: FILTER_TABLE_MARKDOWN });
  const valueHead = el.querySelectorAll("thead th")[1] as HTMLElement;
  const sortButton = find<HTMLButtonElement>(valueHead, "button.mdmark-sort");
  // 実行・検証: 値の列の見出しを 3 回押す
  sortButton.click();
  expect(columnTexts(el, 1)).toEqual(["33", "10", "2"]);
  expect(valueHead.getAttribute("aria-sort")).toBe("descending");
  sortButton.click();
  expect(columnTexts(el, 1)).toEqual(["2", "10", "33"]);
  expect(valueHead.getAttribute("aria-sort")).toBe("ascending");
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
  // 実行・検証: 絞り込みを解除
  const clear = [...drawer.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("絞り込みを解除"),
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

/** 表の本文の行の指定した列のセル（隠れた行も含む）と、その列の見出し・集計のセルを返却する */
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

/** 表の帯のテーブル設定のボタンを押してパネルを開き、ボタン・パネルと、元の列の位置から一覧の目のアイコン・つまみを参照する関数を返却する */
function openTableSettings(table: Element): {
  toggle: HTMLButtonElement;
  panel: HTMLElement;
  eye: (column: number) => HTMLButtonElement;
  grip: (column: number) => HTMLButtonElement;
} {
  const toggle = find<HTMLButtonElement>(
    table,
    "button.mdmark-table-settings-toggle",
  );
  toggle.click();
  const panel = find<HTMLElement>(table, ".mdmark-table-settings");
  const item = (column: number) =>
    find<HTMLElement>(
      panel,
      `.mdmark-table-settings-item[data-column="${column}"]`,
    );
  return {
    toggle,
    panel,
    eye: (column) =>
      find<HTMLButtonElement>(item(column), ".mdmark-table-settings-eye"),
    grip: (column) =>
      find<HTMLButtonElement>(item(column), ".mdmark-table-settings-grip"),
  };
}

/** テーブル設定のボタンのバッジの文字 */
function settingsBadge(table: Element): string {
  return (
    find(table, ".mdmark-table-settings-toggle .mdmark-table-tool-badge")
      .textContent ?? ""
  );
}

/** `navigator.clipboard.writeText` を差し替える */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

// 絞り込みに合わせて件数を書き換え、テーブル設定のパネルの目のアイコンで列を出し入れする（正常系）
test("test_normal_when_table_counted_and_columns_toggled", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      '<!-- table: {"kind": "data", "features": {"count": {}}, "columns": {"説明": {"hidden": true}, "名前": {"filter": {"type": "text"}}}} -->',
      "",
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を修正する | 2026-10-10 |",
      "| りんご飴 | 描画の崩れを修正する | 2026-10-20 |",
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
  expect(settingsBadge(table)).toBe("1");
  expect(
    find(table, ".mdmark-table-settings-toggle").getAttribute("aria-label"),
  ).toBe("テーブル設定（1 列を非表示）");
  // 実行・検証: 「りんご」で絞り込む
  inputFilterText(table, "りんご");
  expect(count.textContent).toContain("2 / 3 件");
  expect(count.textContent).toContain("3 件中 2 件を表示");
  // 実行・検証: テーブル設定のパネルを開く
  const { toggle, panel, eye } = openTableSettings(table);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(find(panel, ".mdmark-table-settings-title").textContent).toBe(
    "表示と並び順",
  );
  expect(eye(0).disabled).toBe(true);
  expect(panel.textContent).toContain("先頭の列は隠せません");
  // 実行・検証: 説明を表示して更新日を隠す
  eye(1).click();
  eye(2).click();
  expect(hiddenOf(1).some(Boolean)).toBe(false);
  expect(hiddenOf(2).every(Boolean)).toBe(true);
  expect(eye(2).getAttribute("aria-label")).toBe("「更新日」を表示");
  expect(settingsBadge(table)).toBe("1");
  // 実行・検証: Esc でパネルを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(panel.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(toggle);
});

/** 集計の行の計算の種類を、上から並べて返却する */
function totalKinds(el: Element): Array<string | undefined> {
  return [...el.querySelectorAll<HTMLElement>("tfoot tr")].map(
    (row) => row.dataset.totalKind,
  );
}

/** 集計の行ごとに、セルの文字（計算の名前と値）を空白を除いてつないだものを、計算の種類をキーにして返却する */
function totalRowTexts(el: Element): Record<string, string[]> {
  return Object.fromEntries(
    [...el.querySelectorAll<HTMLTableRowElement>("tfoot tr")].map((row) => [
      row.dataset.totalKind ?? "",
      [...row.cells].map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, ""),
      ),
    ]),
  );
}

/** 集計の行の指定した計算の、指定した列のセル */
function totalCell(el: Element, kind: string, column: number): HTMLElement {
  const cell = find<HTMLTableRowElement>(
    el,
    `tfoot tr[data-total-kind="${kind}"]`,
  ).cells[column];
  if (!cell) {
    throw new Error(`集計のセルが無い: ${kind} ${column}`);
  }
  return cell;
}

/** 集計の行の指定した計算の、先頭のセルの計算の名前と値 */
function firstTotalCell(
  el: Element,
  kind: string,
): { name: string; value: string } {
  const cell = totalCell(el, kind, 0);
  return {
    name: cell.querySelector(".mdmark-total-name")?.textContent ?? "",
    value: cell.querySelector(".mdmark-total-value")?.textContent ?? "",
  };
}

/** 要素が画面に出ているか（`display: none` の中や取り除いた要素は出ていない） */
function isShown(element: Element | null | undefined): boolean {
  return (element?.getClientRects().length ?? 0) > 0;
}

/** 表の上の帯のスクリーンリーダー向けの要素の文字 */
function statusText(el: Element): string {
  return find(el, ".mdmark-table-status").textContent ?? "";
}

/** コピーのボタンを押して形式のメニューを開き、指定した形式のボタンを押す */
function chooseCopyFormat(el: Element, format: "markdown" | "tsv"): void {
  find<HTMLButtonElement>(el, "button.mdmark-copy").click();
  find<HTMLButtonElement>(
    el,
    `button.mdmark-copy-format[data-format="${format}"]`,
  ).click();
}

/** 集計の 3 つの計算（`数量` の合計・`単価` の平均・`名前` の件数）を持つ表の Markdown */
const TOTALS_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"columns": {}}, "columns": {"数量": {"total": [{"calc": "sum"}]}, "単価": {"total": [{"calc": "avg"}]}, "名前": {"total": [{"calc": "count"}], "filter": {"type": "text"}}}} -->',
  "",
  "| 名前 | 数量 | 単価 |",
  "| --- | --- | --- |",
  "| りんご | 10 | 100 |",
  "| みかん | 2 | 200 |",
  "| りんご飴 | 33 | 300 |",
  "| ぶどう |  | 400 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 表示している行で集計した tfoot の行を計算ごとに配置し、絞り込みでもう一度計算し、並べ替えでは動かさない（正常系）
test("test_normal_when_table_totals", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: TOTALS_MARKDOWN });
  const table = find<HTMLElement>(el, ".mdmark-table");
  // 実行・検証: 描いた直後
  expect(totalKinds(el)).toEqual(["sum", "avg", "count"]);
  expect(
    ["sum", "avg", "count"].map((kind) => firstTotalCell(el, kind).name),
  ).toEqual(["合計", "平均", "件数"]);
  expect(totalRowTexts(el)).toEqual({
    sum: ["合計", "45", ""],
    avg: ["平均", "", "250"],
    count: ["件数4", "", ""],
  });
  expect(firstTotalCell(el, "count").value).toBe("4");
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  // 実行・検証: 「りんご」で絞り込む
  inputFilterText(table, "りんご");
  expect(totalRowTexts(el)).toEqual({
    sum: ["合計", "43", ""],
    avg: ["平均", "", "200"],
    count: ["件数2", "", ""],
  });
  // 実行・検証: 一致する行が無い
  inputFilterText(table, "存在しない");
  expect(totalRowTexts(el)).toEqual({
    sum: ["合計", "0", ""],
    avg: ["平均", "", "—"],
    count: ["件数0", "", ""],
  });
  inputFilterText(table, "");
  // 実行・検証: 数量の列の見出しを押して並べ替える
  find<HTMLButtonElement>(
    el.querySelectorAll("thead th")[1] as HTMLElement,
    "button.mdmark-sort",
  ).click();
  expect(totalKinds(el)).toEqual(["sum", "avg", "count"]);
  const tbody = find(el, "tbody");
  for (const row of el.querySelectorAll("tfoot tr")) {
    expect(row.parentElement?.tagName).toBe("TFOOT");
    expect(tbody.contains(row)).toBe(false);
  }
  // 実行・検証: テーブル設定の単価の目のアイコンで単価を隠す
  openTableSettings(table).eye(2).click();
  for (const cell of columnCells(el, 2)) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  for (const kind of ["sum", "avg", "count"]) {
    expect(totalCell(el, kind, 2).hasAttribute("hidden")).toBe(true);
  }
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
});

// 「集計」のメニューでチェックを解除した計算の行を隠し、もう一度入れると戻す（正常系）
test("test_normal_when_totals_selected", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: TOTALS_MARKDOWN });
  const toggle = find<HTMLButtonElement>(el, "button.mdmark-totals-toggle");
  const menu = find<HTMLElement>(el, ".mdmark-totals-menu");
  const checkbox = (calc: string): HTMLInputElement =>
    find<HTMLInputElement>(menu, `input[value="${calc}"]`);
  const hiddenKinds = (): Array<string | undefined> =>
    [...el.querySelectorAll<HTMLElement>("tfoot tr")]
      .filter((row) => row.hasAttribute("hidden"))
      .map((row) => row.dataset.totalKind);
  // 実行・検証: 集計を押す
  toggle.click();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(menu.hasAttribute("hidden")).toBe(false);
  const boxes = [...menu.querySelectorAll<HTMLInputElement>("input")];
  expect(boxes.map((box) => box.parentElement?.textContent?.trim())).toEqual([
    "合計",
    "平均",
    "件数",
  ]);
  expect(boxes.every((box) => box.type === "checkbox" && box.checked)).toBe(
    true,
  );
  // 実行・検証: 平均のチェックを解除する
  checkbox("avg").click();
  expect(hiddenKinds()).toEqual(["avg"]);
  expect(statusText(el)).toContain("平均");
  expect(statusText(el)).toContain("隠しました");
  // 実行・検証: 平均にチェックを入れる
  checkbox("avg").click();
  expect(hiddenKinds()).toEqual([]);
  // 実行・検証: Esc でメニューを閉じてボタンへフォーカスを戻す
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(menu.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(toggle);
  // 実行・検証: 平均を削除して差し替えると、選択を覚えず全て出す
  toggle.click();
  checkbox("avg").click();
  expect(hiddenKinds()).toEqual(["avg"]);
  handle.update(TOTALS_MARKDOWN);
  expect(hiddenKinds()).toEqual([]);
});

// 数として読み込めないセルを持つ列の合計と平均のセルを、絞り込みに関わらず空にする（正常系）
test("test_normal_when_total_cell_not_number", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}, "単価": {"total": [{"calc": "avg"}]}, "名前": {"filter": {"type": "text"}}}} -->',
      "",
      "| 名前 | 数量 | 単価 |",
      "| --- | --- | --- |",
      "| りんご | 10 | 100 |",
      "| みかん | 2 | 200 |",
      "| ぶどう | - | 300 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const table = find<HTMLElement>(el, ".mdmark-table");
  // 検証: 描いた直後
  expect(totalCell(el, "sum", 1).textContent?.trim()).toBe("");
  expect(totalCell(el, "avg", 2).textContent?.trim()).toBe("200");
  const warnings = el.querySelectorAll(".mdmark-syntax-warning");
  expect(warnings).toHaveLength(1);
  const [warning] = warnings;
  expect(warning?.textContent).toContain("数量");
  expect(warning?.textContent).toContain("-");
  expect(
    (warning?.compareDocumentPosition(table) ?? 0) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  // 実行・検証: 読み込めないセルを隠す絞り込みの後も、合計は空のまま
  inputFilterText(table, "りんご");
  expect(totalCell(el, "sum", 1).textContent?.trim()).toBe("");
  expect(totalCell(el, "avg", 2).textContent?.trim()).toBe("100");
});

/** 名前 `りんご`・`みかん`・`りんご飴` と、説明（`hide=説明` で隠す）・更新日を持つ表を、コピーできるマーカーで囲んだ Markdown */
const COPY_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"説明": {"hidden": true}, "名前": {"filter": {"type": "text"}}}} -->',
  "",
  "| 名前 | 説明 | 更新日 |",
  "| --- | --- | --- |",
  "| りんご | 赤い \\| 甘い | 2026-10-01 |",
  "| みかん | 黄色い | 2026-10-10 |",
  "| りんご飴 | 祭りの菓子 | 2026-10-20 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// コピーの形式のメニューで TSV を選び、表示している行と列をクリップボードへ書き込み、ボタンで通知する（正常系）
test("test_normal_when_table_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: COPY_MARKDOWN });
  inputFilterText(find<HTMLElement>(el, ".mdmark-table"), "りんご");
  const button = find<HTMLButtonElement>(el, "button.mdmark-copy");
  const menu = find<HTMLElement>(el, ".mdmark-copy-menu");
  // 実行・検証: 表をコピーを押す
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(menu.hasAttribute("hidden")).toBe(false);
  const formats = [
    ...menu.querySelectorAll<HTMLButtonElement>("button.mdmark-copy-format"),
  ];
  expect(
    formats.map(
      (format) => find(format, ".mdmark-copy-format-name").textContent,
    ),
  ).toEqual(["Markdown の表", "TSV"]);
  expect(document.activeElement).toBe(formats[0]);
  // 実行: TSV を押す
  formats[1]?.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: コピーした中身と通知し
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(
    "名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20",
  );
  expect(menu.hasAttribute("hidden")).toBe(true);
  expect(document.activeElement).toBe(button);
  expect(button.textContent).toContain("コピーしました");
  expect(statusText(el)).toContain("TSV");
  expect(statusText(el)).toContain("コピーしました");
  // 実行・検証: 2 秒後に戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.textContent).toContain("表をコピー");
});

// 列の表示と絞り込みの後に見えている行と列を、セルの `|` を戻して Markdown の表で記載する（正常系）
test("test_normal_when_table_copied_as_markdown", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: COPY_MARKDOWN });
  const table = find<HTMLElement>(el, ".mdmark-table");
  // テーブル設定で説明を表示して更新日を隠し、「りんご」で絞り込む
  const { eye } = openTableSettings(table);
  eye(1).click();
  eye(2).click();
  inputFilterText(table, "りんご");
  // 実行
  chooseCopyFormat(el, "markdown");
  // 検証
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenCalledWith(
    "| 名前 | 説明 |\n| --- | --- |\n| りんご | 赤い \\| 甘い |\n| りんご飴 | 祭りの菓子 |",
  );
  const button = find<HTMLButtonElement>(el, "button.mdmark-copy");
  await vi.waitFor(() => {
    expect(button.textContent).toContain("コピーしました");
  });
  expect(statusText(el)).toContain("Markdown の表");
  expect(statusText(el)).toContain("コピーしました");
});

// クリップボードへの書き込みが拒まれたら、コピーする中身を選択したパネルを出し、閉じるとボタンへフォーカスを戻す（正常系）
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
      '<!-- table: {"kind": "data", "features": {"copy": {}}} -->',
      "",
      "| 名前 | 更新日 |",
      "| --- | --- |",
      "| a | 2026-10-01 |",
      "| b | 2026-10-10 |",
      "| c | 2026-10-20 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const button = find<HTMLButtonElement>(el, "button.mdmark-copy");
  try {
    // 実行: TSV を選ぶ
    chooseCopyFormat(el, "tsv");
    await vi.advanceTimersByTimeAsync(0);
    // 検証: 表の上の帯の直後にパネルがあり、中身が全て選ばれている
    const panel = find<HTMLElement>(el, ".mdmark-copy-panel");
    expect(panel.getAttribute("role")).toBe("group");
    expect(find(el, ".mdmark-table-bar").nextElementSibling).toBe(panel);
    const textarea = find<HTMLTextAreaElement>(panel, "textarea");
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe(
      "名前\t更新日\na\t2026-10-01\nb\t2026-10-10\nc\t2026-10-20",
    );
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
    expect(document.activeElement).toBe(textarea);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(statusText(el)).toContain("コピーできませんでした");
    expect(statusText(el)).toContain("手動でコピー");
    expect(rejections).toHaveLength(0);
    // 実行・検証: Esc でパネルを閉じる
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(el.querySelector(".mdmark-copy-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
    // 実行・検証: もう一度コピーすると、書き込みをもう一度試し、パネルは 1 つだけ
    chooseCopyFormat(el, "tsv");
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll(".mdmark-copy-panel")).toHaveLength(1);
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// URL の #ID が指す行を囲む閉じた表・セクションを開き、絞り込みを解除して行へ移り、その行を強調する（正常系）
test("test_normal_when_table_row_linked", async () => {
  // 準備
  const el = createElement();
  history.replaceState(null, "", "#みかん");
  await mountTracked(el, {
    markdown: [
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}, "collapse": {"open": false}} -->',
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
      "## セクション",
      "",
      '<!-- section: {"open": false} -->',
      "",
      '<!-- table: {"kind": "data", "features": {"rowlink": {}}, "columns": {"名前": {"filter": {"type": "text"}}}} -->',
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
  expect(find(el, '[id="section-セクション"]').hasAttribute("hidden")).toBe(
    false,
  );
  for (const row of second.querySelectorAll<HTMLElement>(
    "tbody tr:not(.mdmark-table-empty)",
  )) {
    expect(row.hasAttribute("hidden")).toBe(false);
  }
  // 絞り込みのボタンが絞り込み中のままでない（外観とスクリーンリーダーの文字）
  const filterButton = find<HTMLElement>(second, "button.mdmark-filter");
  expect(filterButton.classList.contains("is-active")).toBe(false);
  expect(filterButton.textContent).not.toContain("（絞り込み中）");
  // 実行・検証: まとめた HTML の # の構造
  location.hash = "#/a.md#みかん";
  await vi.waitFor(() => {
    expect(targets()).toEqual(["みかん"]);
  });
});

/** 名前 `りんご`・`みかん`・`りんご飴` の 3 行の表を、行へのリンクのマーカーで囲んだ Markdown */
const ROW_LINK_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"rowlink": {}}} -->',
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| りんご | 1 |",
  "| みかん | 2 |",
  "| りんご飴 | 3 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** `location.hash` をデコードして返却する */
function decodedHash(): string {
  return decodeURIComponent(location.hash);
}

// 行へのリンクのマーカーを押すと、行へ移る動きはそのままに、解決済みの href を記載して通知する（正常系）
test("test_normal_when_row_url_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: ROW_LINK_MARKDOWN });
  const row = find<HTMLElement>(el, 'tr[id="みかん"]');
  const anchor = find<HTMLAnchorElement>(row, "a.mdmark-row-anchor");
  const notice = find<HTMLElement>(row, ".mdmark-row-link-notice");
  // 実行
  anchor.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 解決済みの href を 1 回書き、マーカーの横に通知を出す
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(anchor.href);
  expect(notice.getAttribute("role")).toBe("status");
  expect(notice.textContent).toBe("リンクをコピーしました");
  // 検証: 行へ移り、その行だけを強調する
  expect(decodedHash()).toBe("#みかん");
  expect(
    [...el.querySelectorAll<HTMLElement>("tr[data-target]")].map((r) => r.id),
  ).toEqual(["みかん"]);
  // 実行・検証: 2 秒後に通知が消える
  await vi.advanceTimersByTimeAsync(2000);
  expect(notice.textContent).toBe("");
  expect(notice.hasAttribute("data-state")).toBe(false);
});

// クリップボードへの書き込みが拒まれても、行へ移り、書き込めなかったことを通知する（正常系）
test("test_normal_when_row_url_copy_denied", async () => {
  // 準備
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const el = createElement();
  await mountTracked(el, { markdown: ROW_LINK_MARKDOWN });
  const row = find<HTMLElement>(el, 'tr[id="みかん"]');
  const notice = find<HTMLElement>(row, ".mdmark-row-link-notice");
  try {
    // 実行
    find<HTMLAnchorElement>(row, "a.mdmark-row-anchor").click();
    // 検証
    await vi.waitFor(() => {
      expect(notice.textContent).toBe("リンクをコピーできませんでした");
    });
    expect(notice.getAttribute("role")).toBe("status");
    expect(decodedHash()).toBe("#みかん");
    expect(row.hasAttribute("data-target")).toBe(true);
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// はみ出す表にだけピン止めのボタンを出し、押した列だけを留め、留めた列より左を表示している間は右端に留める（正常系）
test("test_normal_when_table_pinned", async () => {
  // 準備
  const el = createElement();
  el.style.width = "800px";
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
    "| マーカー | 目印 |",
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
  const narrowRow = narrow.querySelector("tbody tr") as HTMLTableRowElement;
  expect(getComputedStyle(narrowRow.cells[0] as HTMLElement).position).not.toBe(
    "sticky",
  );
  // 検証: ボタンの名前は押した列だけを留める名前
  expect(widePins[0]?.getAttribute("aria-label")).toBe(
    "「列の名前1」の列をピン止め",
  );
  // 検証: 描いた直後は 1 列目だけを留める
  expect(widePins[0]?.getAttribute("aria-pressed")).toBe("true");
  expect(positions().slice(0, 2)).toEqual(["sticky", "static"]);
  // 実行・検証: 3 列目のピン止めを押すと、1・3 列目だけを留める
  const pressed = () =>
    [...widePins].map((pin) => pin.getAttribute("aria-pressed"));
  const third = widePins[2] as HTMLButtonElement;
  third.click();
  expect(pressed().slice(0, 3)).toEqual(["true", "false", "true"]);
  expect(positions().slice(0, 3)).toEqual(["sticky", "static", "sticky"]);
  // 実行・検証: 右端までスクロールすると、1・3 列目が左端に並ぶ
  const cells = [...firstRow.querySelectorAll<HTMLElement>("td")];
  const scroller = find<HTMLElement>(wide, ".mdmark-table-scroll");
  const visibleLeft = () =>
    scroller.getBoundingClientRect().left + scroller.clientLeft;
  const visibleRight = () => visibleLeft() + scroller.clientWidth;
  const box = (index: number) =>
    (cells[index] as HTMLElement).getBoundingClientRect();
  scroller.scrollLeft = scroller.scrollWidth;
  await nextFrames();
  expect(scroller.scrollLeft).toBeGreaterThan(0);
  expect(Math.abs(box(0).left - visibleLeft())).toBeLessThanOrEqual(1);
  expect(Math.abs(box(2).left - box(0).right)).toBeLessThanOrEqual(1);
  // 実行・検証: 8・9 列目を押して左端までスクロールすると、8・9 列目が右端に並ぶ
  (widePins[7] as HTMLButtonElement).click();
  (widePins[8] as HTMLButtonElement).click();
  scroller.scrollLeft = 0;
  await nextFrames();
  expect(Math.abs(box(8).right - visibleRight())).toBeLessThanOrEqual(1);
  expect(Math.abs(box(7).right - box(8).left)).toBeLessThanOrEqual(1);
  // 実行・検証: 3 列目をもう一度押すと、3 列目だけを解除する
  third.click();
  expect(third.getAttribute("aria-pressed")).toBe("false");
  expect(positions()[2]).toBe("static");
  for (const index of [0, 7, 8]) {
    expect(positions()[index]).toBe("sticky");
  }
  // 検証: 表は高さを抑えず、表の中で縦にスクロールしない
  expect(getComputedStyle(wide).maxHeight).toBe("none");
  expect(wide.scrollHeight).toBe(wide.clientHeight);
});

// -pin の表は留めず、pin= の表は記載した列だけを留め、wide= の列を折り返さずに広く取る（正常系）
test("test_normal_when_table_pin_and_wide", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  const headers = Array.from({ length: 10 }, (_, i) => `列の名前${i + 1}`);
  const columns = [
    "No",
    "物理名",
    "説明",
    "型",
    "必須",
    "既定",
    "単位",
    "備考",
  ];
  const markdown = [
    '<!-- table: {"features": {"pin": {"enabled": false}}} -->',
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...Array.from(
      { length: 30 },
      (_, row) =>
        `| ${headers.map((_h, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
    ),
    "",
    "<!-- /table -->",
    "",
    '<!-- table: {"kind": "data", "columns": {"物理名": {"pinned": true}, "説明": {"width": {"mode": "nowrap"}}}} -->',
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...[1, 2, 3].map(
      (row) =>
        `| ${row} | name${row} | 表の行を識別するための値で、文書の中で重ならないように付ける長い説明の文 | string | true | - | 文字 | なし |`,
    ),
    "",
    "<!-- /table -->",
    "",
    '<!-- table: {"kind": "data", "columns": {"No": {"pinned": true}, "物理名": {"pinned": true}}} -->',
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...[1, 2, 3].map(
      (row) =>
        `| ${row} | name${row} | 表の行を識別するための値で、文書の中で重ならないように付ける長い説明の文 | string | true | - | 文字 | なし |`,
    ),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const [noPin, pinned, pinnedTwo] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-table"),
  ] as [HTMLElement, HTMLElement, HTMLElement];
  const table = pinned.querySelector("table") as HTMLTableElement;
  const firstRow = table.tBodies[0]?.rows[0] as HTMLTableRowElement;
  const positions = () =>
    [...firstRow.cells].map((cell) => getComputedStyle(cell).position);
  // 検証: -pin の表は留めない
  expect(noPin.querySelector("button.mdmark-pin")).toBeNull();
  const noPinCell = noPin.querySelector("tbody td") as HTMLElement;
  expect(getComputedStyle(noPinCell).position).not.toBe("sticky");
  // 検証: pin=物理名 の表は物理名の列だけを留める
  await vi.waitFor(() => {
    expect(positions().slice(0, 3)).toEqual(["static", "sticky", "static"]);
  });
  const pins = pinned.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  expect(
    [...pins].map((pin) => pin.getAttribute("aria-pressed")).slice(0, 3),
  ).toEqual(["false", "true", "false"]);
  // 検証: pin=No,物理名 の表は 2 つの列を留める
  const twoRow = pinnedTwo.querySelector("tbody tr") as HTMLTableRowElement;
  await vi.waitFor(() => {
    expect(
      [...twoRow.cells]
        .slice(0, 3)
        .map((cell) => getComputedStyle(cell).position),
    ).toEqual(["sticky", "sticky", "static"]);
  });
  expect(
    [...pinnedTwo.querySelectorAll<HTMLButtonElement>("button.mdmark-pin")]
      .map((pin) => pin.getAttribute("aria-pressed"))
      .slice(0, 3),
  ).toEqual(["true", "true", "false"]);
  // 実行・検証: 横に最後までスクロールしても、物理名の見出しが左端に並ぶ
  const scroller = find<HTMLElement>(pinned, ".mdmark-table-scroll");
  scroller.scrollLeft = scroller.scrollWidth;
  expect(scroller.scrollLeft).toBeGreaterThan(0);
  await vi.waitFor(() => {
    const left = scroller.getBoundingClientRect().left + scroller.clientLeft;
    const name = table.tHead?.rows[0]?.cells[1] as HTMLElement;
    expect(Math.round(name.getBoundingClientRect().left)).toBe(
      Math.round(left),
    );
  });
  // 検証: 説明の列は折り返さず、ほかのどの列より広い
  const description = firstRow.cells[2] as HTMLElement;
  expect(getComputedStyle(description).whiteSpace).toBe("nowrap");
  const widths = [...firstRow.cells].map((cell) => cell.offsetWidth);
  const descriptionWidth = widths[2] ?? 0;
  for (const [index, width] of widths.entries()) {
    if (index !== 2) {
      expect(descriptionWidth).toBeGreaterThan(width);
    }
  }
  // 検証: 表の中で横にスクロールし、ページははみ出さない
  expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    document.documentElement.clientWidth,
  );
});

// check= の列を、出している ✓ と空欄ではなく true・false の値で並べ替え・絞り込み・コピーする（正常系）
test("test_normal_when_table_check_column", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  const markdown = [
    '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"必須": {"format": {"type": "check"}, "filter": {}}}} -->',
    "",
    "| 名前 | 必須 | 既定 |",
    "| --- | --- | --- |",
    "| a | true | true |",
    "| b | false | false |",
    "| c | true | false |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const rows = () =>
    [
      ...el.querySelectorAll<HTMLTableRowElement>(
        ".mdmark-table tbody tr:not(.mdmark-table-empty)",
      ),
    ].filter((row) => !row.hidden);
  // 実行・検証: 必須の列の見出しを押して並べ替える
  const header = el.querySelectorAll(".mdmark-table thead th")[1];
  find<HTMLButtonElement>(header as HTMLElement, "button.mdmark-sort").click();
  expect(rows().map((row) => row.cells[0]?.textContent)).toEqual([
    "a",
    "c",
    "b",
  ]);
  // 実行・検証: 絞り込みの候補と、true に絞る
  find<HTMLButtonElement>(
    header as HTMLElement,
    "button.mdmark-filter",
  ).click();
  const drawer = find<HTMLElement>(el, ".mdmark-filter-drawer:not([hidden])");
  const candidates = [
    ...drawer.querySelectorAll<HTMLInputElement>(
      ".mdmark-filter-options input",
    ),
  ];
  expect(candidates.map((input) => input.value).sort()).toEqual([
    "false",
    "true",
  ]);
  candidates.find((input) => input.value === "true")?.click();
  expect(rows().map((row) => row.cells[0]?.textContent)).toEqual(["a", "c"]);
  for (const row of rows()) {
    expect(row.cells[1]?.querySelector(".mdmark-check")).not.toBeNull();
  }
  // 実行・検証: TSV でコピーする
  find<HTMLButtonElement>(el, "button.mdmark-copy").click();
  find<HTMLButtonElement>(
    el,
    'button.mdmark-copy-format[data-format="tsv"]',
  ).click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenCalledWith(
    "名前\t必須\t既定\na\ttrue\ttrue\nc\ttrue\tfalse",
  );
});

/** 次の描画を 2 回待つ */
function nextFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** ページを縦に `top` までスクロールし、描画の更新を待つ */
async function scrollPageTo(top: number): Promise<void> {
  window.scrollTo(0, top);
  await nextFrames();
}

/** 見出し行と集計の行を留める確認の表の行数 */
const STICKY_ROWS = 60;

/** 長い段落の後に、集計の行を持つ 10 列 60 行の表を配置し、表の後に長い段落を配置した Markdown。数量の列は昇順に並べる */
const STICKY_MARKDOWN = (() => {
  const headers = [
    "名前",
    "数量",
    ...Array.from({ length: 8 }, (_, i) => `列${i + 3}`),
  ];
  const rows = Array.from({ length: STICKY_ROWS }, (_, row) => {
    const cells = [
      `行${row + 1}`,
      String(row + 1),
      ...Array.from({ length: 8 }, (_, i) => `値${row + 1}-${i + 3}`),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  const paragraphs = (label: string): string[] =>
    Array.from({ length: 40 }, (_, i) => `${label}の段落 ${i + 1}\n`);
  return [
    ...paragraphs("前"),
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}} -->',
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
    "<!-- /table -->",
    "",
    ...paragraphs("後"),
  ].join("\n");
})();

/** `cell` の画面の中の位置と幅 */
function cellBox(cell: Element): { left: number; width: number } {
  const rect = cell.getBoundingClientRect();
  return { left: rect.left, width: rect.width };
}

/** 見出し行と集計の行を留める一連の確認を、`animation-timeline` で動かす留め方（`timeline`）か、JS でずらす留め方（`script`）で実行する */
async function checkStickyRows(mode: "timeline" | "script"): Promise<void> {
  if (mode === "script") {
    // `animation-timeline` を持たないブラウザの代わりに、その問い合わせだけを偽にする
    const supports = CSS.supports.bind(CSS) as (...args: string[]) => boolean;
    vi.spyOn(CSS, "supports").mockImplementation(((...args: string[]) =>
      args[0]?.includes("animation-timeline")
        ? false
        : supports(...args)) as typeof CSS.supports);
  }
  const el = createElement();
  el.style.width = "600px";
  el.style.setProperty("--mdmark-sticky-top", "48px");
  const handle = await mountTracked(el, { markdown: STICKY_MARKDOWN });
  const wrapper = find<HTMLElement>(el, ".mdmark-table");
  const table = find<HTMLTableElement>(wrapper, "table");
  const headCells = [...table.querySelectorAll<HTMLElement>("thead th")];
  const footCells = [...table.querySelectorAll<HTMLElement>("tfoot td")];
  const viewportBottom = document.documentElement.clientHeight;
  const tableTop = table.getBoundingClientRect().top + window.scrollY;
  try {
    await vi.waitFor(() => {
      expect(el.getAttribute("data-mdmark-sticky")).toBe(mode);
    });
    // 検証: 表は高さを抑えず、表の中で縦にスクロールしない
    expect(getComputedStyle(wrapper).maxHeight).toBe("none");
    expect(wrapper.scrollHeight).toBe(wrapper.clientHeight);
    // 実行・検証: 表の途中までスクロールする
    await scrollPageTo(tableTop + 600);
    await vi.waitFor(() => {
      for (const cell of headCells) {
        expect(
          Math.abs(cell.getBoundingClientRect().top - 48),
        ).toBeLessThanOrEqual(1);
      }
      for (const cell of footCells) {
        expect(
          Math.abs(cell.getBoundingClientRect().bottom - viewportBottom),
        ).toBeLessThanOrEqual(1);
      }
    });
    // 実行・検証: 2 列目までを留めて、表を横にスクロールする
    const pins = table.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
    await vi.waitFor(() => {
      expect(pins[1]?.hasAttribute("hidden")).toBe(false);
    });
    pins[1]?.click();
    find<HTMLElement>(wrapper, ".mdmark-table-scroll").scrollLeft = 200;
    await nextFrames();
    const body = find<HTMLElement>(table, "tbody tr");
    await vi.waitFor(() => {
      headCells.forEach((head, column) => {
        const bodyBox = cellBox(body.querySelectorAll("td")[column] as Element);
        const headBox = cellBox(head);
        expect(Math.abs(headBox.left - bodyBox.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(headBox.width - bodyBox.width)).toBeLessThanOrEqual(1);
        const footBox = cellBox(footCells[column] as Element);
        expect(Math.abs(footBox.left - bodyBox.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(footBox.width - bodyBox.width)).toBeLessThanOrEqual(1);
      });
    });
    // 留めた 1・2 列目は表の左端に並ぶ
    const tableLeft = find<HTMLElement>(
      wrapper,
      ".mdmark-table-scroll",
    ).getBoundingClientRect().left;
    const first = cellBox(headCells[0] as Element);
    const second = cellBox(headCells[1] as Element);
    expect(Math.abs(first.left - tableLeft)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(second.left - (first.left + first.width)),
    ).toBeLessThanOrEqual(1);
    // 実行・検証: 留めた見出し行の数量の並べ替えを押す
    await userEvent.click(
      find<HTMLButtonElement>(headCells[1] as Element, "button.mdmark-sort"),
    );
    expect(columnTexts(el, 1).slice(0, 3)).toEqual(["60", "59", "58"]);
    expect(headCells[1]?.getAttribute("aria-sort")).toBe("descending");
    // 検証: 文書の中の見出し行は 1 つで、Tab で見出し行の各ボタンと列の幅のつまみへ 1 回ずつ移る
    expect(el.querySelectorAll("thead")).toHaveLength(1);
    const buttons = [
      ...table.querySelectorAll<HTMLElement>(
        "thead :is(button, .mdmark-col-resize)",
      ),
    ];
    table.focus({ preventScroll: true });
    for (const button of buttons) {
      await userEvent.tab();
      expect(document.activeElement).toBe(button);
    }
    // 実行・検証: 表の後の段落までスクロールすると、見出し行と集計の行が画面の外へ出る
    await scrollPageTo(tableTop + table.offsetHeight + 400);
    await vi.waitFor(() => {
      for (const cell of [...headCells, ...footCells]) {
        expect(cell.getBoundingClientRect().bottom).toBeLessThan(0);
      }
    });
    // 実行・検証: 印刷の媒体では、ずらさない
    await scrollPageTo(tableTop + 600);
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    await vi.waitFor(() => {
      for (const cell of [...headCells, ...footCells]) {
        expect(getComputedStyle(cell).transform).toBe("none");
      }
    });
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
    handle.destroy();
    el.remove();
    vi.restoreAllMocks();
    window.scrollTo(0, 0);
  }
}

// ページのスクロールで、見出し行を画面の上端からずれの分だけ下に、集計の行を画面の下端に留め、表が削除されると一緒に削除する（正常系）
test("test_normal_when_table_header_stuck", async () => {
  // 準備
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1280, 800);
  try {
    // 実行・検証: このブラウザ（`animation-timeline` を持つ）の留め方
    await checkStickyRows("timeline");
    // 実行・検証: `animation-timeline` を持たないブラウザの留め方
    await checkStickyRows("script");
  } finally {
    await page.viewport(original.width, original.height);
  }
});

/** 390px の幅で 1 行に収まらない説明を最終列に持つ、3 列 3 行の表を `data` のマーカーで囲んだ Markdown */
const FOLD_TABLE_MARKDOWN = [
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読み込みやすくする変更の説明 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 描く先の要素の幅を決める */
function setElementWidth(el: HTMLElement, width: number): void {
  el.style.boxSizing = "border-box";
  el.style.width = `${width}px`;
}

/** コードの行のマーカーと、言語の無いコードブロックと、ファイルツリーに描く `tree` のコードブロックを持つ Markdown */
const CODE_COPY_MARKDOWN = [
  "```ts",
  "const a = 1; // [!code --]",
  "const a = 2; // [!code ++]",
  "count += 1; // 数える [!code highlight]",
  "return a;",
  "```",
  "",
  "```",
  "npm install mdmark",
  "```",
  "",
  "```tree",
  "src/",
  "  index.ts",
  "```",
  "",
].join("\n");

/** コードブロックのコピーのボタンを、文書の順に返却する */
function codeCopyButtons(el: Element): HTMLButtonElement[] {
  return [...el.querySelectorAll<HTMLButtonElement>("button.mdmark-code-copy")];
}

// コピーボタンで、削除した行を含めない変更後のコードをクリップボードへ書き込み、ボタンで通知する（正常系）
test("test_normal_when_code_copied", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: CODE_COPY_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const [tsButton, plainButton] = codeCopyButtons(el) as [
    HTMLButtonElement,
    HTMLButtonElement,
  ];
  // 検証: ファイルツリーに描いた tree のコードブロックにはボタンが無い
  expect(codeCopyButtons(el)).toHaveLength(2);
  expect(find(el, ".mdmark-tree").closest(".mdmark-code")).toBeNull();
  expect(
    el.querySelectorAll(".mdmark-tree button.mdmark-tree-copy"),
  ).toHaveLength(1);
  // 実行: Tab でフォーカスして Enter で押す
  await userEvent.tab();
  expect(document.activeElement).toBe(tsButton);
  expect(tsButton.type).toBe("button");
  await userEvent.keyboard("{Enter}");
  // 検証: 行番号と行頭の `+`・`-` を含まない変更後のコードをコピーし、通知する
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText).toHaveBeenNthCalledWith(
    1,
    "const a = 2;\ncount += 1; // 数える\nreturn a;",
  );
  expect(tsButton.textContent).toContain("コピーしました");
  expect(
    find(tsButton.closest(".mdmark-code") as Element, '[role="status"]')
      .textContent,
  ).toContain("コードをコピーしました");
  // 実行: 言語の無いコードブロックのボタンを押す
  plainButton.click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(2);
  });
  expect(writeText).toHaveBeenNthCalledWith(2, "npm install mdmark");
  // 実行・検証: 2 秒後にボタンの文字が戻る
  await vi.waitFor(
    () => {
      expect(tsButton.textContent?.trim()).toBe("コピー");
    },
    { timeout: 4000 },
  );
  // 実行・検証: 印刷の媒体では、コピーボタンを表示しない
  try {
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    await vi.waitFor(() => {
      expect(isShown(tsButton)).toBe(false);
    });
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

// クリップボードへの書き込みが拒まれたら、ボタンで通知して次に押すまで残す（正常系）
test("test_normal_when_code_copy_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const el = createElement();
  await mountTracked(el, {
    markdown: "```ts\nconst a = 1;\n```\n",
    config: { features: { syntax: false } },
  });
  const [button] = codeCopyButtons(el) as [HTMLButtonElement];
  const status = (): string =>
    find(button.closest(".mdmark-code") as Element, '[role="status"]')
      .textContent ?? "";
  try {
    // 実行・検証: 押すと失敗を通知し、2 秒たっても戻らない
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(status()).toContain("コードをコピーできませんでした");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(rejections).toHaveLength(0);
    // 実行・検証: クリップボードが無いページでも、押すと同じ通知になる
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(status()).toContain("コードをコピーできませんでした");
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

/** 長い段落の後に、閉じたセクションの中のタブ（`macOS`・`Windows`）が見出しを持つ Markdown */
const FRAGMENT_TAB_MARKDOWN = [
  ...Array.from({ length: 30 }, (_, i) => `前の段落 ${i + 1}\n`),
  "## 導入",
  "",
  '<!-- section: {"open": false} -->',
  "",
  '<!-- tabs: {"group": "os"} -->',
  "",
  "### macOS",
  "",
  "#### macOS の注意",
  "",
  "macOS の段落",
  "",
  "### Windows",
  "",
  "#### Windows の注意",
  "",
  "Windows の段落",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

// URL の ID が選ばれていないタブの中の見出しを指すとき、残したタブ名より優先してそのタブを選び、セクションを開いてから移る（正常系）
test("test_normal_when_fragment_in_tab", async () => {
  // 準備
  localStorage.setItem("mdmark-tabs:os", "macOS");
  history.replaceState(null, "", "#windows-の注意");
  const el = createElement();
  await mountTracked(el, { markdown: FRAGMENT_TAB_MARKDOWN });
  const panelHidden = (): boolean[] =>
    [
      ...find(el, ".mdmark-tabs").querySelectorAll<HTMLElement>(
        '[role="tabpanel"]',
      ),
    ].map((panel) => panel.hasAttribute("hidden"));
  const inScreen = (id: string): boolean => {
    const rect = find(el, `[id="${id}"]`).getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  };
  // 検証: 描いた後、Windows のタブを選び、セクションを開いて、見出しが画面の中にある
  await vi.waitFor(() => {
    expect(inScreen("windows-の注意")).toBe(true);
  });
  expect(find(el, '[id="section-導入"]').hasAttribute("hidden")).toBe(false);
  expect(tabNamed(el, 0, "Windows").getAttribute("aria-selected")).toBe("true");
  expect(panelHidden()).toEqual([true, false]);
  expect(localStorage.getItem("mdmark-tabs:os")).toBe("macOS");
  // 実行・検証: #macos-の注意 にする
  location.hash = "#macos-の注意";
  await vi.waitFor(() => {
    expect(tabNamed(el, 0, "macOS").getAttribute("aria-selected")).toBe("true");
  });
  await vi.waitFor(() => {
    expect(inScreen("macos-の注意")).toBe(true);
  });
  expect(panelHidden()).toEqual([false, true]);
  // 実行・検証: まとめた HTML の # の構造
  location.hash = "#/a.md#windows-の注意";
  await vi.waitFor(() => {
    expect(tabNamed(el, 0, "Windows").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
  expect(panelHidden()).toEqual([true, false]);
});

/** class `mdmark-code` の `code` を持つコードブロックの色分けの色を、要素の `--mdmark-*` の変数から解決した色にする */
function resolvedColor(el: HTMLElement, variable: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  el.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

// dockerfile・diff と別名のコードブロックを、言語ごとに 1 回読んだモジュールで色分けし、コードの行のマーカーと両立させる（正常系）
test("test_normal_when_dockerfile_and_diff_highlighted", async () => {
  // 準備
  const el = createElement();
  const config = { syntax: { url: highlightUrl("dockerfile-diff") } };
  const markdown = [
    "```dockerfile",
    "FROM node:20",
    "RUN npm ci",
    "```",
    "",
    "```docker",
    "FROM node:20",
    "```",
    "",
    "```patch",
    "-old",
    "+new",
    "```",
    "",
    "```diff",
    "-removed",
    "+added",
    "+marked # [!code ++]",
    "```",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown, config });
  // 検証: 色分けの要求は core と 2 つの言語の 3 件
  await vi.waitFor(() => {
    expect(coloredLanguages(el)).toHaveLength(4);
  });
  const base = `${location.origin}${highlightUrl("dockerfile-diff")}`;
  expect(highlightRequests("dockerfile-diff")).toEqual(
    [
      `${base}core.min.js`,
      `${base}languages/dockerfile.min.js`,
      `${base}languages/diff.min.js`,
    ].sort(),
  );
  const code = (language: string): HTMLElement =>
    find<HTMLElement>(el, `code.language-${language}`);
  // 検証: dockerfile と docker は命令を色分けする
  for (const language of ["dockerfile", "docker"]) {
    expect(code(language).querySelector(".hljs-keyword")).not.toBeNull();
  }
  // 検証: diff と patch は追加と削除を、差分のマーカーの色で色分けする
  const added = resolvedColor(el, "--mdmark-color-diff-add-sign");
  const deleted = resolvedColor(el, "--mdmark-color-diff-del-sign");
  for (const language of ["diff", "patch"]) {
    const addition = find<HTMLElement>(code(language), ".hljs-addition");
    const deletion = find<HTMLElement>(code(language), ".hljs-deletion");
    expect(getComputedStyle(addition).color).toBe(added);
    expect(getComputedStyle(deletion).color).toBe(deleted);
  }
  // 検証: コードの行のマーカーと両立する
  const marked = find<HTMLElement>(
    code("diff"),
    '.mdmark-code-line[data-kind="add"]',
  );
  expect(
    find(marked, ".mdmark-code-text").querySelector('span[class^="hljs-"]'),
  ).not.toBeNull();
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

// 見出しでセクションを、行のボタンで行の詳細を開閉し、閉じたセクションの中の見出しへの #ID で、囲むセクションと見出し自身のセクションを開く（正常系）
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
    '<!-- section: {"open": false} -->',
    "",
    "補足の段落",
    "",
    "### 注意",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "注意の段落",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    '<!-- row-detail: {"at": 2} -->',
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
      expect(bodyOf("注意").hasAttribute("hidden")).toBe(false);
    });
    expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("true");
    expect(toggleOf("注意").getAttribute("aria-expanded")).toBe("true");
    expect(
      isShown(
        [...el.querySelectorAll("p")].find(
          (p) => p.textContent === "注意の段落",
        ),
      ),
    ).toBe(true);
  } finally {
    history.replaceState(null, "", location.pathname);
  }
});

// 読者が開閉したセクションを update の後も同じ開閉で描き、マーカーを変えたセクションと新しいセクションはマーカーのとおりに描く（正常系）
test("test_normal_when_sections_kept_on_update", async () => {
  // 準備
  history.replaceState(null, "", "#注意");
  const el = createElement();
  const markdown = [
    "## 概要",
    "",
    "概要の段落",
    "",
    "## 補足",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "補足の段落",
    "",
    "### 注意",
    "",
    "注意の段落",
    "",
    "## 参考",
    "",
    "参考の段落",
    "",
  ].join("\n");
  const updated = [
    "## 概要",
    "",
    "書き換えた概要の段落",
    "",
    "## 補足",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "書き換えた補足の段落",
    "",
    "### 注意",
    "",
    "書き換えた注意の段落",
    "",
    "## 参考",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "書き換えた参考の段落",
    "",
    "## 付録",
    "",
    "付録の段落",
    "",
  ].join("\n");
  const toggleOf = (id: string) =>
    find<HTMLButtonElement>(el, `[aria-controls="section-${id}"]`);
  const bodyOf = (id: string) => find<HTMLElement>(el, `[id="section-${id}"]`);
  try {
    const handle = await mountTracked(el, { markdown });
    expect(bodyOf("補足").hasAttribute("hidden")).toBe(false);
    toggleOf("概要").click();
    toggleOf("補足").click();
    toggleOf("参考").click();
    toggleOf("参考").click();
    // 実行
    handle.update(updated);
    // 検証: 覚えた開閉で概要と補足を閉じ、URL が #注意 のままでも補足を開き直さない
    for (const id of ["概要", "補足"]) {
      expect(bodyOf(id).getAttribute("hidden")).toBe("until-found");
      expect(toggleOf(id).getAttribute("aria-expanded")).toBe("false");
    }
    // 検証: マーカーを追加した参考は閉じ、追加した付録は開く
    expect(bodyOf("参考").getAttribute("hidden")).toBe("until-found");
    expect(bodyOf("付録").hasAttribute("hidden")).toBe(false);
    // 実行・検証: もう一度 mount すると、概要は開き、補足は #注意 で開く
    handle.destroy();
    await mountTracked(el, { markdown: updated });
    expect(bodyOf("概要").hasAttribute("hidden")).toBe(false);
    expect(bodyOf("補足").hasAttribute("hidden")).toBe(false);
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
    '<!-- row-detail: {"at": 1} -->',
    "",
    "詳細の段落",
    "",
    "<!-- /row-detail -->",
    "",
    '<!-- table: {"kind": "data", "collapse": {"open": false}} -->',
    "",
    "| バージョン | 日付 |",
    "| --- | --- |",
    "| v1 | 2026-10-10 |",
    "",
    "<!-- /table -->",
    "",
    "> [!NOTE]-",
    "> 補足の本文",
    "",
    '<!-- tabs: {"collapse": {"open": false}} -->',
    "",
    "### uv",
    "",
    "uv で入れる",
    "",
    "### pip",
    "",
    "pip で入れる",
    "",
    "<!-- /tabs -->",
    "",
    '<!-- steps: {"collapse": {"open": false}} -->',
    "",
    "1. 一つ目",
    "2. 二つ目",
    "",
    "<!-- /steps -->",
    "",
    '<!-- tree: {"depth": 1} -->',
    "",
    "```tree",
    "app/",
    "└── src/",
    "    └── parts/",
    "        └── tree.ts",
    "```",
    "",
    wrapDirective("er", erText(shopErFolded())),
    "## 閉じたセクション",
    "",
    '<!-- section: {"open": false} -->',
    "",
    "セクションの中身",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const erOrders = find<HTMLElement>(
    el,
    '.mdmark-diagram-er-table[data-node="orders"]',
  );
  const erRows = [
    ...erOrders.querySelectorAll<HTMLElement>(".mdmark-diagram-er-column"),
  ];
  const erFold = find<HTMLElement>(erOrders, ".mdmark-diagram-er-fold");
  expect(erRows.filter((row) => isShown(row))).toHaveLength(2);
  const firstTabs = find<HTMLElement>(el, ".mdmark-tabs");
  const tabs = [...firstTabs.querySelectorAll<HTMLElement>('[role="tab"]')];
  tabs[1]?.click();
  const panels = [
    ...firstTabs.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
  ];
  const collapsibles = [
    ...el.querySelectorAll<HTMLDetailsElement>("details.mdmark-collapsible"),
  ];
  expect(collapsibles).toHaveLength(2);
  const folders = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-tree-toggle"),
  ].slice(1);
  expect(folders.map((f) => f.getAttribute("aria-expanded"))).toEqual([
    "false",
    "false",
  ]);
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
    [...firstTabs.querySelectorAll(".mdmark-tab-title")].map(
      (title) => title.textContent,
    ),
  ).toEqual(["一つ目", "二つ目"]);
  expect(section.hasAttribute("hidden")).toBe(false);
  expect(detail.hasAttribute("hidden")).toBe(false);
  for (const element of [...details, ...collapsibles]) {
    expect(element.open).toBe(true);
  }
  expect(folders.map((f) => f.getAttribute("aria-expanded"))).toEqual([
    "true",
    "true",
  ]);
  expect(isShown(find(el, ".mdmark-tree .mdmark-tree-list ul ul li"))).toBe(
    true,
  );
  expect(erRows.every((row) => isShown(row))).toBe(true);
  expect(erFold.getAttribute("aria-expanded")).toBe("true");
  // 印刷の媒体では、ツリーのコピーのボタンを出さない
  await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
  try {
    await vi.waitFor(() => {
      expect(isShown(find(el, ".mdmark-tree-copy"))).toBe(false);
    });
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
  // 実行・検証: 印刷の後
  sendPrintEvent("afterprint");
  expect(panels.map((panel) => panel.hasAttribute("hidden"))).toEqual([
    true,
    false,
  ]);
  expect(section.getAttribute("hidden")).toBe("until-found");
  expect(detail.hasAttribute("hidden")).toBe(true);
  for (const element of [...details, ...collapsibles]) {
    expect(element.open).toBe(false);
  }
  expect(folders.map((f) => f.getAttribute("aria-expanded"))).toEqual([
    "false",
    "false",
  ]);
  expect(erRows.filter((row) => isShown(row))).toHaveLength(2);
  expect(erFold.getAttribute("aria-expanded")).toBe("false");
});

// update の後も記法の操作が働き、destroy の後は document の受け取りが解除されている（正常系）
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
  schema: 2,
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

// 索引の用語と文書の別名に下線を付け、ポインター・フォーカス・Tab・Esc でツールチップを操作する（正常系）
test("test_normal_when_glossary", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "## セクション\n\n索引を読み込み、索引をもう一度書く。公開関数を使用する。\n";
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
  // Esc: ツールチップが消え、フォーカスが単語に戻る
  await userEvent.keyboard("{Escape}");
  expect(isOpen(apiTip)).toBe(false);
  expect(document.activeElement).toBe(term);
});

// 索引の用語のやめた言い方に波線のマーカーを付け、フォーカスで代わりの用語のツールチップを出し、Esc で閉じる（正常系）
test("test_normal_when_avoided_term", async () => {
  // 準備
  const el = createElement();
  const markdown =
    "## セクション\n\nワークスペースと作業場と作業場を記載する。行内のコードは `作業場` と記載する。\n";
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
  // フォーカスすると、単語の `aria-describedby` が指す role="tooltip" のツールチップが開く
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
    "話し合いの記録を配置するフォルダ",
  );
  // Esc: ツールチップが消え、フォーカスが単語に残る
  await userEvent.keyboard("{Escape}");
  expect(isOpen(tip)).toBe(false);
  expect(document.activeElement).toBe(avoided);
});

// 全角と半角・大文字と小文字だけが違う本文の単語と図の `{{単語}}` にも、用語の下線とツールチップを付ける（正常系）
test("test_normal_when_notation_differs", async () => {
  // 準備
  const el = createElement();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "cur", path: "cur.md", title: "描く文書" }],
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        aliases: ["WS"],
        meaning: "作業の配置場所",
        avoid: ["workplace"],
      },
      { id: "mcp", term: "MCP", meaning: "Model Context Protocol" },
    ],
  };
  const flow = [
    "{",
    '  "title": "受け取り",',
    '  "scope": "範囲",',
    '  "updated": "2026-10-23",',
    '  "width": 520,',
    '  "height": 160,',
    '  "nodes": [',
    '    { "id": "recv", "kind": "script", "x": 20, "y": 48, "w": 140, "h": 64, "name": "{{ｍｃｐ}}", "sub": "" }',
    "  ],",
    '  "wires": []',
    "}",
  ].join("\n");
  const markdown = [
    "## 一つ目",
    "",
    "ＷＳを開く。",
    "",
    "## 二つ目",
    "",
    "ws と WorkPlace を記載する。",
    "",
    wrapDirective("flow", flow),
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown, index, docId: "cur" });
  // 検証
  // 本文の下線の単語は、本文に記載したままの文字
  const body = [...el.querySelectorAll<HTMLElement>("p .mdmark-term")].filter(
    (term) => term.closest(".mdmark-diagram") === null,
  );
  expect(body.map((term) => term.textContent)).toEqual([
    "ＷＳ",
    "ws",
    "WorkPlace",
  ]);
  const [first, second, avoided] = body as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  for (const term of [first, second]) {
    expect(term.classList.contains("mdmark-term-avoided")).toBe(false);
    term.focus();
    const tip = document.getElementById(
      term.getAttribute("aria-describedby") ?? "",
    ) as HTMLElement;
    expect(isOpen(tip)).toBe(true);
    expect(find<HTMLElement>(tip, ".mdmark-term-tip-meaning").textContent).toBe(
      "作業の配置場所",
    );
  }
  // やめた言い方は波線のマーカーで、代わりの用語を出す
  expect(avoided.classList.contains("mdmark-term-avoided")).toBe(true);
  avoided.focus();
  const avoidedTip = document.getElementById(
    avoided.getAttribute("aria-describedby") ?? "",
  ) as HTMLElement;
  expect(
    find<HTMLElement>(avoidedTip, ".mdmark-term-tip-replacement").textContent,
  ).toBe("ワークスペース");
  // 図のノードの `{{単語}}` も用語の下線で、意味が出る
  const boxTerm = find<HTMLElement>(el, ".mdmark-diagram-node .mdmark-term");
  expect(boxTerm.textContent).toBe("ｍｃｐ");
  boxTerm.focus();
  expect(tipOfTerm(boxTerm).textContent).toContain("Model Context Protocol");
});

/** 単語の `aria-describedby` が指すツールチップ */
function tipOfTerm(term: Element): HTMLElement {
  return document.getElementById(
    term.getAttribute("aria-describedby") ?? "",
  ) as HTMLElement;
}

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

// ブラウザで配布物の render を呼んでも、エイリアスつきの出力が固定値と等しい（正常系）
test("test_normal_when_aliases_in_browser", async () => {
  // 準備
  const { render } = await loadBuilt();
  // 実行
  const html = render(ALIAS_MARKDOWN, { aliases: ALIASES });
  // 検証
  expect(stripSourceLine(html)).toBe(ALIAS_EXPECTED_HTML);
});

// 描く文書とほかの文書の用語集の表のやめた言い方にマーカーを付け、索引の用語を先に代わりの用語にする（正常系）
test("test_normal_when_glossary_avoid_column", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [
      { id: "glossary", path: "glossary.md", title: "用語集" },
      { id: "guide", path: "guide.md", title: "ガイド" },
    ],
    terms: [
      {
        id: "folder",
        term: "フォルダ",
        meaning: "ファイルの入れ物",
        avoid: ["作業場"],
      },
    ],
  };
  const glossaryMarkdown = [
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}, "avoid": {"column": "やめた言い方"}} -->',
    "",
    "| 用語 | 意味 | やめた言い方 |",
    "| --- | --- | --- |",
    "| ワークスペース | 作業の配置場所 | 作業場、ワーク場 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  const markdown = [
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}, "avoid": {"column": "やめた言い方"}} -->',
    "",
    "| 用語 | 意味 | やめた言い方 |",
    "| --- | --- | --- |",
    "| 下書き | 公開前の文書 | 草稿、ワーク場 |",
    "",
    "<!-- /glossary -->",
    "",
    "## セクション",
    "",
    "作業場、ワーク場、草稿を記載する。",
    "",
  ].join("\n");
  const references = collectReferences({
    index,
    documents: { "glossary.md": glossaryMarkdown, "guide.md": markdown },
  });
  const el = createElement();
  // 実行
  await mountTracked(el, { markdown, index, docId: "guide", references });
  // 検証
  // 段落の 3 つの単語が、どれもマーカーの要素になる（表の中は照合しない）
  const avoided = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-term.mdmark-term-avoided"),
  ];
  expect(avoided.map((term) => term.textContent)).toEqual([
    "作業場",
    "ワーク場",
    "草稿",
  ]);
  expect(el.querySelector("table .mdmark-term")).toBeNull();
  // フォーカスすると、「代わりの用語」の下に代わりの用語の単語と意味が出る
  const replacementOf = (term: HTMLElement): string[] => {
    const tip = document.getElementById(
      term.getAttribute("aria-describedby") ?? "",
    ) as HTMLElement;
    term.focus();
    expect(isOpen(tip)).toBe(true);
    expect(
      [...tip.querySelectorAll(".mdmark-term-tip-heading")].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(["代わりの用語"]);
    return [
      find<HTMLElement>(tip, ".mdmark-term-tip-replacement").textContent ?? "",
      find<HTMLElement>(tip, ".mdmark-term-tip-meaning").textContent ?? "",
    ];
  };
  // 索引の用語が、表の用語より先になる
  expect(replacementOf(avoided[0] as HTMLElement)).toEqual([
    "フォルダ",
    "ファイルの入れ物",
  ]);
  // 描く文書の表より、索引の `docs` で先に並ぶほかの文書の表が先になる
  expect(replacementOf(avoided[1] as HTMLElement)).toEqual([
    "ワークスペース",
    "作業の配置場所",
  ]);
  // 描く文書の表だけが持つやめた言い方は、描く文書の表の用語になる
  expect(replacementOf(avoided[2] as HTMLElement)).toEqual([
    "下書き",
    "公開前の文書",
  ]);
});

/** 参照の表: `arch` を `api`・`guide` が参照している */
const BACKLINKS_REFERENCES: MdmarkReferences = {
  backlinks: { arch: ["api", "guide"], api: ["arch"], guide: [] },
  glossary: [],
};

/** 索引: 3 つの文書 */
const BACKLINKS_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API" },
    { id: "guide", path: "使い方/guide.md", title: "使用方法" },
  ],
};

// 参照の表から、文書の末尾に関連文書の一覧を配置し、update の後ももう一度配置する（正常系）
test("test_normal_when_backlinks", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: "本文の段落です。\n",
    index: BACKLINKS_INDEX,
    docId: "arch",
    references: BACKLINKS_REFERENCES,
  });
  /** 末尾の一覧のタイトルとリンクを返却する */
  const readList = (): { title: string; links: Array<string | null> } => {
    const nav = find<HTMLElement>(el, "nav.mdmark-backlinks");
    const titleId = nav.getAttribute("aria-labelledby") ?? "";
    return {
      title: document.getElementById(titleId)?.textContent ?? "",
      links: [...nav.querySelectorAll("a")].map(
        (link) => `${link.textContent}:${link.getAttribute("href")}`,
      ),
    };
  };
  // 検証（描いた直後）
  expect(
    find(el, "button.mdmark-back-to-top").previousElementSibling?.matches(
      "nav.mdmark-backlinks",
    ),
  ).toBe(true);
  expect(el.lastElementChild?.matches("button.mdmark-back-to-top")).toBe(true);
  expect(readList()).toEqual({
    title: "関連文書",
    links: ["API:../api.md", "使用方法:../使い方/guide.md"],
  });
  // 実行
  handle.update("# 見出しだけ\n");
  // 検証（update の後）
  expect(el.querySelectorAll("nav.mdmark-backlinks")).toHaveLength(1);
  expect(readList().links).toEqual([
    "API:../api.md",
    "使用方法:../使い方/guide.md",
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

/** 幅 600px の描く先の要素に、幅 1100・高さ 560 のフロー図を描き、図と表示する枠を返却する */
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

/** スクリーンリーダー向けの名前でボタンを探す */
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

/** 倍率のボタン（スクリーンリーダー向けの名前が `倍率 {今の倍率}。全体が収まる倍率に戻す`） */
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
  // 描いた直後の倍率は収まる倍率で、倍率のボタンは 100% と出し、図の幅が表示する枠の幅を超えない
  await vi.waitFor(() => {
    expect(scaleOf(figure)).toBeLessThan(1);
  });
  const fit = scaleOf(figure);
  expect(zoomText(figure)).toBe("100%");
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
  // ノードの名前の上のドラッグは、図を動かさず、名前の文字を選ばせる
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

/** 図の `tip` を持つ線のラベルを全て返却する */
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
  // 検証: タイトル・図・凡例と閉じるボタンを持つモーダル
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
  // モーダルのために付けた document の keydown の受け取りが解除されている
  expect(removed.filter((type) => type === "keydown")).toHaveLength(
    added.filter((type) => type === "keydown").length,
  );
});

/** 索引: 用語 `意思決定モデル` を持つ */
const TERM_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [],
  terms: [
    {
      id: "dm",
      term: "意思決定モデル",
      meaning: "選択肢から選ぶだけの、速く安い判断用の AI",
    },
  ],
};

// 線・ノード・ノードの中の用語に、ポインターとフォーカスでツールチップを出し、Esc で削除する（正常系）
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
  expect(wireTip.textContent).toContain("件名・本文・送信者のアドレス");
  await userEvent.hover(wireTip);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(wireTip.hidden).toBe(false);
  // LLM のノードのマーカーにフォーカスすると、入力・処理・出力を出す。io を持たないノードにマーカーは無い
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
  // Esc でツールチップを削除し、フォーカスをマーカーに残す
  await userEvent.keyboard("{Escape}");
  expect(ioTip.hidden).toBe(true);
  expect(document.activeElement).toBe(info);
  // ノードの中の用語は、本文の用語と同じ破線の下線で、ポインターで意味を出す
  const term = find<HTMLElement>(figure, ".mdmark-diagram-node .mdmark-term");
  await userEvent.hover(term);
  expect(tipOf(term).hidden).toBe(false);
  expect(tipOf(term).textContent).toContain("選択肢から選ぶだけの");
  const outside = find<HTMLElement>(el, ":scope > p .mdmark-term");
  expect(getComputedStyle(term).textDecorationStyle).toBe("dashed");
  expect(getComputedStyle(outside).textDecorationStyle).toBe("dashed");
});

/** `pointerType` の種類を持つポインターの操作を発火する */
function firePointer(
  target: Element,
  type: string,
  pointerType: "touch" | "mouse",
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerType,
      bubbles: type === "pointerdown" || type === "pointerup",
    }),
  );
}

/** 持ち主をタッチでタップする（既にフォーカスを持つ持ち主では `focus` は発火しない） */
function tapOwner(owner: HTMLElement): void {
  for (const type of [
    "pointerenter",
    "pointerdown",
    "pointerup",
    "pointerleave",
  ]) {
    firePointer(owner, type, "touch");
  }
  owner.focus();
}

// タッチでは持ち主のタップで開閉を切り替え、ツールチップと持ち主の外の pointerdown で閉じる（正常系）
test("test_normal_when_diagram_tooltip_touch", async () => {
  // 準備
  await userEvent.unhover(document.body);
  const markdown = [
    wrapDirective("flow", INQUIRY_TEXT),
    wrapHtml(
      '<div data-hint="返信の種類を 1 つ選ぶ" style="display: inline-block; padding: 1rem 2rem">自動返信</div>',
    ),
    "図の外の段落。",
  ].join("\n\n");
  const el = await mountEmbedded(markdown);
  const info = buttonOf(el, "「分類」の入力・処理・出力");
  const ioTip = tipOf(info);
  const mark = find<HTMLElement>(el, ".mdmark-hint-block .mdmark-hint-mark");
  const hintTip = tipOf(mark);
  const outside = find<HTMLElement>(el, ":scope > p");
  // 実行・検証: 閉じたマーカーへのタップで開く
  tapOwner(info);
  expect(ioTip.hidden).toBe(false);
  // 開いているマーカーへのタップで閉じる
  tapOwner(info);
  expect(ioTip.hidden).toBe(true);
  // div のマーカーへのタップで data-hint の文を出す
  tapOwner(mark);
  expect(hintTip.hidden).toBe(false);
  expect(hintTip.textContent).toBe("返信の種類を 1 つ選ぶ");
  // mouse の pointerdown では切り替えない
  firePointer(mark, "pointerdown", "mouse");
  expect(hintTip.hidden).toBe(false);
  // ツールチップの中の pointerdown では閉じない
  firePointer(hintTip, "pointerdown", "touch");
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(hintTip.hidden).toBe(false);
  // 図の外の段落の pointerdown だけで閉じる
  firePointer(outside, "pointerdown", "touch");
  expect(hintTip.hidden).toBe(true);
});

/** 表示する枠の中の位置に、`pointerType` が `touch` のポインターのイベントを発火する */
function fireTouchAt(
  target: Element,
  type: string,
  point: { x: number; y: number },
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerType: "touch",
      pointerId: 7,
      button: 0,
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
    }),
  );
}

// タッチでは余白をタップするまで縦のドラッグを文書のスクロールにし、タップした後は図の外をタップするまで縦にも横にも図を動かす（正常系）
test("test_normal_when_diagram_touch_drag", async () => {
  // 準備: 画面の幅を 390px にし、表示する枠より広いフロー図を拡大して描く
  await withViewport(390, async () => {
    const el = createElement();
    await mountTracked(el, {
      markdown: `${wrapDirective("flow", INQUIRY_TEXT)}\n\n図の外の段落。`,
    });
    const box = find<HTMLElement>(el, ".mdmark-diagram-box");
    const viewport = find<HTMLElement>(el, ".mdmark-diagram-viewport");
    buttonOf(el, "拡大").click();
    buttonOf(el, "拡大").click();
    const outside = find<HTMLElement>(el, ":scope > p");
    const node = find<HTMLElement>(el, ".mdmark-diagram-node");
    const rect = viewport.getBoundingClientRect();
    // 余白: 表示する枠の中で、ノード・線・ボタンの上でない位置
    const blank = (() => {
      for (let y = rect.top + 8; y < rect.bottom - 8; y += 8) {
        for (let x = rect.left + 8; x < rect.right - 8; x += 8) {
          const hit = document.elementFromPoint(x, y);
          if (
            hit &&
            viewport.contains(hit) &&
            !hit.closest(
              ".mdmark-diagram-node, .mdmark-diagram-wire-hit, [data-tip-owner], button, a",
            )
          ) {
            return { x, y };
          }
        }
      }
      throw new Error("表示する枠に余白が無い");
    })();
    // 検証: 描いた直後は縦のドラッグが文書のスクロール
    expect(getComputedStyle(viewport).touchAction).toBe("pan-y");
    expect(box.hasAttribute("data-touch-active")).toBe(false);
    // ノードの上のタップでは操作中にしない
    const nodeRect = node.getBoundingClientRect();
    const onNode = { x: nodeRect.left + 4, y: nodeRect.top + 4 };
    fireTouchAt(node, "pointerdown", onNode);
    fireTouchAt(node, "pointerup", onNode);
    expect(box.hasAttribute("data-touch-active")).toBe(false);
    // mouse のクリックでは操作中にしない
    firePointer(viewport, "pointerdown", "mouse");
    firePointer(viewport, "pointerup", "mouse");
    expect(box.hasAttribute("data-touch-active")).toBe(false);
    // 余白のタップで操作中にする
    fireTouchAt(viewport, "pointerdown", blank);
    fireTouchAt(viewport, "pointerup", blank);
    expect(box.hasAttribute("data-touch-active")).toBe(true);
    expect(getComputedStyle(viewport).touchAction).toBe("none");
    const linkColor = getComputedStyle(box)
      .getPropertyValue("--mdmark-color-link")
      .trim();
    expect(linkColor).not.toBe("");
    expect(getComputedStyle(box).boxShadow).toContain("2px inset");
    // 操作中のドラッグで縦にも横にも動く（合成のイベントはブラウザのポインターを持たないため、捕まえる処理を差し替える）
    vi.spyOn(viewport, "setPointerCapture").mockImplementation(() => {});
    const before = { left: viewport.scrollLeft, top: viewport.scrollTop };
    fireTouchAt(viewport, "pointerdown", blank);
    fireTouchAt(viewport, "pointermove", { x: blank.x - 40, y: blank.y - 40 });
    fireTouchAt(viewport, "pointerup", { x: blank.x - 40, y: blank.y - 40 });
    expect(viewport.scrollLeft).toBeGreaterThan(before.left);
    expect(viewport.scrollTop).toBeGreaterThan(before.top);
    // 図の外の段落のタップで操作中を解く
    fireTouchAt(outside, "pointerdown", { x: 1, y: 1 });
    expect(box.hasAttribute("data-touch-active")).toBe(false);
  });
});

/** 操作できる部品を描いた要素と、その要素の部品の要素 */
async function mountParam(): Promise<{ el: HTMLElement; param: HTMLElement }> {
  const el = createElement();
  await mountTracked(el, { markdown: wrapDirective("param", STRENGTH_TEXT) });
  return { el, param: find<HTMLElement>(el, ".mdmark-param") };
}

/** スライダーのボタンを押して、今の値を写すボタンを返却する */
function copyButtonOf(param: ParentNode): HTMLButtonElement {
  const found = [...param.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("コピーする"),
  );
  if (!found) {
    throw new Error("今の値を写すボタンが無い");
  }
  return found;
}

// スライダーの値でグラフを再描画し、今の値を JSON でクリップボードへ写す（正常系）
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
  // 検証: 今の値とグラフが 8 で再描画され、タイトルと凡例は 1 つずつのまま
  expect(find(param, ".mdmark-param-knob output").textContent).toBe("8");
  expect(find(param, "svg[role=img]").getAttribute("aria-label")).toContain(
    "今の値（8）: 0・55・80・91・96・98",
  );
  expect(param.querySelectorAll(".mdmark-diagram-head")).toHaveLength(1);
  expect(param.querySelectorAll(".mdmark-diagram-legend")).toHaveLength(1);
  // 今の値を写すと、JSON を記載し、コピーしたことを出す
  copyButtonOf(param).click();
  await vi.waitFor(() => {
    expect(find(param, '[role="status"]').textContent).toContain(
      "クリップボードにコピーしました",
    );
  });
  expect(JSON.parse(written[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
});

// 書き込みを拒まれたら、記載できなかったことと選んで写せる JSON を出す（異常系）
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
      "クリップボードへ書き込めませんでした",
    );
  });
  const fallback = find<HTMLElement>(param, "pre");
  expect(fallback.hidden).toBe(false);
  expect(fallback.getAttribute("tabindex")).toBe("0");
  expect(JSON.parse(fallback.textContent ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
  // その後もスライダーを動かすとグラフが再描画される
  slider.value = "3";
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  expect(find(param, "svg[role=img]").getAttribute("aria-label")).toContain(
    "今の値（3）",
  );
});

// 設定の文言で今の値をコピーするボタンを描き、update で再描画しても同じ文言で描く（正常系）
test("test_normal_when_param_copy_label_configured", async () => {
  // 準備
  const part = wrapDirective("param", STRENGTH_TEXT);
  const markdown = `段落 A\n\n${part}`;
  const el = createElement();
  const el2 = createElement();
  // 実行
  const handle = await mountTracked(el, {
    markdown,
    config: { labels: { paramCopy: "コピー" } },
  });
  const named = page.getByRole("button", { name: "コピー", exact: true });
  const before = find<HTMLButtonElement>(el, "button.mdmark-param-copy");
  const beforeText = before.textContent;
  const beforeNamed = named.element();
  handle.update(`段落 B\n\n${part}`);
  await mountTracked(el2, {
    markdown,
    config: { labels: { paramCopy: "" } },
  });
  // 検証
  expect(beforeText).toBe("コピー");
  expect(beforeNamed).toBe(before);
  expect(paragraphTexts(el)).toContain("段落 B");
  const after = find<HTMLButtonElement>(el, "button.mdmark-param-copy");
  expect(after.textContent).toBe("コピー");
  expect(named.element()).toBe(after);
  expect(find(el2, "button.mdmark-param-copy").textContent).toBe(
    "今の値をコピーする",
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

// data-hint のブロックは右上のマーカー、行内は要素そのものでツールチップを開き、マーカーの外では開かない（正常系）
test("test_normal_when_embedded_hint", async () => {
  // 準備
  const body = [
    '<div data-hint="返信の種類を 1 つ選ぶ" style="display: inline-block; padding: 1rem 2rem">自動返信</div>',
    '<p>問い合わせは <span data-hint="本文を読み込んで種類を決める処理">分類</span> する。</p>',
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
  // 実行・検証: 文字の上では開かず、ポインターの形状は help でない
  await userEvent.hover(block);
  expect(tips().every((tip) => tip.hidden)).toBe(true);
  expect(getComputedStyle(block).cursor).not.toBe("help");
  // マーカーの上で、data-hint の文を出す
  await userEvent.hover(mark);
  expect(tipOf(mark).hidden).toBe(false);
  expect(tipOf(mark).textContent).toBe("返信の種類を 1 つ選ぶ");
  // 行内の要素: フォーカスで開き、Esc で消えてフォーカスが残る
  inline.focus();
  expect(tipOf(inline).hidden).toBe(false);
  expect(tipOf(inline).textContent).toBe("本文を読み込んで種類を決める処理");
  await userEvent.keyboard("{Escape}");
  expect(tipOf(inline).hidden).toBe(true);
  expect(document.activeElement).toBe(inline);
  expect(getComputedStyle(inline).cursor).not.toBe("help");
  // 図のノードの hint: 名前の上では開かず、右上のマーカーの上で hint の文を出す
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
  { id: "r3", at: "2026-10-20T02:05:00Z", label: "追加する", author: "田中" },
  {
    id: "r2",
    at: "2026-10-19T07:40:00Z",
    label: "件数を修正する",
    author: "鈴木",
  },
  { id: "r1", at: "2026-10-18T00:12:00Z", label: "初版", author: "佐藤" },
];

// リビジョンごとの本文: r2 から r3 で単語 `差分` を `変更` に書き換え、行を 1 つ追加し、別の行を 1 つ削除する
const DIFF_CONTENTS: Record<string, string> = {
  r1: "# ガイド\n\n初版の行\n終わり\n",
  r2: "# ガイド\n\n差分を色分けして読み込む。\n削除する行\n終わり\n",
  r3: "# ガイド\n\n変更を色分けして読み込む。\n終わり\n追加する行\n",
};

/** 呼ばれた引数を記録し、本文をすぐに返却する取り出し元を作る */
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

/** 取り出し元を指定して文書を描く。文書は `h1` で始まり、本文の段落を 1 つ持つ */
async function mountDiff(
  source: RecordingSource,
  markdown = "# ガイド\n\n本文の段落。\n",
): Promise<HTMLElement> {
  const el = createElement();
  await mountTracked(el, { markdown, docId: "guide", diffSource: source });
  return el;
}

/** 差分を開いている間に、隠した要素に付く属性 */
const DIFF_HIDDEN_ATTRIBUTE = "data-mdmark-diff-hidden";

/** `mountDiff` の文書の `h1` のセクションの中身 */
function diffSectionBody(el: HTMLElement): HTMLElement {
  return find<HTMLElement>(el, '[id="section-ガイド"]');
}

/** 「変更表示」のボタン */
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

// 取り出し元を指定して描き、「変更表示」で一番新しい 2 つのリビジョンの差分を出す（正常系）
test("test_normal_when_diff_opened", async () => {
  // 準備
  const source = createDiffSource();
  const el = await mountDiff(source);
  // 検証: mount の直後は取り出し元を呼ばず、h1 の後ろにボタンがある
  const toggle = diffToggle(el);
  expect(source.revisionsCalls).toEqual([]);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(find(el, "h1").nextElementSibling?.contains(toggle)).toBe(true);
  expect(
    toggle.compareDocumentPosition(diffSectionBody(el)) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(toggle.closest(".mdmark-content")).not.toBeNull();
  // 実行
  toggle.click();
  await waitForDiffLines(el);
  // 検証: h1 のセクションの中身と右側の目次が隠れ、見出しは残る
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(true);
  expect(
    find(el, "aside.mdmark-side-toc").hasAttribute(DIFF_HIDDEN_ATTRIBUTE),
  ).toBe(true);
  expect(find(el, "h1").hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(false);
  // 差分を開いたまま h1 の開閉を 2 回押しても、セクションの中身は隠れたまま
  const sectionToggle = find<HTMLButtonElement>(
    el,
    "h1 .mdmark-section-toggle",
  );
  sectionToggle.click();
  sectionToggle.click();
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(find(el, ".mdmark-diff").hasAttribute("hidden")).toBe(false);
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
  // もう一度押すと、差分の場所が隠れ、右側の目次が戻り、セクションは 2 回押した後の開いた状態で出る
  toggle.click();
  expect(find(el, ".mdmark-diff").hasAttribute("hidden")).toBe(true);
  expect(
    find(el, "aside.mdmark-side-toc").hasAttribute(DIFF_HIDDEN_ATTRIBUTE),
  ).toBe(false);
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(false);
  expect(sectionToggle.getAttribute("aria-expanded")).toBe("true");
  expect(diffSectionBody(el).hasAttribute("hidden")).toBe(false);
});

// 前のリビジョンをもう一度選ぶと、その 2 つの差分に再描画する（正常系）
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
  expect(el.textContent).not.toContain("削除する行");
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

// 長い文書の差分で、ミニマップの帯を押す・押したまま動かすと差分をスクロールする（正常系）
test("test_normal_when_scrolled_by_minimap", async () => {
  // 準備
  const lines = (changed: boolean) => {
    const out = ["# 長い文書", ""];
    for (let index = 0; index < 120; index += 1) {
      out.push(`変えない行 ${index}`);
      if (index === 10 && changed) {
        out.push("前半で追加した行");
      }
      if (index === 110 && changed) {
        out.push("後半で追加した行");
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
  // 検証: 帯は画面の右端に、画面の高さいっぱいで配置される
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
  // 実行: 後半のマーカーの位置を押す
  const lastMark = [
    ...band.querySelectorAll<HTMLElement>(".mdmark-diff-minimap-mark"),
  ].at(-1);
  const markRect = (lastMark as HTMLElement).getBoundingClientRect();
  await userEvent.click(band, {
    position: { x: 5, y: markRect.top - rect.top + markRect.height / 2 },
  });
  // 検証
  await vi.waitFor(() => {
    expect(visible("後半で追加した行")).toBe(true);
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
    expect(visible("前半で追加した行")).toBe(true);
  });
});

// 「変更表示」をもう一度押すと差分とミニマップを片付けて本文に戻す（正常系）
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
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(false);
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

// `revisions` が reject すると差分の場所を通知ブロックにし、本文は残す（異常系）
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
    "リビジョンの一覧を取り出せませんでした。時間をおいて、変更をもう一度開いてください。",
  );
  expect(source.contentCalls).toEqual([]);
  // もう一度押すと、本文が開く前と同じに出る
  diffToggle(el).click();
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(false);
  expect(consoleError).toHaveBeenCalledTimes(1);
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  expect(args.some((arg) => String(arg).includes("revisions"))).toBe(true);
  expect(args.some((arg) => String(arg).includes("guide"))).toBe(true);
});

// `content` が 1 つのリビジョンで reject すると、選ぶ欄を残して通知ブロックを出し、もう一度選べば差分を出す（異常系）
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
  // 実行: 本文を返却できない r1 を選ぶ
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
  // 実行: r2 をもう一度選ぶ
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

// `revisions` が構造に合わない値を返却すると、取り出せないときと同じ通知ブロックを出す（異常系）
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

// 取り出し元を指定して `docId` を指定しないと、何も描かずに TypeError を投げる（異常系）
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

// `diffMode: "open"` で、押される前から一番新しい 2 つのリビジョンの差分を出す（正常系）
test("test_normal_when_diff_opened_on_mount", async () => {
  // 準備
  const source = createDiffSource();
  const el = createElement();
  const markdown = "# ガイド\n\n本文の段落。\n";
  // 実行
  const handle = await mountTracked(el, {
    markdown,
    docId: "guide",
    diffSource: source,
    diffMode: "open",
  });
  await waitForDiffLines(el);
  // 検証: 押さないうちに取り出し元が呼ばれ、開いた状態で差分が出ている
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
  expect(diffToggle(el).getAttribute("aria-expanded")).toBe("true");
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(true);
  expect(
    find(el, "aside.mdmark-side-toc").hasAttribute(DIFF_HIDDEN_ATTRIBUTE),
  ).toBe(true);
  // 実行: 再描画する
  handle.update(markdown);
  // 検証: 開いたままで、取り出し元をもう 1 回呼ぶ
  await vi.waitFor(() => {
    expect(source.revisionsCalls).toEqual(["guide", "guide"]);
  });
  await waitForDiffLines(el);
  expect(diffToggle(el).getAttribute("aria-expanded")).toBe("true");
  // 実行: 押すと閉じる
  diffToggle(el).click();
  // 検証: 差分の場所が隠れ、本文と右側の目次が戻る
  expect(find(el, ".mdmark-diff").hasAttribute("hidden")).toBe(true);
  expect(diffSectionBody(el).hasAttribute(DIFF_HIDDEN_ATTRIBUTE)).toBe(false);
  expect(
    find(el, "aside.mdmark-side-toc").hasAttribute(DIFF_HIDDEN_ATTRIBUTE),
  ).toBe(false);
});

// 描いた文書のブロックを色分けして試すリビジョンの本文。`BLOCKS_BEFORE` から `BLOCKS_AFTER` で、段落 A の単語を 1 つ書き換え、表の後に段落 B を追加し、段落 C を削除し、段落 D を共通する単語の無い段落 E に入れ替える
const BLOCKS_BEFORE = [
  "# ガイド",
  "",
  "差分を確認する手順です。",
  "",
  "## 手順",
  "",
  "古い注意書きを削除します。",
  "",
  "配布物が届くまで数分かかります。",
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| 行一 | 1 |",
  "",
].join("\n");
const BLOCKS_AFTER = [
  "# ガイド",
  "",
  "変更を確認する手順です。",
  "",
  "## 手順",
  "",
  "表の列を増やす案をまとめました。",
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| 行一 | 1 |",
  "",
  "最後に確認する段落です。",
  "",
].join("\n");

/** 新しい順に `r2`・`r1` を返却し、リビジョンごとの本文を返却する取り出し元を作る */
function createBlocksSource(
  contents: Record<string, string>,
  override: Partial<RecordingSource> = {},
): RecordingSource {
  return createDiffSource(
    override,
    [DIFF_REVISIONS[1], DIFF_REVISIONS[2]].map((revision, index) => ({
      ...revision,
      id: `r${2 - index}`,
    })),
    contents,
  );
}

/** 追加の色で包まれたブロック */
function addedBlocks(el: HTMLElement): HTMLElement[] {
  return [
    ...el.querySelectorAll<HTMLElement>(
      'div.mdmark-diff-block[data-kind="add"]',
    ),
  ];
}

/** 要素の最初の段落の文字 */
function firstParagraph(el: Element): string {
  return el.querySelector("p")?.textContent ?? "";
}

/** 要素の中のスクリーンリーダーにだけ出す文字と、`aria-hidden` の記号 */
function marksOf(el: Element): { name: string; sign: string } {
  return {
    name: find(el, ".mdmark-visually-hidden").textContent ?? "",
    sign: find(el, '[aria-hidden="true"]').textContent ?? "",
  };
}

// `diffMode: "blocks"` で、後のリビジョンを描いた文書のブロックを追加と削除の色で塗り分ける（正常系）
test("test_normal_when_diff_blocks", async () => {
  // 準備
  const source = createBlocksSource({ r1: BLOCKS_BEFORE, r2: BLOCKS_AFTER });
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: BLOCKS_AFTER,
    docId: "guide",
    diffSource: source,
    diffMode: "blocks",
  });
  await vi.waitFor(() => {
    expect(addedBlocks(el).length).toBeGreaterThan(0);
  });
  // 検証: 「変更表示」と差分の場所とミニマップの帯が無い
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
  expect(el.querySelector(".mdmark-diff")).toBeNull();
  expect(minimapBands()).toHaveLength(0);
  expect(source.revisionsCalls).toEqual(["guide"]);
  // 検証: 段落 A・E・B が追加の色のブロックに包まれ、先頭にスクリーンリーダー向けの名前と記号を持つ
  const adds = addedBlocks(el);
  expect(adds.map(firstParagraph)).toEqual([
    "変更を確認する手順です。",
    "表の列を増やす案をまとめました。",
    "最後に確認する段落です。",
  ]);
  for (const add of adds) {
    expect(marksOf(add)).toEqual({ name: "追加:", sign: "+" });
  }
  // 検証: 段落 C が h2 のセクションの中身の先頭、段落 D が段落 E の直前に、削除の色のブロックで入る
  const dels = [
    ...el.querySelectorAll<HTMLElement>(
      'div.mdmark-diff-block[data-kind="del"]',
    ),
  ];
  expect(dels.map(firstParagraph)).toEqual([
    "古い注意書きを削除します。",
    "配布物が届くまで数分かかります。",
  ]);
  for (const del of dels) {
    expect(marksOf(del)).toEqual({ name: "削除:", sign: "−" });
    expect(del.querySelector("[data-source-line], [id]")).toBeNull();
  }
  expect(find(el, '[id="section-手順"]').firstElementChild).toBe(dels[0]);
  expect(adds[1]?.previousElementSibling).toBe(dels[1]);
  // 検証: 段落 A の削除のブロックは無い
  expect(dels.some((del) => del.textContent?.includes("差分を確認する"))).toBe(
    false,
  );
  // 検証: h1・h2・表・セクションの中身は包まれず、`data-source-line` は `opts.markdown` の行番号のまま
  for (const selector of [
    "h1",
    "h2",
    ".mdmark-table",
    ".mdmark-section-body",
  ]) {
    expect(find(el, selector).closest(".mdmark-diff-block")).toBeNull();
  }
  expect(
    adds.map((add) => find(add, "p").getAttribute("data-source-line")),
  ).toEqual(["2", "6", "12"]);
  // 検証: 背景色の計算値が差分の色の変数の値
  expect(getComputedStyle(adds[0] as HTMLElement).backgroundColor).toBe(
    resolvedColor(el, "--mdmark-color-diff-add-bg"),
  );
  expect(getComputedStyle(dels[0] as HTMLElement).backgroundColor).toBe(
    resolvedColor(el, "--mdmark-color-diff-del-bg"),
  );
});

// リストと表は項目・行の単位で色を当て、削除した項目は番号を使用しない（正常系）
test("test_normal_when_diff_blocks_list_and_table", async () => {
  // 準備: 番号付きリストの番号は全て 1 にして、行の違いを項目の文字だけにする
  const table = (cell: string) =>
    [
      "| 名前 | 値 |",
      "| --- | --- |",
      "| 行一 | 1 |",
      `| 行二 | ${cell} |`,
      "| 行三 | 3 |",
    ].join("\n");
  const before = `# ガイド\n\n${["甲", "乙", "丙", "丁"].map((item) => `1. ${item}`).join("\n")}\n\n${table("古い手順を削除する")}\n`;
  const after = `# ガイド\n\n${["甲", "新", "乙", "丁"].map((item) => `1. ${item}`).join("\n")}\n\n${table("表を増やす案")}\n`;
  const source = createBlocksSource({ r1: before, r2: after });
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: after,
    docId: "guide",
    diffSource: source,
    diffMode: "blocks",
  });
  await vi.waitFor(() => {
    expect(el.querySelector("li.mdmark-diff-block")).not.toBeNull();
  });
  // 検証: リストと表は包まれず、追加した項目と削除した項目が `li` に class と `data-kind` を持つ
  const list = find(el, "ol");
  const grid = find(el, "table");
  expect(list.closest(".mdmark-diff-block")).toBeNull();
  expect(grid.closest(".mdmark-diff-block")).toBeNull();
  const items = [...list.querySelectorAll(":scope > li")];
  expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
    null,
    "add",
    null,
    "del",
    null,
  ]);
  for (const item of [items[1], items[3]]) {
    expect(item?.classList.contains("mdmark-diff-block")).toBe(true);
  }
  // 検証: 削除した項目は `r1` の 2 番目の項目（乙）の後ろにあり、番号を出さない
  expect(items[2]?.textContent).toContain("乙");
  expect(items[3]?.textContent).toContain("丙");
  const deleted = getComputedStyle(items[3] as Element);
  expect(deleted.listStyleType).toBe("none");
  expect(deleted.counterIncrement).toBe("list-item 0");
  // 検証: 削除した項目の後ろの項目の番号の表示が `r2` の文書と同じ（4.）。番号は `::marker` を読み込めないため、
  // 番号を進める項目（`counter-increment` が `list-item 0` でない項目）を先頭から数えて求める
  expect(items[4]?.textContent).toContain("丁");
  const displayedNumber = items
    .slice(0, 5)
    .filter(
      (item) => getComputedStyle(item).counterIncrement !== "list-item 0",
    ).length;
  expect(displayedNumber).toBe(4);
  // 検証: 表の 2 行目は削除の行と追加の行がこの順で、1 つ目のセルの先頭に名前と記号を持つ
  const rows = [...grid.querySelectorAll("tbody > tr")];
  expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual([
    null,
    "del",
    "add",
    null,
  ]);
  expect(marksOf(find(rows[1] as Element, "td"))).toEqual({
    name: "削除:",
    sign: "−",
  });
  expect(marksOf(find(rows[2] as Element, "td"))).toEqual({
    name: "追加:",
    sign: "+",
  });
  // 検証: 変えていない項目と行は色を適用しない
  for (const unchanged of [items[0], items[2], items[4], rows[0], rows[3]]) {
    expect(unchanged?.classList.contains("mdmark-diff-block")).toBe(false);
  }
});

// `blocks` で `update` すると取り出し元をもう一度呼び、待つ間にもう一度差し替えたら古い結果を描かない（正常系）
test("test_normal_when_diff_blocks_updated", async () => {
  // 準備: `update` の回数で回答を変える取り出し元
  let updates = 0;
  const paragraphF = "\n段落 F を追加した。\n";
  const paragraphG = "\n段落 G を追加した。\n";
  const source = createBlocksSource(
    { r1: BLOCKS_BEFORE, r2: BLOCKS_AFTER },
    {
      content: async ({ revisionId }) => {
        if (revisionId === "r1") {
          return BLOCKS_BEFORE;
        }
        if (updates === 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return `${BLOCKS_AFTER}${paragraphF}`;
        }
        return updates === 2
          ? `${BLOCKS_AFTER}${paragraphF}${paragraphG}`
          : BLOCKS_AFTER;
      },
    },
  );
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: BLOCKS_AFTER,
    docId: "guide",
    diffSource: source,
    diffMode: "blocks",
  });
  await vi.waitFor(() => {
    expect(addedBlocks(el)).toHaveLength(3);
  });
  const kinds = (): (string | null)[] =>
    [...el.querySelectorAll(".mdmark-diff-block")].map((block) =>
      block.getAttribute("data-kind"),
    );
  const initial = kinds();
  // 実行: 1 回目の `update` の結果が届く前に、もう一度 `update` する
  updates = 1;
  handle.update(`${BLOCKS_AFTER}${paragraphF}`);
  updates = 2;
  handle.update(`${BLOCKS_AFTER}${paragraphF}${paragraphG}`);
  // 検証: 2 回目の結果で、段落 F と G が追加のブロックで出る
  await vi.waitFor(() => {
    expect(addedBlocks(el).map(firstParagraph)).toEqual([
      "変更を確認する手順です。",
      "表の列を増やす案をまとめました。",
      "最後に確認する段落です。",
      "段落 F を追加した。",
      "段落 G を追加した。",
    ]);
  });
  // 検証: 遅れて届いた 1 回目の結果で再描画されない
  await new Promise((resolve) => setTimeout(resolve, 800));
  expect(addedBlocks(el).map(firstParagraph).slice(-2)).toEqual([
    "段落 F を追加した。",
    "段落 G を追加した。",
  ]);
  // 検証: 最初に色を適用したブロックが同じ `data-kind` のまま出ている
  expect(kinds().slice(0, initial.length)).toEqual(initial);
});

// `blocks` で `content` が reject すると、色を適用しない本文を残して先頭に通知ブロックを配置する（異常系）
test("test_error_when_diff_blocks_content_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("network");
  const source = createBlocksSource(
    {},
    {
      content: async () => {
        throw error;
      },
    },
  );
  const el = createElement();
  // 実行: 例外を投げない
  await mountTracked(el, {
    markdown: BLOCKS_AFTER,
    docId: "guide",
    diffSource: source,
    diffMode: "blocks",
  });
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-notice")).not.toBeNull();
  });
  // 検証: 本文は色を当てずに描いたまま、先頭に通知ブロックがある
  expect(el.querySelector(".mdmark-diff-block")).toBeNull();
  expect(find(el, "h1").textContent).toContain("ガイド");
  const notice = find(el, ".mdmark-notice");
  expect(notice.getAttribute("role")).toBe("status");
  expect(find(notice, ".mdmark-notice-title").textContent).toBe(
    "変更を表示できません",
  );
  expect(find(notice, "p").textContent).toBe(
    "比べるリビジョンの本文を取り出せませんでした。色分けせずに表示しています。",
  );
  expect(find(el, ".mdmark-content").firstElementChild).toBe(notice);
  // 検証: `console.error` が取り出せなかった本文ごとに 1 回（前と後の 2 回）呼ばれる
  expect(consoleError).toHaveBeenCalledTimes(2);
  // 検証: それぞれの引数に `content`・`guide`・そのリビジョンの `id`・元のエラーを含む
  for (const [call, revisionId] of consoleError.mock.calls.map(
    (args, index) => [args, ["r1", "r2"][index]] as const,
  )) {
    for (const word of ["content", "guide", revisionId]) {
      expect(call.some((arg) => String(arg).includes(word))).toBe(true);
    }
    expect(call).toContain(error);
  }
});

// 知らない `diffMode` は例外を投げず `button` として描く（異常系）
test("test_error_when_unknown_diff_mode", async () => {
  // 準備
  const source = createDiffSource();
  const el = createElement();
  // 実行・検証: 例外を投げない
  await expect(
    mountTracked(el, {
      markdown: "# ガイド\n\n本文の段落。\n",
      docId: "guide",
      diffSource: source,
      diffMode: "inline" as never,
    }),
  ).resolves.toBeDefined();
  // 検証: 「変更表示」が閉じた状態で、押すまで取り出し元を呼ばない
  expect(diffToggle(el).getAttribute("aria-expanded")).toBe("false");
  expect(source.revisionsCalls).toEqual([]);
});

/** `### {タイトル}` で区切ったタブの範囲の Markdown。`group` が無ければ組を持たない */
function tabsRange(titles: string[], group?: string): string {
  return [
    group === undefined
      ? "<!-- tabs -->"
      : `<!-- tabs: {"group": "${group}"} -->`,
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

// 同じ group のタブ群を同じタブ名へ統一し、選んだタブ名を localStorage に残す（正常系）
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
  // 実行: 同じ本文で再描画する
  handle.update(markdown);
  // 検証
  expect(selectedTab(el, 0)).toBe("Windows");
  expect(localStorage.getItem("mdmark-tabs:lang")).toBe("Go");
});

// localStorage を取り出せなくても、同じ組のタブを統一して切り替える（正常系）
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

/** タイトル・状態・担当の列と 5 行を持つ表。状態は上から未着手・進行中・未着手・完了・進行中、担当は佐藤・鈴木・佐藤・田中・鈴木 */
const VIEW_TABLE = [
  "| タイトル | 状態 | 担当 |",
  "| --- | --- | --- |",
  "| 配色の変数を洗い出す | 未着手 | 佐藤 |",
  "| 余白の変数を決める | 進行中 | 鈴木 |",
  "| 印刷の見え方を確認する | 未着手 | 佐藤 |",
  "| 配色を修正する | 完了 | 田中 |",
  "| 表を絞り込む | 進行中 | 鈴木 |",
].join("\n");

/** ビューのマーカーの引数を指定して、表をマーカーで囲んだ文書にする */
function viewMarkdown(args: string): string {
  return `<!-- view: ${args} -->\n\n${VIEW_TABLE}\n\n<!-- /view -->\n`;
}

/** コメントを付ける段落の文字 */
const COMMENT_TEXT = "描いた文書の外観はテーマの変数で変える。";

/** コメントの本文 */
const COMMENT_BODY = "ここは <b>太字</b> にしたい";

/** `テーマの変数` に付いたコメント */
const THEME_COMMENT: MdmarkComment = {
  id: "c1",
  quote: "テーマの変数",
  prefix: "描いた文書の外観は",
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

/** ボードの列の見出しの値を、並びの順に返却する */
function viewColumnNames(el: Element): string[] {
  return [...el.querySelectorAll(".mdmark-view-column-name")].map(
    (name) => name.textContent ?? "",
  );
}

/** ビューの切り替えのボタンを返却する */
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

/** 要素の中の最初の文字のセクションの、始まりと終わりの位置の間を選ぶ */
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

/** 隠れていないコメントのボタンを返却する（無ければ `undefined`） */
function visibleCommentButton(): HTMLElement | undefined {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
}

/** 少し待つ（出ないことを確認する前に、選びの受け取りが動き終わるのを待つ） */
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

/** 読み込みと保存の関数。`save` は受けた下書きに `id: "c1"` を追加して返却する */
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

// ビューのマーカーで囲んだ表をボード表示で描き、表形式と切り替える（正常系）
test("test_normal_when_view_drawn", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
  });
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
    markdown: viewMarkdown(
      '{"board": {"group": {"column": "状態"}}, "initial": "table", "columns": {"担当": {"filter": {}}}}',
    ),
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

// 表に無い group の列と知らない絞り込みの種類に記載の警告を出し、表形式で描く（正常系）
test("test_normal_when_view_syntax_invalid", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: viewMarkdown(
      '{"board": {"group": {"column": "優先度"}}, "columns": {"担当": {"filter": {"type": "range"}}}}',
    ),
  });
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-view-switch")).not.toBeNull(),
  );
  const view = find(el, ".mdmark-view");
  const warnings = [...el.querySelectorAll(".mdmark-syntax-warning")];
  expect(warnings.length).toBeGreaterThanOrEqual(1);
  const text = warnings.map((warning) => warning.textContent).join(" ");
  expect(text).toContain("優先度");
  expect(text).toContain("range");
  expect(text).toContain("columns.担当.filter.type");
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

// views がオフのときは、マーカーの範囲の表を普通の表で描き、ビューの部品のモジュールを読み込まない（正常系）
test("test_normal_when_views_disabled", async () => {
  // 準備
  const fresh = await loadNamedBuilt("views-disabled");
  const el = createElement();
  // 実行
  const handle = fresh.mount(el, {
    markdown: viewMarkdown('{"board": {"group": {"column": "状態"}}}'),
    config: { features: { views: false } },
  });
  handles.push(handle);
  await settle();
  // 検証
  expect(el.querySelector(".mdmark-view")).toBeNull();
  expect(el.querySelector(".mdmark-view-switch")).toBeNull();
  expect(el.querySelector(".mdmark-view-board")).toBeNull();
  expect(
    el.querySelectorAll("table tbody tr:not(.mdmark-fold-detail)"),
  ).toHaveLength(5);
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  expect(
    countRequests(`/views-disabled${inject("builtRoot")}/dist/view.js`),
  ).toBe(0);
});

// 選んだ文字にコメントを記載して保存し、マーカーと吹き出しで読み込む（正常系）
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
  selectText(paragraph, 9, 15);
  // 検証
  await vi.waitFor(() => expect(visibleCommentButton()).toBeDefined());
  // 実行
  window.getSelection()?.removeAllRanges();
  // 検証
  await vi.waitFor(() => expect(visibleCommentButton()).toBeUndefined());
  // 実行
  selectText(paragraph, 9, 15);
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
      prefix: "描いた文書の外観は",
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

// 読み込んだコメントにマーカーを付け、update の後も前後の文字でもう一度付き、見つからないものは末尾の一覧に出す（正常系）
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
  handle.update("描いた文書の外観は CSS 変数 で変える。\n");
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector(".mdmark-comment-orphans")).not.toBeNull(),
  );
  expect(el.querySelector("mark")).toBeNull();
  const orphans = find(el, ".mdmark-comment-orphans");
  expect(find(el, ".mdmark-content").lastElementChild).toBe(orphans);
  expect(orphans.textContent).toContain("テーマの変数");
  expect(orphans.textContent).toContain("読み込んだコメント");
});

// comments が既定のオフのときは、読み込みと保存の関数を指定しても呼ばず、ボタンを出さない（正常系）
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

// save が reject すると、入力欄と本文を残して通知を出し、マーカーを付けない（異常系）
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

// comments がオンで読み込みと保存の関数を指定しないと、ボタンを出さず、console.error に 1 回だけ出す（異常系）
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

// 読み込みと保存の関数を指定して docId を指定しないと、何も描かずに TypeError を投げる（異常系）
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

// 部品のモジュールを読み込めないと、ビューのマーカーの場所は表のまま残し、コメントのボタンを出さず、console.error に出す（異常系）
test("test_error_when_part_module_unavailable", async () => {
  // 準備
  const blocked = await loadNamedBuilt("blocked");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const store = createCommentStore();
  const markdown = `${viewMarkdown('{"board": {"group": {"column": "状態"}}}')}\n${COMMENT_TEXT}\n`;
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
  expect(
    el.querySelectorAll("table tbody tr:not(.mdmark-fold-detail)"),
  ).toHaveLength(5);
  expect(el.querySelector(".mdmark-view-switch")).toBeNull();
  expect(el.querySelector(".mdmark-view-board")).toBeNull();
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  // view と comments の読み込みは並んで進み、呼び出しの順番は決まっていない
  expect(spy.mock.calls.map((call) => call.map(String).join(" "))).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/view .*\/blocked\/.*\/view\.js/),
      expect.stringMatching(/comments .*\/blocked\/.*\/comments\.js/),
    ]),
  );
  // 元のエラーを最後の引数に含む
  for (const call of spy.mock.calls) {
    expect(call.at(-1)).toBeInstanceOf(Error);
  }
  expect(
    find(el, ":scope > .mdmark-content > p:last-of-type").textContent,
  ).toBe(COMMENT_TEXT);
  // 実行
  selectText(find(el, ":scope > .mdmark-content > p:last-of-type"), 10, 16);
  await settle();
  // 検証
  expect(visibleCommentButton()).toBeUndefined();
  expect(store.load).not.toHaveBeenCalled();
});

/** ツールチップの配置する側を確認する索引: 用語 `索引` */
const PLACEMENT_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [{ id: "arch", path: "設計/arch.md", title: "アーキテクチャ" }],
  terms: [
    {
      id: "index",
      term: "索引",
      meaning: "文書と用語を並べた YAML のファイル",
    },
  ],
};

/** ツールチップの配置する側を確認する文書: 1 行目の用語、2 つ目のセクションの用語・`tip` を持つ線のフロー図・`data-hint` を持つ `div`。`tail` を指定すると、末尾に用語を追加する */
function placementMarkdown(options: { tail: boolean }): string {
  const filler = Array.from({ length: 80 }, (_, i) => `詰め物の段落 ${i}\n`);
  return [
    "索引を 1 行目に配置する。",
    "",
    "## セクション",
    "",
    "索引を 2 つ目のセクションに配置する。",
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

/** 持ち主を画面の中ほど（`block` が `end` なら下端）へ送信し、ポインターを乗せて、持ち主とツールチップの枠を返却する */
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

/** 文書の持ち主: 用語の並びと、2 つ目のセクションの線のラベル・ヒントのマーカー */
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

// 用語のツールチップを単語の上に、線・ヒントのツールチップを持ち主の下に出し、上に収まらない単語だけ下に出す（正常系（ツールチップを上に出す））
test("test_normal_when_tooltip_above", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: placementMarkdown({ tail: false }),
    index: PLACEMENT_INDEX,
    docId: "arch",
    // 狭い幅の右側の目次の帯が 1 行目の用語を下げないよう、右側の目次を配置しない
    config: { features: { "side-toc": false } },
  });
  const { terms, label, mark } = placementOwners(el);
  const [firstTerm, sectionTerm] = terms as [HTMLElement, HTMLElement];
  // 実行・検証: 2 つ目のセクションの用語は、単語の上に出る
  const section = await hoverAndMeasure(sectionTerm, "center");
  expect(section.tip.bottom).toBeLessThanOrEqual(section.owner.top);
  // 実行・検証: 線のラベル・ヒントのマーカーは、tooltips.diagramPlacement の既定の bottom で持ち主の下に出る
  for (const owner of [label, mark]) {
    const rects = await hoverAndMeasure(owner, "center");
    expect(rects.tip.top).toBeGreaterThanOrEqual(rects.owner.bottom);
  }
  // 実行・検証: 1 行目の用語は上に収まらないので、単語の下に出る
  window.scrollTo(0, 0);
  await userEvent.hover(firstTerm);
  const termRect = firstTerm.getBoundingClientRect();
  const tipRect = tooltipOf(firstTerm).getBoundingClientRect();
  expect(tipRect.height).toBeGreaterThan(0);
  expect(tipRect.top).toBeGreaterThanOrEqual(termRect.bottom);
  expect(tipRect.top).toBeGreaterThanOrEqual(0);
});

// tooltips.placement が bottom のときは持ち主の下に出し、下に収まらない単語だけ上に出す。知らない値は top として扱う（正常系（ツールチップを下に出す設定））
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
  // 実行・検証: 2 つ目のセクションの用語・線のラベル・ヒントのマーカーは、持ち主の下に出る
  for (const owner of [sectionTerm, label, mark]) {
    const rects = await hoverAndMeasure(owner, "center");
    expect(rects.tip.top).toBeGreaterThanOrEqual(rects.owner.bottom);
  }
  // 実行・検証: 画面の下端にある末尾の用語は下に収まらないので、単語の上に出る
  const tail = await hoverAndMeasure(tailTerm, "end");
  expect(tail.tip.bottom).toBeLessThanOrEqual(tail.owner.top);
  expect(tail.tip.bottom).toBeLessThanOrEqual(window.innerHeight);
  // 実行・検証: 知らない値は top として扱い、単語の上に出る
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
  return ["h1", "p", ".mdmark-table", ".mdmark-code"].map((selector) => {
    const block = find(el, selector);
    const rect = block.getBoundingClientRect();
    return {
      top: rect.top,
      height: rect.height,
      color: getComputedStyle(block).color,
    };
  });
}

// 描いたブロックと差し替えた本文のブロックが、元の行番号を持ち、外観は変わらない（正常系）
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
    '<!-- code: {"lines": {}} -->',
    "```ts",
    "const a = 1;",
    "```",
    "",
  ].join("\n");
  const sourceLines = () =>
    ["h1", "p", ".mdmark-table", ".mdmark-code"].map((selector) =>
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

/** 描く先を包む要素（`wrap`）と描く先（`el`）を配置し、`body` の class と OS の配色を先に決めて見本の Markdown を描く */
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

// OS の配色がライトでも、祖先の `vscode-dark` でダークの値を当て、class を削除すると戻す（正常系）
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

/** リンクを持つ段落の見本 */
const THEME_MARKDOWN = "[リンク](https://example.com/) を含む段落。\n";

/** theme-slate の明るい配色とダークの配色の `--mdmark-color-bg` の値 */
const SLATE_LIGHT_BG = "#f8fafc";
const SLATE_DARK_BG = "#0f172a";

/** OS の配色を切り替える */
async function emulateColorScheme(scheme: "light" | "dark"): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
}

// `opts.config.colorTheme` で選んだテーマの明るい配色で描き、利用側の CSS が勝ち、destroy でテーマを解除する（正常系）
test("test_normal_when_color_theme_selected", async () => {
  // 準備
  const el = createElement();
  const style = document.createElement("style");
  style.textContent = ":root { --mdmark-color-link: rgb(1, 2, 3) }";
  document.head.append(style);
  addedStyles.push(style);
  await emulateColorScheme("light");
  try {
    // 実行
    const handle = await mountTracked(el, {
      markdown: THEME_MARKDOWN,
      config: { colorTheme: "theme-slate" },
    });
    // 検証
    expect(readBackground(el)).toBe(SLATE_LIGHT_BG);
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(248, 250, 252)");
    expect(getComputedStyle(find(el, "a")).color).toBe("rgb(1, 2, 3)");
    // 実行: destroy でテーマを解除する
    handle.destroy();
    // 検証
    expect(readBackground(document.documentElement)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

// 選んだテーマの中で、OS のダークでは暗い配色、親の `mdmark-theme-light` では明るい配色、印刷では明るい配色を使用する（正常系）
test("test_normal_when_color_theme_dark", async () => {
  // 準備
  const wrap = createElement();
  const el = document.createElement("div");
  wrap.append(el);
  await emulateColorScheme("dark");
  try {
    // 実行・検証: 描いた直後は暗い配色
    await mountTracked(el, {
      markdown: THEME_MARKDOWN,
      config: { colorTheme: "theme-slate" },
    });
    expect(readBackground(el)).toBe(SLATE_DARK_BG);
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(15, 23, 42)");
    // 実行・検証: 親に mdmark-theme-light を付けると明るい配色
    wrap.className = "mdmark-theme-light";
    expect(readBackground(el)).toBe(SLATE_LIGHT_BG);
    // 実行・検証: 親の class を削除して印刷のメディアにすると、OS がダークでも明るい配色
    wrap.className = "";
    expect(readBackground(el)).toBe(SLATE_DARK_BG);
    await cdp().send("Emulation.setEmulatedMedia", {
      media: "print",
      features: [{ name: "prefers-color-scheme", value: "dark" }],
    });
    expect(readBackground(el)).toBe(SLATE_LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

// 知らないテーマの名前は無視し、例外を出さずに dev-swiss で描く（正常系）
test("test_normal_when_color_theme_unknown", async () => {
  // 準備
  const el = createElement();
  const { mount } = await loadBuilt();
  await emulateColorScheme("light");
  try {
    // 実行
    let handle: MountHandle | undefined;
    expect(() => {
      handle = mount(el, {
        markdown: THEME_MARKDOWN,
        config: { colorTheme: "sepia" },
      });
    }).not.toThrow();
    // 検証
    if (handle) {
      handles.push(handle);
    }
    expect(find(el, "a").textContent).toBe("リンク");
    expect(readBackground(el)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

/** 周りの面の色（地を透明にした利用側が `--mdmark-color-bg-opaque` に指定する色） */
const SURROUNDING_BG = "rgb(240, 240, 240)";

/** 本文の幅に収まる 3 列 3 行の表を持つ Markdown */
const SMALL_TABLE =
  "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n| 7 | 8 | 9 |\n";

/** 層の外の CSS を追加し、後始末のために記録する */
function addOuterStyle(text: string): void {
  const style = document.createElement("style");
  style.textContent = text;
  document.head.append(style);
  addedStyles.push(style);
}

/** 要素の範囲を撮った PNG の、要素の左上からの CSS の px の位置の画素の色 */
async function pixelAt(
  element: HTMLElement,
  x: number,
  y: number,
): Promise<string> {
  const png = await page.screenshot({ element, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const scale = image.width / element.getBoundingClientRect().width;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0);
  const data = context?.getImageData(
    Math.round(x * scale),
    Math.round(y * scale),
    1,
    1,
  ).data;
  return `rgb(${data?.[0]}, ${data?.[1]}, ${data?.[2]})`;
}

/** 線のラベルにポインターを乗せて開いた、図のツールチップ */
async function openDiagramTip(figure: Element): Promise<HTMLElement> {
  const label = tipLabels(figure)[0];
  if (!label) {
    throw new Error("tip を持つ線のラベルが無い");
  }
  await userEvent.hover(label);
  const tip = tipOf(label);
  expect(tip.hidden).toBe(false);
  return tip;
}

// 地を透明にし `--mdmark-color-bg-opaque` に周りの面の色を指定すると、本文の地は透け、表の覆い・図のツールチップ・全画面の図はその色で描く（正常系）
test("test_normal_when_bg_transparent_with_opaque", async () => {
  // 準備
  document.body.style.backgroundColor = SURROUNDING_BG;
  addOuterStyle(
    `.mdmark { --mdmark-color-bg: transparent; --mdmark-color-bg-opaque: ${SURROUNDING_BG} }`,
  );
  await emulateColorScheme("light");
  try {
    // 実行
    const { el, figure } = await mountFlow({ extra: `\n${SMALL_TABLE}` });
    // 検証: 本文の地は透ける
    expect(getComputedStyle(el).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    // 検証: 表の本文の行の高さの真ん中で、左右の枠の内側は周りの面の色（端の影が出ない）
    const table = find<HTMLElement>(el, "table");
    const box = table.getBoundingClientRect();
    const row = find<HTMLElement>(table, "tbody tr").getBoundingClientRect();
    const middle = row.top - box.top + row.height / 2;
    expect(await pixelAt(table, 2, middle)).toBe(SURROUNDING_BG);
    // 本文の幅に広げた表の右端は画面の右端を越えうるため、画面の中の右端で確認する
    const right =
      Math.min(box.right, document.documentElement.clientWidth) - box.left;
    expect(await pixelAt(table, right - 3, middle)).toBe(SURROUNDING_BG);
    // 実行・検証: 図のツールチップ
    const tip = await openDiagramTip(figure);
    expect(getComputedStyle(tip).backgroundColor).toBe(SURROUNDING_BG);
    await userEvent.unhover(document.body);
    // 実行・検証: 全画面の図
    buttonOf(figure, "全画面で開く").click();
    const dialog = find<HTMLDialogElement>(el, "dialog[open]");
    expect(getComputedStyle(dialog).backgroundColor).toBe(SURROUNDING_BG);
    dialog.close();
  } finally {
    document.body.style.backgroundColor = "";
    await resetThemed();
  }
});

// `--mdmark-color-bg` だけを不透明な色で上書きすると、`--mdmark-color-bg-opaque` もその色になり、浮く部品の色が変わらない（正常系）
test("test_normal_when_bg_overridden", async () => {
  // 準備
  addOuterStyle(".mdmark { --mdmark-color-bg: rgb(34, 34, 34) }");
  await emulateColorScheme("light");
  try {
    // 実行
    const { el, figure } = await mountFlow({ extra: `\n${SMALL_TABLE}` });
    const tip = await openDiagramTip(figure);
    // 検証
    expect(getComputedStyle(el).backgroundColor).toBe("rgb(34, 34, 34)");
    expect(
      getComputedStyle(el).getPropertyValue("--mdmark-color-bg-opaque").trim(),
    ).toBe("rgb(34, 34, 34)");
    expect(getComputedStyle(tip).backgroundColor).toBe("rgb(34, 34, 34)");
    await userEvent.unhover(document.body);
  } finally {
    await resetThemed();
  }
});

// body の直下に配置するコメントの入力欄は、`--mdmark-color-bg-opaque` を `:root` と配色の class から継承し、透けない（正常系）
test("test_normal_when_outside_mdmark", async () => {
  // 準備
  const el = createElement();
  const store = createCommentStore();
  await emulateColorScheme("light");
  try {
    await mountTracked(el, {
      markdown: `${COMMENT_TEXT}\n`,
      config: { features: { comments: true } },
      docId: "guide",
      commentStore: store,
    });
    await vi.waitFor(() => expect(store.load).toHaveBeenCalledTimes(1));
    // 実行: 段落の文字を選び「コメント」を押す
    selectText(find(el, "p"), 10, 16);
    await vi.waitFor(() => expect(visibleCommentButton()).toBeDefined());
    visibleCommentButton()?.click();
    const popover = find<HTMLElement>(document.body, ".mdmark-comment-popover");
    // 検証: body の直下にあり、明るい配色の地
    expect(el.contains(popover)).toBe(false);
    expect(getComputedStyle(popover).backgroundColor).toBe(
      "rgb(255, 255, 255)",
    );
    // 実行・検証: body に mdmark-theme-dark を付けるとダークの地
    document.body.classList.add("mdmark-theme-dark");
    expect(getComputedStyle(popover).backgroundColor).toBe("rgb(19, 19, 22)");
    await userEvent.keyboard("{Escape}");
  } finally {
    await resetThemed();
  }
});

// 色分けの対象のコードブロックがあるときだけ、本体と使用する言語のモジュールを読み込んで、行に分けた構造と分けない構造の両方を色分けする（正常系）
test("test_normal_when_syntax_highlighted", async () => {
  // 準備
  const el = createElement();
  const config = { syntax: { url: highlightUrl("highlighted") } };
  // 実行
  await mountTracked(el, { markdown: HIGHLIGHT_MARKDOWN, config });
  const before = [...el.querySelectorAll("pre, code")].map((node) => ({
    tag: node.tagName,
    attributes: node
      .getAttributeNames()
      .map((name) => [name, node.getAttribute(name)]),
    text: node.textContent,
  }));
  const lineCount = el.querySelectorAll(".mdmark-code-line").length;
  const dataLines = [...el.querySelectorAll(".mdmark-code-line")].map((line) =>
    line.getAttribute("data-line"),
  );
  const [ts, yml, text] = [...el.querySelectorAll("code")];
  // 検証
  await vi.waitFor(() => {
    expect(coloredLanguages(el)).toHaveLength(2);
  });
  const base = `${location.origin}${highlightUrl("highlighted")}`;
  expect(highlightRequests("highlighted")).toEqual(
    [
      `${base}core.min.js`,
      `${base}languages/typescript.min.js`,
      `${base}languages/yaml.min.js`,
    ].sort(),
  );
  expect(coloredLanguages(el)).toEqual(["language-ts", "language-yml"]);
  expect(text?.querySelector('span[class^="hljs-"]')).toBeNull();
  expect(ts?.querySelector(".hljs-keyword")?.textContent).toBe("const");
  const lines = [...(yml?.querySelectorAll(".mdmark-code-line") ?? [])];
  expect(lines).toHaveLength(lineCount);
  expect(lines.map((line) => line.getAttribute("data-line"))).toEqual(
    dataLines,
  );
  for (const line of lines.slice(1)) {
    const code = find(line, ".mdmark-code-text");
    expect(
      code.querySelector(":scope > .hljs-string"),
      line.outerHTML,
    ).not.toBeNull();
  }
  const after = [...el.querySelectorAll("pre, code")].map((node) => ({
    tag: node.tagName,
    attributes: node
      .getAttributeNames()
      .map((name) => [name, node.getAttribute(name)]),
    text: node.textContent,
  }));
  expect(after).toEqual(before);
});

// 色分けの対象が無い文書と、機能 `syntax` を解除した文書では、色分けのライブラリを読み込まない（正常系）
test("test_normal_when_no_syntax_target", async () => {
  // 準備
  const config = { syntax: { url: highlightUrl("no-target") } };
  const plain = createElement();
  const disabled = createElement();
  const plainMarkdown = [
    "```",
    "言語の無いコード",
    "```",
    "",
    "```tree",
    "├── a.ts",
    "└── b.ts",
    "```",
    "",
  ].join("\n");
  const disabledMarkdown = [
    '<!-- features: {"syntax": false} -->',
    "",
    "```ts",
    "const count: number = 1;",
    "```",
    "",
  ].join("\n");
  // 実行
  await mountTracked(plain, { markdown: plainMarkdown, config });
  await mountTracked(disabled, { markdown: disabledMarkdown, config });
  // 検証: 読み込みは描いた後に始まるため、少し待ってから要求が無いことを確認する
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(highlightRequests("no-target")).toEqual([]);
  expect(coloredLanguages(plain)).toEqual([]);
  expect(coloredLanguages(disabled)).toEqual([]);
  expect(find(disabled, "code").textContent).toBe("const count: number = 1;\n");
});

// 色分けのライブラリの本体を読み込めないとき、コードブロックを色分けせずに残す（異常系）
test("test_error_when_highlighter_not_found", async () => {
  // 準備
  const el = createElement();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const config = { syntax: { url: MISSING_HIGHLIGHT_URL } };
  const { mount } = await loadBuilt();
  let handle: MountHandle | undefined;
  // 実行
  expect(() => {
    handle = mount(el, { markdown: HIGHLIGHT_MARKDOWN, config });
  }).not.toThrow();
  if (handle) {
    handles.push(handle);
  }
  const before = codeHtmls(el);
  // 検証
  await vi.waitFor(() => {
    expect(errorSpy).toHaveBeenCalled();
  });
  expect(codeHtmls(el)).toEqual(before);
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  const output = errorSpy.mock.calls.flat().map(String).join("\n");
  expect(output).toContain(
    `${location.origin}${MISSING_HIGHLIGHT_URL}core.min.js`,
  );
});

// 言語のモジュールの一部を読み込めないとき、読み込めた言語のコードブロックだけを色分けする（異常系）
test("test_error_when_language_module_not_found", async () => {
  // 準備
  const el = createElement();
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const config = { syntax: { url: highlightUrl("no-yaml") } };
  // 実行
  await mountTracked(el, { markdown: HIGHLIGHT_MARKDOWN, config });
  const [, yml] = [...el.querySelectorAll("code")];
  const ymlBefore = yml?.outerHTML;
  // 検証
  await vi.waitFor(() => {
    expect(coloredLanguages(el)).toEqual(["language-ts"]);
  });
  await vi.waitFor(() => {
    expect(errorSpy).toHaveBeenCalled();
  });
  expect(yml?.outerHTML).toBe(ymlBefore);
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  const output = errorSpy.mock.calls.flat().map(String).join("\n");
  expect(output).toContain("languages/yaml.min.js");
});

/** 画面の高さより長くなる段落の並び（見出しを画面の上端までスクロールできるようにする） */
function sideTocFiller(): string {
  return Array.from({ length: 30 }, (_, i) => `段落 ${i + 1}\n`).join("\n");
}

/** 見出しを持つ Markdown: `# 手引き`・`## 導入`・`### 前提`・`#### 手順`・`## 使用方法` と、それぞれ画面の高さより長い段落 */
const SIDE_TOC_MARKDOWN = [
  "# 手引き",
  "",
  sideTocFiller(),
  "## 導入",
  "",
  sideTocFiller(),
  "### 前提",
  "",
  sideTocFiller(),
  "#### 手順",
  "",
  sideTocFiller(),
  "## 使用方法",
  "",
  sideTocFiller(),
].join("\n");

/** 画面を `width`×800 にして `run` を実行し、終わったら元の大きさに戻す */
async function withViewport(width: number, run: () => Promise<void>) {
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(width, 800);
  try {
    await run();
  } finally {
    window.scrollTo(0, 0);
    history.replaceState(null, "", location.pathname);
    await page.viewport(original.width, original.height);
  }
}

/** 右側の目次の要素と、よく使用する部分を返却する */
function sideTocOf(el: HTMLElement) {
  const aside = find<HTMLElement>(el, "aside.mdmark-side-toc");
  return {
    aside,
    content: find<HTMLElement>(el, ":scope > .mdmark-content"),
    panel: find<HTMLElement>(aside, ".mdmark-side-toc-panel"),
    toggle: find<HTMLButtonElement>(aside, ".mdmark-side-toc-toggle"),
    pin: find<HTMLButtonElement>(aside, ".mdmark-side-toc-pin"),
    rail: find<HTMLElement>(aside, ".mdmark-side-toc-rail"),
    linkOf: (id: string) =>
      find<HTMLAnchorElement>(aside, `a[data-heading-id="${id}"]`),
  };
}

/** パネルの不透明度を返却する */
function panelOpacity(panel: HTMLElement): string {
  return getComputedStyle(panel).opacity;
}

/** 見出しが画面の中にあるか */
function inViewport(element: Element): boolean {
  const { top } = element.getBoundingClientRect();
  return top >= -1 && top < window.innerHeight;
}

/** セクションの開閉のボタンの `aria-expanded` を、指定した ID の順に返却する */
function expandedOf(el: HTMLElement, ids: string[]): (string | null)[] {
  return ids.map((id) =>
    find(el, `[aria-controls="section-${id}"]`).getAttribute("aria-expanded"),
  );
}

// 右端の線にポインターを乗せると右側の目次を出し、項目で見出しへ移り、ピン止めで出し続ける（正常系（右側の目次をホバーで出してピン止めする））
test("test_normal_when_side_toc_hovered_and_pinned", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
    const { aside, content, panel, toggle, pin, rail, linkOf } = sideTocOf(el);
    // 検証: 描いた直後
    expect([...el.children]).toEqual([
      content,
      aside,
      find(el, ":scope > button.mdmark-back-to-top"),
    ]);
    expect(panelOpacity(panel)).toBe("0");
    expect(getComputedStyle(panel).pointerEvents).toBe("none");
    const items = [...panel.querySelectorAll(".mdmark-side-toc-list a")];
    expect(items.map((a) => a.getAttribute("href"))).toEqual([
      "#手引き",
      "#導入",
      "#前提",
      "#使用方法",
    ]);
    const nested = (id: string) =>
      linkOf(id).parentElement?.querySelector(":scope > ul");
    expect(
      nested("手引き")?.querySelector(":scope > li > a")?.textContent,
    ).toBe("導入");
    expect(nested("導入")?.textContent).toBe("前提");
    expect(getComputedStyle(toggle).display).toBe("none");
    // 実行・検証: 右端の線にポインターを乗せる
    await userEvent.hover(rail);
    await vi.waitFor(() => {
      expect(panelOpacity(panel)).toBe("1");
    });
    const actions = find(panel, ".mdmark-side-toc-actions");
    const list = find(panel, ".mdmark-side-toc-list");
    expect(
      actions.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(actions.querySelectorAll("[data-fold-all]")).toHaveLength(2);
    // 目次の頭: タイトルを配置せず、まとめて開閉するボタンの並び → ピン止めの順
    expect(
      [...find(panel, ".mdmark-side-toc-head").children].map(
        (child) => child.className,
      ),
    ).toEqual(["mdmark-side-toc-actions", "mdmark-side-toc-pin"]);
    expect(panel.textContent).not.toContain("目次");
    // 開いた枠は画面に固定し、見えている枠（画面）の上端から --mdmark-space 下に出す
    const space =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
      Number.parseFloat(
        getComputedStyle(el).getPropertyValue("--mdmark-space"),
      );
    expect(getComputedStyle(panel).position).toBe("fixed");
    expect(panel.getBoundingClientRect().top).toBeCloseTo(space, 0);
    // 実行・検証: 「使用方法」の項目を押す
    await userEvent.click(linkOf("使用方法"));
    await vi.waitFor(() => {
      expect(decodeURIComponent(location.hash)).toBe("#使用方法");
      expect(inViewport(find(el, '[id="使用方法"]'))).toBe(true);
    });
    // 文書の途中へ移った後も、開いた枠は同じ位置に出る
    expect(panel.getBoundingClientRect().top).toBeCloseTo(space, 0);
    // 実行・検証: ピン止めして、ポインターを本文へ動かす
    await userEvent.click(pin);
    expect(pin.getAttribute("aria-pressed")).toBe("true");
    await userEvent.hover(find(content, "p"));
    expect(panelOpacity(panel)).toBe("1");
    expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(
      panel.getBoundingClientRect().left,
    );
    // 実行・検証: ピン止めを解除して、ポインターを本文へ動かす
    await userEvent.click(pin);
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    await userEvent.hover(find(content, "p"));
    await vi.waitFor(() => {
      expect(panelOpacity(panel)).toBe("0");
    });
  });
});

// hover の右側の目次を、フォーカスが入っている間だけ出す（正常系（右側の目次をキーボードで出す））
test("test_normal_when_side_toc_focused", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
    const { aside, content, panel, linkOf } = sideTocOf(el);
    await userEvent.hover(find(content, "p"));
    (document.activeElement as HTMLElement | null)?.blur();
    // 実行・検証: Tab で右側の目次の中へ入る
    for (let i = 0; i < 60 && !aside.contains(document.activeElement); i += 1) {
      await userEvent.tab();
    }
    expect(aside.contains(document.activeElement)).toBe(true);
    expect(panelOpacity(panel)).toBe("1");
    // 実行・検証: 「使用方法」の項目へ Tab で移り、Enter で押す
    for (
      let i = 0;
      i < 20 && document.activeElement !== linkOf("使用方法");
      i += 1
    ) {
      await userEvent.tab();
    }
    expect(document.activeElement).toBe(linkOf("使用方法"));
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(decodeURIComponent(location.hash)).toBe("#使用方法");
      expect(inViewport(find(el, '[id="使用方法"]'))).toBe(true);
    });
    // 実行・検証: フォーカスを右側の目次の外へ移す
    (document.activeElement as HTMLElement).blur();
    await vi.waitFor(() => {
      expect(panelOpacity(panel)).toBe("0");
    });
  });
});

// fixed では目次を出すボタンで、右側の目次を本文に重ねず右の列に出し続ける（正常系（右側の目次をサイドバーで出す））
test("test_normal_when_side_toc_fixed", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, {
      markdown: SIDE_TOC_MARKDOWN,
      config: { "side-toc": { mode: "fixed" } },
    });
    const { content, panel, toggle, rail, linkOf } = sideTocOf(el);
    // 検証: 描いた直後
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(panel.id);
    expect(getComputedStyle(rail).display).toBe("none");
    expect(getComputedStyle(panel).display).toBe("none");
    // 実行・検証: 目次を出すボタンを押す
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getComputedStyle(panel).display).not.toBe("none");
    expect(content.getBoundingClientRect().right).toBeLessThanOrEqual(
      panel.getBoundingClientRect().left,
    );
    // 実行・検証: パネルの項目にフォーカスして Esc を押す
    linkOf("導入").focus();
    await userEvent.keyboard("{Escape}");
    expect(getComputedStyle(panel).display).toBe("none");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });
});

// スクロールの位置で今いるセクションを決め、その項目と右端の線だけをハイライトする（正常系（今いるセクションをハイライトする））
test("test_normal_when_current_section_highlighted", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
    const { aside } = sideTocOf(el);
    const currentLinks = () =>
      [...aside.querySelectorAll('a[aria-current="location"]')].map((a) =>
        a.getAttribute("data-heading-id"),
      );
    const currentBars = () =>
      [...aside.querySelectorAll(".mdmark-side-toc-bar")].map((bar) =>
        bar.hasAttribute("data-current"),
      );
    const scrollToHeading = async (id: string) => {
      find(el, `[id="${id}"]`).scrollIntoView();
      await nextFrames();
    };
    // 検証: 描いた直後
    await vi.waitFor(() => {
      expect(currentLinks()).toEqual(["手引き"]);
    });
    expect(currentBars()).toEqual([true, false, false, false]);
    // 実行・検証: 「使用方法」まで進む
    await scrollToHeading("使用方法");
    await vi.waitFor(() => {
      expect(currentLinks()).toEqual(["使用方法"]);
    });
    // 実行・検証: 「手順」（h4）まで戻る
    await scrollToHeading("手順");
    await vi.waitFor(() => {
      expect(currentLinks()).toEqual(["前提"]);
    });
    expect(aside.querySelector('a[data-heading-id="手順"]')).toBeNull();
    expect(aside.querySelectorAll(".mdmark-side-toc-bar")).toHaveLength(4);
    // 実行・検証: 「前提」まで戻る
    await scrollToHeading("前提");
    await vi.waitFor(() => {
      expect(currentLinks()).toEqual(["前提"]);
    });
  });
});

// 閉じたセクションの中の見出しの項目を押すと、セクションを開いてから移る。URL が変わらないときも同じ（正常系（右側の目次から閉じたセクションの中へ移る））
test("test_normal_when_side_toc_into_closed_section", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, {
      markdown: [
        "## 概要",
        "",
        sideTocFiller(),
        "## 補足",
        "",
        '<!-- section: {"open": false} -->',
        "",
        "### 注意",
        "",
        sideTocFiller(),
      ].join("\n"),
    });
    const { rail, linkOf } = sideTocOf(el);
    const toggleOf = (id: string) =>
      find<HTMLButtonElement>(el, `[aria-controls="section-${id}"]`);
    expect(linkOf("注意")).toBeTruthy();
    expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("false");
    await userEvent.hover(rail);
    // 実行・検証: 「注意」を押す
    await userEvent.click(linkOf("注意"));
    await vi.waitFor(() => {
      expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("true");
      expect(decodeURIComponent(location.hash)).toBe("#注意");
      expect(inViewport(find(el, '[id="注意"]'))).toBe(true);
    });
    // 実行・検証: 補足を閉じ、URL が同じまま「注意」をもう一度押す
    toggleOf("補足").click();
    expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("false");
    window.scrollTo(0, 0);
    await userEvent.hover(rail);
    await userEvent.click(linkOf("注意"));
    await vi.waitFor(() => {
      expect(toggleOf("補足").getAttribute("aria-expanded")).toBe("true");
      expect(inViewport(find(el, '[id="注意"]'))).toBe(true);
    });
  });
});

// H1 を含む全てのセクションを開き、H1 のセクションを開いたまま H2 以下の全てのセクションを閉じる（正常系（すべて展開・すべて折りたたむ））
test("test_normal_when_all_sections_toggled", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, {
      markdown: [
        "# 手引き",
        "",
        "## 概要",
        "",
        "概要の段落",
        "",
        "## 補足",
        "",
        '<!-- section: {"open": false} -->',
        "",
        "補足の段落",
        "",
        "### 注意",
        "",
        '<!-- section: {"open": false} -->',
        "",
        "注意の段落",
        "",
        "# 付録",
        "",
        '<!-- section: {"open": false} -->',
        "",
        "付録の段落",
        "",
      ].join("\n"),
    });
    const { panel, rail } = sideTocOf(el);
    const ids = ["手引き", "概要", "補足", "注意", "付録"];
    const bodyOf = (id: string) =>
      find<HTMLElement>(el, `[id="section-${id}"]`);
    const shown = (text: string) =>
      [...el.querySelectorAll("p")]
        .find((p) => p.textContent === text)
        ?.checkVisibility();
    // 検証: 描いた直後
    expect(find(el, "h1 .mdmark-section-toggle")).toBeTruthy();
    expect(bodyOf("付録").getAttribute("hidden")).toBe("until-found");
    const open = find<HTMLButtonElement>(panel, '[data-fold-all="open"]');
    const close = find<HTMLButtonElement>(panel, '[data-fold-all="close"]');
    const list = find(panel, ".mdmark-side-toc-list");
    for (const button of [open, close]) {
      expect(button.textContent?.trim()).toBe("");
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.getAttribute("title")).toBeTruthy();
      expect(
        button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    // ポインターを乗せると開いた目次が右端の線を覆うため、乗せた後に線が最も手前にあるかは確認しない
    await userEvent.hover(rail, { force: true });
    // 実行・検証: すべて展開
    await userEvent.click(open);
    expect(expandedOf(el, ids)).toEqual([
      "true",
      "true",
      "true",
      "true",
      "true",
    ]);
    expect(shown("注意の段落")).toBe(true);
    expect(shown("付録の段落")).toBe(true);
    expect(document.activeElement).toBe(open);
    // 実行・検証: すべて折りたたむ
    await userEvent.click(close);
    expect(expandedOf(el, ids)).toEqual([
      "true",
      "false",
      "false",
      "false",
      "true",
    ]);
    expect(shown("概要の段落")).toBe(false);
    expect(find(el, '[id="概要"]').checkVisibility()).toBe(true);
    expect(document.activeElement).toBe(close);
  });
});

// Shift を押しながらの押下と Enter・Space で、そのセクションと中の入れ子のセクションを同じ状態にする（正常系（Shift で入れ子をまとめて開閉））
test("test_normal_when_nested_sections_toggled_with_shift", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      "## 概要",
      "",
      "概要の段落",
      "",
      "## 補足",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "### 注意",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "#### 例",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "例の段落",
      "",
    ].join("\n"),
  });
  const toggleOf = (id: string) =>
    find<HTMLButtonElement>(el, `[aria-controls="section-${id}"]`);
  const ids = ["補足", "注意", "例"];
  // 実行・検証: Shift を押しながら補足の開閉を押す
  await userEvent.keyboard("{Shift>}");
  await userEvent.click(toggleOf("補足"));
  await userEvent.keyboard("{/Shift}");
  expect(expandedOf(el, ids)).toEqual(["true", "true", "true"]);
  expect(
    [...el.querySelectorAll("p")]
      .find((p) => p.textContent === "例の段落")
      ?.checkVisibility(),
  ).toBe(true);
  // 実行・検証: 補足の開閉のボタンで Shift と Enter を押す
  toggleOf("補足").focus();
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  expect(expandedOf(el, ids)).toEqual(["false", "false", "false"]);
  // 実行・検証: Shift と Space を押す
  await userEvent.keyboard("{Shift>}[Space]{/Shift}");
  expect(expandedOf(el, ids)).toEqual(["true", "true", "true"]);
  // 実行・検証: Shift を押さずに補足を押す
  await userEvent.click(toggleOf("補足"));
  expect(expandedOf(el, ids)).toEqual(["false", "true", "true"]);
  expect(expandedOf(el, ["概要"])).toEqual(["true"]);
});

// 描く先の要素が狭いとき、本文の上端の帯から右側の目次を開き、項目を押すと閉じる（正常系（狭い幅の右側の目次））
test("test_normal_when_side_toc_in_narrow_width", async () => {
  await withViewport(390, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
    const { aside, content, panel, toggle, rail, linkOf } = sideTocOf(el);
    const label = find(aside, ".mdmark-side-toc-current");
    // 検証: 描いた直後
    await vi.waitFor(() => {
      expect(label.textContent).toBe("手引き");
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(getComputedStyle(rail).display).toBe("none");
    expect(aside.getBoundingClientRect().top).toBeLessThanOrEqual(
      content.getBoundingClientRect().top,
    );
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
    // 実行・検証: 目次を出すボタンを押す
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const bandBottom = toggle.getBoundingClientRect().bottom;
    const panelRect = panel.getBoundingClientRect();
    expect(panelRect.top).toBeGreaterThanOrEqual(bandBottom - 1);
    expect(panelRect.right).toBeLessThanOrEqual(
      el.getBoundingClientRect().right,
    );
    expect(panelRect.left).toBeGreaterThanOrEqual(
      el.getBoundingClientRect().left,
    );
    // 実行・検証: 「使用方法」を押す
    await userEvent.click(linkOf("使用方法"));
    await vi.waitFor(() => {
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(label.textContent).toBe("使用方法");
    });
    const heading = find(el, '[id="使用方法"]').getBoundingClientRect();
    expect(heading.top).toBeGreaterThanOrEqual(
      toggle.getBoundingClientRect().bottom,
    );
    expect(heading.top).toBeLessThan(window.innerHeight);
  });
});

// update で項目を再作成してピン止めを保ち、destroy で右側の目次と見出しの監視を解除し、もう一度の mount はピン止めを解除して始める（正常系（右側の目次を再描画して片付ける））
test("test_normal_when_side_toc_updated_and_destroyed", async () => {
  // 準備
  const disconnect = vi.fn();
  const Original = window.IntersectionObserver;
  vi.stubGlobal(
    "IntersectionObserver",
    class extends Original {
      override disconnect(): void {
        disconnect();
        super.disconnect();
      }
    },
  );
  const el = createElement();
  const handle = await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
  sideTocOf(el).pin.click();
  expect(sideTocOf(el).pin.getAttribute("aria-pressed")).toBe("true");
  // 実行・検証: update
  handle.update("## 新しいセクション\n\n新しい段落\n");
  const after = sideTocOf(el);
  expect(
    [...after.aside.querySelectorAll(".mdmark-side-toc-list a")].map(
      (a) => a.textContent,
    ),
  ).toEqual(["新しいセクション"]);
  expect(after.pin.getAttribute("aria-pressed")).toBe("true");
  expect(el.querySelectorAll("aside.mdmark-side-toc")).toHaveLength(1);
  expect(after.content.textContent).not.toContain("段落 1");
  // 実行・検証: destroy
  disconnect.mockClear();
  handle.destroy();
  expect(el.innerHTML).toBe("");
  expect(disconnect).toHaveBeenCalled();
  expect(() => {
    window.scrollTo(0, 100);
  }).not.toThrow();
  await nextFrames();
  window.scrollTo(0, 0);
  // 実行・検証: もう一度 mount
  await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
  expect(sideTocOf(el).pin.getAttribute("aria-pressed")).toBe("false");
});

// 見出しの無い文書と side-toc がオフの文書では右側の目次を配置せず、文書のマーカーでオンにした文書では配置する（正常系（右側の目次を配置しない））
test("test_normal_when_side_toc_not_placed", async () => {
  // 準備
  const [plain, off, on] = [
    createElement(),
    createElement(),
    createElement(),
  ] as [HTMLElement, HTMLElement, HTMLElement];
  // 実行
  await mountTracked(plain, { markdown: "段落だけ\n" });
  await mountTracked(off, {
    markdown:
      '<!-- features: {"side-toc": false} -->\n\n## 導入\n\n段落\n\n## 使用方法\n\n段落\n',
  });
  await mountTracked(on, {
    markdown:
      '<!-- features: {"side-toc": true} -->\n\n## 導入\n\n段落\n\n## 使用方法\n\n段落\n',
    config: { features: { "side-toc": false } },
  });
  // 検証
  expect(plain.querySelector(".mdmark-side-toc, .mdmark-content")).toBeNull();
  expect(plain.querySelector(":scope > p")?.textContent).toBe("段落だけ");
  expect(off.querySelector(".mdmark-side-toc")).toBeNull();
  expect(off.querySelector(".mdmark-anchor")).not.toBeNull();
  expect(off.querySelector(".mdmark-section-toggle")).not.toBeNull();
  expect(
    [
      ...find(on, "aside.mdmark-side-toc").querySelectorAll(
        ".mdmark-side-toc-list a",
      ),
    ].map((a) => a.textContent),
  ).toEqual(["導入", "使用方法"]);
  for (const target of [plain, off, on]) {
    expect(target.textContent).not.toContain("features");
  }
});

// 知らない side-toc.mode は例外を投げず hover として描く（異常系（知らない出し方・既定の出し方））
test("test_error_when_unknown_side_toc_mode", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    const { mount } = await loadBuilt();
    let handle: MountHandle | undefined;
    // 実行
    expect(() => {
      handle = mount(el, {
        markdown: SIDE_TOC_MARKDOWN,
        config: { "side-toc": { mode: "left" } },
      });
    }).not.toThrow();
    if (handle) {
      handles.push(handle);
    }
    // 検証
    const { content, panel, toggle, rail } = sideTocOf(el);
    expect(content).toBeTruthy();
    expect(panelOpacity(panel)).toBe("0");
    expect(getComputedStyle(toggle).display).toBe("none");
    await userEvent.hover(rail);
    await vi.waitFor(() => {
      expect(panelOpacity(panel)).toBe("1");
    });
  });
});

// ─── 先頭へ戻るボタン ───

/** 先頭へ戻るボタンの文書の見出し（`## 導入` から `## 付録` までの 10 個） */
const BACK_TO_TOP_HEADINGS = [
  "導入",
  "前提",
  "準備",
  "設定",
  "使用方法",
  "応用",
  "運用",
  "確認",
  "参考",
  "付録",
];

/** 先頭へ戻るボタンの文書の、見出しごとの段落の数（文書を画面の高さの 3 倍より長くする） */
const BACK_TO_TOP_PARAGRAPHS = 10;

/** `## 導入` の段落のリンクの URL */
const BACK_TO_TOP_LINK = "https://example.com/config";

/** 10 個の見出しと画面の高さの 3 倍を超える段落を持ち、`## 導入` の段落にリンクを 1 つ持つ文書 */
const BACK_TO_TOP_MARKDOWN = BACK_TO_TOP_HEADINGS.flatMap((heading, index) => [
  `## ${heading}`,
  "",
  ...(index === 0
    ? [`[設定のリファレンス](${BACK_TO_TOP_LINK}) を先に読み込む。`, ""]
    : []),
  ...Array.from({ length: BACK_TO_TOP_PARAGRAPHS }, (_, i) => [
    `${heading}の段落 ${i + 1} は、画面の高さの 3 倍を超えるまで並べる本文。`,
    "",
  ]).flat(),
]).join("\n");

/** ボタンとスクロールする場所の右端・下端の間の既定（px） */
const BACK_TO_TOP_GAP_PX = 16;

/** ボタンが回避する部品の左端からボタンの右端までの間（px） */
const BACK_TO_TOP_AVOID_GAP_PX = 8;

/** 描く先の要素の子の先頭へ戻るボタン */
function backToTopOf(el: HTMLElement): HTMLButtonElement {
  return find<HTMLButtonElement>(el, ":scope > button.mdmark-back-to-top");
}

/** 画面全体を末尾までスクロールし、再配置のフレームを待つ */
async function scrollPageToEnd(): Promise<void> {
  const scroller = document.scrollingElement as HTMLElement;
  await scrollPageTo(scroller.scrollHeight - scroller.clientHeight);
}

/** 描く先の要素の上端の、画面全体の先頭からの位置 */
function pageTopOf(el: HTMLElement): number {
  return el.getBoundingClientRect().top + window.scrollY;
}

/** `window.scrollTo` に指定した引数を、オブジェクトの構造で並べて返却する */
function scrollToCalls(spy: {
  mock: { calls: unknown[][] };
}): ScrollToOptions[] {
  return spy.mock.calls.map((call) => call[0] as ScrollToOptions);
}

/** 本文の列の中で最初にフォーカスできる要素 */
function firstFocusableIn(content: HTMLElement): HTMLElement {
  return find<HTMLElement>(
    content,
    'a[href], button:not([hidden]), [tabindex]:not([tabindex="-1"])',
  );
}

// 画面の高さ分スクロールすると右下に先頭へ戻るボタンを出し、押すと文書の先頭へ戻ってフォーカスを本文の列へ移す（正常系（先頭へ戻るボタンを出して押す））
test("test_normal_when_back_to_top_pressed", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: BACK_TO_TOP_MARKDOWN });
    const button = backToTopOf(el);
    const { clientWidth, clientHeight } = document.documentElement;
    const elTop = pageTopOf(el);
    // 検証: 描いた直後
    expect(el.lastElementChild).toBe(button);
    expect({
      type: button.getAttribute("type"),
      label: button.getAttribute("aria-label"),
      title: button.getAttribute("title"),
      hidden: button.hidden,
    }).toEqual({
      type: "button",
      label: "先頭へ戻る",
      title: "先頭へ戻る",
      hidden: true,
    });
    // 実行・検証: 画面の高さより 1px 少なくスクロールする
    await scrollPageTo(elTop + clientHeight - 1);
    expect(button.hidden).toBe(true);
    // 実行・検証: 画面の高さ分スクロールする
    await scrollPageTo(elTop + clientHeight);
    await vi.waitFor(() => expect(button.hidden).toBe(false));
    const rect = button.getBoundingClientRect();
    expect(
      Math.abs(clientWidth - rect.right - BACK_TO_TOP_GAP_PX),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(clientHeight - rect.bottom - BACK_TO_TOP_GAP_PX),
    ).toBeLessThanOrEqual(1);
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    // 実行: ボタンを押す
    const scrollTo = vi.spyOn(window, "scrollTo");
    await userEvent.click(button);
    // 検証
    const calls = scrollToCalls(scrollTo);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.behavior).toBe("smooth");
    expect(Math.abs((calls[0]?.top ?? Number.NaN) - elTop)).toBeLessThanOrEqual(
      1,
    );
    await vi.waitFor(
      () => {
        expect(Math.abs(el.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
        expect(button.hidden).toBe(true);
      },
      { timeout: 5000 },
    );
    const content = find<HTMLElement>(el, ":scope > div.mdmark-content");
    expect(document.activeElement).toBe(content);
    expect(content.getAttribute("tabindex")).toBe("-1");
    // 実行・検証: 続けて Tab を押す
    const link = find<HTMLAnchorElement>(
      content,
      `a[href="${BACK_TO_TOP_LINK}"]`,
    );
    const first = firstFocusableIn(content);
    await userEvent.tab();
    expect(document.activeElement).toBe(first);
    expect(
      first === link ||
        (first.compareDocumentPosition(link) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
    ).toBe(true);
  });
});

// 描く先の要素の祖先の要素がスクロールするとき、その要素の右下にボタンを出し、その要素を先頭へスクロールする（正常系（スクロールする祖先の要素の中で先頭へ戻る））
test("test_normal_when_back_to_top_in_scroll_container", async () => {
  await withViewport(1280, async () => {
    // 準備
    /** 高さ 600px の縦にスクロールする祖先の要素の中に描く先の要素を入れ、下に高さ 400px の要素を配置する */
    const createBox = () => {
      const box = document.createElement("div");
      box.style.height = "600px";
      box.style.overflowY = "auto";
      const target = document.createElement("div");
      box.append(target);
      const below = document.createElement("div");
      below.style.height = "400px";
      document.body.append(box, below);
      elements.push(box, below);
      return { box, target };
    };
    /** 祖先の要素の、スクロールバーを除く右端と下端（画面からはみ出す分は画面の端） */
    const innerEdges = (box: HTMLElement) => {
      const rect = box.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      return {
        right: Math.min(
          rect.left + box.clientLeft + box.clientWidth,
          clientWidth,
        ),
        bottom: Math.min(
          rect.top + box.clientTop + box.clientHeight,
          clientHeight,
        ),
      };
    };
    /** ボタンの右端と下端が、祖先の要素の右端と下端から 16px にあることを確認する */
    const expectAtCorner = (button: HTMLButtonElement, box: HTMLElement) => {
      const rect = button.getBoundingClientRect();
      const edges = innerEdges(box);
      expect(
        Math.abs(edges.right - rect.right - BACK_TO_TOP_GAP_PX),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(edges.bottom - rect.bottom - BACK_TO_TOP_GAP_PX),
      ).toBeLessThanOrEqual(1);
    };
    const { box, target: el } = createBox();
    await mountTracked(el, { markdown: BACK_TO_TOP_MARKDOWN });
    const button = backToTopOf(el);
    // 実行・検証: 祖先の要素を 599px・600px スクロールする
    box.scrollTop = 599;
    await nextFrames();
    await nextFrames();
    expect(button.hidden).toBe(true);
    box.scrollTop = 600;
    await vi.waitFor(() => expect(button.hidden).toBe(false));
    expectAtCorner(button, box);
    // 実行・検証: 画面全体を 100px スクロールする
    await scrollPageTo(100);
    await vi.waitFor(() => expectAtCorner(button, box));
    // 実行: ボタンを押す
    const pageScroll = window.scrollY;
    const expectedTop =
      box.scrollTop +
      el.getBoundingClientRect().top -
      (box.getBoundingClientRect().top + box.clientTop);
    await userEvent.click(button);
    // 検証
    await vi.waitFor(
      () =>
        expect(Math.abs(box.scrollTop - expectedTop)).toBeLessThanOrEqual(1),
      { timeout: 5000 },
    );
    expect(window.scrollY).toBe(pageScroll);
    // 実行: 短い文書を描いてから、update で長い文書に差し替える
    const { box: box2, target: el2 } = createBox();
    const handle = await mountTracked(el2, { markdown: "短い段落。\n" });
    handle.update(BACK_TO_TOP_MARKDOWN);
    box2.scrollTop = 600;
    // 検証
    await vi.waitFor(() => expect(backToTopOf(el2).hidden).toBe(false));
    expectAtCorner(backToTopOf(el2), box2);
  });
});

// ボタンをミニマップと余白の列の左へずらし、右側の目次のパネルをボタンの上で終わらせる（正常系（先頭へ戻るボタンが右側の部品を回避する））
test("test_normal_when_back_to_top_avoids_side_parts", async () => {
  // 準備: 差分を開いて描いたページ
  const changed = BACK_TO_TOP_MARKDOWN.replace(
    "付録の段落 9 は",
    "付録の段落 9 を書き換えた本文は",
  );
  await withViewport(1280, async () => {
    const source = createDiffSource({}, DIFF_REVISIONS.slice(1), {
      r1: BACK_TO_TOP_MARKDOWN,
      r2: changed,
    });
    const el = createElement();
    await mountTracked(el, {
      markdown: changed,
      docId: "guide",
      diffSource: source,
      diffMode: "open",
    });
    await waitForDiffLines(el);
    await vi.waitFor(() => expect(minimapBands()).toHaveLength(1));
    // 実行: 差分の末尾までスクロールする
    await scrollPageToEnd();
    // 検証
    const button = backToTopOf(el);
    await vi.waitFor(() => {
      expect(button.hidden).toBe(false);
      const band = (minimapBands()[0] as HTMLElement).getBoundingClientRect();
      expect(
        Math.abs(
          band.left -
            BACK_TO_TOP_AVOID_GAP_PX -
            button.getBoundingClientRect().right,
        ),
      ).toBeLessThanOrEqual(1);
    });
  });
  // 準備: コメントの機能をオンにして描いたページ
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(390, 844);
  try {
    const el = createElement();
    const store = createCommentStore([quoteComment("c1", "付録の段落 3 は")]);
    await mountTracked(el, {
      markdown: BACK_TO_TOP_MARKDOWN,
      config: { features: { comments: true } },
      docId: "guide",
      commentStore: store,
    });
    await vi.waitFor(() => expect(marginMarkers(el)).toHaveLength(1));
    const button = backToTopOf(el);
    const margin = find<HTMLElement>(el, ":scope > div.mdmark-comment-margin");
    /** ボタンの右端が余白の列の左端より 8px 左にあり、どの余白のマーカーとも重ならないことを確認する */
    const expectBesideMargin = () => {
      const rect = button.getBoundingClientRect();
      expect(
        Math.abs(
          margin.getBoundingClientRect().left -
            BACK_TO_TOP_AVOID_GAP_PX -
            rect.right,
        ),
      ).toBeLessThanOrEqual(1);
      for (const marker of marginMarkers(el)) {
        const box = marker.getBoundingClientRect();
        const overlaps =
          box.left < rect.right &&
          rect.left < box.right &&
          box.top < rect.bottom &&
          rect.top < box.bottom;
        expect(overlaps).toBe(false);
      }
    };
    // 実行: 文書の末尾までスクロールする
    await scrollPageToEnd();
    // 検証
    await vi.waitFor(() => {
      expect(button.hidden).toBe(false);
      expectBesideMargin();
    });
    const leftAtEnd = button.getBoundingClientRect().left;
    // 実行: 1 画面分戻る
    await scrollPageTo(window.scrollY - document.documentElement.clientHeight);
    // 検証
    expect(button.hidden).toBe(false);
    expectBesideMargin();
    expect(button.getBoundingClientRect().left).toBe(leftAtEnd);
  } finally {
    window.scrollTo(0, 0);
    await page.viewport(original.width, original.height);
  }
  // 準備: 右側の目次を出し続けて描いたページ
  await withViewport(1280, async () => {
    const el = createElement();
    await mountTracked(el, {
      markdown: BACK_TO_TOP_MARKDOWN,
      config: { "side-toc": { mode: "fixed" } },
    });
    const { panel, toggle, linkOf } = sideTocOf(el);
    await userEvent.click(toggle);
    // 実行: 文書の末尾までスクロールする
    await scrollPageToEnd();
    // 検証
    const button = backToTopOf(el);
    await vi.waitFor(() => expect(button.hidden).toBe(false));
    expect(panel.getBoundingClientRect().bottom).toBeLessThan(
      button.getBoundingClientRect().top,
    );
    // 実行: パネルの最後の項目を押す
    await userEvent.click(linkOf("付録"));
    // 検証
    await vi.waitFor(() => {
      expect(decodeURIComponent(location.hash)).toBe("#付録");
    });
  });
});

// 利用者の環境が動きを減らす設定のとき、押すと一度に先頭へ移る（正常系（動きを減らす設定で先頭へ戻る））
test("test_normal_when_back_to_top_with_reduced_motion", async () => {
  await withViewport(1280, async () => {
    // 準備
    const originalMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
      query === "(prefers-reduced-motion: reduce)"
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          } satisfies MediaQueryList)
        : originalMatchMedia(query),
    );
    const el = createElement();
    await mountTracked(el, { markdown: BACK_TO_TOP_MARKDOWN });
    await scrollPageToEnd();
    const button = backToTopOf(el);
    await vi.waitFor(() => expect(button.hidden).toBe(false));
    const scrollTo = vi.spyOn(window, "scrollTo");
    // 実行
    await userEvent.click(button);
    // 検証
    expect(scrollToCalls(scrollTo).map((call) => call.behavior)).toEqual([
      "auto",
    ]);
    expect(Math.abs(el.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
  });
});

// `back-to-top` がオフの文書ではボタンを配置せず、`update` ではボタンを保ち、`destroy` でボタンと受け取りを解除する（正常系（先頭へ戻るボタンを配置しない・片付ける））
test("test_normal_when_back_to_top_not_placed", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el1 = createElement();
    const el2 = createElement();
    const el3 = createElement();
    // 実行
    await mountTracked(el1, {
      markdown: `<!-- features: {"back-to-top": false} -->\n\n${BACK_TO_TOP_MARKDOWN}`,
    });
    await mountTracked(el2, {
      markdown: BACK_TO_TOP_MARKDOWN,
      config: { features: { "back-to-top": false } },
    });
    const handle = await mountTracked(el3, { markdown: BACK_TO_TOP_MARKDOWN });
    // 検証
    for (const el of [el1, el2]) {
      expect(el.querySelector("button.mdmark-back-to-top")).toBeNull();
      expect(el.textContent).not.toContain("features:");
    }
    // 実行: 文書の末尾までスクロールしてから、本文を再描画する
    await scrollPageToEnd();
    await vi.waitFor(() => expect(backToTopOf(el3).hidden).toBe(false));
    handle.update(BACK_TO_TOP_MARKDOWN);
    // 検証
    expect(el3.querySelectorAll("button.mdmark-back-to-top")).toHaveLength(1);
    expect(backToTopOf(el3).hidden).toBe(false);
    // 実行: 片付けてからスクロールする
    handle.destroy();
    await scrollPageTo(0);
    await scrollPageToEnd();
    // 検証
    expect(el3.innerHTML).toBe("");
  });
});

/** 使用できないエイリアス（`env` を含む）を、型の検査にかけずに `aliases` へ指定する構造にする */
function rawAliases(aliases: unknown[]): MdmarkAlias[] {
  return aliases as MdmarkAlias[];
}

/** ツールチップの区分の見出しの文字を並べて返却する */
function tipHeadings(tip: Element): string[] {
  return [...tip.querySelectorAll(".mdmark-term-tip-heading")].map(
    (heading) => heading.textContent ?? "",
  );
}

/** 単語に付いたツールチップを返却する */
function tipInWrap(term: Element): HTMLElement {
  return find<HTMLElement>(
    term.closest(".mdmark-term-wrap") as HTMLElement,
    ".mdmark-term-tip",
  );
}

// 指定したエイリアスの名前と別名に下線を付け、種類ごとのツールチップを出す。env は照合しない（正常系）
test("test_normal_when_aliases", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    "## セクション 1",
    "",
    "レビュー、設計書、課題の一覧、記録の取り込み、点検のツール、設定ファイル、開発サーバーを並べ、レビューをもう一度書く。",
    "",
    "## セクション 2",
    "",
    "査読を記載する。",
    "",
  ].join("\n");
  const aliases = rawAliases([
    {
      alias_type: "term",
      id: "review",
      name: "レビュー",
      aliases: ["査読"],
      description: "変更を別の人が確認すること",
    },
    {
      alias_type: "doc",
      id: "design-doc",
      name: "設計書",
      aliases: [],
      description: "仕様を記載した文書",
    },
    {
      alias_type: "url",
      id: "issues",
      name: "課題の一覧",
      aliases: [],
      description: "Issue を並べたページ",
      url: "https://github.com/shuhei1101/mdmark/issues",
    },
    {
      alias_type: "skill",
      id: "session",
      name: "記録の取り込み",
      aliases: [],
      skill: "mindstella:session",
    },
    {
      alias_type: "tool",
      id: "check-tool",
      name: "点検のツール",
      aliases: [],
      tool: "check",
    },
    {
      alias_type: "path",
      id: "config-file",
      name: "設定ファイル",
      aliases: [],
      path: "mdmark.config.yaml",
    },
    {
      alias_type: "env",
      id: "dev-server",
      name: "開発サーバー",
      aliases: [],
      url: "http://127.0.0.1:8767/",
      port: "8767",
    },
  ]);
  // 実行
  await mountTracked(el, { markdown, aliases });
  // 検証
  // env を除く 6 つの名前と、2 つ目のセクションの `査読` に下線が付き、1 つ目のセクションの 2 回目の `レビュー` には付かない
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual([
    "レビュー",
    "設計書",
    "課題の一覧",
    "記録の取り込み",
    "点検のツール",
    "設定ファイル",
    "査読",
  ]);
  // env: 下線もツールチップも無く、値が文書に入らない
  expect(el.textContent).toContain("開発サーバー");
  expect(el.innerHTML).not.toContain("http://127.0.0.1:8767/");
  // 査読: ポインターを乗せると「用語」の下に名前と説明が出る
  const review = terms[6] as HTMLElement;
  const reviewTip = tipInWrap(review);
  expect(isOpen(reviewTip)).toBe(false);
  await userEvent.hover(review);
  await vi.waitFor(() => {
    expect(isOpen(reviewTip)).toBe(true);
  });
  expect(tipHeadings(reviewTip)).toEqual(["用語"]);
  expect(find(reviewTip, ".mdmark-term-tip-name").textContent).toBe("レビュー");
  expect(find(reviewTip, ".mdmark-term-tip-meaning").textContent).toBe(
    "変更を別の人が確認すること",
  );
  await userEvent.unhover(review);
  // 設計書: 「文書」の下に説明が出る
  const docTip = tipInWrap(terms[1] as HTMLElement);
  expect(tipHeadings(docTip)).toEqual(["文書"]);
  expect(find(docTip, ".mdmark-term-tip-meaning").textContent).toBe(
    "仕様を記載した文書",
  );
  // スキル・ツール・パス: 「スキル」「ツール」「パス」の下の code に値が出る
  const codes = [3, 4, 5].map((position) => {
    const tip = tipInWrap(terms[position] as HTMLElement);
    return [tipHeadings(tip)[0], find(tip, "code").textContent];
  });
  expect(codes).toEqual([
    ["スキル", "mindstella:session"],
    ["ツール", "check"],
    ["パス", "mdmark.config.yaml"],
  ]);
  // 課題の一覧: 「URL」の下に説明とリンクが出る。Tab でリンクへ移り、Esc で閉じて単語へ戻る
  const issues = terms[2] as HTMLElement;
  const issuesTip = tipInWrap(issues);
  issues.focus();
  expect(isOpen(issuesTip)).toBe(true);
  expect(tipHeadings(issuesTip)).toEqual(["URL"]);
  expect(find(issuesTip, ".mdmark-term-tip-meaning").textContent).toBe(
    "Issue を並べたページ",
  );
  const link = find<HTMLAnchorElement>(issuesTip, "a");
  expect(link.textContent).toBe("https://github.com/shuhei1101/mdmark/issues");
  expect(link.getAttribute("href")).toBe(
    "https://github.com/shuhei1101/mdmark/issues",
  );
  await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(link);
  expect(isOpen(issuesTip)).toBe(true);
  await userEvent.keyboard("{Escape}");
  expect(isOpen(issuesTip)).toBe(false);
  expect(document.activeElement).toBe(issues);
});

/** コマンドのエイリアス `単体テスト` */
const UNIT_TEST_ALIAS: MdmarkAlias = {
  alias_type: "command",
  id: "unit-test",
  name: "単体テスト",
  aliases: [],
  description: "ライブラリ本体の単体テストを実行する",
  command: "npm run test:unit",
  cwd: "リポジトリの直下",
};

// コマンドのツールチップのコピーのボタンで、コマンドをクリップボードへ書き込み、ボタンで通知する（正常系）
test("test_normal_when_copy_command", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: "手元で単体テストを実行する。\n",
    aliases: [UNIT_TEST_ALIAS],
  });
  const term = find<HTMLElement>(el, ".mdmark-term");
  const tip = tipInWrap(term);
  const button = find<HTMLButtonElement>(tip, "button.mdmark-term-tip-copy");
  const status = find(tip, '[role="status"]');
  // 検証: ツールチップの中身
  term.focus();
  expect(isOpen(tip)).toBe(true);
  expect(tipHeadings(tip)).toEqual(["コマンド"]);
  expect(find(tip, ".mdmark-term-tip-meaning").textContent).toBe(
    "ライブラリ本体の単体テストを実行する",
  );
  expect(find(tip, "code").textContent).toBe("npm run test:unit");
  expect(tip.textContent).toContain("実行場所");
  expect(tip.textContent).toContain("リポジトリの直下");
  expect(button.getAttribute("type")).toBe("button");
  expect(button.textContent?.trim()).toBe("コピー");
  // 実行: Tab でコピーのボタンへ移り、Enter で押す
  await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(button);
  expect(isOpen(tip)).toBe(true);
  await userEvent.keyboard("{Enter}");
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 記載して、ボタンとスクリーンリーダー向けの要素で通知し、ツールチップは出たまま
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("npm run test:unit");
  expect(button.textContent?.trim()).toBe("コピーしました");
  expect(status.textContent).toContain("コマンドをコピーしました");
  expect(isOpen(tip)).toBe(true);
  // 検証: 2 秒後に戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.textContent?.trim()).toBe("コピー");
  expect(status.textContent).toBe("");
  expect(isOpen(tip)).toBe(true);
});

// クリップボードへの書き込みが拒まれたら、ボタンで通知して次に押すまで残す（正常系）
test("test_normal_when_copy_command_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const el = createElement();
  await mountTracked(el, {
    markdown: "手元で単体テストを実行する。\n",
    aliases: [UNIT_TEST_ALIAS],
  });
  const term = find<HTMLElement>(el, ".mdmark-term");
  const tip = tipInWrap(term);
  const button = find<HTMLButtonElement>(tip, "button.mdmark-term-tip-copy");
  const status = find(tip, '[role="status"]');
  term.focus();
  try {
    // 実行・検証: 押すと失敗を通知し、2 秒たっても戻らない
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(status.textContent).toContain("コマンドをコピーできませんでした");
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(rejections).toHaveLength(0);
    // 実行・検証: クリップボードが無いページでも、押すと同じ通知になる
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.textContent).toContain("コピーできませんでした");
    expect(status.textContent).toContain("コマンドをコピーできませんでした");
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// avoid の種類と term の avoid の単語に波線のマーカーを付け、代わりの用語のツールチップを出す（正常系）
test("test_normal_when_avoid_alias", async () => {
  // 準備
  const el = createElement();
  const aliases = rawAliases([
    {
      alias_type: "avoid",
      id: "workplace",
      name: "作業場",
      aliases: [],
      replacement: "ワークスペース",
    },
    {
      alias_type: "term",
      id: "branch",
      name: "ブランチ",
      aliases: [],
      description: "作業を分ける線",
      avoid: ["枝"],
    },
  ]);
  const markdown =
    "## セクション\n\n作業場と作業場と枝を記載する。行内のコードは `作業場` と記載する。\n";
  // 実行
  await mountTracked(el, { markdown, aliases });
  // 検証
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual(["作業場", "枝"]);
  for (const term of terms) {
    expect(term.classList.contains("mdmark-term-avoided")).toBe(true);
    expect(getComputedStyle(term).textDecorationStyle).toBe("wavy");
  }
  expect(find<HTMLElement>(el, "code").closest(".mdmark-term")).toBeNull();
  // 作業場: 「代わりの用語」の下に置き換え先だけが出る
  const [workplace, branch] = terms as [HTMLElement, HTMLElement];
  workplace.focus();
  const workplaceTip = tipInWrap(workplace);
  expect(isOpen(workplaceTip)).toBe(true);
  expect(tipHeadings(workplaceTip)).toEqual(["代わりの用語"]);
  expect(find(workplaceTip, ".mdmark-term-tip-replacement").textContent).toBe(
    "ワークスペース",
  );
  expect(workplaceTip.querySelector(".mdmark-term-tip-meaning")).toBeNull();
  // 枝: 「代わりの用語」の下に term の名前と説明が出る
  branch.focus();
  const branchTip = tipInWrap(branch);
  expect(isOpen(branchTip)).toBe(true);
  expect(tipHeadings(branchTip)).toEqual(["代わりの用語"]);
  expect(find(branchTip, ".mdmark-term-tip-replacement").textContent).toBe(
    "ブランチ",
  );
  expect(find(branchTip, ".mdmark-term-tip-meaning").textContent).toBe(
    "作業を分ける線",
  );
});

// 同じ単語が索引・エイリアス・表にあるとき、索引 → エイリアス → 描く文書の表の順で先の意味を出す（正常系）
test("test_normal_when_aliases_have_same_term", async () => {
  // 準備
  const el = createElement();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "guide", path: "guide.md", title: "ガイド" }],
    terms: [{ id: "mark", term: "マーカー", meaning: "索引に記載した意味" }],
  };
  const aliases = rawAliases([
    {
      alias_type: "term",
      id: "mark",
      name: "マーカー",
      aliases: [],
      description: "エイリアスに記載した意味",
    },
    {
      alias_type: "term",
      id: "mark-word",
      name: "マーク",
      aliases: [],
      description: "エイリアスに記載したマークの意味",
    },
  ]);
  const markdown = [
    '<!-- glossary: {"term": {"column": "用語"}, "aliases": {"column": "別名"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 別名 | 意味 |",
    "| --- | --- | --- |",
    "| マーカー | マーク、オン・オフのマーカー | HTML コメントで記載する指定 |",
    "",
    "<!-- /glossary -->",
    "",
    "マーカー、マーク、オン・オフのマーカーを記載する。",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown, index, docId: "guide", aliases });
  // 検証
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual([
    "マーカー",
    "マーク",
    "オン・オフのマーカー",
  ]);
  const meanings = terms.map(
    (term) => find(tipInWrap(term), ".mdmark-term-tip-meaning").textContent,
  );
  expect(meanings).toEqual([
    "索引に記載した意味",
    "エイリアスに記載したマークの意味",
    "HTML コメントで記載する指定",
  ]);
  expect(el.textContent).not.toContain("エイリアスに記載した意味");
});

// 文書のマーカーで glossary をオフにした文書では、指定したエイリアスを照合しない（正常系）
test("test_normal_when_aliases_glossary_disabled", async () => {
  // 準備
  const el = createElement();
  const aliases = rawAliases([
    UNIT_TEST_ALIAS,
    {
      alias_type: "avoid",
      id: "workplace",
      name: "作業場",
      aliases: [],
      replacement: "ワークスペース",
    },
  ]);
  const markdown =
    '<!-- features: {"glossary": false} -->\n\n単体テストと作業場を記載する。\n';
  // 実行
  await mountTracked(el, { markdown, aliases });
  // 検証
  expect(el.querySelector(".mdmark-term")).toBeNull();
  expect(el.querySelector('[role="tooltip"]')).toBeNull();
  expect(el.textContent).not.toContain("npm run test:unit");
  expect(paragraphTexts(el)).toEqual(["単体テストと作業場を記載する。"]);
});

// update で本文を差し替えても、描いたときのエイリアスでもう一度照合する（正常系）
test("test_normal_when_aliases_updated", async () => {
  // 準備
  const el = createElement();
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "ws",
      name: "ワークスペース",
      aliases: [],
      description: "話し合いの記録を配置するフォルダ",
    },
  ];
  const handle = await mountTracked(el, {
    markdown: "ここがワークスペース。\n",
    aliases,
  });
  // 検証: 描いた直後
  const first = find<HTMLElement>(el, ".mdmark-term");
  expect(first.textContent).toBe("ワークスペース");
  expect(find(tipInWrap(first), ".mdmark-term-tip-meaning").textContent).toBe(
    "話し合いの記録を配置するフォルダ",
  );
  // 実行
  handle.update("別の段落のワークスペース。\n");
  // 検証: 差し替えた後
  const second = find<HTMLElement>(el, ".mdmark-term");
  expect(el.querySelectorAll(".mdmark-term")).toHaveLength(1);
  expect(second.textContent).toBe("ワークスペース");
  expect(find(tipInWrap(second), ".mdmark-term-tip-meaning").textContent).toBe(
    "話し合いの記録を配置するフォルダ",
  );
  expect(el.textContent).toContain("別の段落の");
});

// 必須のキーが空・知らない種類・重なった ID のエイリアスを除いて描き、http・https でない URL はリンクにしない（異常系）
test("test_error_when_invalid_alias", async () => {
  // 準備
  const el = createElement();
  const aliases = rawAliases([
    {
      alias_type: "term",
      id: "review",
      name: "レビュー",
      aliases: [],
      description: "変更を別の人が確認すること",
    },
    { alias_type: "command", id: "build", name: "ビルド", aliases: [] },
    { alias_type: "memo", id: "memo", name: "メモ", aliases: [] },
    {
      alias_type: "term",
      id: "review",
      name: "査定",
      aliases: [],
      description: "重なった ID",
    },
    {
      alias_type: "url",
      id: "bad-link",
      name: "危ないリンク",
      aliases: [],
      url: "javascript:alert(1)",
    },
  ]);
  const markdown = "レビュー、ビルド、メモ、査定、危ないリンクを記載する。\n";
  const { mount } = await loadBuilt();
  let handle: MountHandle | undefined;
  // 実行
  expect(() => {
    handle = mount(el, { markdown, aliases });
  }).not.toThrow();
  if (handle) {
    handles.push(handle);
  }
  // 検証
  const body = find(el, ":scope > p").cloneNode(true) as Element;
  for (const tip of body.querySelectorAll(".mdmark-term-tip")) {
    tip.remove();
  }
  expect(body.textContent).toBe(
    "レビュー、ビルド、メモ、査定、危ないリンクを記載する。",
  );
  expect(el.querySelector(".mdmark-notice")).toBeNull();
  const terms = [...el.querySelectorAll<HTMLElement>(".mdmark-term")];
  expect(terms.map((term) => term.textContent)).toEqual([
    "レビュー",
    "危ないリンク",
  ]);
  // 危ないリンク: URL を文字で出し、リンクにしない
  const bad = terms[1] as HTMLElement;
  bad.focus();
  const tip = tipInWrap(bad);
  expect(isOpen(tip)).toBe(true);
  expect(tip.textContent).toContain("javascript:alert(1)");
  expect(tip.querySelector("a")).toBeNull();
});

/** `app/` の下に `src/`、その下に `parts/`、その下に `tree.ts` を持つツリーのコードブロックの行 */
const NESTED_TREE_LINES = [
  "```tree",
  "app/",
  "└── src/",
  "    └── parts/",
  "        └── tree.ts",
  "```",
];

/** ツリーの中の、名前のフォルダの開閉のボタンを返却する */
function folderToggle(tree: Element, name: string): HTMLButtonElement {
  const toggle = [
    ...tree.querySelectorAll<HTMLButtonElement>("button.mdmark-tree-toggle"),
  ].find((candidate) => candidate.textContent?.trim().startsWith(name));
  if (!toggle) {
    throw new Error(`開閉のボタンが無い: ${name}`);
  }
  return toggle;
}

/** ツリーの中の、フォルダの開閉のボタンの `aria-expanded` を名前の順に返却する */
function foldersExpanded(tree: Element, names: string[]): Array<string | null> {
  return names.map((name) =>
    folderToggle(tree, name).getAttribute("aria-expanded"),
  );
}

/** ボタンが開閉する入れ子の `ul` を返却する */
function foldedList(toggle: HTMLElement): HTMLElement {
  const list = document.getElementById(
    toggle.getAttribute("aria-controls") ?? "",
  );
  if (!list) {
    throw new Error("aria-controls が指す ul が無い");
  }
  return list;
}

/** ボタンの `::before`（フォルダのアイコン）の `mask-image` */
function folderIcon(toggle: HTMLElement): string {
  return getComputedStyle(find(toggle, ".mdmark-tree-name"), "::before")
    .maskImage;
}

/** Shift を押しながら要素を押す */
function shiftClick(element: Element): void {
  element.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    }),
  );
}

// ファイルツリーを depth の階層まで（省くと全てのフォルダを）開いて描き、フォルダの名前・アイコンの押下と Enter で開閉し、Shift を押しながらなら入れ子も同じ状態にする（正常系）
test("test_normal_when_tree_folders_toggled", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      ...NESTED_TREE_LINES,
      "",
      '<!-- tree: {"depth": 2} -->',
      "",
      ...NESTED_TREE_LINES,
      "",
      '<!-- tree: {"depth": 1} -->',
      "",
      ...NESTED_TREE_LINES,
      "",
    ].join("\n"),
  });
  const [all, second, first] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-tree"),
  ] as [HTMLElement, HTMLElement, HTMLElement];
  const names = ["app/", "src/", "parts/"];
  // 検証: mount の直後
  for (const toggle of first.querySelectorAll<HTMLButtonElement>(
    "button.mdmark-tree-toggle",
  )) {
    expect(toggle.type).toBe("button");
    expect(foldedList(toggle).tagName).toBe("UL");
  }
  expect(foldersExpanded(all, names)).toEqual(["true", "true", "true"]);
  expect(isShown(find(all, ".mdmark-tree-file .mdmark-tree-name"))).toBe(true);
  expect(foldersExpanded(second, names)).toEqual(["true", "true", "false"]);
  expect(foldersExpanded(first, names)).toEqual(["true", "false", "false"]);
  expect(foldedList(folderToggle(first, "src/")).getAttribute("hidden")).toBe(
    "until-found",
  );
  // 検証: フォルダのアイコンは、開いたフォルダと閉じたフォルダで構造が違う
  expect(folderIcon(folderToggle(first, "app/"))).not.toBe(
    folderIcon(folderToggle(first, "src/")),
  );
  // 実行: src/ の名前を押す
  const src = folderToggle(first, "src/");
  find<HTMLElement>(src, ".mdmark-tree-name").click();
  // 検証
  expect(foldersExpanded(first, names)).toEqual(["true", "true", "false"]);
  expect(isShown(folderToggle(first, "parts/"))).toBe(true);
  // 実行: src/ の開閉のボタンで Enter を押す
  src.focus();
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(src.getAttribute("aria-expanded")).toBe("false");
  // 実行: Shift を押しながら src/ のボタンを押す
  shiftClick(src);
  // 検証
  expect(foldersExpanded(first, names)).toEqual(["true", "true", "true"]);
  expect(isShown(find(first, ".mdmark-tree-file .mdmark-tree-name"))).toBe(
    true,
  );
  // 実行: もう一度 Shift を押しながら押すと、入れ子も閉じる
  shiftClick(src);
  expect(foldersExpanded(first, names)).toEqual(["true", "false", "false"]);
  // 実行: ページ内検索が閉じたフォルダの中に該当する
  foldedList(src).dispatchEvent(new Event("beforematch", { bubbles: true }));
  // 検証
  expect(src.getAttribute("aria-expanded")).toBe("true");
  expect(foldedList(src).hasAttribute("hidden")).toBe(false);
});

/** コピーするツリーの Markdown と、`data-source` になる罫線のテキスト */
const COPY_TREE_LINES = ["app/", "└── src/ # ソース", "    └── tree.ts"];

// ツリーの帯のコピーボタンで、元の罫線のテキストをクリップボードへ書き込み、ボタンで通知する（正常系）
test("test_normal_when_tree_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: ["```tree", ...COPY_TREE_LINES, "```", ""].join("\n"),
  });
  const tree = find<HTMLElement>(el, ".mdmark-tree");
  const bar = find(tree, ".mdmark-tree-bar");
  const button = find<HTMLButtonElement>(bar, "button.mdmark-tree-copy");
  expect(find(bar, ".mdmark-tree-kind").textContent).toBe("tree");
  expect(button.type).toBe("button");
  expect(button.textContent).toBe("コピー");
  // 実行: src/ を閉じてから押す
  folderToggle(tree, "src/").click();
  expect(folderToggle(tree, "src/").getAttribute("aria-expanded")).toBe(
    "false",
  );
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(COPY_TREE_LINES.join("\n"));
  expect(button.dataset.state).toBe("copied");
  expect(button.textContent).toBe("コピーしました");
  expect(find(tree, '[role="status"]').textContent).toContain("コピーしました");
  // 実行・検証: 2 秒たつとボタンが戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
  expect(button.textContent).toBe("コピー");
});

// クリップボードに書き込めなければ、元の罫線のテキストを選択したパネルをツリーの下に出し、Esc と閉じるボタンで閉じてコピーボタンへフォーカスを戻す（正常系）
test("test_normal_when_tree_copy_denied", async () => {
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
    markdown: ["```tree", ...COPY_TREE_LINES, "```", ""].join("\n"),
  });
  const tree = find<HTMLElement>(el, ".mdmark-tree");
  const button = find<HTMLButtonElement>(tree, "button.mdmark-tree-copy");
  try {
    // 実行
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    // 検証: ツリーの下にパネルがあり、元の罫線のテキストが全て選ばれている
    const panel = find<HTMLElement>(tree, ".mdmark-copy-panel");
    expect(panel.getAttribute("role")).toBe("group");
    expect(find(tree, ".mdmark-tree-list").nextElementSibling).toBe(panel);
    const textarea = find<HTMLTextAreaElement>(panel, "textarea");
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe(COPY_TREE_LINES.join("\n"));
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
    expect(document.activeElement).toBe(textarea);
    const status = find(tree, '[role="status"]').textContent ?? "";
    expect(status).toContain("コピーできませんでした");
    expect(status).toContain("手動でコピー");
    expect(rejections).toHaveLength(0);
    // 実行・検証: Esc で閉じる
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(tree.querySelector(".mdmark-copy-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
    // 実行・検証: もう一度コピーすると、書き込みをもう一度試し、パネルは 1 つだけ
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(tree.querySelectorAll(".mdmark-copy-panel")).toHaveLength(1);
    // 実行・検証: 閉じるボタンでも閉じて、コピーボタンへフォーカスを戻す
    find<HTMLButtonElement>(tree, 'button[aria-label="閉じる"]').click();
    expect(tree.querySelector(".mdmark-copy-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
    // 実行・検証: クリップボードが無いページでも、同じパネルが出る
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(tree.querySelectorAll(".mdmark-copy-panel")).toHaveLength(1);
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

/** 要素が見えているか。閉じた `details` の中身のように描かれない要素は見えていない（`checkVisibility` が描かれない祖先も確認する） */
function isVisible(element: Element | null | undefined): boolean {
  return element?.checkVisibility() ?? false;
}

// 閉じたタブとステップを見出しだけで描き、見出しを押すと開き、開いたタブも切り替えられる（正常系）
test("test_normal_when_folded_tabs_and_steps_opened", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      '<!-- tabs: {"collapse": {"open": false}} -->',
      "",
      "### uv",
      "",
      "uv で入れる",
      "",
      "### pip",
      "",
      "pip で入れる",
      "",
      "<!-- /tabs -->",
      "",
      '<!-- steps: {"collapse": {"open": false, "title": "準備"}} -->',
      "",
      "1. 一つ目",
      "2. 二つ目",
      "",
      "<!-- /steps -->",
      "",
    ].join("\n"),
  });
  const [tabsFold, stepsFold] = [
    ...el.querySelectorAll<HTMLDetailsElement>("details.mdmark-collapsible"),
  ] as [HTMLDetailsElement, HTMLDetailsElement];
  // 検証: mount の直後は見出しだけが見える
  expect(tabsFold.open).toBe(false);
  expect(stepsFold.open).toBe(false);
  expect(find(tabsFold, "summary").textContent).toBe("タブ（uv・pip）");
  expect(find(stepsFold, "summary").textContent).toBe("準備");
  expect(isVisible(find(tabsFold, '[role="tablist"]'))).toBe(false);
  expect(isVisible(find(stepsFold, "li"))).toBe(false);
  // 実行: タブの見出しを押す
  find<HTMLElement>(tabsFold, "summary").click();
  // 検証: タブの並びと uv の中身が見える
  expect(tabsFold.open).toBe(true);
  expect(isVisible(find(tabsFold, '[role="tablist"]'))).toBe(true);
  const [uv, pip] = [
    ...tabsFold.querySelectorAll<HTMLElement>('[role="tab"]'),
  ] as [HTMLElement, HTMLElement];
  expect(uv.getAttribute("aria-selected")).toBe("true");
  expect(isVisible(find(tabsFold, '[role="tabpanel"]'))).toBe(true);
  // 実行: pip のタブを押す
  pip.click();
  // 検証
  expect(pip.getAttribute("aria-selected")).toBe("true");
  const panels = [
    ...tabsFold.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
  ];
  expect(panels.map((panel) => isVisible(panel))).toEqual([false, true]);
  // 実行: ステップの見出しにフォーカスして Enter を押す
  find<HTMLElement>(stepsFold, "summary").focus();
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(stepsFold.open).toBe(true);
  expect(
    [...stepsFold.querySelectorAll("li")].map((item) => isVisible(item)),
  ).toEqual([true, true]);
});

/** 指定した大きさと色で塗った PNG の data: URL（手元の画像の応答の代わり） */
function pngUrl(options: {
  width: number;
  height: number;
  color: string;
}): string {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = options.color;
    context.fillRect(0, 0, options.width, options.height);
  }
  return canvas.toDataURL("image/png");
}

/** 無限ループで、フレームの間隔が 100ms の GIF（モックの見本） */
const ANIMATED_GIF_URL = new URL(
  "../../../docs/mock/refs/263/assets/media/build.gif",
  import.meta.url,
).href;

/** 2 つの `rgb(r, g, b)` の色のコントラスト比（WCAG 2） */
function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light = 0, dark = 0] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** 色の式を、要素の中で解決した computed の色の文字列にする */
function resolveColorIn(el: HTMLElement, expression: string): string {
  const probe = document.createElement("span");
  probe.style.color = expression;
  el.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** 開いているライトボックス（無ければ undefined） */
function openLightbox(el: HTMLElement): HTMLDialogElement | undefined {
  const dialog = el.querySelector<HTMLDialogElement>("dialog.mdmark-lightbox");
  return dialog?.open ? dialog : undefined;
}

/** ライトボックスの画像の src と枚数の表示 */
function lightboxState(el: HTMLElement): { src: string; count: string } {
  const dialog = openLightbox(el);
  if (!dialog) {
    throw new Error("ライトボックスが開いていない");
  }
  return {
    src: find<HTMLImageElement>(dialog, ".mdmark-lightbox-stage img").src,
    count: find(dialog, ".mdmark-lightbox-count").textContent ?? "",
  };
}

// 画像を押すと全画面のダイアログで拡大し、前後に切り替え、Esc と背景で閉じて押した画像へフォーカスを戻す（正常系）
test("test_normal_when_lightbox_opened", async () => {
  // 準備
  const [a, b, c] = ["#0f766e", "#b45309", "#6d28d9"].map((color) =>
    pngUrl({ width: 320, height: 200, color }),
  ) as [string, string, string];
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      `![画像 a](${a})`,
      "",
      "本文の段落。",
      "",
      `![画像 b](${b})`,
      "",
      "本文の段落。",
      "",
      `![画像 c](${c})`,
      "",
    ].join("\n"),
  });
  const buttons = [
    ...el.querySelectorAll<HTMLButtonElement>("button.mdmark-image-open"),
  ];
  // 検証: 3 つの画像が拡大のボタンに入っている
  expect(buttons).toHaveLength(3);
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "画像を拡大: 画像 a",
    "画像を拡大: 画像 b",
    "画像を拡大: 画像 c",
  ]);
  expect(buttons.map((button) => button.type)).toEqual([
    "button",
    "button",
    "button",
  ]);
  const second = buttons[1] as HTMLButtonElement;
  const scrollY = window.scrollY;
  // 実行: 2 つ目を押す
  await userEvent.click(second);
  // 検証
  const dialog = openLightbox(el);
  expect(dialog).toBeDefined();
  expect(lightboxState(el)).toEqual({ src: b, count: "2 / 3" });
  for (const [tool, label] of [
    ["prev", "前の画像"],
    ["next", "次の画像"],
    ["close", "拡大を閉じる"],
  ]) {
    expect(
      find(dialog as HTMLElement, `[data-tool="${tool}"]`).getAttribute(
        "aria-label",
      ),
    ).toBe(label);
  }
  // 実行・検証: 右の矢印キーで次へ、前の画像のボタンを 2 回押して前へ送信する
  await userEvent.keyboard("{ArrowRight}");
  expect(lightboxState(el)).toEqual({ src: c, count: "3 / 3" });
  const prev = find<HTMLButtonElement>(
    dialog as HTMLElement,
    '[data-tool="prev"]',
  );
  await userEvent.click(prev);
  await userEvent.click(prev);
  expect(lightboxState(el)).toEqual({ src: a, count: "1 / 3" });
  // 実行・検証: Esc で閉じ、押した画像へフォーカスを戻す
  await userEvent.keyboard("{Escape}");
  await vi.waitFor(() => expect(openLightbox(el)).toBeUndefined());
  expect(document.activeElement).toBe(second);
  expect(window.scrollY).toBe(scrollY);
  // 実行・検証: もう一度開き、ダイアログの外の背景を押して閉じる
  await userEvent.click(second);
  const reopened = openLightbox(el) as HTMLDialogElement;
  expect(reopened).toBeDefined();
  await userEvent.click(reopened, { position: { x: -6, y: -6 }, force: true });
  await vi.waitFor(() => expect(openLightbox(el)).toBeUndefined());
  expect(document.activeElement).toBe(second);
});

// ライトボックスの画像を図の全画面と同じボタンとキーで拡大・縮小し、拡大中は矢印キーで動かす（正常系）
test("test_normal_when_lightbox_zoomed", async () => {
  // 準備
  const a = pngUrl({ width: 1600, height: 1000, color: "#0f766e" });
  const b = pngUrl({ width: 1600, height: 1000, color: "#b45309" });
  const el = createElement();
  await mountTracked(el, {
    markdown: `![画像 a](${a})\n\n![画像 b](${b})\n`,
  });
  // 実行: 1 つ目の画像を押す
  await userEvent.click(find(el, "button.mdmark-image-open"));
  const dialog = openLightbox(el) as HTMLDialogElement;
  const stage = find<HTMLElement>(dialog, ".mdmark-lightbox-stage");
  const zoomButton = find(dialog, '[data-tool="fit"]');
  const pan = find<HTMLElement>(dialog, '[data-group="pan"]');
  const fit = Math.min(1, stage.clientWidth / 1600, stage.clientHeight / 1000);
  // 検証: 収まる倍率で出し、移動のボタンを出さない
  await vi.waitFor(() =>
    expect(zoomButton.textContent).toBe(`${Math.round(fit * 100)}%`),
  );
  expect(pan.hidden).toBe(true);
  // 実行・検証: + を 2 回押すと 1.25 倍ずつ上がり、移動のボタンを出す
  await userEvent.keyboard("+");
  expect(zoomButton.textContent).toBe(`${Math.round(fit * 1.25 * 100)}%`);
  await userEvent.keyboard("+");
  expect(zoomButton.textContent).toBe(
    `${Math.round(fit * 1.25 * 1.25 * 100)}%`,
  );
  expect(pan.hidden).toBe(false);
  expect(
    [...pan.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    ),
  ).toEqual(["左へ動かす", "上へ動かす", "下へ動かす", "右へ動かす"]);
  // 実行・検証: 拡大中の右の矢印キーは画像を動かし、送信しない
  const before = stage.scrollLeft;
  await userEvent.keyboard("{ArrowRight}");
  expect(stage.scrollLeft).toBeGreaterThan(before);
  expect(lightboxState(el).src).toBe(a);
  // 実行・検証: 0 で収まる倍率に戻してから右の矢印キーで送信する
  await userEvent.keyboard("0");
  await userEvent.keyboard("{ArrowRight}");
  expect(lightboxState(el).src).toBe(b);
  await vi.waitFor(() =>
    expect(zoomButton.textContent).toBe(`${Math.round(fit * 100)}%`),
  );
  expect(pan.hidden).toBe(true);
});

// nolightbox の画像を拡大のボタンで包まず、切り替えの並びから除外する（正常系）
test("test_normal_when_nolightbox", async () => {
  // 準備
  const [a, b, c] = ["#0f766e", "#b45309", "#6d28d9"].map((color) =>
    pngUrl({ width: 320, height: 200, color }),
  ) as [string, string, string];
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      `![画像 a](${a})`,
      "",
      `![アイコン](${b}){nolightbox}`,
      "",
      `![画像 c](${c})`,
      "",
    ].join("\n"),
  });
  // 検証: b の画像は包まず、フォーカスされない
  const icon = find<HTMLImageElement>(el, 'img[alt="アイコン"]');
  expect(icon.closest("button")).toBeNull();
  expect(icon.tabIndex).toBe(-1);
  expect(el.querySelectorAll("button.mdmark-image-open")).toHaveLength(2);
  // 実行: 1 つ目を押してから右の矢印キーを押す
  await userEvent.click(find(el, "button.mdmark-image-open"));
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(lightboxState(el)).toEqual({ src: c, count: "2 / 2" });
  await userEvent.keyboard("{Escape}");
});

/** GIF の範囲を撮った PNG の base64 */
function snapGif(el: HTMLElement): Promise<string> {
  return page.screenshot({
    element: find(el, ".mdmark-gif"),
    save: false,
  });
}

/** 500ms 空けて GIF の範囲を 2 枚撮り、画素が同じかを返却する */
async function gifStill(el: HTMLElement): Promise<boolean> {
  const first = await snapGif(el);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const second = await snapGif(el);
  return first === second;
}

// GIF に止める・再生するボタンを付け、押すたびに最初のフレームで止めるか動かす（正常系）
test("test_normal_when_gif_toggled", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: `![ビルド](${ANIMATED_GIF_URL})\n` });
  const toggle = await vi.waitFor(() =>
    find<HTMLButtonElement>(el, "button.mdmark-gif-toggle"),
  );
  // 検証: GIF を包み、停止のボタンを付ける
  expect(find(el, "img[data-gif]").closest(".mdmark-gif")).not.toBeNull();
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(toggle.getAttribute("aria-label")).toBe("GIF を停止");
  // 検証: 押す前は動いている
  expect(await gifStill(el)).toBe(false);
  const requests = performance.getEntriesByType("resource").length;
  // 実行: ボタンを押す
  await userEvent.click(toggle);
  // 検証: 止まり、再生のボタンになる
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(toggle.getAttribute("aria-label")).toBe("GIF を再生");
  expect(await gifStill(el)).toBe(true);
  // 実行: もう一度押す
  await userEvent.click(toggle);
  // 検証: 動き出す
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(await gifStill(el)).toBe(false);
  // 検証: 止める・再生するで外への要求が増えない
  expect(performance.getEntriesByType("resource").length).toBe(requests);
});

// prefers-reduced-motion: reduce のとき、GIF を止めた状態で描く（正常系）
test("test_normal_when_gif_reduced_motion", async () => {
  // 準備
  await cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  try {
    const el = createElement();
    // 実行
    await mountTracked(el, { markdown: `![ビルド](${ANIMATED_GIF_URL})\n` });
    const toggle = await vi.waitFor(() =>
      find<HTMLButtonElement>(el, "button.mdmark-gif-toggle"),
    );
    // 検証
    expect(await gifStill(el)).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("GIF を再生");
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

/** 色のプリセットの値（デザイン方針の既定のテーマ） */
const PRESET = {
  light: {
    greenText: "rgb(22, 101, 52)",
    greenBg: "rgb(203, 242, 210)",
    redText: "rgb(185, 28, 28)",
  },
  dark: {
    greenText: "rgb(74, 222, 128)",
    greenBg: "rgb(26, 56, 33)",
    redText: "rgb(248, 113, 113)",
  },
} as const;

/** 色とテーマごとの画像を持つ見本の Markdown */
function colorMarkdown(): string {
  const dark = pngUrl({ width: 200, height: 120, color: "#111113" });
  const light = pngUrl({ width: 200, height: 120, color: "#ffffff" });
  return [
    "`badge:green:完了` と [決め手の 1 文]{color=red}",
    "",
    `![暗い構成](${dark}#only-dark)`,
    "",
    `![明るい構成](${light}#only-light)`,
    "",
  ].join("\n");
}

/** バッジと本文の文字の色・太さと、テーマごとの画像の図の display */
function readColors(el: HTMLElement) {
  const badge = find(el, ".mdmark-badge[data-color]");
  const text = find(el, ".mdmark-color[data-color]");
  const figure = (alt: string) =>
    getComputedStyle(
      find(el, `img[alt="${alt}"]`).closest("figure") as HTMLElement,
    ).display;
  return {
    badgeText: getComputedStyle(badge).color,
    badgeBg: getComputedStyle(badge).backgroundColor,
    text: getComputedStyle(text).color,
    weight: getComputedStyle(text).fontWeight,
    bg: resolveColorIn(el, "var(--mdmark-color-bg)"),
    darkImage: figure("暗い構成"),
    lightImage: figure("明るい構成"),
  };
}

// 色の名前の要素に今の配色の色のプリセットを当て、今の配色に合わない画像を隠す（正常系）
test("test_normal_when_color_preset_and_theme_images", async () => {
  // 準備
  await emulateColorScheme("light");
  try {
    const el = createElement();
    // 実行
    await mountTracked(el, { markdown: colorMarkdown() });
    // 検証: 明るい配色
    const light = readColors(el);
    expect(light.badgeText).toBe(PRESET.light.greenText);
    expect(light.text).toBe(PRESET.light.redText);
    expect(light.weight).toBe("700");
    expect(light.lightImage).not.toBe("none");
    expect(light.darkImage).toBe("none");
    expect(
      contrastRatio(light.badgeText, light.badgeBg),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.text, light.bg)).toBeGreaterThanOrEqual(4.5);
    // 実行: 暗い配色にする
    await emulateColorScheme("dark");
    // 検証
    const dark = readColors(el);
    expect(dark.badgeText).toBe(PRESET.dark.greenText);
    expect(dark.text).toBe(PRESET.dark.redText);
    expect(dark.darkImage).not.toBe("none");
    expect(dark.lightImage).toBe("none");
    expect(contrastRatio(dark.badgeText, dark.badgeBg)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contrastRatio(dark.text, dark.bg)).toBeGreaterThanOrEqual(4.5);
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

// 印刷では明るい配色の色のプリセットで色を残し、明るい配色の画像・動画の poster・カードの URL を出し、操作のボタンを出さない（正常系）
test("test_normal_when_colors_and_media_printed", async () => {
  // 準備
  await emulateColorScheme("dark");
  try {
    const el = createElement();
    const poster = pngUrl({ width: 160, height: 90, color: "#1d4ed8" });
    const image = pngUrl({ width: 160, height: 90, color: "#0f766e" });
    await mountTracked(el, {
      markdown: [
        '<!-- table: {"kind": "data", "rows": {"colors": [{"column": "状態", "value": "完了", "color": "green"}]}} -->',
        "",
        "| 案件 | 状態 |",
        "| --- | --- |",
        "| 見積もり | 完了 |",
        "",
        "<!-- /table -->",
        "",
        colorMarkdown(),
        `![拡大する画像](${image})`,
        "",
        `![ビルド](${ANIMATED_GIF_URL})`,
        "",
        `![操作](demo.mp4 "操作の動画"){poster=${poster}}`,
        "",
        "https://example.com/docs",
        "",
        "[仕様書](files/spec.pdf)",
        "",
      ].join("\n"),
    });
    await vi.waitFor(() => find(el, "button.mdmark-gif-toggle"));
    // 実行: 印刷の media にする
    await cdp().send("Emulation.setEmulatedMedia", {
      media: "print",
      features: [{ name: "prefers-color-scheme", value: "dark" }],
    });
    // 検証: 色は明るい配色の値
    const colors = readColors(el);
    expect(
      getComputedStyle(find(el, "tr[data-color] td")).backgroundColor,
    ).toBe(PRESET.light.greenBg);
    expect(colors.badgeText).toBe(PRESET.light.greenText);
    expect(colors.text).toBe(PRESET.light.redText);
    // 検証: 明るい配色の画像を出す
    expect(colors.lightImage).not.toBe("none");
    expect(colors.darkImage).toBe("none");
    // 検証: 操作のボタンを出さない
    expect(getComputedStyle(find(el, "button.mdmark-gif-toggle")).display).toBe(
      "none",
    );
    expect(getComputedStyle(find(el, ".mdmark-image-open-icon")).display).toBe(
      "none",
    );
    // 検証: 動画の代わりに poster とキャプションを出す
    expect(getComputedStyle(find(el, "video")).display).toBe("none");
    const printed = find<HTMLImageElement>(el, "img.mdmark-media-print");
    expect(printed.getAttribute("src")).toBe(poster);
    expect(getComputedStyle(printed).display).not.toBe("none");
    expect(
      getComputedStyle(find(el, ".mdmark-media figcaption")).display,
    ).not.toBe("none");
    // 検証: リンクのカードと添付のカードに、リンク先の URL の文字を出す
    for (const [kind, url] of [
      ["link", "https://example.com/docs"],
      ["file", "spec.pdf"],
    ] as const) {
      const text = find(
        el,
        `a.mdmark-card[data-card="${kind}"] .mdmark-card-url`,
      );
      expect(getComputedStyle(text).display, kind).not.toBe("none");
      expect(text.textContent, kind).toBe(url);
    }
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

// opts.config.colorTheme で選んだテーマの色のプリセットで色の名前の要素を描く（正常系）
test("test_normal_when_color_preset_in_theme", async () => {
  // 準備
  await emulateColorScheme("light");
  try {
    const el = createElement();
    // 実行
    await mountTracked(el, {
      markdown: "`badge:green:完了` と [決め手の 1 文]{color=red}\n",
      config: { colorTheme: "theme-slate" },
    });
    // 検証: theme-slate の明るい配色の値
    const badge = find(el, ".mdmark-badge[data-color]");
    const text = find(el, ".mdmark-color[data-color]");
    expect(getComputedStyle(badge).color).toBe("rgb(4, 105, 76)");
    expect(getComputedStyle(text).color).toBe("rgb(185, 28, 28)");
    expect(
      contrastRatio(
        getComputedStyle(badge).color,
        getComputedStyle(badge).backgroundColor,
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(
        getComputedStyle(text).color,
        resolveColorIn(el, "var(--mdmark-color-bg)"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

// 利用側が層の外で記載した色のプリセットの CSS 変数が、色の名前の要素に該当する（正常系）
test("test_normal_when_color_preset_overridden", async () => {
  // 準備
  const style = document.createElement("style");
  style.textContent =
    ".mdmark { --mdmark-color-accent-blue-text: rgb(0, 0, 128); --mdmark-color-accent-blue-bg: rgb(230, 240, 255) }";
  document.head.append(style);
  addedStyles.push(style);
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: "`badge:blue:参考` と [決め手の 1 文]{color=blue}\n",
  });
  // 検証
  const badge = find(el, ".mdmark-badge[data-color]");
  expect(getComputedStyle(badge).color).toBe("rgb(0, 0, 128)");
  expect(getComputedStyle(badge).backgroundColor).toBe("rgb(230, 240, 255)");
  expect(getComputedStyle(find(el, ".mdmark-color")).color).toBe(
    "rgb(0, 0, 128)",
  );
});

/** 要素の最初の行の縦の中ほど（画面の上端から） */
function lineMiddle(element: Element): number {
  const rect = element.getClientRects()[0] ?? element.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

/** 余白のマーカーの縦の中ほど（画面の上端から） */
function markerMiddle(marker: Element): number {
  const rect = marker.getBoundingClientRect();
  return rect.top + rect.height / 2;
}

/** 余白の列の余白のマーカーを上から並べて返却する */
function marginMarkers(el: Element): HTMLButtonElement[] {
  return [
    ...el.querySelectorAll<HTMLButtonElement>(
      ":scope > .mdmark-comment-margin > button.mdmark-comment-marker",
    ),
  ];
}

/** 選んだ文字を `aria-label` に持つ余白のマーカーを返却する */
function markerOf(el: Element, quote: string): HTMLButtonElement {
  const found = marginMarkers(el).find((marker) =>
    marker.getAttribute("aria-label")?.includes(`「${quote}」`),
  );
  if (!found) {
    throw new Error(`「${quote}」の余白のマーカーが無い`);
  }
  return found;
}

/** 選んだ文字のコメントのマーカーを返却する */
function commentMarkOf(el: Element, quote: string): HTMLElement {
  const found = [
    ...el.querySelectorAll<HTMLElement>("mark.mdmark-comment-mark"),
  ].find((mark) => mark.textContent === quote);
  if (!found) {
    throw new Error(`「${quote}」のマーカーが無い`);
  }
  return found;
}

/** 前後の文字を持たない、選んだ文字だけのコメント */
function quoteComment(id: string, quote: string): MdmarkComment {
  return { id, quote, prefix: "", suffix: "", body: `${quote}へのコメント` };
}

/** h2 の見出しを 1 つ持ち、画面の高さを超える段落を並べた文書 */
const MARGIN_MARKDOWN = [
  "## 問い合わせ",
  "",
  "電話は担当者が返却する割合が高く、返信の目安を超えやすい。",
  "",
  ...Array.from(
    { length: 40 },
    (_, i) => `間の段落 ${i + 1} は、画面の高さを超えるまで並べる本文。\n`,
  ),
  "描いた文書の外観はテーマの変数で変える。",
  "",
].join("\n");

// マーカーのある行の高さに余白のマーカーを配置し、押すとマーカーまでスクロールして吹き出しを開き、幅の変化でもう一度配置する（正常系）
test("test_normal_when_jumped_from_margin_marker", async () => {
  // 準備
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1280, 600);
  const el = createElement();
  setElementWidth(el, 960);
  const store = createCommentStore([
    quoteComment("c1", "テーマの変数"),
    quoteComment("c2", "担当者"),
    quoteComment("c3", "返信の目安"),
    quoteComment("c4", "無い文字"),
  ]);
  try {
    // 実行
    await mountTracked(el, {
      markdown: MARGIN_MARKDOWN,
      config: { features: { comments: true }, "side-toc": { mode: "hover" } },
      docId: "guide",
      commentStore: store,
    });
    // 検証
    await vi.waitFor(() => expect(marginMarkers(el)).toHaveLength(2));
    expect(
      [...el.children].map((child) => `${child.tagName}.${child.className}`),
    ).toEqual([
      "DIV.mdmark-content",
      "DIV.mdmark-comment-margin",
      expect.stringMatching(/^ASIDE\.mdmark-side-toc/),
      "BUTTON.mdmark-back-to-top",
    ]);
    expect(
      marginMarkers(el).some((marker) =>
        marker.getAttribute("aria-label")?.includes("無い文字"),
      ),
    ).toBe(false);
    const merged = markerOf(el, "担当者");
    expect(merged.textContent).toBe("2");
    expect(merged.getAttribute("aria-label")).toBe("コメント 2 件、「担当者」");
    expect(
      Math.abs(markerMiddle(merged) - lineMiddle(commentMarkOf(el, "担当者"))),
    ).toBeLessThanOrEqual(1);
    // 実行
    markerOf(el, "テーマの変数").click();
    // 検証
    const theme = commentMarkOf(el, "テーマの変数");
    await vi.waitFor(() =>
      expect(theme.getAttribute("aria-expanded")).toBe("true"),
    );
    const themeRect = theme.getBoundingClientRect();
    expect(themeRect.top).toBeGreaterThanOrEqual(0);
    expect(themeRect.bottom).toBeLessThanOrEqual(window.innerHeight);
    await vi.waitFor(() =>
      expect(markerOf(el, "テーマの変数").hasAttribute("data-current")).toBe(
        true,
      ),
    );
    // 実行
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(document.querySelector(".mdmark-comment-bubble")).toBeNull(),
    );
    await vi.waitFor(() =>
      expect(markerOf(el, "テーマの変数").hasAttribute("data-current")).toBe(
        false,
      ),
    );
    markerOf(el, "テーマの変数").focus();
    await userEvent.keyboard("{Enter}");
    // 検証
    await vi.waitFor(() =>
      expect(document.querySelector(".mdmark-comment-bubble")).not.toBeNull(),
    );
    expect(theme.getAttribute("aria-expanded")).toBe("true");
    // 実行
    await userEvent.keyboard("{Escape}");
    setElementWidth(el, 360);
    // 検証
    await vi.waitFor(() =>
      expect(
        Math.abs(
          markerMiddle(markerOf(el, "テーマの変数")) -
            lineMiddle(commentMarkOf(el, "テーマの変数")),
        ),
      ).toBeLessThanOrEqual(1),
    );
    // 実行
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    // 検証
    await vi.waitFor(() =>
      expect(getComputedStyle(find(el, ".mdmark-comment-margin")).display).toBe(
        "none",
      ),
    );
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
    await page.viewport(original.width, original.height);
  }
});

/** 閉じたセクション・選ばれていないタブ・閉じた行の詳細の中にマーカーの文字を配置した文書 */
const CLOSED_MARGIN_MARKDOWN = [
  "## 補足",
  "",
  '<!-- section: {"open": false} -->',
  "",
  "閉じた中の閉じた箇所を読み込む。",
  "",
  "## 手順",
  "",
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "macOS の手順",
  "",
  "### Windows",
  "",
  "Windows のタブの箇所を読み込む。",
  "",
  "<!-- /tabs -->",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| りんご | 1 |",
  "| みかん | 2 |",
  "",
  "<!-- /table -->",
  "",
  '<!-- row-detail: {"at": 1} -->',
  "",
  "りんごの行の箇所を読み込む。",
  "",
  "<!-- /row-detail -->",
  "",
].join("\n");

/** マーカーを包むいちばん外側の閉じた要素を `aria-controls` で指す開くボタン */
function openerOfMark(
  el: Element,
  mark: Element,
  selector: string,
): HTMLElement {
  const closed = mark.closest(selector) as HTMLElement;
  return find<HTMLElement>(el, `[aria-controls="${CSS.escape(closed.id)}"]`);
}

// 閉じた中のマーカーは開くボタンの行に破線のマーカーを配置し、押すと開いてからマーカーへ移る（正常系）
test("test_normal_when_margin_marker_in_closed", async () => {
  // 準備
  const el = createElement();
  const store = createCommentStore([
    quoteComment("c1", "閉じた箇所"),
    quoteComment("c2", "タブの箇所"),
    quoteComment("c3", "行の箇所"),
  ]);
  // 実行
  await mountTracked(el, {
    markdown: CLOSED_MARGIN_MARKDOWN,
    config: { features: { comments: true, "side-toc": false } },
    docId: "guide",
    commentStore: store,
  });
  // 検証
  await vi.waitFor(() => expect(marginMarkers(el)).toHaveLength(3));
  const content = el.children[0] as HTMLElement;
  const margin = el.children[1] as HTMLElement;
  expect(el.children).toHaveLength(3);
  expect(content.matches("div.mdmark-content")).toBe(true);
  expect(margin.matches("div.mdmark-comment-margin")).toBe(true);
  expect(el.children[2]?.matches("button.mdmark-back-to-top")).toBe(true);
  const contentRect = content.getBoundingClientRect();
  const marginRect = margin.getBoundingClientRect();
  expect(Math.abs(marginRect.top - contentRect.top)).toBeLessThanOrEqual(1);
  expect(marginRect.left).toBeGreaterThan(contentRect.right);
  const sectionMarker = markerOf(el, "閉じた箇所");
  expect(sectionMarker.dataset.closed).toBe("section");
  expect(sectionMarker.getAttribute("aria-label")).toBe(
    "コメント 「閉じた箇所」（閉じたセクションの中）",
  );
  const sectionOpener = openerOfMark(
    el,
    commentMarkOf(el, "閉じた箇所"),
    "[hidden]",
  );
  expect(
    Math.abs(markerMiddle(sectionMarker) - lineMiddle(sectionOpener)),
  ).toBeLessThanOrEqual(1);
  const tabMarker = markerOf(el, "タブの箇所");
  expect(tabMarker.dataset.closed).toBe("tab");
  const tab = openerOfMark(
    el,
    commentMarkOf(el, "タブの箇所"),
    '[role="tabpanel"]',
  );
  expect(tab.textContent).toContain("Windows");
  expect(
    Math.abs(markerMiddle(tabMarker) - lineMiddle(tab)),
  ).toBeLessThanOrEqual(1);
  const rowMarker = markerOf(el, "行の箇所");
  expect(rowMarker.dataset.closed).toBe("row");
  const rowToggle = openerOfMark(
    el,
    commentMarkOf(el, "行の箇所"),
    ".mdmark-row-detail",
  );
  expect(rowToggle.closest("tr")?.textContent).toContain("りんご");
  expect(
    Math.abs(markerMiddle(rowMarker) - lineMiddle(rowToggle)),
  ).toBeLessThanOrEqual(1);
  // 実行
  sectionMarker.click();
  // 検証
  const closedMark = commentMarkOf(el, "閉じた箇所");
  await vi.waitFor(() =>
    expect(closedMark.getAttribute("aria-expanded")).toBe("true"),
  );
  expect(sectionOpener.getAttribute("aria-expanded")).toBe("true");
  const closedRect = closedMark.getBoundingClientRect();
  expect(closedRect.top).toBeGreaterThanOrEqual(0);
  expect(closedRect.bottom).toBeLessThanOrEqual(window.innerHeight);
  await vi.waitFor(() => {
    const moved = markerOf(el, "閉じた箇所");
    expect(moved.hasAttribute("data-closed")).toBe(false);
    expect(
      Math.abs(markerMiddle(moved) - lineMiddle(closedMark)),
    ).toBeLessThanOrEqual(1);
  });
  // 実行
  await userEvent.keyboard("{Escape}");
  tab.click();
  // 検証
  await vi.waitFor(() => {
    const moved = markerOf(el, "タブの箇所");
    expect(moved.hasAttribute("data-closed")).toBe(false);
    expect(
      Math.abs(
        markerMiddle(moved) - lineMiddle(commentMarkOf(el, "タブの箇所")),
      ),
    ).toBeLessThanOrEqual(1);
  });
});

// ─── 比較元の Markdown・列の表示の通知・コメントの修正と削除と再読み込みと移動 ───

// 比較元: 段落 A・B・C。段落 C は空行どうしで合わないよう 2 行にする
const BASE_MARKDOWN = [
  "比較元の段落 A です。",
  "",
  "削除する段落 B です。",
  "",
  "残す段落 C の 1 行目です。",
  "残す段落 C の 2 行目です。",
  "",
].join("\n");

// 描く Markdown: 段落 A の単語を 1 つ書き換え、段落 B を削除し、段落 C の後に段落 D を追加する
const BASE_TARGET = [
  "書き換えた段落 A です。",
  "",
  "残す段落 C の 1 行目です。",
  "残す段落 C の 2 行目です。",
  "",
  "追加した段落 D です。",
  "",
].join("\n");

/** 差分のブロックの種類ごとに、包んだ段落の文字を上から順に返却する */
function diffBlockTexts(el: HTMLElement, kind: "add" | "del"): string[] {
  return [
    ...el.querySelectorAll(`div.mdmark-diff-block[data-kind="${kind}"]`),
  ].map((block) => block.querySelector("p")?.textContent ?? "");
}

/** 文字を含む段落 */
function paragraphWith(el: HTMLElement, text: string): HTMLElement {
  const found = [...el.querySelectorAll<HTMLElement>("p")].find((p) =>
    p.textContent?.includes(text),
  );
  if (!found) {
    throw new Error(`段落が見つからない: ${text}`);
  }
  return found;
}

// 比較元を指定すると、取り出し元を使用せずに本文の中のブロックを追加と削除の色で塗り分ける（正常系）
test("test_normal_when_base_markdown", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: BASE_TARGET,
    baseMarkdown: BASE_MARKDOWN,
  });
  // 検証
  expect(diffBlockTexts(el, "add")).toEqual([
    "書き換えた段落 A です。",
    "追加した段落 D です。",
  ]);
  expect(
    paragraphWith(el, "残す段落 C").closest(".mdmark-diff-block"),
  ).toBeNull();
  const del = [
    ...el.querySelectorAll<HTMLElement>(
      'div.mdmark-diff-block[data-kind="del"]',
    ),
  ].find((block) => block.textContent?.includes("削除する段落 B です。"));
  if (!del) {
    throw new Error("段落 B の削除のブロックが無い");
  }
  expect(
    del.compareDocumentPosition(paragraphWith(el, "書き換えた段落 A")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(el.querySelector(".mdmark-diff-toggle")).toBeNull();
  expect(el.querySelector(".mdmark-diff")).toBeNull();
});

// update の第 2 引数で比較元を差し替え、省くと前の比較元を保ち、null で強調を解除する（正常系）
test("test_normal_when_base_replaced", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: BASE_TARGET,
    baseMarkdown: BASE_MARKDOWN,
  });
  const nextBase = BASE_TARGET.replace("\n追加した段落 D です。\n", "");
  const plain = createElement();
  await mountTracked(plain, { markdown: BASE_TARGET });
  // 実行・検証: 次の比較元へ差し替える
  handle.update(BASE_TARGET, { baseMarkdown: nextBase });
  expect(diffBlockTexts(el, "add")).toEqual(["追加した段落 D です。"]);
  expect(el.querySelector('div.mdmark-diff-block[data-kind="del"]')).toBeNull();
  // 実行・検証: 第 2 引数を省くと前の比較元のまま
  handle.update(BASE_TARGET);
  expect(diffBlockTexts(el, "add")).toEqual(["追加した段落 D です。"]);
  // 実行・検証: null で強調を解除する
  handle.update(BASE_TARGET, { baseMarkdown: null });
  expect(el.querySelector(".mdmark-diff-block")).toBeNull();
  expect(el.innerHTML).toBe(plain.innerHTML);
});

// 取り出し元と比較元を両方渡すと、本文の強調は比較元で行い、取り出し元は差分を開く UI にだけ使用する（正常系）
test("test_normal_when_base_with_diff_source", async () => {
  // 準備
  const blocksSource = createDiffSource();
  const el = createElement();
  // 実行: diffMode: "blocks"
  await mountTracked(el, {
    markdown: BASE_TARGET,
    baseMarkdown: BASE_MARKDOWN,
    docId: "guide",
    diffSource: blocksSource,
    diffMode: "blocks",
  });
  await settle();
  // 検証
  expect(diffBlockTexts(el, "add")).toEqual([
    "書き換えた段落 A です。",
    "追加した段落 D です。",
  ]);
  expect(blocksSource.revisionsCalls).toEqual([]);
  expect(blocksSource.contentCalls).toEqual([]);
  // 実行: diffMode を省く
  const source = createDiffSource();
  const other = createElement();
  await mountTracked(other, {
    markdown: BASE_TARGET,
    baseMarkdown: BASE_MARKDOWN,
    docId: "guide",
    diffSource: source,
  });
  // 検証
  expect(diffBlockTexts(other, "add")).toEqual([
    "書き換えた段落 A です。",
    "追加した段落 D です。",
  ]);
  const toggle = diffToggle(other);
  expect(source.revisionsCalls).toEqual([]);
  // 実行
  toggle.click();
  // 検証
  await waitForDiffLines(other);
  expect(source.revisionsCalls).toEqual(["guide"]);
});

// 比較元が文字列でも null でもないと、描かずに TypeError を投げる（異常系）
test("test_error_when_base_not_string", async () => {
  // 準備
  const { mount } = await loadBuilt();
  const el = createElement();
  // 実行・検証: mount
  expect(() =>
    mount(el, {
      markdown: BASE_TARGET,
      baseMarkdown: 1 as unknown as string,
    }),
  ).toThrow(/baseMarkdown/);
  expect(el.innerHTML).toBe("");
  expect(el.classList.contains("mdmark")).toBe(false);
  // 実行・検証: update
  const handle = await mountTracked(el, { markdown: BASE_TARGET });
  const before = el.innerHTML;
  expect(() =>
    handle.update(BASE_TARGET, { baseMarkdown: 1 as unknown as string }),
  ).toThrow(TypeError);
  expect(() =>
    handle.update(BASE_TARGET, { baseMarkdown: 1 as unknown as string }),
  ).toThrow(/baseMarkdown/);
  expect(el.innerHTML).toBe(before);
});

// 表のマーカーで囲まない表と、列の表示を持つ表を 2 つ持つ文書
const COLUMNS_MARKDOWN = [
  "| 項目 | 値 |",
  "| --- | --- |",
  "| x | 1 |",
  "",
  '<!-- table: {"kind": "data", "features": {"columns": {}}} -->',
  "",
  "| 名前 | 説明 | 更新日 |",
  "| --- | --- | --- |",
  "| りんご | 描画を速くする | 2026-10-01 |",
  "",
  "<!-- /table -->",
  "",
  '<!-- table: {"kind": "data", "columns": {"備考": {"hidden": true}}} -->',
  "",
  "| 名前 | 備考 |",
  "| --- | --- |",
  "| みかん | 季節の果物 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** テーブル設定のボタンを持つ表のうち、指定した番号の表のパネルを開く */
function openSettingsOf(el: Element, index: number) {
  const table = [...el.querySelectorAll<HTMLElement>(".mdmark-table")].filter(
    (candidate) =>
      candidate.querySelector("button.mdmark-table-settings-toggle") !== null,
  )[index];
  if (!table) {
    throw new Error(`テーブル設定のボタンが無い: ${index}`);
  }
  return openTableSettings(table);
}

// 列を出し入れするたびに、表の番号と隠している列の名前を onColumnsChange に指定する（正常系）
test("test_normal_when_columns_changed", async () => {
  // 準備
  const calls: unknown[] = [];
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: COLUMNS_MARKDOWN,
    onColumnsChange: (event) => {
      calls.push(event);
    },
  });
  // 検証: 描いた直後は呼ばない
  expect(calls).toEqual([]);
  // 実行: 1 つ目の表で更新日、説明の順に目のアイコンで隠す
  const first = openSettingsOf(el, 0);
  first.eye(2).click();
  first.eye(1).click();
  // 検証
  expect(calls).toEqual([
    { tableIndex: 0, hidden: ["更新日"] },
    { tableIndex: 0, hidden: ["説明", "更新日"] },
  ]);
  // 実行: 2 つ目の表で備考の目のアイコンを押して表示し、もう一度押して隠す
  const second = openSettingsOf(el, 1);
  second.eye(1).click();
  second.eye(1).click();
  // 検証
  expect(calls.slice(2)).toEqual([
    { tableIndex: 1, hidden: [] },
    { tableIndex: 1, hidden: ["備考"] },
  ]);
  // 実行: 再描画する
  handle.update(COLUMNS_MARKDOWN);
  // 検証
  expect(calls).toHaveLength(4);
});

// onColumnsChange が例外を投げても、列の表示の切り替えは済ませて console.error に出す（異常系）
test("test_error_when_columns_callback_throws", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("boom");
  const el = createElement();
  await mountTracked(el, {
    markdown: COLUMNS_MARKDOWN,
    onColumnsChange: () => {
      throw error;
    },
  });
  const table = [...el.querySelectorAll<HTMLElement>(".mdmark-table")].find(
    (candidate) =>
      candidate.querySelector("button.mdmark-table-settings-toggle") !== null,
  );
  if (!table) {
    throw new Error("列の表示の表が無い");
  }
  // 実行
  const { eye } = openSettingsOf(el, 0);
  expect(() => eye(1).click()).not.toThrow();
  // 検証
  expect(
    columnCells(table, 1).every((cell) => cell.hasAttribute("hidden")),
  ).toBe(true);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("onColumnsChange");
  expect(spy.mock.calls.flat()).toContain(error);
});

// 修正と削除を試す段落
const EDIT_TEXT =
  "描いた文書の外観はテーマの変数で変える。CSS を書き込んで上書きする。";

/** `テーマの変数` に付いたコメント */
const EDIT_THEME_COMMENT: MdmarkComment = {
  id: "c1",
  quote: "テーマの変数",
  prefix: "描いた文書の外観は",
  suffix: "で変える。",
  body: "テーマのコメント",
};

/** `CSS` に付いたコメント */
const EDIT_CSS_COMMENT: MdmarkComment = {
  id: "c2",
  quote: "CSS",
  prefix: "で変える。",
  suffix: " を記載して上書きする。",
  body: "CSS のコメント",
};

/** `update`・`remove` を持つ読み込みと保存の関数 */
function createEditableStore(loaded: MdmarkComment[]) {
  return {
    ...createCommentStore(loaded),
    update: vi.fn(
      async (_target: { docId: string; id: string; body: string }) => {},
    ),
    remove: vi.fn(async (_target: { docId: string; id: string }) => {}),
  };
}

/** 文字のマーカー */
function commentMark(el: Element, text: string): HTMLElement {
  const found = [
    ...el.querySelectorAll<HTMLElement>("mark.mdmark-comment-mark"),
  ].find((mark) => mark.textContent === text);
  if (!found) {
    throw new Error(`マーカーが見つからない: ${text}`);
  }
  return found;
}

/** マーカーを押して開いた吹き出し */
function openCommentBubble(mark: HTMLElement): HTMLElement {
  mark.click();
  return find<HTMLElement>(document.body, ".mdmark-comment-bubble");
}

/** 修正と削除の段落を、読み込みと保存の関数を指定して描き、マーカーが付くのを待つ */
async function mountEditable(
  store: ReturnType<typeof createEditableStore>,
): Promise<HTMLElement> {
  const el = createElement();
  await mountTracked(el, {
    markdown: `${EDIT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() =>
    expect(el.querySelectorAll("mark.mdmark-comment-mark")).toHaveLength(2),
  );
  return el;
}

/** 吹き出しの「編集」を押し、本文を書き換えて保存する */
function editAndSave(bubble: HTMLElement, body: string): HTMLTextAreaElement {
  find<HTMLButtonElement>(bubble, 'button[aria-label="編集"]').click();
  const field = find<HTMLTextAreaElement>(bubble, "textarea");
  field.value = body;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  find<HTMLButtonElement>(bubble, "button.is-primary").click();
  return field;
}

// 吹き出しの「編集」から修正し、確認を経て削除する（正常系）
test("test_normal_when_comment_edited_and_removed", async () => {
  // 準備
  const store = createEditableStore([EDIT_THEME_COMMENT, EDIT_CSS_COMMENT]);
  const el = await mountEditable(store);
  // 実行
  const bubble = openCommentBubble(commentMark(el, "テーマの変数"));
  // 検証
  expect(bubble.querySelectorAll('button[aria-label="編集"]')).toHaveLength(1);
  expect(bubble.querySelectorAll('button[aria-label="削除"]')).toHaveLength(1);
  // 実行
  find<HTMLButtonElement>(bubble, 'button[aria-label="編集"]').click();
  // 検証
  const field = find<HTMLTextAreaElement>(bubble, "textarea");
  expect(field.value).toBe("テーマのコメント");
  expect(document.activeElement).toBe(field);
  // 実行
  field.value = "書き換えたコメント";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  find<HTMLButtonElement>(bubble, "button.is-primary").click();
  // 検証
  await vi.waitFor(() =>
    expect(bubble.querySelector(".mdmark-comment-body")?.textContent).toBe(
      "書き換えたコメント",
    ),
  );
  expect(store.update).toHaveBeenCalledTimes(1);
  expect(store.update).toHaveBeenCalledWith({
    docId: "guide",
    id: "c1",
    body: "書き換えたコメント",
  });
  expect(document.activeElement).toBe(
    bubble.querySelector('button[aria-label="編集"]'),
  );
  expect(commentMark(el, "テーマの変数")).toBeDefined();
  // 実行
  await userEvent.keyboard("{Escape}");
  const cssBubble = openCommentBubble(commentMark(el, "CSS"));
  find<HTMLButtonElement>(cssBubble, 'button[aria-label="削除"]').click();
  // 検証
  expect(cssBubble.textContent).toContain(
    "このコメントを削除しますか? 削除すると元に戻せません。",
  );
  expect(document.activeElement).toBe(
    cssBubble.querySelector('[data-action="cancel-remove"]'),
  );
  expect(store.remove).not.toHaveBeenCalled();
  // 実行
  find<HTMLButtonElement>(cssBubble, '[data-action="confirm-remove"]').click();
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelectorAll("mark.mdmark-comment-mark")).toHaveLength(1),
  );
  expect(store.remove).toHaveBeenCalledTimes(1);
  expect(store.remove).toHaveBeenCalledWith({ docId: "guide", id: "c2" });
  const paragraph = find<HTMLElement>(el, "p");
  expect(paragraph.textContent).toBe(EDIT_TEXT);
  expect(paragraph.getAttribute("tabindex")).toBe("-1");
  expect(document.activeElement).toBe(paragraph);
});

// update・remove を持たない読み込みと保存の関数では、吹き出しに「編集」「削除」を出さない（正常系）
test("test_normal_when_comment_store_without_edit", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: createCommentStore([THEME_COMMENT]),
  });
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  // 実行
  const bubble = openCommentBubble(commentMark(el, "テーマの変数"));
  // 検証
  expect(bubble.querySelector('button[aria-label="編集"]')).toBeNull();
  expect(bubble.querySelector('button[aria-label="削除"]')).toBeNull();
  expect(spy).not.toHaveBeenCalled();
});

// update が reject すると、入力欄と書き換えた本文を残して通知を出す（異常系）
test("test_error_when_comment_update_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const store = createEditableStore([EDIT_THEME_COMMENT, EDIT_CSS_COMMENT]);
  store.update.mockRejectedValue(new Error("network"));
  const el = await mountEditable(store);
  const bubble = openCommentBubble(commentMark(el, "テーマの変数"));
  // 実行
  editAndSave(bubble, "書き換えたコメント");
  // 検証
  await vi.waitFor(() =>
    expect(find(bubble, '[role="alert"]').textContent).toBe(
      "コメントを保存できませんでした。記載したコメントは残っています。もう一度「保存」を押してください。",
    ),
  );
  const failedField = find<HTMLTextAreaElement>(bubble, "textarea");
  expect(failedField.value).toBe("書き換えたコメント");
  expect(failedField.getAttribute("aria-invalid")).toBe("true");
  expect(spy).toHaveBeenCalledTimes(1);
  const logged = loggedText(spy);
  for (const text of ["update", "guide", "c1", "network"]) {
    expect(logged).toContain(text);
  }
  // 実行
  find<HTMLButtonElement>(bubble, '[data-action="cancel-edit"]').click();
  // 検証
  expect(bubble.querySelector(".mdmark-comment-body")?.textContent).toBe(
    "テーマのコメント",
  );
});

// remove が reject すると、コメントとマーカーを残し、削除の確認を開いたまま通知を出す（異常系）
test("test_error_when_comment_remove_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const store = createEditableStore([EDIT_THEME_COMMENT, EDIT_CSS_COMMENT]);
  store.remove.mockRejectedValue(new Error("network"));
  const el = await mountEditable(store);
  const bubble = openCommentBubble(commentMark(el, "CSS"));
  // 実行
  find<HTMLButtonElement>(bubble, 'button[aria-label="削除"]').click();
  find<HTMLButtonElement>(bubble, '[data-action="confirm-remove"]').click();
  // 検証
  await vi.waitFor(() =>
    expect(find(bubble, '[role="alert"]').textContent).toBe(
      "コメントを削除できませんでした。もう一度「削除」を押してください。",
    ),
  );
  expect(commentMark(el, "CSS")).toBeDefined();
  expect(bubble.querySelector(".mdmark-comment-body")?.textContent).toBe(
    "CSS のコメント",
  );
  expect(bubble.querySelector(".mdmark-comment-confirm")).not.toBeNull();
  expect(spy).toHaveBeenCalledTimes(1);
  const logged = loggedText(spy);
  for (const text of ["remove", "guide", "c2", "network"]) {
    expect(logged).toContain(text);
  }
});

// reloadComments で load をもう一度呼び、本文を再描画せずにマーカーだけをもう一度付ける（正常系）
test("test_normal_when_comments_reloaded", async () => {
  // 準備
  const store = createEditableStore([]);
  store.load
    .mockResolvedValueOnce([EDIT_THEME_COMMENT])
    .mockResolvedValueOnce([EDIT_THEME_COMMENT, EDIT_CSS_COMMENT]);
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: [
      EDIT_TEXT,
      "",
      '<!-- table: {"kind": "data", "features": {"sort": {}}} -->',
      "",
      "| 名前 |",
      "| --- |",
      "| b |",
      "| a |",
      "| c |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() =>
    expect(el.querySelectorAll("mark.mdmark-comment-mark")).toHaveLength(1),
  );
  find<HTMLButtonElement>(el, "th button.mdmark-sort").click();
  expect(columnTexts(el, 0)).toEqual(["c", "b", "a"]);
  // 実行
  await handle.reloadComments();
  // 検証
  expect(
    [...el.querySelectorAll("mark.mdmark-comment-mark")].map(
      (mark) => mark.textContent,
    ),
  ).toEqual(["テーマの変数", "CSS"]);
  expect(store.load).toHaveBeenCalledTimes(2);
  expect(columnTexts(el, 0)).toEqual(["c", "b", "a"]);
});

// reloadComments の load が reject すると、今のマーカーを残して Promise を reject する（異常系）
test("test_error_when_comments_reload_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("network");
  const store = createEditableStore([]);
  store.load
    .mockResolvedValueOnce([THEME_COMMENT])
    .mockRejectedValueOnce(error);
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  // 実行・検証
  await expect(handle.reloadComments()).rejects.toBe(error);
  expect(commentMark(el, "テーマの変数")).toBeDefined();
  expect(spy).toHaveBeenCalledTimes(1);
  const logged = loggedText(spy);
  for (const text of ["load", "guide", "network"]) {
    expect(logged).toContain(text);
  }
});

// comments がオフか読み込みと保存の関数を指定しないときの reloadComments は、load を呼ばずに解決する（正常系）
test("test_normal_when_comments_reload_disabled", async () => {
  // 準備: 読み込みと保存の関数を指定しない側が console.error に出す通知は、このテストでは見ない
  vi.spyOn(console, "error").mockImplementation(() => {});
  const store = createCommentStore();
  const handle = await mountTracked(createElement(), {
    markdown: `${COMMENT_TEXT}\n`,
    docId: "guide",
    commentStore: store,
  });
  const withoutStore = await mountTracked(createElement(), {
    markdown: `${COMMENT_TEXT}\n`,
    config: { features: { comments: true } },
    docId: "guide",
  });
  // 実行・検証
  await expect(handle.reloadComments()).resolves.toBeUndefined();
  await expect(withoutStore.reloadComments()).resolves.toBeUndefined();
  expect(store.load).not.toHaveBeenCalled();
});

// focusComment で、そのコメントのマーカーを画面に入れてフォーカスを移し、強調する（正常系）
test("test_normal_when_comment_focused", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  window.scrollTo(0, 0);
  const paragraphs = Array.from(
    { length: 30 },
    (_, index) => `${index + 1} 番目の段落です。`,
  );
  paragraphs[0] = "先頭の単語を含む段落です。";
  paragraphs[29] = "末尾の単語を含む段落です。";
  const store = createEditableStore([
    {
      id: "c1",
      quote: "先頭の単語",
      prefix: "",
      suffix: "を含む段落です。",
      body: "先頭",
    },
    {
      id: "c9",
      quote: "末尾の単語",
      prefix: "",
      suffix: "を含む段落です。",
      body: "末尾",
    },
  ]);
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: `${paragraphs.join("\n\n")}\n`,
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() =>
    expect(el.querySelectorAll("mark.mdmark-comment-mark")).toHaveLength(2),
  );
  const head = commentMark(el, "先頭の単語");
  const tail = commentMark(el, "末尾の単語");
  expect(tail.getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
  // 実行
  handle.focusComment("c1");
  // 検証
  expect(head.hasAttribute("data-focused")).toBe(true);
  expect(document.activeElement).toBe(head);
  // 実行
  handle.focusComment("c9");
  // 検証
  const rect = tail.getBoundingClientRect();
  expect(rect.top).toBeGreaterThanOrEqual(0);
  // 小数の位置の丸めの分だけ許す
  expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
  expect(el.querySelectorAll("[data-focused]")).toHaveLength(1);
  expect(tail.hasAttribute("data-focused")).toBe(true);
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
  // 実行
  const scrollY = window.scrollY;
  handle.focusComment("none");
  // 検証
  expect(window.scrollY).toBe(scrollY);
  expect(document.activeElement).toBe(tail);
  expect(tail.hasAttribute("data-focused")).toBe(true);
  expect(el.querySelectorAll("[data-focused]")).toHaveLength(1);
  expect(spy).not.toHaveBeenCalled();
});

// ─── 表のセルの結合・行見出し・入れ子のタブ・コードの行の種類と開閉 ───

/** 見出しが 2 行で、分類の列を `^^` で結合した表（数値は上から `3`・`1`・`4`・`2`） */
const MERGED_TABLE_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"copy": {}}, "columns": {"分類": {"filter": {}}}, "header": {"rows": 2}} -->',
  "",
  "| 区分 | << |",
  "| --- | --- |",
  "| 分類 | 数値 |",
  "| A | 3 |",
  "| ^^ | 1 |",
  "| B | 4 |",
  "| ^^ | 2 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 多段の見出しの最下段にボタンを配置し、並べ替え・絞り込みの後に隣り合う同じ値のセルをもう一度結合する（正常系）
test("test_normal_when_merged_table_sorted", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: MERGED_TABLE_MARKDOWN });
  const headRows = el.querySelectorAll<HTMLTableRowElement>("thead tr");
  const categoryCells = (): HTMLElement[] =>
    [
      ...el.querySelectorAll<HTMLTableRowElement>(
        "tbody tr:not(.mdmark-table-empty)",
      ),
    ].map((row) => row.cells[0] as HTMLElement);
  // 検証: ボタンは見出しの 2 行目にだけある
  expect(headRows[0]?.querySelector("button")).toBeNull();
  for (const selector of [
    "button.mdmark-sort",
    "button.mdmark-pin",
    "button.mdmark-filter",
  ]) {
    expect(headRows[1]?.querySelector(selector)).not.toBeNull();
  }
  // 検証: 描いた直後は A と B のセルが 2 行ずつ結合している
  const [a, aRest, b, bRest] = categoryCells();
  expect(a?.getAttribute("rowspan")).toBe("2");
  expect(aRest?.hidden).toBe(true);
  expect(b?.getAttribute("rowspan")).toBe("2");
  expect(bRest?.hidden).toBe(true);
  // 実行: 数値の列の並べ替えを押す
  find<HTMLButtonElement>(
    headRows[1]?.cells[1] as HTMLElement,
    "button.mdmark-sort",
  ).click();
  // 検証: 降順に並び、隣り合う同じ値が無いので結合しない
  expect(columnTexts(el, 1)).toEqual(["4", "3", "2", "1"]);
  expect(categoryCells().map((cell) => cell.textContent)).toEqual([
    "B",
    "A",
    "B",
    "A",
  ]);
  for (const cell of categoryCells()) {
    expect(cell.hasAttribute("rowspan")).toBe(false);
    expect(cell.hidden).toBe(false);
  }
  // 実行: 分類の絞り込みで A を選ぶ
  find<HTMLButtonElement>(el, "button.mdmark-filter").click();
  const drawer = find<HTMLElement>(el, ".mdmark-filter-drawer");
  const choiceA = [...drawer.querySelectorAll("label")].find(
    (label) => label.textContent?.trim() === "A",
  )?.control as HTMLInputElement | undefined;
  choiceA?.click();
  // 検証: A の 2 行を出し、分類をもう一度結合する
  const visible = [...el.querySelectorAll<HTMLTableRowElement>("tbody tr")]
    .filter((row) => !row.hidden)
    .filter((row) => !row.classList.contains("mdmark-table-empty"));
  expect(visible).toHaveLength(2);
  expect(visible[0]?.cells[0]?.getAttribute("rowspan")).toBe("2");
  // 実行: 表をコピー → TSV を押す
  chooseCopyFormat(el, "tsv");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証: 各行の分類が A で、結合の記号を含まない
  const [text = ""] = writeText.mock.calls[0] ?? [];
  const rows = text.split("\n").filter((row) => row !== "");
  for (const row of rows.slice(-2)) {
    expect(row.split("\t")[0]).toBe("A");
  }
  expect(text).not.toContain("^^");
  expect(text).not.toContain("<<");
});

// 行見出しを持つはみ出す表を、描いた直後に行見出しの全ての列を留めた状態にする（正常系）
test("test_normal_when_row_header_pinned", async () => {
  // 準備
  const el = createElement();
  setElementWidth(el, 320);
  // 留める 2 列は短くして描く先の幅に収め、残りの 8 列で横にはみ出させる
  const headers = [
    "分類",
    "記法",
    ...Array.from({ length: 8 }, (_, i) => `とても長い列の名前${i + 3}`),
  ];
  const markdown = [
    '<!-- table: {"kind": "data", "header": {"columns": 2}} -->',
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...Array.from(
      { length: 5 },
      (_, row) =>
        `| ${headers.map((_, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
    ),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown });
  // 検証: 1・2 列目のピン止めが押した状態で、1・2 列目のセルを留める
  const pins = el.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  await vi.waitFor(() => {
    expect(pins[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(pins[1]?.getAttribute("aria-pressed")).toBe("true");
  });
  const cells = find<HTMLTableRowElement>(el, "tbody tr").cells;
  expect(getComputedStyle(cells[0] as Element).position).toBe("sticky");
  expect(getComputedStyle(cells[1] as Element).position).toBe("sticky");
  expect(getComputedStyle(cells[2] as Element).position).not.toBe("sticky");
  // 実行: 表を横に端までスクロールする
  const table = find<HTMLElement>(el, "table");
  const scroller =
    table.scrollWidth > table.clientWidth
      ? table
      : find<HTMLElement>(el, ".mdmark-table");
  scroller.scrollLeft = scroller.scrollWidth;
  await nextFrames();
  // 検証: 1・2 列目のセルの左端が表の左端と同じ位置のまま
  const left = scroller.getBoundingClientRect().left;
  const first = cellBox(cells[0] as Element);
  const second = cellBox(cells[1] as Element);
  expect(Math.abs(first.left - left)).toBeLessThanOrEqual(2);
  expect(
    Math.abs(second.left - (first.left + first.width)),
  ).toBeLessThanOrEqual(1);
});

// 外側の `macOS` の中に内側のタブを配置し、`Windows` のタブ名を強調した Markdown
const NESTED_TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "<!-- tabs -->",
  "",
  "#### zsh",
  "",
  "zsh の本文",
  "",
  "#### bash",
  "",
  "bash の本文",
  "",
  "<!-- /tabs -->",
  "",
  "### **Windows**",
  "",
  "Windows の本文",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

// 入れ子のタブを、内側と外側で別々に切り替える（正常系）
test("test_normal_when_nested_tabs_switched", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: NESTED_TABS_MARKDOWN });
  const tablists = [...el.querySelectorAll<HTMLElement>('[role="tablist"]')];
  const tabsOf = (list: Element | undefined): HTMLElement[] => [
    ...(list?.querySelectorAll<HTMLElement>(':scope > [role="tab"]') ?? []),
  ];
  // 検証: 外側と内側の 2 つの並び
  expect(tablists).toHaveLength(2);
  const outerList = tablists.find((list) =>
    list.textContent?.includes("macOS"),
  );
  const innerList = tablists.find((list) => list.textContent?.includes("zsh"));
  const [macos, windows] = tabsOf(outerList);
  const [zsh, bash] = tabsOf(innerList);
  expect(tabsOf(outerList).map((tab) => tab.textContent)).toEqual([
    "macOS",
    "Windows",
  ]);
  expect(tabsOf(innerList).map((tab) => tab.textContent)).toEqual([
    "zsh",
    "bash",
  ]);
  expect(windows?.querySelector("strong")).not.toBeNull();
  // 実行: 内側の bash を押す
  bash?.click();
  // 検証: 内側だけが切り替わる
  expect(bash?.getAttribute("aria-selected")).toBe("true");
  expect(macos?.getAttribute("aria-selected")).toBe("true");
  // 実行: 内側の bash で右の矢印を押す
  bash?.focus();
  bash?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
  // 検証: フォーカスは内側の並びの先頭へ戻り、外側へ移らない
  expect(document.activeElement).toBe(zsh);
  // 実行: 外側の Windows を押す
  windows?.click();
  // 検証: Windows の中身だけを出し、macOS の中身は内側のタブごと隠す
  const panelOf = (tab: HTMLElement | undefined): HTMLElement =>
    find<HTMLElement>(el, `#${tab?.getAttribute("aria-controls")}`);
  expect(panelOf(windows).hidden).toBe(false);
  expect(panelOf(windows).textContent).toContain("Windows の本文");
  expect(panelOf(macos).hidden).toBe(true);
  expect(panelOf(macos).contains(innerList as Node)).toBe(true);
});

/** focus・error・warning のマーカーを付けた 3 行と、マーカーの無い 1 行を持つコードブロック */
const CODE_KINDS_MARKDOWN = [
  "```ts",
  "foo(); // [!code focus]",
  "bar(); // [!code error]",
  "baz(); // [!code warning]",
  "qux();",
  "```",
  "",
].join("\n");

// focus の行のほかを薄くし、error と warning の行を色で分け、マーカーを除いた全ての行をコピーする（正常系）
test("test_normal_when_code_focused", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: CODE_KINDS_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const lines = [...el.querySelectorAll<HTMLElement>(".mdmark-code-line")];
  const [focus, error, warning, plain] = lines.map((line) =>
    getComputedStyle(line),
  );
  // 検証: focus の行のほかは薄い
  expect(Number(focus?.opacity)).toBe(1);
  for (const style of [error, warning, plain]) {
    expect(Number(style?.opacity)).toBeLessThan(1);
  }
  // 検証: error と warning の行の地の色は互いに異なり、種類の無い行とも異なる
  const backgrounds = [error, warning, plain].map(
    (style) => style?.backgroundColor,
  );
  expect(new Set(backgrounds).size).toBe(3);
  // 実行: コピーボタンを押す
  codeCopyButtons(el)[0]?.click();
  // 検証: 4 行全てを、マーカーを除いて記載する
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  const [text = ""] = writeText.mock.calls[0] ?? [];
  expect(text.split("\n").filter((line) => line !== "")).toEqual([
    "foo();",
    "bar();",
    "baz();",
    "qux();",
  ]);
  expect(text).not.toContain("[!code");
});

/** 3 階層の入れ子のキーを持つ yaml のコードブロックと、tree のコードブロックを持つ Markdown */
const CODE_FOLD_MARKDOWN = [
  "```yaml",
  "a:",
  "  b:",
  "    c: 1",
  "  d: 2",
  "e: 3",
  "```",
  "",
  "```tree",
  "src/",
  "  index.ts",
  "```",
  "",
].join("\n");

/** コードブロックの行を上から並べて返却する */
function codeLines(el: Element): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>("pre .mdmark-code-line")];
}

/** 行の開閉のボタン（無ければ undefined） */
function foldToggle(line: Element | undefined): HTMLButtonElement | undefined {
  return (
    line?.querySelector<HTMLButtonElement>(":scope > .mdmark-code-fold") ??
    undefined
  );
}

/** 行ごとに `hidden` を持つかを並べて返却する */
function hiddenLines(el: Element): boolean[] {
  return codeLines(el).map((line) => line.hidden === true);
}

// 畳める行の開閉のボタンと `⋯` で行を畳んで開き、Shift で入れ子をまとめて開閉する（正常系）
test("test_normal_when_code_folded", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: CODE_FOLD_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const lines = codeLines(el);
  const [first, second] = [foldToggle(lines[0]), foldToggle(lines[1])];
  // 検証: 1・2 行目にだけ開いた状態のボタンがある
  expect(lines.map((line) => foldToggle(line) !== undefined)).toEqual([
    true,
    true,
    false,
    false,
    false,
  ]);
  for (const toggle of [first, second]) {
    expect(toggle?.type).toBe("button");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  }
  // 実行・検証: 1 行目を畳む
  first?.click();
  expect(first?.getAttribute("aria-expanded")).toBe("false");
  expect(hiddenLines(el)).toEqual([false, true, true, true, false]);
  const more = find<HTMLButtonElement>(
    lines[0] as Element,
    ".mdmark-code-fold-more",
  );
  expect(more.textContent).toBe("⋯");
  // 実行・検証: ⋯ で開く
  more.click();
  expect(hiddenLines(el)).toEqual([false, false, false, false, false]);
  expect(lines[0]?.querySelector(".mdmark-code-fold-more")).toBeNull();
  expect(first?.getAttribute("aria-expanded")).toBe("true");
  // 実行・検証: 2 行目を畳んでから 1 行目を畳んで開くと、2 行目は畳んだまま
  second?.click();
  first?.click();
  first?.click();
  expect(lines[2]?.hidden).toBe(true);
  expect(second?.getAttribute("aria-expanded")).toBe("false");
  // 実行・検証: Shift で入れ子をまとめて畳み、まとめて開く
  shiftClick(first as HTMLButtonElement);
  expect(first?.getAttribute("aria-expanded")).toBe("false");
  expect(second?.getAttribute("aria-expanded")).toBe("false");
  shiftClick(first as HTMLButtonElement);
  expect(first?.getAttribute("aria-expanded")).toBe("true");
  expect(second?.getAttribute("aria-expanded")).toBe("true");
  expect(hiddenLines(el).slice(1, 4)).toEqual([false, false, false]);
  // 実行・検証: Tab でフォーカスして Enter で押す
  find<HTMLElement>(el, "pre").focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(first);
  await userEvent.keyboard("{Enter}");
  expect(first?.getAttribute("aria-expanded")).toBe("false");
  await userEvent.keyboard("{Enter}");
  expect(first?.getAttribute("aria-expanded")).toBe("true");
  // 実行・検証: Shift を押しながら Enter で入れ子をまとめて畳む
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  expect(first?.getAttribute("aria-expanded")).toBe("false");
  expect(second?.getAttribute("aria-expanded")).toBe("false");
  // 検証: tree のコードブロックには開閉のボタンが無い
  expect(
    find(el, ".mdmark-tree").querySelector(".mdmark-code-fold"),
  ).toBeNull();
});

// インデントのレベルの数の縦線を描き、ポインターを乗せた行のブロックの縦線を濃くする（正常系）
test("test_normal_when_code_guide_hovered", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: CODE_FOLD_MARKDOWN,
    config: { features: { syntax: false } },
  });
  const lines = codeLines(el);
  // 検証: 2〜4 行目は data-indent のとおりの数の縦線を持つ
  for (const line of lines.slice(1, 4)) {
    expect(
      getComputedStyle(line).getPropertyValue("--mdmark-code-level").trim(),
    ).toBe(line.dataset.indent);
  }
  // 実行: 3 行目にポインターを乗せる
  await userEvent.hover(
    find<HTMLElement>(lines[2] as Element, ".mdmark-code-text"),
  );
  // 検証: 3 行目だけが濃い縦線を持つ
  expect(lines.map((line) => line.hasAttribute("data-guide-active"))).toEqual([
    false,
    false,
    true,
    false,
    false,
  ]);
  // 実行: ポインターを離す
  await userEvent.unhover(
    find<HTMLElement>(lines[2] as Element, ".mdmark-code-text"),
  );
  // 検証
  expect(el.querySelectorAll("[data-guide-active]")).toHaveLength(0);
  // 実行: コードブロックの文字を全て選ぶ
  const selection = getSelection();
  selection?.selectAllChildren(find(el, "pre code"));
  // 検証: 縦線の文字が入らない
  const selected = selection?.toString() ?? "";
  expect(selected).toContain("    c: 1");
  expect(selected).not.toMatch(/[│|┃]/);
  selection?.removeAllRanges();
});

/** 開閉のボタンの `opacity` の計算値 */
function foldOpacity(toggle: HTMLElement | undefined): number {
  return toggle ? Number(getComputedStyle(toggle).opacity) : Number.NaN;
}

// 開閉のボタンは乗せた行だけに出し、開閉のボタンの列に乗せたときは全てのボタンを出す（正常系（開閉のボタンの列にポインターを乗せる））
test("test_normal_when_code_fold_column_hovered", async () => {
  // 準備・実行
  const el = createElement();
  await mountTracked(el, {
    markdown: [
      '<!-- code: {"lines": {}} -->',
      "",
      ...CODE_FOLD_MARKDOWN.split("\n").slice(0, 7),
      "",
    ].join("\n"),
    config: { features: { syntax: false } },
  });
  const lines = codeLines(el);
  const [first, second] = [foldToggle(lines[0]), foldToggle(lines[1])] as [
    HTMLButtonElement,
    HTMLButtonElement,
  ];
  // 検証: ポインターをコードブロックの外に置くと出さず、ボタンは行番号の右
  const away = createElement();
  away.textContent = "コードブロックの外";
  await userEvent.hover(away);
  await vi.waitFor(() => {
    expect([foldOpacity(first), foldOpacity(second)]).toEqual([0, 0]);
  });
  const number = getComputedStyle(lines[0] as HTMLElement, "::before");
  expect(number.content).not.toBe("none");
  // 実行・検証: 3 行目の文字に乗せる
  await userEvent.hover(
    find<HTMLElement>(lines[2] as HTMLElement, ".mdmark-code-text"),
  );
  await vi.waitFor(() => {
    expect([foldOpacity(first), foldOpacity(second)]).toEqual([0, 0]);
  });
  // 実行・検証: 1 行目の文字に乗せる
  await userEvent.hover(
    find<HTMLElement>(lines[0] as HTMLElement, ".mdmark-code-text"),
  );
  await vi.waitFor(() => {
    expect([foldOpacity(first), foldOpacity(second)]).toEqual([1, 0]);
  });
  // 実行・検証: 4 行目の開閉のボタンの列に乗せる
  const column = first.getBoundingClientRect();
  const fourth = (lines[3] as HTMLElement).getBoundingClientRect();
  await userEvent.hover(lines[3] as HTMLElement, {
    position: {
      x: column.left + column.width / 2 - fourth.left,
      y: fourth.height / 2,
    },
  });
  await vi.waitFor(() => {
    expect([foldOpacity(first), foldOpacity(second)]).toEqual([1, 1]);
  });
  // 実行・検証: 2 行目を畳み、キーボードで 1 行目にフォーカスしてから、ポインターを開閉のボタンの列の外に出す
  second.click();
  await userEvent.keyboard("{Shift}");
  first.focus();
  await userEvent.hover(el.querySelector("pre") as HTMLElement, {
    position: { x: 1, y: 1 },
  });
  await vi.waitFor(() => {
    expect(second.getAttribute("aria-expanded")).toBe("false");
    expect([foldOpacity(first), foldOpacity(second)]).toEqual([1, 1]);
  });
  first.blur();
  // 検証: ポインターで乗せられない画面（`(hover: none)`。ブラウザの代役で切り替えられない）では、開閉のボタンを常に出す CSS を持つ
  expect(hoverNoneOpacity(".mdmark-code-fold")).toBe("1");
});

/** 配布物の CSS のうち `(hover: none)` の中で `selector` に当てる `opacity` を返却する（無ければ undefined） */
function hoverNoneOpacity(selector: string): string | undefined {
  const visit = (
    rules: CSSRuleList,
    inHoverNone: boolean,
  ): string | undefined => {
    for (const rule of rules) {
      const hoverNone =
        inHoverNone ||
        (rule instanceof CSSMediaRule &&
          rule.conditionText.includes("hover: none"));
      if (
        hoverNone &&
        rule instanceof CSSStyleRule &&
        rule.selectorText.split(",").some((text) => {
          const trimmed = text.trim();
          return trimmed === selector || trimmed.endsWith(` ${selector}`);
        }) &&
        rule.style.opacity
      ) {
        return rule.style.opacity;
      }
      const children = (rule as CSSGroupingRule).cssRules;
      if (children) {
        const found = visit(children, hoverNone);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  };
  for (const sheet of document.styleSheets) {
    const found = visit(sheet.cssRules, false);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** 2 行目と 6 行目が畳める行の 8 行の yaml を、`fold=2,6` で畳んで描く Markdown */
const CODE_FOLD_INITIAL_MARKDOWN = [
  '<!-- code: {"lines": {}, "fold": [2, 6]} -->',
  "",
  "```yaml",
  "root:",
  "  a:",
  "    b: 1",
  "  c: 2",
  "other:",
  "  d:",
  "    e: 3",
  "  f: 4",
  "```",
  "",
].join("\n");

// `fold=` の行を畳んで描き、畳んだ行を含めてコピーし、`update` で畳んだ状態に戻す（正常系）
test("test_normal_when_code_fold_initial", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: CODE_FOLD_INITIAL_MARKDOWN,
    config: { features: { syntax: false } },
  });
  // 検証: 2 行目と 6 行目を畳んで描く
  let lines = codeLines(el);
  for (const index of [1, 5]) {
    expect(foldToggle(lines[index])?.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(lines[index + 1]?.hidden).toBe(true);
    expect(
      lines[index]?.querySelector(".mdmark-code-fold-more"),
    ).not.toBeNull();
  }
  // 実行: コピーボタンを押す
  codeCopyButtons(el)[0]?.click();
  // 検証: 畳んだ行を含めて 8 行を記載する
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  const [text = ""] = writeText.mock.calls[0] ?? [];
  expect(text.split("\n").filter((line) => line !== "")).toEqual([
    "root:",
    "  a:",
    "    b: 1",
    "  c: 2",
    "other:",
    "  d:",
    "    e: 3",
    "  f: 4",
  ]);
  // 実行: 2 行目を開いてから再描画する
  foldToggle(lines[1])?.click();
  expect(foldToggle(lines[1])?.getAttribute("aria-expanded")).toBe("true");
  handle.update(CODE_FOLD_INITIAL_MARKDOWN);
  // 検証: 2 行目を畳んだ状態に戻す
  lines = codeLines(el);
  expect(foldToggle(lines[1])?.getAttribute("aria-expanded")).toBe("false");
});

// 印刷の前に畳んだコードの行と閉じた注意書きを開き、印刷の後に開いたものだけを戻す（正常系）
test("test_normal_when_code_folds_printed", async () => {
  // 準備
  const el = createElement();
  const markdown = [
    '<!-- code: {"fold": [2]} -->',
    "",
    "```yaml",
    "a:",
    "  b:",
    "    c: 1",
    "  d: 2",
    "```",
    "",
    "> [!NOTE]+ 外側",
    "> 外側の本文",
    ">",
    "> > [!TIP]- 内側",
    "> > 内側の本文",
    "",
  ].join("\n");
  await mountTracked(el, {
    markdown,
    config: { features: { syntax: false } },
  });
  const lines = codeLines(el);
  const outer = find<HTMLDetailsElement>(el, "details.markdown-alert-note");
  const inner = find<HTMLDetailsElement>(el, "details.markdown-alert-tip");
  expect(lines[2]?.hidden).toBe(true);
  expect(inner.open).toBe(false);
  try {
    // 実行: 印刷の前
    sendPrintEvent("beforeprint");
    // 検証: 全ての行と入れ子の注意書きを開く
    expect(lines.map((line) => line.hidden)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(inner.open).toBe(true);
    // 検証: 印刷の媒体では開閉のボタンと ⋯ を出さない
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    await vi.waitFor(() => {
      for (const button of el.querySelectorAll(
        ".mdmark-code-fold, .mdmark-code-fold-more",
      )) {
        expect(isShown(button)).toBe(false);
      }
    });
    // 実行: 印刷の後
    sendPrintEvent("afterprint");
    // 検証: 開いたものだけを戻す
    expect(lines[2]?.hidden).toBe(true);
    expect(inner.open).toBe(false);
    expect(outer.open).toBe(true);
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
  }
});

/** ER 図を描いた図と、`id` のテーブル */
async function mountEr(markdown: string): Promise<{
  figure: HTMLElement;
  table: (id: string) => HTMLElement;
}> {
  const el = createElement();
  el.style.width = "800px";
  await mountTracked(el, { markdown });
  const figure = find<HTMLElement>(
    el,
    'figure.mdmark-diagram[data-diagram="er"]',
  );
  return {
    figure,
    table: (id) =>
      find<HTMLElement>(figure, `.mdmark-diagram-er-table[data-node="${id}"]`),
  };
}

/** 関係の線の、先の端の縦の位置（`d` の最後の縦の線の終わり） */
function erEndY(figure: Element): number {
  const d =
    figure
      .querySelector('[data-er-to="orders"] path[data-line="er"]')
      ?.getAttribute("d") ?? "";
  return Number(/V([\d.]+) H[\d.]+$/.exec(d)?.[1]);
}

// ER 図の列の開閉のボタンで、主キーと外部キー以外の列を畳み、関係の線をもう一度結ぶ（正常系）
test("test_normal_when_er_columns_folded", async () => {
  // 準備
  const { figure, table } = await mountEr(
    wrapDirective("er", erText(foldEr())),
  );
  const orders = table("orders");
  const rows = () =>
    [
      ...orders.querySelectorAll<HTMLElement>(".mdmark-diagram-er-column"),
    ].filter((row) => isShown(row));
  const button = find<HTMLButtonElement>(orders, ".mdmark-diagram-er-fold");
  expect(rows()).toHaveLength(12);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const before = erEndY(figure);
  const zoom = zoomText(figure);
  // 実行
  await userEvent.click(button);
  // 検証
  expect(rows()).toHaveLength(2);
  expect(isShown(find(orders, ".mdmark-diagram-er-rest"))).toBe(true);
  expect(find(orders, ".mdmark-diagram-er-rest").textContent).toBe(
    "非表示 10 列",
  );
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(button);
  const fkRow = find<HTMLElement>(orders, '[data-column="customer_id"]');
  const stage = find<HTMLElement>(figure, ".mdmark-diagram-stage");
  const scale = stage.getBoundingClientRect().height / stage.offsetHeight;
  const rowMiddle =
    (fkRow.getBoundingClientRect().top +
      fkRow.getBoundingClientRect().height / 2 -
      stage.getBoundingClientRect().top) /
    scale;
  expect(Math.abs(erEndY(figure) - rowMiddle)).toBeLessThanOrEqual(2);
  expect(erEndY(figure)).not.toBe(before);
  expect(zoomText(figure)).toBe(zoom);
  // 実行
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(rows()).toHaveLength(12);
  expect(button.getAttribute("aria-expanded")).toBe("true");
});

// ER 図のテーブルの説明のボタンで、概要と列の説明をテーブルの下に出す（正常系）
test("test_normal_when_er_table_tooltip", async () => {
  // 準備
  const definition = {
    title: "顧客",
    scope: "確認し",
    updated: "2026-11-03",
    width: 400,
    tables: [
      {
        id: "customers",
        name: "customers",
        label: "顧客",
        desc: "注文する人",
        x: 24,
        y: 180,
        w: 260,
        columns: [
          { name: "id", type: "bigint", pk: true },
          { name: "email", type: "text", desc: "ログインに使用する" },
          { name: "name", type: "text", desc: "表示に使用する名前" },
        ],
      },
    ],
    relations: [],
  };
  const { figure, table } = await mountEr(
    wrapDirective("er", JSON.stringify(definition)),
  );
  const customers = table("customers");
  const info = buttonOf(figure, "「顧客」の説明");
  const tip = tipOf(info);
  // 実行
  await userEvent.hover(info);
  // 検証
  expect(tip.getAttribute("role")).toBe("tooltip");
  expect(tip.hidden).toBe(false);
  const text = tip.textContent ?? "";
  for (const word of [
    "顧客（customers）",
    "注文する人",
    "email",
    "ログインに使用する",
    "name",
    "表示に使用する名前",
  ]) {
    expect(text).toContain(word);
  }
  expect(tip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    customers.getBoundingClientRect().bottom,
  );
  // 実行
  await userEvent.hover(tip);
  await new Promise((resolve) => setTimeout(resolve, 400));
  // 検証
  expect(tip.hidden).toBe(false);
  // 実行
  info.focus();
  await userEvent.keyboard("{Escape}");
  // 検証
  expect(tip.hidden).toBe(true);
  expect(document.activeElement).toBe(info);
  // 実行
  info.blur();
  await userEvent.unhover(tip);
  find<HTMLElement>(figure, ".mdmark-diagram-viewport").focus();
  await userEvent.tab();
  while (
    document.activeElement !== info &&
    figure.contains(document.activeElement)
  ) {
    await userEvent.tab();
  }
  // 検証
  expect(document.activeElement).toBe(info);
  expect(tip.hidden).toBe(false);
});

/** 脚注 1 はリンクを持ち、脚注 2 は持たない文書（インターフェース定義『文書をHTML文字列にする』の正常系（脚注）と同じ） */
const FOOTNOTES_MARKDOWN = [
  "出典がある[^src]。",
  "",
  "[^src]: 出典の説明",
  "",
  "    [詳しく](https://example.com)",
  "",
  "行内にも記載できる^[行内の補足]。",
  "",
].join("\n");

/** 描いた要素の中の、`n` 番目（1 から）の脚注の番号の組 */
function footnoteRef(el: Element, n: number): HTMLElement {
  const ref = el.querySelectorAll<HTMLElement>(".mdmark-fn-ref")[n - 1];
  if (!ref) {
    throw new Error(`脚注の番号が無い: ${n}`);
  }
  return ref;
}

// 脚注の番号にポインター・フォーカスでツールチップを出し、中のリンクへ Tab で移り、Esc で削除する（正常系）
test("test_normal_when_footnote_tooltip", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, { markdown: FOOTNOTES_MARKDOWN });
  // 検証
  const first = footnoteRef(el, 1);
  const second = footnoteRef(el, 2);
  const secondTip = find<HTMLElement>(second, ".mdmark-fn-tip");
  // 番号 2: ポインターを乗せると出て、ツールチップの上へ移っても出たまま
  await userEvent.hover(find(second, ".mdmark-fn-link"));
  expect(isOpen(secondTip)).toBe(true);
  expect(secondTip.textContent).toContain("行内の補足");
  await userEvent.hover(secondTip);
  expect(isOpen(secondTip)).toBe(true);
  await userEvent.unhover(secondTip);
  // 番号 1: フォーカスで出て、Tab で中のリンクへ移り、その間も出たまま
  const firstLink = find<HTMLElement>(first, ".mdmark-fn-link");
  const firstTip = find<HTMLElement>(first, ".mdmark-fn-tip");
  firstLink.focus();
  expect(isOpen(firstTip)).toBe(true);
  expect(find(firstTip, ".mdmark-fn-tip-title").textContent).toBe("脚注 1");
  await userEvent.keyboard("{Tab}");
  expect(document.activeElement?.textContent).toBe("詳しく");
  expect(isOpen(firstTip)).toBe(true);
  // Esc: ツールチップが消え、フォーカスが番号 1 に戻る
  await userEvent.keyboard("{Escape}");
  expect(isOpen(firstTip)).toBe(false);
  expect(document.activeElement).toBe(firstLink);
  // id はページの中で一意にもう一度振られ、属性がそれを指す
  const ids = [...el.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const ref of [first, second]) {
    const link = find<HTMLElement>(ref, ".mdmark-fn-link");
    const tip = find<HTMLElement>(ref, ".mdmark-fn-tip");
    const pointer =
      link.getAttribute("aria-details") ??
      link.getAttribute("aria-describedby");
    expect(pointer).toBe(tip.id);
    expect(tip.id).not.toMatch(/^mdmark-fn-tip-\d+-\d+$/);
    const item = el.querySelector(
      `[id="${link.getAttribute("href")?.slice(1)}"]`,
    );
    expect(item?.classList.contains("mdmark-fn-item")).toBe(true);
  }
});

// 番号を押すと閉じた一覧を開いて項目へ移り、戻るリンクで番号へ戻る（正常系）
test("test_normal_when_footnote_jump", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: FOOTNOTES_MARKDOWN });
  const hash = location.hash;
  const second = footnoteRef(el, 2);
  const secondLink = find<HTMLElement>(second, ".mdmark-fn-link");
  const list = find<HTMLDetailsElement>(el, "details.mdmark-footnotes");
  expect(list.open).toBe(false);
  // 実行
  await userEvent.click(secondLink);
  // 検証
  expect(list.open).toBe(true);
  const item = el.querySelectorAll<HTMLElement>(".mdmark-fn-item")[1];
  expect(document.activeElement).toBe(item);
  expect(item?.getAttribute("tabindex")).toBe("-1");
  expect(isOpen(find(second, ".mdmark-fn-tip"))).toBe(false);
  expect(location.hash).toBe(hash);
  // 実行
  await userEvent.click(find(item as HTMLElement, ".mdmark-fn-back"));
  // 検証
  expect(document.activeElement).toBe(secondLink);
  expect(location.hash).toBe(hash);
});

/** 番号のリンクをタッチでタップし、`click` の既定の動作が止められたかを返却する。`pointerenter`・`pointerleave` は泡立たないため、ブラウザと同じく `sup` とリンクの両方に送信する（既にフォーカスを持つリンクでは `focus` は発火しない） */
function tapFootnote(ref: HTMLElement): boolean {
  const link = find<HTMLElement>(ref, ".mdmark-fn-link");
  firePointer(ref, "pointerenter", "touch");
  firePointer(link, "pointerenter", "touch");
  firePointer(link, "pointerdown", "touch");
  firePointer(link, "pointerup", "touch");
  firePointer(link, "pointerleave", "touch");
  firePointer(ref, "pointerleave", "touch");
  link.focus();
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(click);
  return click.defaultPrevented;
}

// タッチのタップで閉じた番号のツールチップを開き、開いた番号のタップで一覧へ移り、ツールチップと番号の外の pointerdown で閉じる（正常系）
test("test_normal_when_footnote_touch", async () => {
  // 準備
  await userEvent.unhover(document.body);
  const el = createElement();
  await mountTracked(el, {
    markdown: `${FOOTNOTES_MARKDOWN}\n脚注を含まない段落。\n`,
  });
  const hash = location.hash;
  const first = footnoteRef(el, 1);
  const link = find<HTMLElement>(first, ".mdmark-fn-link");
  const tip = find<HTMLElement>(first, ".mdmark-fn-tip");
  const inner = find<HTMLElement>(tip, "a");
  const list = find<HTMLDetailsElement>(el, "details.mdmark-footnotes");
  const outside = find<HTMLElement>(el, "p:last-of-type");
  expect(outside.textContent).toBe("脚注を含まない段落。");
  // 実行・検証: 閉じた番号への 1 回のタップで開き、一覧へは移らない
  expect(tapFootnote(first)).toBe(true);
  expect(first.classList.contains("is-open")).toBe(true);
  expect(list.open).toBe(false);
  // ツールチップの中のリンクの pointerdown では閉じない
  firePointer(inner, "pointerdown", "touch");
  expect(first.classList.contains("is-open")).toBe(true);
  // 脚注を含まない段落の pointerdown だけで閉じ、番号にフォーカスが残ってもツールチップを出さない
  firePointer(outside, "pointerdown", "touch");
  expect(first.classList.contains("is-open")).toBe(false);
  expect(document.activeElement).toBe(link);
  expect(getComputedStyle(tip).display).toBe("none");
  // 消えた後のタップでもう一度開く
  tapFootnote(first);
  expect(first.classList.contains("is-open")).toBe(true);
  // 開いた番号のタップで閉じ、一覧を開いて項目へ移る
  tapFootnote(first);
  expect(first.classList.contains("is-open")).toBe(false);
  expect(list.open).toBe(true);
  expect(document.activeElement).toBe(
    el.querySelectorAll<HTMLElement>(".mdmark-fn-item")[0],
  );
  expect(location.hash).toBe(hash);
});

// 印刷の前に閉じた脚注の一覧を開き、印刷の後にもう一度閉じる（正常系）
test("test_normal_when_footnotes_printed", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: FOOTNOTES_MARKDOWN });
  const list = find<HTMLDetailsElement>(el, "details.mdmark-footnotes");
  // 実行・検証
  sendPrintEvent("beforeprint");
  expect(list.open).toBe(true);
  sendPrintEvent("afterprint");
  expect(list.open).toBe(false);
});

/** 表と重なる位置で右側の目次を出す Markdown: `## 導入` と `## 使用方法` の間に、集計の行とピン止めした列を持つ 10 列 30 行の表 */
function sideTocTableMarkdown(): string {
  const columns = [
    "名前",
    "数量",
    ...Array.from({ length: 8 }, (_, i) => `説明の長い列 ${i + 1}`),
  ];
  const rows = Array.from(
    { length: 30 },
    (_, row) =>
      `| 品目 ${row + 1} | ${row + 1} | ${Array.from(
        { length: 8 },
        (_, col) => `折り返さない長さの値 ${row + 1}-${col + 1}`,
      ).join(" | ")} |`,
  );
  return [
    "## 導入",
    "",
    sideTocFiller(),
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}, "名前": {"pinned": true}}} -->',
    "",
    `| ${columns.join(" | ")} |`,
    `|${" --- |".repeat(columns.length)}`,
    ...rows,
    "",
    "<!-- /table -->",
    "",
    "## 使用方法",
    "",
    sideTocFiller(),
  ].join("\n");
}

/** 計算した `z-index` を数にする（`auto` は 0） */
function zIndexOf(element: Element): number {
  const value = getComputedStyle(element).zIndex;
  return value === "auto" ? 0 : Number(value);
}

// 表の見出し行を画面の上端に留めた位置で、hover で開いた右側の目次を表より手前に出す（正常系（表と重なる位置で右側の目次を出す））
test("test_normal_when_side_toc_over_table", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await mountTracked(el, { markdown: sideTocTableMarkdown() });
    const { aside, panel, rail } = sideTocOf(el);
    const table = find<HTMLTableElement>(el, ".mdmark-table table");
    // 実行: 表の見出し行が画面の上端に留まる位置までスクロールする
    window.scrollTo(
      0,
      table.getBoundingClientRect().top + window.scrollY + 300,
    );
    await vi.waitFor(() => {
      expect(find(table, "thead th").getBoundingClientRect().top).toBeLessThan(
        panel.getBoundingClientRect().bottom,
      );
    });
    // 実行: 右端の線にポインターを乗せる
    await userEvent.hover(rail);
    await vi.waitFor(() => {
      expect(panelOpacity(panel)).toBe("1");
    });
    // 前提: 表の右側が開いた枠の下まで届いている
    const box = panel.getBoundingClientRect();
    expect(table.parentElement?.getBoundingClientRect().right).toBeGreaterThan(
      box.left,
    );
    // 検証: 枠の矩形の中の格子状の点で、最も手前の要素がどれも右側の目次の中にある
    const outside: string[] = [];
    for (let y = box.top + 4; y < box.bottom - 4; y += 16) {
      for (let x = box.left + 4; x < box.right - 4; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !aside.contains(hit)) {
          outside.push(
            `${hit?.tagName ?? "null"}@${Math.round(x)},${Math.round(y)}`,
          );
        }
      }
    }
    expect(outside).toEqual([]);
    // 検証: 右側の目次の z-index が、見出し行・集計の行・ピン止めした列のセルのどれより大きい
    const cells = [
      ...table.querySelectorAll("thead th, tfoot td, .is-pinned-col"),
    ];
    expect(cells.length).toBeGreaterThan(0);
    const cellMax = Math.max(...cells.map(zIndexOf));
    expect(zIndexOf(aside)).toBeGreaterThan(cellMax);
  });
});

// 文書の末尾までスクロールしても、右端の線と hover で開くパネルをスクロールする場所の上端の近くに留める（正常系（文書の末尾まで右側の目次を留める））
test("test_normal_when_side_toc_scrolled_to_end", async () => {
  await withViewport(1280, async () => {
    for (const where of ["box", "page"] as const) {
      // 準備: 高さ 600px のスクロールする要素の中か、ページ全体のスクロールで描く
      const el = createElement();
      let scroller: HTMLElement = document.documentElement;
      if (where === "box") {
        const box = document.createElement("div");
        box.style.cssText = "height: 600px; overflow-y: auto;";
        document.body.append(box);
        elements.push(box);
        box.append(el);
        scroller = box;
      }
      el.style.setProperty("--mdmark-sticky-top", "48px");
      const handle = await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
      const { panel, rail } = sideTocOf(el);
      const space =
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
        Number.parseFloat(
          getComputedStyle(el).getPropertyValue("--mdmark-space"),
        );
      const frame = () =>
        where === "box"
          ? scroller.getBoundingClientRect()
          : { top: 0, bottom: document.documentElement.clientHeight };
      const scrollTo = (top: number) => {
        if (where === "box") {
          scroller.scrollTop = top;
          scroller.dispatchEvent(new Event("scroll"));
        } else {
          window.scrollTo(0, top);
        }
      };
      const max = () => scroller.scrollHeight - scroller.clientHeight;
      // 実行・検証: 文書の途中と末尾までスクロールする
      for (const top of [max() / 2, max()]) {
        scrollTo(top);
        await vi.waitFor(() => {
          expect(rail.getBoundingClientRect().top).toBeCloseTo(
            frame().top + 48 + space,
            0,
          );
        });
        expect(rail.getBoundingClientRect().bottom).toBeLessThanOrEqual(
          frame().bottom,
        );
      }
      // 実行・検証: 末尾で右端の線にポインターを乗せる
      await userEvent.hover(rail);
      await vi.waitFor(() => {
        expect(panelOpacity(panel)).toBe("1");
      });
      expect(
        Math.abs(
          panel.getBoundingClientRect().top - rail.getBoundingClientRect().top,
        ),
      ).toBeLessThanOrEqual(1);
      // 後始末: 次の場合の前に削除する
      await userEvent.unhover(rail);
      handle.destroy();
      handles.splice(handles.indexOf(handle), 1);
      el.remove();
      scrollTo(0);
    }
  });
});

/** 右端の線の右端から、見えている枠のスクロールバーを除いた右端までの距離（px） */
function railGapToFrame(rail: HTMLElement, frameRight: number): number {
  return frameRight - rail.getBoundingClientRect().right;
}

// 描く先の要素が画面より狭いときも、ピン止めしていない右端の線とパネルをスクロールする場所の右端から 1rem に配置し、差分のミニマップを回避する（正常系（右側の目次をスクロールする場所の右端に配置する））
test("test_normal_when_side_toc_at_scroll_edge", async () => {
  await withViewport(1600, async () => {
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    for (const where of ["page", "box"] as const) {
      // 準備: ページ全体のスクロールでは幅 992px を左端から 312px に、スクロールする要素の中では幅 800px を左に配置して描く
      const el = createElement();
      let scroller: HTMLElement | undefined;
      if (where === "box") {
        scroller = document.createElement("div");
        scroller.style.cssText =
          "position: fixed; top: 0; left: 0; width: 1200px; height: 600px; overflow-y: auto;";
        document.body.append(scroller);
        elements.push(scroller);
        scroller.append(el);
        el.style.width = "800px";
      } else {
        el.style.cssText = "width: 992px; margin-left: 312px;";
      }
      const handle = await mountTracked(el, { markdown: SIDE_TOC_MARKDOWN });
      const { panel, pin, rail, content } = sideTocOf(el);
      /** 見えている枠のスクロールバーを除いた右端 */
      const frameRight = () =>
        scroller
          ? scroller.getBoundingClientRect().left +
            scroller.clientLeft +
            scroller.clientWidth
          : document.documentElement.clientWidth;
      /** 右端の線の右端が el の右端より右で、見えている枠の右端から 1rem にあることを確認する */
      const expectAtEdge = async () => {
        await vi.waitFor(() => {
          expect(rail.getBoundingClientRect().right).toBeGreaterThan(
            el.getBoundingClientRect().right,
          );
          expect(
            Math.abs(railGapToFrame(rail, frameRight()) - rem),
          ).toBeLessThanOrEqual(1);
        });
      };
      // 検証: 描いた直後
      await expectAtEdge();
      // 実行・検証: 文書の途中までスクロールした後
      if (scroller) {
        scroller.scrollTop = scroller.scrollHeight / 2;
        scroller.dispatchEvent(new Event("scroll"));
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight / 2);
      }
      await expectAtEdge();
      // 実行・検証: 右端の線にポインターを乗せると、同じ右端にパネルを出す
      await userEvent.hover(rail);
      await vi.waitFor(() => {
        expect(panelOpacity(panel)).toBe("1");
      });
      expect(
        Math.abs(
          panel.getBoundingClientRect().right -
            rail.getBoundingClientRect().right,
        ),
      ).toBeLessThanOrEqual(1);
      // 実行・検証: ピン止めすると、パネルを el の中の右の列に出す
      await userEvent.click(pin);
      await vi.waitFor(() => {
        expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(
          el.getBoundingClientRect().right,
        );
      });
      expect(content.getBoundingClientRect().right).toBeLessThan(
        panel.getBoundingClientRect().left,
      );
      await userEvent.click(pin);
      await userEvent.unhover(rail);
      if (where === "page") {
        // 準備: 同じページの別の要素で、スクロールせずに差分を開く
        const changed = BACK_TO_TOP_MARKDOWN.replace(
          "付録の段落 9 は",
          "付録の段落 9 を書き換えた本文は",
        );
        const source = createDiffSource({}, DIFF_REVISIONS.slice(1), {
          r1: BACK_TO_TOP_MARKDOWN,
          r2: changed,
        });
        const other = createElement();
        other.style.cssText = "width: 200px;";
        await mountTracked(other, {
          markdown: changed,
          docId: "guide",
          diffSource: source,
          diffMode: "open",
        });
        await waitForDiffLines(other);
        await vi.waitFor(() => expect(minimapBands()).toHaveLength(1));
        // 検証: 線とパネルの右端が、ミニマップの帯の左端から 8px 左
        await vi.waitFor(() => {
          const band = (
            minimapBands()[0] as HTMLElement
          ).getBoundingClientRect();
          expect(
            Math.abs(band.left - 8 - rail.getBoundingClientRect().right),
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs(band.left - 8 - panel.getBoundingClientRect().right),
          ).toBeLessThanOrEqual(1);
        });
        // 実行・検証: スクロールせずに差分を閉じると、帯が削除され、線が 1rem の位置に戻る
        await userEvent.click(diffToggle(other));
        await vi.waitFor(() => expect(minimapBands()).toHaveLength(0));
        await expectAtEdge();
      }
      // 後始末: 次の場合の前に削除する
      handle.destroy();
      handles.splice(handles.indexOf(handle), 1);
      el.remove();
      window.scrollTo(0, 0);
    }
  });
});

/** リンク先を持つノード `a`（`io` を持つ）とリンク先を持たないノード `e` のフロー図の定義 */
const LINKED_FLOW_TEXT = JSON.stringify({
  title: "リンク",
  scope: "点検",
  updated: "2026-11-05",
  width: 760,
  height: 152,
  nodes: [
    {
      id: "a",
      kind: "script",
      x: 20,
      y: 40,
      w: 200,
      h: 72,
      name: "仕様を開く",
      href: "https://example.com/spec",
      io: { in: "本文", do: "分ける", out: "種類" },
    },
    { id: "e", kind: "script", x: 520, y: 40, w: 200, h: 72, name: "記録する" },
  ],
  wires: [],
});

// リンク先を持つノードをクリックと Enter で開き、ノードの上から始めたドラッグでは図を動かすだけにする（正常系）
test("test_normal_when_node_link_opened", async () => {
  // 準備
  const el = createElement();
  el.style.width = "600px";
  el.style.setProperty("--mdmark-padding", "0");
  await mountTracked(el, { markdown: wrapDirective("flow", LINKED_FLOW_TEXT) });
  const figure = find<HTMLElement>(el, "figure.mdmark-diagram");
  const viewport = find<HTMLElement>(figure, ".mdmark-diagram-viewport");
  buttonOf(figure, "拡大").click();
  buttonOf(figure, "拡大").click();
  const link = find<HTMLAnchorElement>(
    figure,
    '[data-node="a"] a.mdmark-diagram-node-link',
  );
  const info = find<HTMLButtonElement>(
    figure,
    '[data-node="a"] .mdmark-diagram-info',
  );
  // 開いた URL を記録し、ページを移らせない（リンク先への遷移の代役）
  const opened: string[] = [];
  const record = (event: MouseEvent) => {
    const anchor = (event.target as Element).closest("a");
    if (anchor && !event.defaultPrevented) {
      opened.push(anchor.href);
    }
    event.preventDefault();
  };
  window.addEventListener("click", record);
  try {
    // 検証: ノードの名前の上の構造
    expect(
      getComputedStyle(
        find(figure, '[data-node="a"] .mdmark-diagram-node-name'),
      ).cursor,
    ).toBe("pointer");
    expect(
      getComputedStyle(
        find(figure, '[data-node="e"] .mdmark-diagram-node-name'),
      ).cursor,
    ).toBe("text");
    // 実行: リンクの上で押したまま 100px 動かして離す
    viewport.scrollLeft = 0;
    const start = viewport.scrollLeft;
    await userEvent.dragAndDrop(link, link, {
      sourcePosition: { x: 150, y: 30 },
      targetPosition: { x: 50, y: 30 },
    });
    // 検証: 図だけが動き、リンク先を開かない
    expect(viewport.scrollLeft - start).toBe(100);
    expect(getSelection()?.toString()).toBe("");
    expect(opened).toEqual([]);
    // 実行・検証: マーカーを押すとツールチップを出し、リンク先を開かない
    await userEvent.click(info);
    expect(tipOf(info).hidden).toBe(false);
    expect(opened).toEqual([]);
    await userEvent.keyboard("{Escape}");
    // 実行・検証: Tab の順はリンク、マーカー
    link.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(info);
    // 実行・検証: 動かさずに押すとリンク先へ移る
    await userEvent.click(link);
    expect(opened).toEqual(["https://example.com/spec"]);
    // 実行・検証: フォーカスして Enter でも同じリンク先へ移る
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toEqual([
      "https://example.com/spec",
      "https://example.com/spec",
    ]);
  } finally {
    window.removeEventListener("click", record);
  }
});

/** 折り返しの結合テストの長い行 */
const WRAP_LONG_LINE =
  'const url = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js"; // バージョンを固定した URL から配布物を読み込む';

/** 折り返しの結合テストのコードブロック */
const WRAP_CODE = [
  "```ts",
  "const a = 1;",
  WRAP_LONG_LINE,
  "const c = 3;",
  "```",
];

/** 折り返しの結合テストのファイルツリー */
const WRAP_TREE = [
  "```tree",
  "very-long-folder-name-for-the-generated-design-documents/",
  "└── a-file-name-that-is-much-longer-than-the-box-width-on-phones.config.ts # 狭い幅では注釈も項目の中で折り返す",
  "```",
];

/** 要素の中の最初の文字のノードの、行ごとの矩形 */
function textLineRects(element: Element): DOMRect[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  if (node === null) {
    throw new Error("文字が無い");
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  return [...range.getClientRects()];
}

// wrap のコードブロックとファイルツリーだけを折り返し、利用側の pre への汎用の CSS では既定を変えない（正常系）
test("test_normal_when_wrap", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(390, 800);
  const host = document.createElement("style");
  host.textContent = "pre { white-space: pre-wrap; overflow-wrap: anywhere; }";
  try {
    await loadBuilt();
    document.head.append(host);
    const el = createElement();
    await mountTracked(el, {
      markdown: [
        '<!-- code: {"lines": {}, "wrap": true} -->',
        "",
        ...WRAP_CODE,
        "",
        '<!-- code: {"lines": {}} -->',
        "",
        ...WRAP_CODE,
        "",
        "```json",
        "{",
        '  "nodes": [{ "id": "a-very-long-identifier-for-the-node", "name": "とても長い名前の項目" }]',
        "}",
        "```",
        "",
        '<!-- tree: {"depth": "all", "wrap": true} -->',
        "",
        ...WRAP_TREE,
        "",
        '<!-- tree: {"depth": "all"} -->',
        "",
        ...WRAP_TREE,
        "",
      ].join("\n"),
      config: { features: { syntax: false } },
    });
    const pres = [...el.querySelectorAll<HTMLElement>(".mdmark-code pre")];
    const [wrapped, unwrapped, json] = pres as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    // 検証: wrap のコードブロックは枠の中で折り返し、行番号は各行の頭に出る
    expect(wrapped.scrollWidth).toBeLessThanOrEqual(wrapped.clientWidth);
    const lines = [
      ...wrapped.querySelectorAll<HTMLElement>(".mdmark-code-line"),
    ];
    const [first, second, third] = lines.map(
      (line) => line.getBoundingClientRect().height,
    ) as [number, number, number];
    expect(second).toBeGreaterThanOrEqual(first * 2);
    expect(third).toBeLessThan(first * 2);
    expect(getComputedStyle(lines[2] as HTMLElement, "::before").top).toBe(
      "0px",
    );
    // 検証: wrap の無いブロックは利用側の CSS があっても折り返さない
    for (const pre of [unwrapped, json]) {
      expect(getComputedStyle(pre).whiteSpace).toBe("pre");
      expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
    }
    const jsonLefts = () =>
      [...json.querySelectorAll<HTMLElement>(".mdmark-code-text")].map(
        (text) => textLineRects(text)[0]?.left,
      );
    const withHost = jsonLefts();
    host.disabled = true;
    expect(jsonLefts()).toEqual(withHost);
    host.disabled = false;
    // 検証: wrap のツリーは名前と注釈を名前の頭に統一して折り返す
    const [wrapTree, plainTree] = [
      ...el.querySelectorAll<HTMLElement>(".mdmark-tree"),
    ] as [HTMLElement, HTMLElement];
    const wrapList = find<HTMLElement>(wrapTree, ".mdmark-tree-list");
    const plainList = find<HTMLElement>(plainTree, ".mdmark-tree-list");
    expect(wrapList.scrollWidth).toBeLessThanOrEqual(wrapList.clientWidth);
    const fileName = find<HTMLElement>(
      wrapTree,
      ".mdmark-tree-file .mdmark-tree-name",
    );
    const nameRects = textLineRects(fileName);
    expect(nameRects.length).toBeGreaterThanOrEqual(2);
    expect(nameRects[1]?.left).toBeCloseTo(nameRects[0]?.left ?? 0, 0);
    const note = find<HTMLElement>(
      wrapTree,
      ".mdmark-tree-file .mdmark-tree-note",
    );
    expect(textLineRects(note)[0]?.left).toBeCloseTo(
      nameRects[0]?.left ?? 0,
      0,
    );
    expect(plainList.scrollWidth).toBeGreaterThan(plainList.clientWidth);
    const nestedLeft = (list: HTMLElement) =>
      find<HTMLElement>(list, "ul ul").getBoundingClientRect().left -
      list.getBoundingClientRect().left;
    expect(nestedLeft(wrapList)).toBeCloseTo(nestedLeft(plainList), 0);
    // 実行・検証: コピーした文字は折り返しの改行を含まない
    find<HTMLButtonElement>(
      wrapped.closest(".mdmark-code") as Element,
      "button.mdmark-code-copy",
    ).click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText).toHaveBeenCalledWith(
      ["const a = 1;", WRAP_LONG_LINE, "const c = 3;"].join("\n"),
    );
  } finally {
    host.remove();
    await page.viewport(original.width, original.height);
  }
});

/** CDP の Fetch で差し替える要求 1 件 */
type PausedRequest = {
  requestId: string;
  request: { url: string; method: string };
};

/** CDP の送信と受信（`vitest/browser` の `cdp()` を使用する型） */
type CdpSession = {
  send: (method: string, params?: unknown) => Promise<unknown>;
  on: (event: string, handler: (params: unknown) => void) => void;
};

/** jsDelivr の Lucide のアイコンへの要求に回答する関数（`stubLucide` が差し替える） */
let lucideResponder:
  | ((
      request: PausedRequest["request"],
    ) => { status: number; body?: string } | "fail")
  | undefined;
/** 受けた要求（`stubLucide` ごとに空にする） */
const lucideRequests: string[] = [];
/** CDP の受信を登録したか（受信は削除できないため、ページで 1 回だけ登録する） */
let lucideListening = false;

/** jsDelivr の Lucide のアイコンへの要求を差し替え、受けた要求を記録する。返却する関数で差し替えを削除する */
async function stubLucide(
  respond: NonNullable<typeof lucideResponder>,
): Promise<{ requests: string[]; restore: () => Promise<void> }> {
  const session = cdp() as unknown as CdpSession;
  lucideResponder = respond;
  lucideRequests.length = 0;
  if (!lucideListening) {
    lucideListening = true;
    session.on("Fetch.requestPaused", (params: unknown) => {
      const { requestId, request } = params as PausedRequest;
      lucideRequests.push(`${request.method} ${request.url}`);
      const answer = lucideResponder?.(request) ?? "fail";
      if (answer === "fail") {
        void session.send("Fetch.failRequest", {
          requestId,
          errorReason: "Failed",
        });
        return;
      }
      void session.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: answer.status,
        responseHeaders: [
          { name: "Content-Type", value: "text/javascript" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: btoa(answer.body ?? ""),
      });
    });
  }
  await session.send("Fetch.enable", {
    patterns: [{ urlPattern: "https://cdn.jsdelivr.net/npm/lucide@*" }],
  });
  return {
    requests: lucideRequests,
    restore: async () => {
      lucideResponder = undefined;
      await session.send("Fetch.disable");
    },
  };
}

/** Lucide のアイコンのモジュールの代役（構造を 1 つ持つ） */
const LUCIDE_MODULE = 'export default [["path",{"d":"M3 12h18"}]];';

/** まとめていない名前のアイコンを持つ文書 */
const UNBUNDLED_ICONS_MARKDOWN = [
  "## `icon:sailboat` 航海",
  "",
  "`icon:anchor` と `icon:anchor` と `icon:flag` の段落",
  "",
].join("\n");

// まとめていない名前のアイコンを、名前ごとに 1 回だけ読み込んで描く（正常系（まとめていない名前のアイコンを読み込む））
test("test_normal_when_unbundled_icons", async () => {
  // 準備
  const stub = await stubLucide(() => ({ status: 200, body: LUCIDE_MODULE }));
  try {
    const el = createElement();
    // 実行
    await mountTracked(el, { markdown: UNBUNDLED_ICONS_MARKDOWN });
    // 検証
    await vi.waitFor(() =>
      expect(
        el.querySelectorAll(
          '.mdmark-inline-icon[data-icon="sailboat"] svg, .mdmark-inline-icon[data-icon="anchor"] svg',
        ),
      ).toHaveLength(3),
    );
    const names = stub.requests.map((line) => line.replace(/^.*\//, ""));
    expect(names.sort()).toEqual(["anchor.mjs", "sailboat.mjs"]);
    expect(stub.requests.every((line) => line.startsWith("GET "))).toBe(true);
    const anchor = find(el, "h2 .mdmark-anchor");
    expect(anchor.getAttribute("aria-label")).not.toContain("sailboat");
    // 実行: まとめていない名前を持たない文書
    stub.requests.length = 0;
    const other = createElement();
    await mountTracked(other, { markdown: "`icon:flag` だけの段落\n" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    // 検証
    expect(stub.requests).toHaveLength(0);
  } finally {
    await stub.restore();
  }
});

// Lucide に無い名前を行内のコードに戻し、段落の前に記載の警告を配置する（異常系（Lucide に無いアイコンの名前））
test("test_error_when_icon_not_in_lucide", async () => {
  // 準備
  const stub = await stubLucide((request) =>
    request.url.endsWith("/no-such-icon.mjs")
      ? { status: 404 }
      : { status: 200, body: LUCIDE_MODULE },
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const el = createElement();
    // 実行
    await mountTracked(el, {
      markdown: "`icon:no-such-icon` と `icon:anchor` の段落\n",
    });
    // 検証
    await vi.waitFor(() =>
      expect(el.innerHTML).toContain("<code>icon:no-such-icon</code>"),
    );
    const warning = find(el, ".mdmark-syntax-warning");
    expect(warning.textContent).toContain("no-such-icon");
    expect(warning.nextElementSibling?.tagName).toBe("P");
    await vi.waitFor(() =>
      expect(
        el.querySelector('.mdmark-inline-icon[data-icon="anchor"] svg'),
      ).not.toBeNull(),
    );
    expect(el.querySelector(".mdmark-notice")).toBeNull();
  } finally {
    await stub.restore();
  }
});

// Lucide を読み込めないときは、行内のコードに戻して通知ブロックを 1 つだけ配置する（異常系（Lucide のアイコンを読み込めない・通知ブロック））
test("test_error_when_icons_unreachable", async () => {
  // 準備
  const stub = await stubLucide(() => "fail");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const el = createElement();
    // 実行（前のテストで読み込んだモジュールはページに残るため、まだ読み込んでいない名前で確認する）
    await mountTracked(el, {
      markdown: UNBUNDLED_ICONS_MARKDOWN.replaceAll(
        "sailboat",
        "ship",
      ).replaceAll("anchor", "compass"),
    });
    // 検証
    await vi.waitFor(() =>
      expect(el.querySelectorAll(".mdmark-notice")).toHaveLength(1),
    );
    expect(el.innerHTML).toContain("<code>icon:ship</code>");
    expect(el.innerHTML).toContain("<code>icon:compass</code>");
    expect(find(el, ".mdmark-notice").textContent).toContain("Lucide");
    expect(el.textContent).toContain("航海");
    expect(el.textContent).toContain("の段落");
    expect(loggedText(spy)).toContain("https://cdn.jsdelivr.net/npm/lucide@");
  } finally {
    await stub.restore();
  }
});

/** 8 列の表 */
const WIDE_TABLE = [
  "| 項目 | 1 月 | 2 月 | 3 月 | 4 月 | 5 月 | 6 月 | 備考 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  "| 売上 | 1,200,000 | 1,350,000 | 1,410,000 | 1,280,000 | 1,520,000 | 1,610,000 | 前年比で増加した |",
].join("\n");

/** 2 つの wide の範囲を持つ文書 */
const WIDE_MARKDOWN = [
  "前の段落",
  "",
  "<!-- wide -->",
  "",
  WIDE_TABLE,
  "",
  "<!-- /wide -->",
  "",
  '<!-- wide: {"open": false} -->',
  "",
  WIDE_TABLE,
  "",
  "<!-- /wide -->",
  "",
  "後ろの段落",
  "",
].join("\n");

/** 本文の幅を 640px にした描く先の要素を作る */
function createContentElement(): HTMLElement {
  const el = createElement();
  el.style.setProperty("--mdmark-content-width", "640px");
  return el;
}

/** 要素の幅（px） */
function widthOf(element: Element): number {
  return element.getBoundingClientRect().width;
}

// wide の範囲の幅を、本文の幅と広げた幅で切り替える（正常系（wide の範囲の幅を切り替える））
test("test_normal_when_wide_toggled", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createContentElement();
    await mountTracked(el, { markdown: WIDE_MARKDOWN });
    const ranges = [...el.querySelectorAll<HTMLElement>(".mdmark-wide-range")];
    const buttons = ranges.map((range) =>
      find<HTMLButtonElement>(
        range.previousElementSibling as Element,
        ".mdmark-wide-toggle",
      ),
    );
    const paragraph = find(el, "p");
    await vi.waitFor(() =>
      expect(widthOf(ranges[0] as Element)).toBeGreaterThan(640),
    );
    // 検証: 描いた直後
    expect(widthOf(ranges[0] as Element)).toBeLessThanOrEqual(1280);
    expect(buttons[0]?.getAttribute("aria-label")).toBe("広げて表示");
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0]?.textContent).toBe("");
    expect(widthOf(ranges[1] as Element)).toBeCloseTo(widthOf(paragraph), 0);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");
    // 実行: 1 つ目を押す
    const before = buttons[0]?.getBoundingClientRect();
    await userEvent.click(buttons[0] as HTMLButtonElement);
    // 検証
    expect(widthOf(ranges[0] as Element)).toBeCloseTo(widthOf(paragraph), 0);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(buttons[0]?.getBoundingClientRect().left).toBeCloseTo(
      before?.left ?? 0,
      0,
    );
    expect(buttons[0]?.getAttribute("aria-label")).toBe("広げて表示");
    // 実行: 2 つ目で Enter を押す
    buttons[1]?.focus();
    await userEvent.keyboard("{Enter}");
    // 検証
    expect(widthOf(ranges[1] as Element)).toBeGreaterThan(widthOf(paragraph));
    // 次の画面幅の確認で横のスクロールを作らないよう片付ける
    el.remove();
  });
  await withViewport(390, async () => {
    // 準備
    const el = createContentElement();
    await mountTracked(el, { markdown: WIDE_MARKDOWN });
    const range = find<HTMLElement>(el, ".mdmark-wide-range");
    // 検証
    await vi.waitFor(() =>
      expect((range.previousElementSibling as HTMLElement | null)?.hidden).toBe(
        true,
      ),
    );
    expect(widthOf(range)).toBeCloseTo(widthOf(find(el, "p")), 0);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth,
    );
  });
});

/** 見出しと wide の範囲を持つ文書 */
const WIDE_TOC_MARKDOWN = [
  "## 概要",
  "",
  "概要の段落",
  "",
  "<!-- wide -->",
  "",
  WIDE_TABLE,
  "",
  "<!-- /wide -->",
  "",
  ...Array.from({ length: 30 }, (_, i) => `間の段落 ${i + 1}\n`),
  "## 詳細",
  "",
  "詳細の段落",
  "",
].join("\n");

// wide の範囲を、右側の目次の列に重ねずに広げる（正常系（wide の範囲と右側の目次））
test("test_normal_when_wide_with_side_toc", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createContentElement();
    await mountTracked(el, {
      markdown: WIDE_TOC_MARKDOWN,
      config: { "side-toc": { mode: "fixed" } },
    });
    const { panel, toggle, linkOf } = sideTocOf(el);
    await userEvent.click(toggle);
    const range = find<HTMLElement>(el, ".mdmark-wide-range");
    const paragraph = find(el, ".mdmark-content p");
    // 検証
    await vi.waitFor(() =>
      expect(widthOf(range)).toBeGreaterThan(widthOf(paragraph)),
    );
    await vi.waitFor(() =>
      expect(range.getBoundingClientRect().right).toBeLessThanOrEqual(
        panel.getBoundingClientRect().left + 1,
      ),
    );
    // 実行
    await userEvent.click(linkOf("詳細"));
    // 検証
    const heading = find(el, "#詳細");
    await vi.waitFor(() => {
      const rect = heading.getBoundingClientRect();
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeLessThan(window.innerHeight);
    });
  });
  await withViewport(1280, async () => {
    // 準備
    const el = createContentElement();
    el.style.maxWidth = "none";
    await mountTracked(el, {
      markdown: WIDE_TOC_MARKDOWN,
      config: { "side-toc": { mode: "hover" } },
    });
    const { rail, panel } = sideTocOf(el);
    const range = find<HTMLElement>(el, ".mdmark-wide-range");
    // 検証: ピン止めしていない間に出ている右端の線（この幅では線の代わりに出るパネル）の左に収まる
    await vi.waitFor(() => {
      const column = rail.getClientRects().length > 0 ? rail : panel;
      expect(column.getClientRects().length).toBeGreaterThan(0);
      expect(range.getBoundingClientRect().right).toBeLessThanOrEqual(
        column.getBoundingClientRect().left + 1,
      );
    });
  });
});

/** CSV の表と、言語 csv でない表を持つ文書 */
const CSV_MARKDOWN = [
  '<!-- table: {"kind": "data", "columns": {"拠点": {"filter": {}}}} -->',
  "",
  "```csv",
  "名前,拠点,金額",
  '北山,"東京, 本社",800',
  "南田,大阪,950",
  "西川,名古屋,1200",
  "```",
  "",
  "<!-- /table -->",
  "",
  "| 列 | 値 |",
  "| --- | --- |",
  "| a | 1 |",
  "",
].join("\n");

/** 要素が描かれているか（表と元の CSV は、隠した側も場所を保つため `visibility` で隠す） */
function isPainted(element: Element): boolean {
  return element.checkVisibility({ visibilityProperty: true });
}

// CSV の表と記載したとおりの CSV を、RAW のボタンで切り替える（正常系（CSV の表と元の CSV を切り替える））
test("test_normal_when_csv_raw_toggled", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: CSV_MARKDOWN });
  const wrapper = find<HTMLElement>(el, '.mdmark-table[data-source="csv"]');
  const button = find<HTMLButtonElement>(wrapper, ".mdmark-raw-toggle");
  const table = find<HTMLElement>(wrapper, "table");
  const raw = find<HTMLElement>(wrapper, "pre.mdmark-raw");
  // 検証: 描いた直後
  expect(button.closest(".mdmark-table-bar")).not.toBeNull();
  expect(button.getAttribute("aria-label")).toBe("元の CSV を表示");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(isPainted(raw)).toBe(false);
  // 実行
  await userEvent.click(button);
  // 検証
  expect(isPainted(table)).toBe(false);
  expect(raw.textContent).toBe(
    '名前,拠点,金額\n北山,"東京, 本社",800\n南田,大阪,950\n西川,名古屋,1200\n',
  );
  expect(button.getAttribute("aria-pressed")).toBe("true");
  // 実行
  button.focus();
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(isPainted(table)).toBe(true);
  expect(columnTexts(wrapper, 2)).toEqual(["800", "950", "1200"]);
  expect(wrapper.querySelector(".mdmark-sort")).not.toBeNull();
  expect(wrapper.querySelector(".mdmark-filter")).not.toBeNull();
  const other = [...el.querySelectorAll(".mdmark-table")].find(
    (candidate) => !candidate.hasAttribute("data-source"),
  );
  expect(other?.querySelector(".mdmark-raw-toggle")).toBeNull();
});

// 印刷の前に details の範囲を開き、改ページの場所で用紙を分ける（正常系（改ページと details の範囲を印刷する））
test("test_normal_when_pagebreak_and_details_printed", async () => {
  // 準備
  const el = createContentElement();
  await mountTracked(el, {
    markdown: [
      "前の段落",
      "",
      "<!-- pagebreak -->",
      "",
      '<!-- details: {"title": "補足"} -->',
      "",
      "補足の段落",
      "",
      "<!-- /details -->",
      "",
      "<!-- wide -->",
      "",
      WIDE_TABLE,
      "",
      "<!-- /wide -->",
      "",
    ].join("\n"),
  });
  const pagebreak = find<HTMLElement>(el, ".mdmark-pagebreak");
  const details = find<HTMLDetailsElement>(el, "details.mdmark-collapsible");
  const range = find<HTMLElement>(el, ".mdmark-wide-range");
  // 検証: 画面
  expect(pagebreak.getBoundingClientRect().height).toBe(0);
  expect(pagebreak.textContent).toBe("");
  // 実行
  await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
  try {
    sendPrintEvent("beforeprint");
    // 検証
    expect(getComputedStyle(pagebreak).breakBefore).toBe("page");
    expect(details.open).toBe(true);
    expect(widthOf(range)).toBeLessThanOrEqual(widthOf(find(el, "p")) + 1);
  } finally {
    await cdp().send("Emulation.setEmulatedMedia", { media: "", features: [] });
    sendPrintEvent("afterprint");
  }
  // 検証
  expect(details.open).toBe(false);
});

/** `共通/手順.md#実行` を取り込む文書と、取り込む文書の表を返却する */
function includeFixture(rowText: string): {
  markdown: string;
  includes: Record<string, string>;
} {
  return {
    markdown:
      '# 案内\n\n<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->\n\n後ろの段落\n',
    includes: {
      "共通/手順.md": [
        "## 準備",
        "",
        "準備の段落",
        "",
        "## 実行",
        "",
        '<!-- table: {"kind": "data"} -->',
        "",
        "| 手順 | 担当 |",
        "| --- | --- |",
        `| ${rowText} | 開発者 |`,
        "| 確認 | 利用者 |",
        "",
        "<!-- /table -->",
        "",
      ].join("\n"),
    },
  };
}

// update の options.includes で取り込む文書の表を差し替えて再描画する（正常系（取り込む文書を差し替える））
test("test_normal_when_includes_updated", async () => {
  // 準備
  const el = createElement();
  const first = includeFixture("ビルド");
  const handle = await mountTracked(el, first);
  // 検証
  const include = find(el, ".mdmark-include");
  expect(find(include, ".mdmark-table").getAttribute("data-kind")).toBe("data");
  expect(include.querySelector(".mdmark-sort")).not.toBeNull();
  expect(find(include, "h2 .mdmark-anchor")).toBeDefined();
  expect(
    [...el.querySelectorAll(".mdmark-side-toc-list a")].map(
      (link) => link.textContent,
    ),
  ).toContain("実行");
  // 実行
  const second = includeFixture("配布");
  handle.update(second.markdown, { includes: second.includes });
  // 検証
  expect(find(el, ".mdmark-include").textContent).toContain("配布");
  expect(find(el, ".mdmark-include").textContent).not.toContain("ビルド");
  // 実行
  handle.update(`${second.markdown}\n追加の段落\n`);
  // 検証
  expect(find(el, ".mdmark-include").textContent).toContain("配布");
  expect(el.textContent).toContain("追加の段落");
});

// 蛍光ペンの mark を、コメントのマーカーと分けて扱う（正常系（蛍光ペンとコメント））
test("test_normal_when_highlight_with_comments", async () => {
  // 準備
  const el = createElement();
  const store = createCommentStore([
    {
      id: "c1",
      quote: "テーマの変数",
      prefix: "外観は",
      suffix: "で変える",
      body: "読み込んだコメント",
    },
  ]);
  await mountTracked(el, {
    markdown:
      "==決め手== と ==例外=={color=green} がある。外観はテーマの変数で変える。\n",
    config: { features: { comments: true } },
    docId: "guide",
    commentStore: store,
  });
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  const highlights = [
    ...el.querySelectorAll<HTMLElement>("mark.mdmark-highlight"),
  ];
  // 検証
  expect(highlights).toHaveLength(2);
  for (const mark of highlights) {
    expect(mark.classList.contains("mdmark-comment-mark")).toBe(false);
  }
  // 実行
  await userEvent.click(highlights[0] as HTMLElement);
  // 検証
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
  // 実行
  await userEvent.click(commentMarkOf(el, "テーマの変数"));
  // 検証
  await vi.waitFor(() =>
    expect(document.querySelector(".mdmark-comment-bubble")).not.toBeNull(),
  );
  for (const mark of highlights) {
    const style = getComputedStyle(mark);
    expect(
      contrastRatio(style.color, style.backgroundColor),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

/** 単語をタッチでタップする。`pointerenter`・`pointerleave` は泡立たないため、ブラウザと同じく単語の枠と単語の両方に送信する（既にフォーカスを持つ単語では `focus` は発火しない） */
function tapTerm(term: HTMLElement): void {
  const wrap = term.closest<HTMLElement>(".mdmark-term-wrap");
  if (!wrap) {
    throw new Error("単語の枠が無い");
  }
  firePointer(wrap, "pointerenter", "touch");
  firePointer(term, "pointerenter", "touch");
  firePointer(term, "pointerdown", "touch");
  firePointer(term, "pointerup", "touch");
  firePointer(term, "pointerleave", "touch");
  firePointer(wrap, "pointerleave", "touch");
  term.focus();
}

// タッチのタップで用語のツールチップを開閉し、ツールチップと単語の外の pointerdown で閉じる（正常系）
test("test_normal_when_glossary_touch", async () => {
  // 準備
  await userEvent.unhover(document.body);
  const el = createElement();
  await mountTracked(el, {
    markdown: "手元で単体テストを実行する。\n\n用語を含まない段落。\n",
    aliases: [UNIT_TEST_ALIAS],
  });
  const term = find<HTMLElement>(el, ".mdmark-term");
  const wrap = find<HTMLElement>(el, ".mdmark-term-wrap");
  const button = find<HTMLButtonElement>(wrap, "button.mdmark-term-tip-copy");
  const outside = find<HTMLElement>(el, "p:last-of-type");
  // 実行・検証: 閉じた単語への 1 回のタップで開く
  tapTerm(term);
  expect(wrap.classList.contains("is-open")).toBe(true);
  // コピーのボタンのタップ（フォーカスがボタンへ移る）では閉じない
  firePointer(button, "pointerdown", "touch");
  button.focus();
  expect(wrap.classList.contains("is-open")).toBe(true);
  // mouse の pointerdown では切り替えない
  firePointer(term, "pointerdown", "mouse");
  expect(wrap.classList.contains("is-open")).toBe(true);
  // フォーカスがボタンにある状態で開いている単語をタップすると閉じる（単語の focusin が pointerdown の後に発火する）
  tapTerm(term);
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(wrap.classList.contains("is-open")).toBe(false);
  // 単語のタップでもう一度開き、2 つ目の段落の pointerdown だけで閉じる
  tapTerm(term);
  expect(wrap.classList.contains("is-open")).toBe(true);
  firePointer(outside, "pointerdown", "touch");
  expect(wrap.classList.contains("is-open")).toBe(false);
  // 単語にフォーカスが残ったままでも、ツールチップを出さない
  expect(document.activeElement).toBe(term);
  expect(getComputedStyle(find(wrap, ".mdmark-term-tip")).display).toBe("none");
});

/** 列の並べ替えを付けた表（`+reorder +columns`）と、`+reorder` だけの表と、`<!-- table: {"kind": "data"} -->` の表を持つ文書 */
const REORDER_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"reorder": {}, "columns": {}}} -->',
  "",
  "| 名前 | 型 | 既定 | 説明 |",
  "| --- | --- | --- | --- |",
  "| features.table | bool | true | 表の機能 |",
  "| features.html | bool | true | 埋め込んだ HTML |",
  "| build.include | string[] |  | まとめる文書 |",
  "",
  "<!-- /table -->",
  "",
  '<!-- table: {"kind": "data", "features": {"reorder": {}}} -->',
  "",
  "| 名前 | 型 |",
  "| --- | --- |",
  "| a | b |",
  "",
  "<!-- /table -->",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 名前 | 型 |",
  "| --- | --- |",
  "| c | d |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 表の見出しの最下段のセルと、本文の行ごとのセルの文字（並べ替えのボタンなどの文字を除いた列名）を、列の並んだ順に返却する */
function headAndRowTexts(table: Element): string[][] {
  const lastHead = [...table.querySelectorAll("thead tr")].at(-1);
  const headTexts = [...(lastHead?.children ?? [])].map(
    (cell) =>
      cell.querySelector(".mdmark-th-label")?.textContent?.trim() ??
      cell.firstChild?.textContent?.trim() ??
      "",
  );
  const rows = [...table.querySelectorAll("tbody tr")].map((row) =>
    [...row.children].map((cell) => cell.textContent?.trim() ?? ""),
  );
  return [headTexts, ...rows];
}

/** 一覧の項目の列名を、並んだ順に返却する */
function settingsNames(panel: Element): string[] {
  return [
    ...panel.querySelectorAll<HTMLElement>(".mdmark-table-settings-item"),
  ].map((item) => item.dataset.name ?? "");
}

// テーブル設定の一覧のつまみで列を動かし、目のアイコンで列を隠す（正常系）
test("test_normal_when_columns_reordered", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: REORDER_MARKDOWN });
  const [table, onlyReorder, plain] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-table"),
  ] as HTMLElement[];
  if (!table || !onlyReorder || !plain) {
    throw new Error("表が足りない");
  }
  const columnOrder = () =>
    [...table.querySelectorAll<HTMLElement>("tbody tr:first-child td")].map(
      (cell) => Number(cell.dataset.col),
    );
  // 実行・検証: テーブル設定を押す
  const toggle = find<HTMLButtonElement>(
    table,
    "button.mdmark-table-settings-toggle",
  );
  expect(toggle.getAttribute("aria-label")).toBe("テーブル設定");
  const { panel, eye, grip } = openTableSettings(table);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(find(panel, ".mdmark-table-settings-title").textContent).toBe(
    "表示と並び順",
  );
  expect(table.querySelector("thead .mdmark-table-settings-grip")).toBeNull();
  // 実行・検証: 説明のつまみを名前の上へドラッグする
  await userEvent.dragAndDrop(grip(3), grip(0), {
    targetPosition: { x: 4, y: 1 },
  });
  expect(columnOrder()).toEqual([3, 0, 1, 2]);
  expect(
    [...table.querySelectorAll<HTMLElement>("thead th")].map((th) =>
      Number(th.dataset.col),
    ),
  ).toEqual([3, 0, 1, 2]);
  expect(settingsNames(panel)).toEqual(["説明", "名前", "型", "既定"]);
  // 実行・検証: 型のつまみで ↓ キーを押す
  grip(1).focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(columnOrder()).toEqual([3, 0, 2, 1]);
  expect(settingsNames(panel)).toEqual(["説明", "名前", "既定", "型"]);
  expect(document.activeElement).toBe(grip(1));
  // 実行・検証: 説明の目のアイコンを押す
  eye(3).click();
  expect(
    columnCells(table, 0).every((cell) => cell.hasAttribute("hidden")),
  ).toBe(true);
  expect(eye(3).getAttribute("aria-pressed")).toBe("true");
  expect(eye(3).getAttribute("aria-label")).toBe("「説明」を表示");
  expect(settingsBadge(table)).toBe("1");
  expect(eye(0).disabled).toBe(true);
  // 実行・検証: 名前の見出しの並べ替えを押す
  const nameHead = find<HTMLElement>(table, 'thead th[data-col="0"]');
  find<HTMLButtonElement>(nameHead, "button.mdmark-sort").click();
  expect(columnOrder()).toEqual([3, 0, 2, 1]);
  // 検証: ほかの表
  const second = openTableSettings(onlyReorder);
  expect(find(second.panel, ".mdmark-table-settings-title").textContent).toBe(
    "並び順",
  );
  expect(second.panel.querySelector(".mdmark-table-settings-eye")).toBeNull();
  expect(plain.querySelector(".mdmark-table-settings-toggle")).toBeNull();
  // 実行・検証: 再描画すると Markdown の順に戻る
  handle.update(REORDER_MARKDOWN);
  const redrawn = find<HTMLElement>(el, ".mdmark-table");
  expect(
    [...redrawn.querySelectorAll<HTMLElement>("tbody tr:first-child td")].map(
      (cell) => Number(cell.dataset.col),
    ),
  ).toEqual([0, 1, 2, 3]);
  expect(headAndRowTexts(redrawn)[1]).toEqual([
    "features.table",
    "bool",
    "true",
    "表の機能",
  ]);
});

/** 2 行の見出しで名前をピン止めし、設定の範囲を持つ表の文書 */
const REORDER_GROUPS_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"reorder": {}, "columns": {}}, "columns": {"名前": {"pinned": true}}, "header": {"rows": 2}} -->',
  "",
  "| 名前 | 設定 | << | << | 備考 |",
  "| --- | --- | --- | --- | --- |",
  "| ^^ | 型 | 既定 | 必須 | ^^ |",
  "| features.table | bool | true | ✓ | 表の機能のオン・オフを決める長い説明の文 |",
  "| features.html | bool | true |  | 埋め込んだ HTML のオン・オフを決める長い説明の文 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 結合した見出しの範囲の中だけで列を動かし、ピン止めの境をまたがせない（正常系）
test("test_normal_when_reordered_within_groups", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  await mountTracked(el, {
    markdown: REORDER_GROUPS_MARKDOWN,
    config: { table: { pin: "through" } },
  });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const secondHead = () =>
    [...table.querySelectorAll<HTMLElement>("thead tr")]
      .flatMap((row) => [...row.children] as HTMLElement[])
      .filter((cell) => cell.dataset.col !== undefined)
      .map((cell) => cell.textContent?.trim() ?? "");
  const order = () =>
    [...table.querySelectorAll<HTMLElement>("tbody tr:first-child td")].map(
      (cell) => Number(cell.dataset.col),
    );
  const { panel, grip } = openTableSettings(table);
  // 検証: 一覧の分け方
  expect(
    [...panel.querySelectorAll(".mdmark-table-settings-group")].map(
      (group) => group.textContent,
    ),
  ).toEqual(["ピン止めの列", "設定", "範囲の外の列"]);
  expect(grip(0).disabled).toBe(true);
  expect(grip(4).disabled).toBe(true);
  // 実行・検証: 既定を型の上へドラッグする
  await userEvent.dragAndDrop(grip(2), grip(1), {
    targetPosition: { x: 4, y: 1 },
  });
  expect(order()).toEqual([0, 2, 1, 3, 4]);
  expect(secondHead().slice(-3)).toEqual(
    expect.arrayContaining(["既定", "型", "必須"]),
  );
  const group = [...table.querySelectorAll<HTMLElement>("thead th")].find(
    (th) => th.textContent?.trim().startsWith("設定"),
  );
  expect(group?.getAttribute("colspan")).toBe("3");
  // 実行・検証: 型を備考の下へドラッグしても動かない
  const item = (column: number) =>
    find<HTMLElement>(
      panel,
      `.mdmark-table-settings-item[data-column="${column}"]`,
    );
  item(1).dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
  await userEvent.dragAndDrop(grip(1), item(4), {
    targetPosition: { x: 4, y: 20 },
  });
  expect(order()).toEqual([0, 2, 1, 3, 4]);
  expect(
    panel.querySelectorAll(".is-drop-before, .is-drop-after"),
  ).toHaveLength(0);
  // 検証: 横にスクロールしても名前の列が左端に留まる
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  const nameCell = find<HTMLElement>(
    table,
    'tbody tr:first-child td[data-col="0"]',
  );
  const before = nameCell.getBoundingClientRect().left;
  scroller.scrollLeft = 200;
  await nextFrames();
  expect(scroller.scrollLeft).toBeGreaterThan(0);
  expect(
    Math.abs(nameCell.getBoundingClientRect().left - before),
  ).toBeLessThanOrEqual(1);
});

/** 10 列 30 行の、マーカーで囲まない表の Markdown */
function wideTableMarkdown(): string {
  const headers = Array.from({ length: 10 }, (_, i) => `列の名前${i + 1}`);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...Array.from(
      { length: 30 },
      (_, row) =>
        `| ${headers.map((_h, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
    ),
    "",
  ].join("\n");
}

// table.pin: through の表は、押した列までを左端に留め、もう一度押すと全て解除する（正常系）
test("test_normal_when_table_pinned_through", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  await mountTracked(el, {
    markdown: wideTableMarkdown(),
    config: { table: { pin: "through" } },
  });
  const pins = el.querySelectorAll<HTMLButtonElement>("button.mdmark-pin");
  await vi.waitFor(() => {
    expect(pins[0]?.hasAttribute("hidden")).toBe(false);
  });
  const firstRow = find<HTMLTableRowElement>(el, "tbody tr");
  const positions = () =>
    [...firstRow.cells].map((cell) => getComputedStyle(cell).position);
  const pressed = () =>
    [...pins].map((pin) => pin.getAttribute("aria-pressed"));
  // 検証: ボタンの名前は押した列までを留める名前
  expect(pins[0]?.getAttribute("aria-label")).toBe(
    "「列の名前1」の列までピン止め",
  );
  // 実行・検証: 3 列目を押すと、1〜3 列目を左端に留め、3 列目のボタンだけを押した状態にする
  const third = pins[2] as HTMLButtonElement;
  third.click();
  expect(pressed()).toEqual([
    "false",
    "false",
    "true",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
  ]);
  expect(positions().slice(0, 4)).toEqual([
    "sticky",
    "sticky",
    "sticky",
    "static",
  ]);
  // right は入れず auto のまま（sticky の計算値は left から求めた値になるので、入れた値を見る）
  for (const cell of el.querySelectorAll<HTMLElement>("th, td")) {
    expect(cell.style.right).toBe("");
  }
  // 実行・検証: もう一度押すと全て解除する
  third.click();
  expect(pressed().every((value) => value === "false")).toBe(true);
  expect(positions().slice(0, 3)).toEqual(["static", "static", "static"]);
});

/** 名前をピン止めし、列の並べ替えを持つ 8 列の表の文書 */
const REORDER_PINNED_MARKDOWN = [
  '<!-- table: {"kind": "data", "features": {"reorder": {}}, "columns": {"名前": {"pinned": true}}} -->',
  "",
  "| 名前 | 型 | 既定 | 必須 | 単位 | 範囲 | 例 | 説明 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  "| features.table | bool | true | ✓ | なし | true・false | true | 表の機能のオン・オフを決める長い説明の文 |",
  "| table.pin | string | each | | なし | each・through | through | ピン止めの動きを決める長い説明の文 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// each の表は、留めているかを列が持ったまま動かし、テーブル設定の一覧を留めた列で分けない（正常系）
test("test_normal_when_reordered_with_pinned_columns", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  await mountTracked(el, { markdown: REORDER_PINNED_MARKDOWN });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const { panel, grip } = openTableSettings(table);
  const headTexts = () =>
    [...table.querySelectorAll<HTMLElement>("thead th")].map(
      (cell) => cell.textContent?.trim() ?? "",
    );
  // 検証: 一覧は分かれず、表の列の順に 1 つに並ぶ
  expect(panel.querySelectorAll(".mdmark-table-settings-group")).toHaveLength(
    0,
  );
  expect(
    [...panel.querySelectorAll<HTMLElement>(".mdmark-table-settings-item")].map(
      (item) => Number(item.dataset.column),
    ),
  ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // 実行: 名前を型の下へドラッグする
  const item = (column: number) =>
    find<HTMLElement>(
      panel,
      `.mdmark-table-settings-item[data-column="${column}"]`,
    );
  await userEvent.dragAndDrop(grip(0), item(1), {
    targetPosition: { x: 4, y: item(1).offsetHeight - 2 },
  });
  // 検証: 型・名前の順になり、名前の列は留めたまま
  expect(headTexts().slice(0, 2)).toEqual(["型", "名前"]);
  const namePin = find<HTMLButtonElement>(
    table,
    'thead th[data-col="0"] button.mdmark-pin',
  );
  expect(namePin.getAttribute("aria-pressed")).toBe("true");
  const nameCell = find<HTMLElement>(
    table,
    'tbody tr:first-child td[data-col="0"]',
  );
  expect(getComputedStyle(nameCell).position).toBe("sticky");
  // 実行・検証: 右端までスクロールすると、名前の列が左端に留まる
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  scroller.scrollLeft = scroller.scrollWidth;
  await nextFrames();
  expect(scroller.scrollLeft).toBeGreaterThan(0);
  const visibleLeft =
    scroller.getBoundingClientRect().left + scroller.clientLeft;
  expect(
    Math.abs(nameCell.getBoundingClientRect().left - visibleLeft),
  ).toBeLessThanOrEqual(1);
});

/** 2 行の見出しで設定の範囲を持ち、備考を広く取る表の文書 */
const MERGED_HEADER_PIN_MARKDOWN = [
  '<!-- table: {"kind": "data", "columns": {"備考": {"width": {"mode": "nowrap"}}}, "header": {"rows": 2}} -->',
  "",
  "| 名前 | 設定 | << | << | 備考 |",
  "| --- | --- | --- | --- | --- |",
  "| ^^ | 型 | 既定 | 必須 | ^^ |",
  "| table.pin | string | each | false | each は押した列だけを留め、through は押した列までを留める。既定は each で、mount は他の値を無視して each にする |",
  "| side-toc.mode | string | hover | false | hover は右端の線を出し、fixed は目次を出すボタンでサイドバーを開閉する |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// each の表で結合した見出しの下の 1 列だけを留めると、結合したセルは留めず、最下段の見出しと本文のセルだけを留める（正常系）
test("test_normal_when_pinned_under_merged_header", async () => {
  // 準備
  const el = createElement();
  el.style.width = "320px";
  await mountTracked(el, { markdown: MERGED_HEADER_PIN_MARKDOWN });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const pinOf = (column: number) =>
    find<HTMLButtonElement>(
      table,
      `thead th[data-col="${column}"] button.mdmark-pin`,
    );
  await vi.waitFor(() => {
    expect(pinOf(2).hasAttribute("hidden")).toBe(false);
  });
  // 実行: 2 行目の既定のピン止めを押し、右端までスクロールする
  pinOf(2).click();
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  scroller.scrollLeft = scroller.scrollWidth;
  await nextFrames();
  // 検証: 既定の列の見出しと本文のセルを、名前の列の幅の位置に留める
  const nameCell = find<HTMLElement>(
    table,
    'tbody tr:first-child td[data-col="0"]',
  );
  const defaultHead = find<HTMLElement>(table, 'thead th[data-col="2"]');
  const defaultCell = find<HTMLElement>(
    table,
    'tbody tr:first-child td[data-col="2"]',
  );
  for (const cell of [defaultHead, defaultCell]) {
    expect(getComputedStyle(cell).position).toBe("sticky");
    expect(cell.style.left).toBe(`${nameCell.offsetWidth}px`);
  }
  // 検証: 結合した設定のセルは留めない
  const groupHead = [...table.querySelectorAll<HTMLElement>("thead th")].find(
    (cell) => cell.getAttribute("colspan") === "3",
  );
  expect(groupHead?.textContent?.trim()).toBe("設定");
  expect(getComputedStyle(groupHead as HTMLElement).position).not.toBe(
    "sticky",
  );
  // 検証: 既定のボタンだけが押され、型・必須は押していない
  expect(pinOf(2).getAttribute("aria-pressed")).toBe("true");
  expect(pinOf(1).getAttribute("aria-pressed")).toBe("false");
  expect(pinOf(3).getAttribute("aria-pressed")).toBe("false");
});

/** 階層の表の行（キー・型・必須・既定・説明） */
const TREE_TABLE_ROWS = [
  "| キー | 型 | 必須 | 既定 | 説明 |",
  "| --- | --- | --- | --- | --- |",
  "| features.table | bool | ✓ | true | 表の機能 |",
  "| features.html | bool |  |  | 埋め込んだ HTML |",
  "| aliases[].id | string |  |  | 別名の ID |",
  "| aliases[].metadata.alias_type.type | ref \\| custom |  |  | 別名の種類 |",
];

/** 表のマーカーの `tree` に `tree` のキーを、最上位に `top` のキーを加えた階層の表の文書 */
function treeMarkdown(extra: { tree?: string; top?: string } = {}): string {
  return [
    `<!-- table: {"kind": "data", "tree": {"key": {"column": "キー"}, "type": {"column": "型"}, "required": {"column": "必須"}, "default": {"column": "既定"}${extra.tree ?? ""}}${extra.top ?? ""}} -->`,
    "",
    ...TREE_TABLE_ROWS,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 横の目盛り `1月`〜`4月`・系列 2 つの、折れ線か棒のグラフの定義の JSON */
function monthlyChartText(type: "line" | "bar"): string {
  return JSON.stringify({
    type,
    title: type === "line" ? "月ごとの返信の件数" : "月ごとの起票の件数",
    scope: "1 月から 4 月",
    updated: "2026-11-05",
    x: { label: "月", ticks: ["1月", "2月", "3月", "4月"] },
    y: { label: "件" },
    series: [
      { name: "自動返信", points: [12, 38, 25, 41] },
      { name: "担当者", points: [8, 14, 19, 22] },
    ],
  });
}

/** 項目 `A`・`B`・`C`（値 50・30・20）の円のグラフの定義の JSON */
const ABC_PIE_TEXT = JSON.stringify({
  type: "pie",
  title: "返信の種類の割合",
  scope: "1 月から 4 月",
  updated: "2026-11-05",
  items: [
    { name: "A", value: 50 },
    { name: "B", value: 30 },
    { name: "C", value: 20 },
  ],
});

/** 系列 1 つ・点 6 つの散布図の定義の JSON */
const SIX_POINTS_SCATTER_TEXT = JSON.stringify({
  type: "scatter",
  title: "本文の長さと返信までの時間",
  scope: "1 月から 4 月",
  updated: "2026-11-05",
  x: { label: "字" },
  y: { label: "分" },
  series: [
    {
      name: "問い合わせ",
      points: [
        [120, 6],
        [180, 9],
        [240, 14],
        [300, 20],
        [360, 26],
        [420, 31],
      ],
    },
  ],
});

/** 図の `figure` を、文書の順に返却する */
function diagramFiguresOf(el: Element): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>("figure.mdmark-diagram")];
}

/** 図の中のツールチップの持ち主（グラフの項目と、点のクリックを受ける円）を返却する */
function itemOwners(figure: Element): HTMLElement[] {
  return [...figure.querySelectorAll<HTMLElement>("[data-tip-owner]")].filter(
    (owner) => !owner.classList.contains("mdmark-diagram-info"),
  );
}

// tooltips.diagramPlacement が top なら線・ヒント・グラフの項目のツールチップを持ち主の上に出し、本文の用語は placement のとおり。知らない値は bottom（正常系（図のツールチップを上に出す設定））
test("test_normal_when_diagram_placement_top", async () => {
  // 準備
  const markdown = `${placementMarkdown({ tail: false })}\n${wrapDirective("chart", monthlyChartText("line"))}\n`;
  const el = createElement();
  await mountTracked(el, {
    markdown,
    index: PLACEMENT_INDEX,
    docId: "arch",
    config: {
      tooltips: { diagramPlacement: "top", placement: "bottom" },
      features: { "side-toc": false },
    },
  });
  const { terms, label, mark } = placementOwners(el);
  const sectionTerm = terms[1] as HTMLElement;
  const chart = diagramFiguresOf(el).at(-1) as HTMLElement;
  const point = itemOwners(chart)[1] as HTMLElement;
  // 実行・検証: 線のラベル・div のマーカー・グラフの点は、持ち主の上に出る
  for (const owner of [label, mark, point]) {
    const rects = await hoverAndMeasure(owner, "center");
    expect(rects.tip.bottom).toBeLessThanOrEqual(rects.owner.top);
  }
  // 実行・検証: 2 つ目のセクションの用語は、placement の bottom のとおり単語の下に出る
  const term = await hoverAndMeasure(sectionTerm, "center");
  expect(term.tip.top).toBeGreaterThanOrEqual(term.owner.bottom);
  // 実行・検証: 知らない値は bottom として扱い、線のラベルの下に出る
  const el2 = createElement();
  await mountTracked(el2, {
    markdown,
    index: PLACEMENT_INDEX,
    docId: "arch",
    config: {
      tooltips: { diagramPlacement: "left" },
      features: { "side-toc": false },
    },
  });
  const unknown = await hoverAndMeasure(placementOwners(el2).label, "center");
  expect(unknown.tip.top).toBeGreaterThanOrEqual(unknown.owner.bottom);
});

// グラフの点・棒・扇形・散布図の点と追加した種類の項目に、名前と値のツールチップを出し、Esc で削除する（正常系（グラフの項目のツールチップ））
test("test_normal_when_chart_item_tooltip", async () => {
  // 準備
  const el = createElement();
  el.style.width = "600px";
  const markdown = [
    wrapDirective("chart", monthlyChartText("line")),
    wrapDirective("chart", monthlyChartText("bar")),
    wrapDirective("chart", ABC_PIE_TEXT),
    wrapDirective("chart", SIX_POINTS_SCATTER_TEXT),
    ...ADDED_CHART_DEFINITIONS.slice(0, 8).map((definition) =>
      wrapDirective("chart", JSON.stringify(definition)),
    ),
  ].join("\n");
  await mountTracked(el, { markdown });
  const [line, bar, pie, scatter, ...added] = diagramFiguresOf(el) as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];
  expect(added).toHaveLength(8);
  // 実行・検証: 折れ線の 2 つ目の点の上で、系列の名前・横の目盛り・値を出し、項目の下に配置する
  const point = itemOwners(line)[1] as HTMLElement;
  point.scrollIntoView({ block: "center" });
  await userEvent.hover(point);
  const pointTip = tipOf(point);
  expect(pointTip.getAttribute("role")).toBe("tooltip");
  expect(pointTip.hidden).toBe(false);
  expect(pointTip.textContent).toContain("自動返信");
  expect(pointTip.textContent).toContain("2月: 38");
  expect(pointTip.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    point.getBoundingClientRect().bottom,
  );
  // 実行・検証: 外観の点の外で、クリックを受ける範囲の内側でも同じツールチップを出す
  await userEvent.unhover(point);
  await vi.waitFor(() => expect(pointTip.hidden).toBe(true));
  const box = point.getBoundingClientRect();
  await userEvent.hover(point, {
    position: { x: box.width * 0.85, y: box.height / 2 },
  });
  await vi.waitFor(() => expect(pointTip.hidden).toBe(false));
  // 実行・検証: 棒・円の A の扇形・散布図の点
  const cases: Array<[HTMLElement, string[]]> = [
    [itemOwners(bar)[0] as HTMLElement, ["自動返信", "1月: 12"]],
    [itemOwners(pie)[0] as HTMLElement, ["A", "50", "50%"]],
    [itemOwners(scatter)[0] as HTMLElement, ["問い合わせ", "120", "6"]],
  ];
  for (const [owner, words] of cases) {
    owner.scrollIntoView({ block: "center" });
    await userEvent.hover(owner);
    const tip = tipOf(owner);
    expect(tip.hidden).toBe(false);
    for (const word of words) {
      expect(tip.textContent).toContain(word);
    }
  }
  // 実行・検証: 追加した 8 つの種類のグラフの項目（ドーナツの扇形は矩形の中心が穴のため、フォーカスで開く）
  await userEvent.unhover(document.body);
  for (const [index, figure] of added.entries()) {
    const owner = itemOwners(figure)[0];
    if (!owner) {
      throw new Error(`項目の持ち主が無い: ${index}`);
    }
    owner.scrollIntoView({ block: "center" });
    owner.focus();
    const tip = tipOf(owner);
    expect(tip.hidden, String(index)).toBe(false);
    const definition = ADDED_CHART_DEFINITIONS[index] as {
      series?: Array<{ name: string }>;
      items?: Array<{ name: string }>;
    };
    const names = [
      ...(definition.series ?? []),
      ...(definition.items ?? []),
    ].map((entry) => entry.name);
    expect(
      names.some((name) => tip.textContent?.includes(name)),
      String(index),
    ).toBe(true);
    expect(tip.textContent, String(index)).toMatch(/\d/);
  }
  // 実行・検証: フォーカスした点の aria-describedby がツールチップを指し、Esc で削除してフォーカスを残す
  await userEvent.unhover(document.body);
  point.focus();
  expect(
    document.getElementById(point.getAttribute("aria-describedby") ?? ""),
  ).toBe(pointTip);
  await vi.waitFor(() => expect(pointTip.hidden).toBe(false));
  await userEvent.keyboard("{Escape}");
  expect(pointTip.hidden).toBe(true);
  expect(document.activeElement).toBe(point);
});

/** 図の表示する枠 */
function viewportOf(figure: Element): HTMLElement {
  return find<HTMLElement>(figure, '[role="group"][aria-roledescription="図"]');
}

/** 表示する枠の中の要素の位置（表示する枠の左上から、px）で、表示する枠の上を押して動かして離す */
async function dragViewport(
  viewport: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await userEvent.dragAndDrop(viewport, viewport, {
    sourcePosition: from,
    targetPosition: to,
  });
}

/** 要素の中心の、表示する枠の左上からの位置 */
function centerIn(
  viewport: Element,
  element: Element,
): { x: number; y: number } {
  const outer = viewport.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return {
    x: inner.left + inner.width / 2 - outer.left,
    y: inner.top + inner.height / 2 - outer.top,
  };
}

// 拡大したグラフの点の上で、しきい値より小さく動かしても図を動かさずツールチップを残し、越えたら動かしてツールチップを閉じる（正常系（グラフの項目の上で動かす））
test("test_normal_when_drag_on_chart_item", async () => {
  // 準備
  const el = createElement();
  el.style.width = "600px";
  await mountTracked(el, {
    markdown: wrapDirective("chart", monthlyChartText("line")),
  });
  const figure = diagramFiguresOf(el)[0] as HTMLElement;
  const viewport = viewportOf(figure);
  buttonOf(figure, "拡大").click();
  buttonOf(figure, "拡大").click();
  const point = itemOwners(figure)[1] as HTMLElement;
  point.scrollIntoView({ block: "nearest", inline: "nearest" });
  viewport.scrollLeft = 0;
  await userEvent.hover(point);
  const tip = tipOf(point);
  expect(tip.hidden).toBe(false);
  const before = viewport.scrollLeft;
  const start = centerIn(viewport, point);
  // 実行・検証: 2px 動かして離す
  await dragViewport(viewport, start, { x: start.x + 2, y: start.y });
  expect(viewport.scrollLeft).toBe(before);
  expect(tip.hidden).toBe(false);
  // 実行・検証: 100px 左へ動かす（離す前に確認する。離した後はポインターの下に点が戻り、ポインターを乗せたことになる）
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const rect = point.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientY: rect.top + rect.height / 2,
  };
  const x = rect.left + rect.width / 2;
  point.dispatchEvent(
    new PointerEvent("pointerdown", { ...pointer, clientX: x }),
  );
  point.dispatchEvent(
    new PointerEvent("pointermove", { ...pointer, clientX: x - 100 }),
  );
  expect(viewport.scrollLeft).toBeGreaterThan(before);
  expect(tip.hidden).toBe(true);
  point.dispatchEvent(
    new PointerEvent("pointerup", { ...pointer, clientX: x - 100 }),
  );
});

/** タイトルの上端が `top` から、図の座標で 8px（倍率を掛けた px）以内の下にあるか */
function stuckBelow(top: number, title: Element, scale: number): boolean {
  const rect = title.getBoundingClientRect();
  return rect.top >= top - 1 && rect.top <= top + 8 * scale + 1;
}

/** タイトルの高さの真ん中・左端から 24px 内側（拡大したタイトルは画面より長いため）の位置で、最も手前の要素がタイトルかその子か */
function frontAtCenter(title: Element): boolean {
  const rect = title.getBoundingClientRect();
  const hit = document.elementFromPoint(
    rect.left + Math.min(rect.width / 2, 24),
    rect.top + rect.height / 2,
  );
  return hit !== null && (hit === title || title.contains(hit));
}

// 拡大して動かした間、見えているシステムの枠と層のタイトルを上端に留め、stickyTitles: false の図では留めない（正常系（グループのタイトルを留める））
test("test_normal_when_group_titles_stuck", async () => {
  // 準備
  const definition = JSON.parse(INQUIRY_GROUPS_TEXT) as {
    frame: { title: string; hint: string; x: number };
    lanes: Array<{ label: string; kind: string; y: number; h: number }>;
  };
  const off = { ...definition, stickyTitles: false };
  const el = createElement();
  el.style.width = "600px";
  await mountTracked(el, {
    markdown: [
      wrapDirective("flow", INQUIRY_GROUPS_TEXT),
      wrapDirective("flow", JSON.stringify(off)),
    ].join("\n"),
  });
  const [stuck, plain] = diagramFiguresOf(el) as [HTMLElement, HTMLElement];
  const process = definition.lanes.find((lane) => lane.kind === "mcp");
  const data = definition.lanes.find((lane) => lane.kind === "data");
  if (!process || !data) {
    throw new Error("見本の定義に処理とデータの層が無い");
  }
  const labelOf = (figure: Element, label: string) =>
    [
      ...figure.querySelectorAll<HTMLElement>(".mdmark-diagram-lane-label"),
    ].find((element) => element.textContent?.startsWith(label)) as HTMLElement;
  // 処理の層が表示する枠の上へ出るまで縦に動かせるよう、拡大できるだけ拡大する
  for (const figure of [stuck, plain]) {
    for (let i = 0; i < 12 && !buttonOf(figure, "拡大").disabled; i += 1) {
      buttonOf(figure, "拡大").click();
    }
  }
  const viewport = viewportOf(stuck);
  const scale = scaleOf(stuck);
  const frameTitle = find<HTMLElement>(stuck, ".mdmark-diagram-frame-title");
  const processLabel = labelOf(stuck, process.label);
  // 実行: 処理の層の途中を見せる（狭い画面でもタイトルが画面に入るよう、枠の左端まで横にも動かす）
  const middle = Math.round((process.y + process.h / 2) * scale);
  viewport.scrollLeft = Math.round(definition.frame.x * scale);
  viewport.scrollTop = middle;
  await nextFrames();
  // 検証
  expect(viewport.scrollTop).toBeGreaterThan(process.y * scale);
  const viewportTop = viewport.getBoundingClientRect().top;
  expect(stuckBelow(viewportTop, frameTitle, scale)).toBe(true);
  expect(
    stuckBelow(frameTitle.getBoundingClientRect().bottom, processLabel, scale),
  ).toBe(true);
  expect(frontAtCenter(frameTitle)).toBe(true);
  expect(frontAtCenter(processLabel)).toBe(true);
  // 実行・検証: 留めた枠のタイトルのマーカーで、枠の hint を出す
  const info = buttonOf(stuck, `「${definition.frame.title}」の説明`);
  await userEvent.hover(info);
  const tip = tipOf(info);
  expect(tip.hidden).toBe(false);
  expect(tip.textContent).toContain(definition.frame.hint);
  await userEvent.unhover(info);
  // 実行: 処理の層が表示する枠の上へ出るまで動かす
  viewport.scrollTop = Math.round((process.y + process.h) * scale) + 24;
  await nextFrames();
  // 検証
  expect(processLabel.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    viewport.getBoundingClientRect().top,
  );
  expect(
    stuckBelow(
      frameTitle.getBoundingClientRect().bottom,
      labelOf(stuck, data.label),
      scale,
    ),
  ).toBe(true);
  // 実行・検証: stickyTitles: false の図は、同じだけ動かしてもタイトルを留めない
  const plainViewport = viewportOf(plain);
  plainViewport.scrollIntoView({ block: "center" });
  plainViewport.scrollTop = middle;
  await nextFrames();
  const plainTop = plainViewport.getBoundingClientRect().top;
  expect(
    find(plain, ".mdmark-diagram-frame-title").getBoundingClientRect().bottom,
  ).toBeLessThanOrEqual(plainTop);
  expect(
    labelOf(plain, process.label).getBoundingClientRect().bottom,
  ).toBeLessThanOrEqual(plainTop);
});

/** 幅 500・高さ 1600 のフロー図の定義の JSON */
const TALL_FLOW_TEXT = JSON.stringify({
  title: "縦に長い処理の流れ",
  scope: "高さの確認",
  updated: "2026-11-05",
  width: 500,
  height: 1600,
  nodes: [
    { id: "a", kind: "script", x: 40, y: 40, w: 180, h: 72, name: "受け取る" },
    { id: "b", kind: "script", x: 40, y: 760, w: 180, h: 72, name: "分ける" },
    { id: "c", kind: "data", x: 40, y: 1480, w: 180, h: 72, name: "残す" },
  ],
  wires: [
    {
      id: "w1",
      from: "a",
      to: "b",
      line: "flow",
      points: [
        [130, 112],
        [130, 760],
      ],
    },
    {
      id: "w2",
      from: "b",
      to: "c",
      line: "write",
      points: [
        [130, 832],
        [130, 1480],
      ],
    },
  ],
});

/** 図の表示する枠の高さ（px） */
function viewportHeight(figure: Element): number {
  return viewportOf(figure).getBoundingClientRect().height;
}

// リサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、倍率をもう一度求め、sessionStorage に保ち、ダブルクリックで図の全体が収まる高さにする（正常系（図の高さを変える））
test("test_normal_when_diagram_resized", async () => {
  // 準備
  sessionStorage.clear();
  const el = createElement();
  el.style.width = "600px";
  el.style.setProperty("--mdmark-padding", "0");
  const markdown = wrapDirective("flow", TALL_FLOW_TEXT);
  const first = await mountTracked(el, { markdown });
  let figure = diagramFiguresOf(el)[0] as HTMLElement;
  let handle = find<HTMLElement>(figure, ".mdmark-diagram-resize");
  // 検証: リサイズハンドルの属性
  expect(handle.getAttribute("role")).toBe("separator");
  expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
  expect(handle.getAttribute("tabindex")).toBe("0");
  expect(handle.getAttribute("aria-label")).toBe(
    "「縦に長い処理の流れ」の表示の高さ",
  );
  await vi.waitFor(() => expect(scaleOf(figure)).toBeGreaterThan(0));
  const opened = viewportHeight(figure);
  const openedScale = scaleOf(figure);
  const openedWidth = viewportOf(figure).clientWidth;
  expect(
    Math.abs(Number(handle.getAttribute("aria-valuenow")) - opened),
  ).toBeLessThanOrEqual(1);
  // 実行・検証: 200px 下へドラッグする
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const center = handle.getBoundingClientRect();
  const pointer = {
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: center.left + center.width / 2,
  };
  const y = center.top + center.height / 2;
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...pointer, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...pointer, clientY: y + 200 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...pointer, clientY: y + 200 }),
  );
  const resized = viewportHeight(figure);
  expect(Math.abs(resized - opened - 200)).toBeLessThanOrEqual(1);
  expect(viewportOf(figure).clientWidth).toBe(openedWidth);
  expect(scaleOf(figure)).toBeCloseTo(openedScale, 4);
  expect(
    Math.abs(Number(handle.getAttribute("aria-valuenow")) - resized),
  ).toBeLessThanOrEqual(1);
  // 実行・検証: 0 で、変えた高さで全体が収まる倍率に戻す
  const viewport = viewportOf(figure);
  viewport.focus();
  await userEvent.keyboard("0");
  const fit = Math.min(
    viewport.clientWidth / 500,
    viewport.clientHeight / 1600,
    1,
  );
  expect(scaleOf(figure)).toBeCloseTo(fit, 2);
  expect(1600 * scaleOf(figure)).toBeLessThanOrEqual(viewport.clientHeight + 1);
  // 実行・検証: ↑ で 32px 低く、↓ で 32px 高く
  handle.focus();
  await userEvent.keyboard("{ArrowUp}");
  expect(Math.abs(viewportHeight(figure) - (resized - 32))).toBeLessThanOrEqual(
    1,
  );
  await userEvent.keyboard("{ArrowDown}");
  const kept = viewportHeight(figure);
  expect(Math.abs(kept - resized)).toBeLessThanOrEqual(1);
  expect(viewport.clientHeight).toBeLessThanOrEqual(1600 * scaleOf(figure) + 2);
  // 実行・検証: もう一度 mount すると、変えた高さで描く
  first.destroy();
  const second = await mountTracked(el, { markdown });
  figure = diagramFiguresOf(el)[0] as HTMLElement;
  handle = find<HTMLElement>(figure, ".mdmark-diagram-resize");
  expect(Math.abs(viewportHeight(figure) - kept)).toBeLessThanOrEqual(1);
  // 実行・検証: ダブルクリックで、倍率を変えずに今の倍率の図の全体が収まる高さにし、もう一度 mount しても同じ
  const scale = scaleOf(figure);
  await userEvent.dblClick(handle);
  expect(scaleOf(figure)).toBeCloseTo(scale, 4);
  expect(
    Math.abs(viewportOf(figure).clientHeight - 1600 * scale),
  ).toBeLessThanOrEqual(1);
  const fitted = viewportHeight(figure);
  second.destroy();
  await mountTracked(el, { markdown });
  figure = diagramFiguresOf(el)[0] as HTMLElement;
  expect(Math.abs(viewportHeight(figure) - fitted)).toBeLessThanOrEqual(1);
  // 実行・検証: 全画面のモーダルの中にリサイズハンドルが無い
  buttonOf(figure, "全画面で開く").click();
  const dialog = find<HTMLDialogElement>(el, "dialog");
  expect(dialog.open).toBe(true);
  expect(dialog.querySelector(".mdmark-diagram-resize")).toBeNull();
  await userEvent.keyboard("{Escape}");
  sessionStorage.clear();
});

// diagram-resize がオフの文書と設定では、図にリサイズハンドルを配置しない（正常系（図のリサイズハンドルの機能を解除する））
test("test_normal_when_diagram_resize_disabled", async () => {
  // 準備
  const flow = wrapDirective("flow", INQUIRY_TEXT);
  const el = createElement();
  const el2 = createElement();
  const el3 = createElement();
  // 実行
  await mountTracked(el, {
    markdown: `<!-- features: {"diagram-resize": false} -->\n\n${flow}`,
  });
  await mountTracked(el2, { markdown: flow });
  await mountTracked(el3, {
    markdown: flow,
    config: { features: { "diagram-resize": false } },
  });
  // 検証
  expect(
    el.querySelector('[role="separator"].mdmark-diagram-resize'),
  ).toBeNull();
  expect(el.querySelector('button[aria-label="拡大"]')).not.toBeNull();
  expect(el.textContent).not.toContain("features:");
  expect(
    el2.querySelector('[role="separator"].mdmark-diagram-resize'),
  ).not.toBeNull();
  expect(el3.querySelector(".mdmark-diagram-resize")).toBeNull();
});

/** 列名と 3 行の表を、`<!-- table: {"kind": "data"} -->` で囲んだ Markdown にする */
function dataTableMarkdown(columns: string[]): string {
  const rows = [1, 2, 3].map(
    (row) => `| ${columns.map((_, i) => `値 ${row}-${i + 1}`).join(" | ")} |`,
  );
  return [
    '<!-- table: {"kind": "data"} -->',
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 見本を結んだ階層の表と、見出し `設定の見本` の下の `最小`・`エイリアス` のタブを持つ文書 */
const TREE_EXAMPLE_MARKDOWN = [
  treeMarkdown({ tree: ', "example": {"heading": "設定の見本"}' }),
  "## 設定の見本",
  "",
  "<!-- tabs -->",
  "",
  "### 最小",
  "",
  "```yaml",
  "features:",
  "  table: true",
  "```",
  "",
  "### エイリアス",
  "",
  "```yaml",
  "aliases:",
  "  - id: terms",
  "    metadata:",
  "      alias_type:",
  "        type: custom",
  "```",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

/** パスの階層の行（無ければ失敗する） */
function treeRow(el: Element, path: string): HTMLTableRowElement {
  const row = [
    ...el.querySelectorAll<HTMLTableRowElement>("tr.mdmark-tree-row"),
  ].find((candidate) => candidate.dataset.path === path);
  if (!row) {
    throw new Error(`行が無い: ${path}`);
  }
  return row;
}

/** 表示している階層の行のパスを、並んだ順に返却する */
function shownTreePaths(el: Element): string[] {
  return [...el.querySelectorAll<HTMLTableRowElement>("tr.mdmark-tree-row")]
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.path ?? "");
}

/** パスの行の開閉のボタン */
function treeToggle(el: Element, path: string): HTMLButtonElement {
  return find<HTMLButtonElement>(
    treeRow(el, path),
    "button.mdmark-tree-toggle",
  );
}

// 階層の表のキーに全体のパスのツールチップとコピーのボタンを付ける（正常系）
test("test_normal_when_tree", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: treeMarkdown() });
  const row = treeRow(el, "aliases[].metadata.alias_type.type");
  // 実行・検証: type のキーにフォーカスする
  find<HTMLElement>(row, ".mdmark-tree-name").focus();
  const tip = find<HTMLElement>(row, '[role="tooltip"]');
  expect(tip.hidden).toBe(false);
  expect(tip.textContent).toBe("aliases[].metadata.alias_type.type");
  // 実行・検証: コピーのボタンを押す
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const copy = find<HTMLButtonElement>(row, "button.mdmark-tree-copy");
  copy.click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(
      "aliases[].metadata.alias_type.type",
    );
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(copy.textContent).toContain("コピーしました");
  await vi.advanceTimersByTimeAsync(2000);
  expect(copy.textContent).not.toContain("コピーしました");
  // 検証: 親の行だけに開閉のボタンがある
  const toggles = [
    ...el.querySelectorAll<HTMLButtonElement>("button.mdmark-tree-toggle"),
  ];
  expect(toggles.map((button) => button.closest("tr")?.dataset.path)).toEqual([
    "features",
    "aliases[]",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
  ]);
  for (const button of toggles) {
    expect(button.getAttribute("aria-expanded")).toBe("true");
  }
  expect(el.querySelector("thead button.mdmark-sort")).toBeNull();
});

// 開閉のボタンで子孫を畳み、Shift で入れ子をまとめて開閉する（正常系）
test("test_normal_when_tree_folded", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, {
    markdown: treeMarkdown({ top: ', "features": {"copy": {}}' }),
  });
  const descendants = [
    "aliases[].id",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ];
  // 実行・検証: aliases[] を畳む
  treeToggle(el, "aliases[]").click();
  for (const path of descendants) {
    expect(treeRow(el, path).hidden).toBe(true);
  }
  expect(treeToggle(el, "aliases[]").getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(treeToggle(el, "aliases[]").getAttribute("aria-label")).toBe(
    "aliases[] を開く",
  );
  // 実行・検証: もう一度押して開く
  treeToggle(el, "aliases[]").click();
  expect(shownTreePaths(el)).toContain("aliases[].metadata.alias_type.type");
  // 実行・検証: Shift を押しながら畳み、開く
  treeToggle(el, "aliases[]").dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true }),
  );
  expect(
    treeToggle(el, "aliases[].metadata").getAttribute("aria-expanded"),
  ).toBe("false");
  expect(
    treeToggle(el, "aliases[].metadata.alias_type").getAttribute(
      "aria-expanded",
    ),
  ).toBe("false");
  treeToggle(el, "aliases[]").dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true }),
  );
  expect(shownTreePaths(el)).toHaveLength(8);
  // 実行・検証: Enter・Space で開閉する
  treeToggle(el, "aliases[]").focus();
  await userEvent.keyboard("{Enter}");
  expect(treeRow(el, "aliases[].id").hidden).toBe(true);
  await userEvent.keyboard(" ");
  expect(treeRow(el, "aliases[].id").hidden).toBe(false);
  // 実行・検証: 畳んだままコピーする
  treeToggle(el, "aliases[]").click();
  chooseCopyFormat(el, "markdown");
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  expect(writeText.mock.calls[0]?.[0]).toContain("aliases[].id");
});

// 末尾の名前で照合し、該当した行の祖先を残す（正常系）
test("test_normal_when_tree_filtered", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: treeMarkdown({
      top: ', "features": {"count": {}}, "columns": {"キー": {"filter": {"type": "text"}}}',
    }),
  });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const count = find<HTMLElement>(el, ".mdmark-table-count");
  treeToggle(el, "features").click();
  // 実行・検証: id で絞り込む
  inputFilterText(table, "id");
  expect(shownTreePaths(el)).toEqual(["aliases[]", "aliases[].id"]);
  expect(
    find(treeRow(el, "aliases[].id"), "mark.mdmark-tree-hit").textContent,
  ).toBe("id");
  expect(count.textContent).toContain("1 / 4 件");
  // 実行・検証: metadata に変える
  inputFilterText(table, "metadata");
  expect(shownTreePaths(el)).toEqual(["aliases[]", "aliases[].metadata"]);
  expect(count.textContent).toContain("0 / 4 件");
  // 実行・検証: 絞り込みを解く
  inputFilterText(table, "");
  expect(treeRow(el, "features.table").hidden).toBe(true);
  expect(treeToggle(el, "features").getAttribute("aria-expanded")).toBe(
    "false",
  );
});

// 行を押すと同じ親の範囲の縦線を濃くし、もう一度押すと解く（正常系）
test("test_normal_when_tree_row_selected", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const el = createElement();
  await mountTracked(el, { markdown: treeMarkdown() });
  const activeRows = () =>
    [...el.querySelectorAll("tr.mdmark-tree-row")]
      .filter(
        (row) =>
          row
            .querySelector(".mdmark-tree-guide")
            ?.classList.contains("is-active") === true,
      )
      .map((row) => (row as HTMLElement).dataset.path);
  // 実行・検証: features.html の行を押す
  const row = treeRow(el, "features.html");
  find<HTMLElement>(row, "td:last-child").click();
  expect(row.getAttribute("aria-selected")).toBe("true");
  expect(activeRows()).toEqual(["features.table", "features.html"]);
  expect(el.querySelectorAll(".mdmark-tree-guide.is-active")).toHaveLength(2);
  // 実行・検証: コピー・開閉のボタンを押しても選択が変わらない
  find<HTMLButtonElement>(row, "button.mdmark-tree-copy").click();
  treeToggle(el, "aliases[]").click();
  expect(row.getAttribute("aria-selected")).toBe("true");
  // 実行・検証: もう一度押す
  find<HTMLElement>(row, "td:last-child").click();
  expect(row.getAttribute("aria-selected")).toBe("false");
  expect(el.querySelectorAll(".mdmark-tree-guide.is-active")).toHaveLength(0);
});

/** 見本の中の、表示しているタブのパスの行 */
function shownExampleLine(el: Element, path: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(
    `.mdmark-tree-example [role="tabpanel"]:not([hidden]) .mdmark-yaml-line[data-path="${path}"]`,
  );
}

// 表の行と見本の行を互いに強調し、見本の表示を切り替える（正常系）
test("test_normal_when_tree_linked_to_example", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: TREE_EXAMPLE_MARKDOWN });
  const toggle = find<HTMLButtonElement>(
    el,
    "button.mdmark-tree-example-toggle",
  );
  const example = find<HTMLElement>(el, "aside.mdmark-tree-example");
  // 検証: 描いた直後
  expect(isShown(example)).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(toggle.textContent?.trim()).toBe("見本を隠す");
  // 実行・検証: features.table の行を押す
  find<HTMLElement>(treeRow(el, "features.table"), "td:last-child").click();
  expect(
    shownExampleLine(el, "features.table")?.classList.contains("is-linked"),
  ).toBe(true);
  // 実行・検証: エイリアスのタブに切り替える
  tabNamed(el, 0, "エイリアス").click();
  await vi.waitFor(() => {
    expect(el.querySelectorAll(".mdmark-tree-example .is-linked")).toHaveLength(
      0,
    );
  });
  // 実行・検証: 見本の id の行を押す
  const idLine = shownExampleLine(el, "aliases[].id");
  if (!idLine) {
    throw new Error("見本の id の行が無い");
  }
  idLine.click();
  expect(treeRow(el, "aliases[].id").getAttribute("aria-selected")).toBe(
    "true",
  );
  // 実行・検証: 見本を隠す
  toggle.click();
  expect(isShown(example)).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.textContent?.trim()).toBe("見本を表示");
});

// 印刷の前に畳んだ階層の行と隠した見本を開き、印刷の後に戻す（正常系）
test("test_normal_when_printed_tree", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: TREE_EXAMPLE_MARKDOWN });
  const example = find<HTMLElement>(el, "aside.mdmark-tree-example");
  treeToggle(el, "aliases[]").click();
  find<HTMLButtonElement>(el, "button.mdmark-tree-example-toggle").click();
  // 実行・検証: 印刷の前
  sendPrintEvent("beforeprint");
  expect(shownTreePaths(el)).toHaveLength(8);
  expect(isShown(example)).toBe(true);
  // 実行・検証: 印刷の後
  sendPrintEvent("afterprint");
  expect(treeRow(el, "aliases[].id").hidden).toBe(true);
  expect(treeRow(el, "aliases[].metadata.alias_type.type").hidden).toBe(true);
  expect(isShown(example)).toBe(false);
});

/** 範囲の `ts` が根の要素を押すたびに class `is-open` を付与・解除し、`destroy` で `window.__mdmarkDestroyed` を 1 増やす範囲の文書。範囲の外に同じ class のノードを持つ範囲を続ける */
const RANGE_SCRIPT_MARKDOWN = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "<script>window.__mdmarkScriptRan = true</script>",
  "```",
  "",
  "```css",
  ".box { background-color: rgb(255, 0, 0); }",
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): (() => void) => {",
  '  const box = root.querySelector<HTMLElement>(".box");',
  "  const onClick = (): void => {",
  '    root.classList.toggle("is-open");',
  "  };",
  '  box?.addEventListener("click", onClick);',
  "  return () => {",
  '    box?.removeEventListener("click", onClick);',
  "    const w = window as unknown as { __mdmarkDestroyed?: number };",
  "    w.__mdmarkDestroyed = (w.__mdmarkDestroyed ?? 0) + 1;",
  "  };",
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">外のノード</div>',
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** 範囲のスクリプトの記録を `window` から削除する */
function clearRangeMarks(): void {
  for (const key of [
    "__mdmarkDestroyed",
    "__mdmarkScriptRan",
    "__mdmarkCalls",
  ]) {
    Reflect.deleteProperty(window, key);
  }
}

/** 範囲の根の要素の `index` 番目のノード */
function rangeBox(el: Element, index: number): HTMLElement {
  const box = el.querySelectorAll<HTMLElement>("div.mdmark-html .box")[index];
  if (!box) {
    throw new Error(`範囲のノードが無い: ${index}`);
  }
  return box;
}

/** 変換のライブラリ（約 2.3MB）を読み込んで範囲のスクリプトを動かすまでの待ちの上限。負荷の無いときは 200ms 以内、ほかのテストと重なると 1 秒を超える。テストの上限（5 秒）から待ちの後の処理の分を残す */
const BABEL_WAIT_MS = 4000;

/** `html-scripts` をオンにし、変換のライブラリをテストごとに別の URL で読み込む設定 */
function rangeScriptConfig(name: string) {
  return {
    features: { "html-scripts": true },
    "html-scripts": { url: `/fixtures/babel.mjs?${name}` },
  };
}

// html-scripts がオンのとき、範囲の ts を変換して根の要素で呼び、再描画する前に destroy を呼ぶ（正常系）
test("test_normal_when_range_scripts", async () => {
  // 準備
  clearRangeMarks();
  const el = createElement();
  const handle = await mountTracked(el, {
    markdown: RANGE_SCRIPT_MARKDOWN,
    config: rangeScriptConfig("normal"),
  });
  const scope = find<HTMLElement>(el, "div.mdmark-html");
  await vi.waitFor(
    () => {
      expect(countRequests("/fixtures/babel.mjs?normal")).toBe(1);
      rangeBox(el, 0).click();
      expect(scope.classList.contains("is-open")).toBe(true);
    },
    { timeout: BABEL_WAIT_MS },
  );
  // 検証
  expect(getComputedStyle(rangeBox(el, 0)).backgroundColor).toBe(
    "rgb(255, 0, 0)",
  );
  expect(getComputedStyle(rangeBox(el, 1)).backgroundColor).not.toBe(
    "rgb(255, 0, 0)",
  );
  rangeBox(el, 0).click();
  expect(scope.classList.contains("is-open")).toBe(false);
  expect(Reflect.get(window, "__mdmarkScriptRan")).not.toBe(true);
  expect(countRequests("/fixtures/babel.mjs?normal")).toBe(1);
  expect(
    [...document.head.querySelectorAll("script")].some((script) =>
      script.textContent?.includes("__mdmarkHtmlScript"),
    ),
  ).toBe(false);
  // 実行・検証: 再描画する
  handle.update(RANGE_SCRIPT_MARKDOWN);
  expect(Reflect.get(window, "__mdmarkDestroyed")).toBe(1);
  clearRangeMarks();
});

// html-scripts がオフのとき、範囲のスクリプトを動かさず、変換のライブラリを読み込まない（正常系）
test("test_normal_when_range_scripts_off", async () => {
  // 準備
  clearRangeMarks();
  const el = createElement();
  await mountTracked(el, {
    markdown: RANGE_SCRIPT_MARKDOWN,
    config: { "html-scripts": { url: "/fixtures/babel.mjs?off" } },
  });
  // 機能がオフの範囲は記載した人の class を残さないため、ノードは範囲の中の要素で参照する
  const box = find<HTMLElement>(el, "div.mdmark-html > div");
  // 実行
  box.click();
  await nextFrames();
  // 検証
  expect(box.classList.contains("box")).toBe(false);
  expect(getComputedStyle(box).backgroundColor).not.toBe("rgb(255, 0, 0)");
  expect(find(el, "div.mdmark-html").classList.contains("is-open")).toBe(false);
  expect(el.querySelector("pre code.language-css")).not.toBeNull();
  expect(el.querySelector("pre code.language-ts")).not.toBeNull();
  expect(countRequests("/fixtures/babel.mjs?off")).toBe(0);
});

// 設定でオフの html-scripts を、文書のマーカーでその文書だけオンにする（正常系）
test("test_normal_when_range_scripts_enabled_by_mark", async () => {
  // 準備
  clearRangeMarks();
  const el = createElement();
  const markdown = [
    '<!-- features: {"html-scripts": true} -->',
    "",
    "<!-- html -->",
    "",
    "```html",
    '<div class="box">ノード</div>',
    "```",
    "",
    "```css",
    ".box { background-color: rgb(255, 0, 0); }",
    "```",
    "",
    "```js",
    "export default (root) => {",
    "  const w = window;",
    "  w.__mdmarkCalls = [...(w.__mdmarkCalls ?? []), root];",
    "};",
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, {
    markdown,
    config: {
      features: { "html-scripts": false },
      "html-scripts": { url: "/fixtures/babel.mjs?mark" },
    },
  });
  // 検証
  const scope = find<HTMLElement>(el, "div.mdmark-html");
  await vi.waitFor(() => {
    expect(Reflect.get(window, "__mdmarkCalls")).toEqual([scope]);
  });
  expect(getComputedStyle(rangeBox(el, 0)).backgroundColor).toBe(
    "rgb(255, 0, 0)",
  );
  expect(el.textContent).not.toContain("features:");
  clearRangeMarks();
});

/** 範囲に `html` と、言語 `lang` のコードブロックを配置した Markdown */
function scriptRange(lang: "ts" | "js", code: string, css = ""): string {
  return [
    "<!-- html -->",
    "",
    "```html",
    '<div class="box">ノード</div>',
    "```",
    "",
    ...(css === "" ? [] : ["```css", css, "```", ""]),
    `\`\`\`${lang}`,
    code,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
}

// 既定のエクスポートが関数でない範囲と例外を投げる範囲と構文エラーの範囲の前に記載の警告を配置し、ほかは描く（異常系）
test("test_error_when_range_script_invalid", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const error = new Error("範囲の失敗");
  Reflect.set(window, "__mdmarkRangeError", error);
  const markdown = [
    scriptRange("ts", "export default 1 as number;"),
    scriptRange(
      "js",
      "export default () => { throw window.__mdmarkRangeError; };",
    ),
    scriptRange("js", "export default (root) => {"),
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, { markdown, config: rangeScriptConfig("invalid") });
  // 検証
  const scopes = [...el.querySelectorAll<HTMLElement>("div.mdmark-html")];
  await vi.waitFor(() => {
    expect(el.querySelectorAll(".mdmark-syntax-warning")).toHaveLength(3);
  });
  const warningOf = (scope: HTMLElement | undefined) =>
    scope?.previousElementSibling?.classList.contains("mdmark-syntax-warning")
      ? (scope.previousElementSibling.textContent ?? "")
      : "";
  expect(warningOf(scopes[0])).toContain("export default");
  expect(warningOf(scopes[1])).toContain("例外を投げた");
  expect(warningOf(scopes[2])).toContain("構文エラー");
  for (const scope of scopes) {
    expect(scope.querySelector(".box")?.textContent).toBe("ノード");
  }
  expect(paragraphTexts(el)).toContain("後ろの段落");
  expect(
    spy.mock.calls.some(
      (call) =>
        String(call[0]).includes("範囲のスクリプト 1") && call[1] === error,
    ),
  ).toBe(true);
  Reflect.deleteProperty(window, "__mdmarkRangeError");
});

// 変換のライブラリを読み込めないとき、ts・js の範囲に通知ブロックを配置し、範囲の html・css と本文は描く（異常系）
test("test_error_when_transpiler_unavailable", async () => {
  // 準備
  clearRangeMarks();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createElement();
  const markdown = [
    scriptRange(
      "ts",
      'export default (root: HTMLElement) => { root.dataset.ran = "1"; };',
      ".box { background-color: rgb(255, 0, 0); }",
    ),
    scriptRange("js", 'export default (root) => { root.dataset.ran = "1"; };'),
    "後ろの段落",
    "",
  ].join("\n");
  // 実行
  await mountTracked(el, {
    markdown,
    config: {
      features: { "html-scripts": true },
      "html-scripts": { url: MISSING_LIB_PATH },
    },
  });
  // 検証
  const scopes = [...el.querySelectorAll<HTMLElement>("div.mdmark-html")];
  await vi.waitFor(() => {
    expect(el.querySelectorAll(".mdmark-notice")).toHaveLength(2);
  });
  for (const scope of scopes) {
    expect(
      scope.previousElementSibling?.classList.contains("mdmark-notice"),
    ).toBe(true);
    expect(scope.dataset.ran).toBeUndefined();
    expect(scope.querySelector(".box")?.textContent).toBe("ノード");
  }
  expect(el.querySelectorAll('.mdmark-notice[role="status"]')).toHaveLength(2);
  expect(getComputedStyle(rangeBox(el, 0)).backgroundColor).toBe(
    "rgb(255, 0, 0)",
  );
  expect(paragraphTexts(el)).toContain("後ろの段落");
  expect(
    spy.mock.calls.some((call) => String(call[0]).includes(MISSING_LIB_PATH)),
  ).toBe(true);
});

/** 要素の見えている文字（スクリーンリーダー向けの文字を除く）の行の数（行の矩形の上端の数） */
function textLineCount(element: Element): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const tops = new Set<number>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      !node.textContent?.trim() ||
      node.parentElement?.closest(".mdmark-visually-hidden")
    ) {
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      tops.add(Math.round(rect.top));
    }
  }
  return tops.size;
}

/** h2 を 3 つと段落を持つ本文（page のマーカーの後ろに続ける） */
const PAGE_BODY = [
  "## 概要",
  "",
  "段落",
  "",
  "## 使用方法",
  "",
  "段落",
  "",
  "## 補足",
  "",
  "段落",
  "",
].join("\n");

// 文書の先頭の page のマーカーの明暗・テーマ・右側の目次の出し方を、設定より優先して適用する（正常系（ページの設定のマーカー））
test("test_normal_when_page_marker", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    await emulateColorScheme("dark");
    try {
      // 実行
      await mountTracked(el, {
        markdown: `<!-- page: {"scheme": "light", "theme": "theme-slate", "toc": {"mode": "fixed"}} -->\n\n${PAGE_BODY}`,
        config: {
          colorScheme: "dark",
          colorTheme: "theme-paper",
          "side-toc": { mode: "hover" },
        },
      });
      // 検証
      expect(el.classList.contains("mdmark-theme-light")).toBe(true);
      expect(el.classList.contains("mdmark-theme-dark")).toBe(false);
      expect(readBackground(el)).toBe(SLATE_LIGHT_BG);
      expect(el.getAttribute("data-mdmark-color-theme")).toBe("theme-slate");
      const { aside, toggle } = sideTocOf(el);
      expect(aside.getAttribute("data-mode")).toBe("fixed");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(el.textContent).not.toContain("page:");
      expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
    } finally {
      await resetThemed();
    }
  });
});

// 設定の明暗を、祖先の class と OS の配色より優先して当て、destroy で削除する（正常系（設定の明暗））
test("test_normal_when_config_color_scheme", async () => {
  // 準備
  const el = createElement();
  document.body.className = "mdmark-theme-light";
  await emulateColorScheme("light");
  try {
    // 実行
    const handle = await mountTracked(el, {
      markdown: THEME_MARKDOWN,
      config: { colorScheme: "dark" },
    });
    // 検証
    expect(el.classList.contains("mdmark-theme-dark")).toBe(true);
    expect(readBackground(el)).toBe(DARK_BG);
    // 実行: destroy で明暗の class を削除する
    handle.destroy();
    // 検証
    expect(el.classList.contains("mdmark-theme-dark")).toBe(false);
    expect(el.classList.contains("mdmark-theme-light")).toBe(false);
  } finally {
    await resetThemed();
  }
});

// マーカーの scheme=auto は設定の明暗だけを解除して祖先の class に任せ、update でもう一度決める（正常系（明暗を OS の設定に戻す））
test("test_normal_when_color_scheme_auto", async () => {
  // 準備
  const el = createElement();
  document.body.className = "mdmark-theme-dark";
  await emulateColorScheme("light");
  try {
    // 実行
    const handle = await mountTracked(el, {
      markdown: `<!-- page: {"scheme": "auto"} -->\n\n${THEME_MARKDOWN}`,
      config: { colorScheme: "light" },
    });
    // 検証
    expect(el.classList.contains("mdmark-theme-light")).toBe(false);
    expect(el.classList.contains("mdmark-theme-dark")).toBe(false);
    expect(readBackground(el)).toBe(DARK_BG);
    // 実行: マーカーを持たない文書に差し替える
    handle.update(THEME_MARKDOWN);
    // 検証
    expect(el.classList.contains("mdmark-theme-light")).toBe(true);
    expect(readBackground(el)).toBe(LIGHT_BG);
  } finally {
    await resetThemed();
  }
});

/** 知らないキー・値を記載した page のマーカー */
const PAGE_INVALID_MARK =
  '<!-- page: {"scheme": "sepia", "theme": "theme-unknown", "size": "wide", "toc": {"mode": "fixed"}} -->';

// 知らないキー・値と、先頭に無い page のマーカーは記載の警告にして使用しない（正常系（ページの設定のマーカーの記載方法の誤り））
test("test_normal_when_page_marker_invalid", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el1 = createElement();
    const el2 = createElement();
    const { mount } = await loadBuilt();
    await emulateColorScheme("light");
    try {
      // 実行
      expect(() => {
        handles.push(
          mount(el1, {
            markdown: `${PAGE_INVALID_MARK}\n\n${PAGE_BODY}`,
            config: { colorScheme: "dark" },
          }),
        );
        handles.push(
          mount(el2, {
            markdown:
              '最初の段落\n\n<!-- page: {"scheme": "light"} -->\n\n後ろの段落\n',
            config: { colorScheme: "dark" },
          }),
        );
      }).not.toThrow();
      // 検証: el1
      const warnings1 = el1.querySelectorAll(".mdmark-syntax-warning");
      expect(warnings1).toHaveLength(1);
      const text1 = warnings1[0]?.textContent ?? "";
      // 本文の頭はマーカーの文字のため、マーカーの後ろの挙げた指定を確認する
      const listed1 = text1.replace(PAGE_INVALID_MARK, "");
      // 知らないキー size は無視し、警告に挙げない
      expect(listed1).not.toContain("size");
      for (const word of [
        "scheme",
        "sepia",
        "theme",
        "theme-unknown",
        "light",
        "dark",
        "auto",
        "theme-slate",
      ]) {
        expect(listed1).toContain(word);
      }
      const nodes1 = [...el1.querySelectorAll("h2, .mdmark-syntax-warning")];
      expect(nodes1[0]?.classList.contains("mdmark-syntax-warning")).toBe(true);
      expect(el1.classList.contains("mdmark-theme-dark")).toBe(true);
      expect(el1.getAttribute("data-mdmark-color-theme")).toBe("dev-swiss");
      expect(sideTocOf(el1).aside.getAttribute("data-mode")).toBe("fixed");
      // 検証: el2
      const warnings2 = el2.querySelectorAll(".mdmark-syntax-warning");
      expect(warnings2).toHaveLength(1);
      expect(warnings2[0]?.textContent).toContain("先頭");
      const order = [...el2.querySelectorAll("p, .mdmark-syntax-warning")].map(
        (node) =>
          node.classList.contains("mdmark-syntax-warning")
            ? "warning"
            : node.textContent,
      );
      expect(order.indexOf("warning")).toBeGreaterThan(
        order.indexOf("最初の段落"),
      );
      expect(order.indexOf("warning")).toBeLessThan(
        order.indexOf("後ろの段落"),
      );
      expect(el2.classList.contains("mdmark-theme-dark")).toBe(true);
    } finally {
      await resetThemed();
    }
  });
});

/** シナリオ『リンクをカードの格子に並べる』の 4 項目と、リンクの無い 1 項目を囲んだ cards の範囲 */
const CARD_GRID_MARKDOWN = [
  "<!-- cards -->",
  "- `icon:book` [使用方法](使い方/README.md)",
  "  導入と使用方法の手順",
  "- [リファレンス](リファレンス/README.md) 名前から参照する一覧",
  "- https://example.com/docs",
  "- `icon:rocket` [始める](はじめに/README.md)",
  "- `icon:clock` 準備中",
  "  次のバージョンで追加する",
  "<!-- /cards -->",
  "",
].join("\n");

// cards の範囲のリストの項目をカードにして格子に並べる（正常系（カードの格子））
test("test_normal_when_card_grid", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    // 実行
    await mountTracked(el, { markdown: CARD_GRID_MARKDOWN });
    // 検証
    const grids = el.querySelectorAll("ul.mdmark-card-grid");
    expect(grids).toHaveLength(1);
    const grid = grids[0] as HTMLElement;
    const cards = [...grid.querySelectorAll(":scope > li")].map(
      (li) => li.firstElementChild as HTMLElement,
    );
    expect(cards).toHaveLength(5);
    expect(cards.map((card) => card.tagName)).toEqual([
      "A",
      "A",
      "A",
      "A",
      "DIV",
    ]);
    for (const card of cards) {
      expect(card.classList.contains("mdmark-card-grid-item")).toBe(true);
    }
    const first = cards[0] as HTMLAnchorElement;
    expect(decodeURI(first.getAttribute("href") ?? "")).toBe(
      "使い方/README.md",
    );
    expect(find(first, ".mdmark-card-grid-icon").outerHTML).toContain(
      'data-icon="book"',
    );
    expect(find(first, ".mdmark-card-grid-title").textContent).toBe("使用方法");
    expect(find(first, ".mdmark-card-grid-desc").textContent).toBe(
      "導入と使用方法の手順",
    );
    expect(
      find(cards[2] as HTMLElement, ".mdmark-card-grid-title").textContent,
    ).toBe("example.com/docs");
    expect(el.querySelector(".mdmark-card")).toBeNull();
    const columns = getComputedStyle(grid)
      .gridTemplateColumns.split(" ")
      .filter((value) => value !== "");
    expect(columns.length).toBeGreaterThanOrEqual(2);
    expect(
      getComputedStyle(find(first, ".mdmark-card-grid-title"))
        .textDecorationLine,
    ).toBe("underline");
    expect(
      getComputedStyle(find(cards[4] as HTMLElement, ".mdmark-card-grid-title"))
        .textDecorationLine,
    ).toBe("none");
    expect(el.textContent).not.toContain("cards");
    expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  });
});

// card-grid がオフの文書は、囲んだリストをリストのまま描く（正常系（カードの格子の機能を解除する））
test("test_normal_when_card_grid_disabled", async () => {
  // 準備
  const el = createElement();
  // 実行
  await mountTracked(el, {
    markdown: `<!-- features: {"card-grid": false} -->\n\n${CARD_GRID_MARKDOWN}`,
  });
  // 検証
  expect(el.querySelector(".mdmark-card-grid")).toBeNull();
  const lists = el.querySelectorAll("ul");
  const list = [...lists].find(
    (ul) => ul.querySelectorAll(":scope > li").length === 5,
  );
  expect(list).toBeDefined();
  const third = list?.querySelectorAll(":scope > li")[2] as HTMLElement;
  expect(third.querySelector("a.mdmark-card")).not.toBeNull();
  expect(el.textContent).not.toContain("cards");
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
});

// cards の範囲の中身がリスト 1 つでないときは、記載の警告を配置して中身を記載したとおりに描く（正常系（カードの格子にリスト以外の中身））
test("test_normal_when_card_grid_not_list", async () => {
  // 準備
  const el = createElement();
  const { mount } = await loadBuilt();
  const markdown = [
    "<!-- cards -->",
    "",
    "囲んだ段落",
    "",
    "- [使用方法](a.md)",
    "- [参照](b.md)",
    "<!-- /cards -->",
    "",
  ].join("\n");
  // 実行
  expect(() => {
    handles.push(mount(el, { markdown }));
  }).not.toThrow();
  // 検証
  const warning = find(el, ".mdmark-syntax-warning");
  expect(warning.textContent).toContain("<!-- cards -->");
  expect(warning.textContent).toContain("リスト 1 つ");
  expect(el.querySelector(".mdmark-card-grid")).toBeNull();
  expect(paragraphTexts(el)).toContain("囲んだ段落");
  expect(el.querySelectorAll("ul > li")).toHaveLength(2);
  const position = (node: Element) =>
    [...el.querySelectorAll("*")].indexOf(node);
  expect(position(warning)).toBeLessThan(
    position(
      [...el.querySelectorAll("p")].find(
        (p) => p.textContent === "囲んだ段落",
      ) as Element,
    ),
  );
});

// 正常系（ブロックの間隔）で並べるブロック。同じ種類のリストが 1 つにつながらないよう、後に配置するときの記載方法を分ける
const SPACING_BLOCKS: { name: string; before: string; after?: string }[] = [
  { name: "段落", before: "段落の文。" },
  { name: "見出し", before: "## 見出し" },
  { name: "表", before: "| 列 |\n| --- |\n| 値 |" },
  { name: "コードブロック", before: "```ts\nconst a = 1;\n```" },
  { name: "ファイルツリー", before: "```tree\napp/\n└── a.ts\n```" },
  { name: "箇条書き", before: "- 項目", after: "* 項目" },
  { name: "番号付きリスト", before: "1. 項目", after: "1) 項目" },
  { name: "引用", before: "> 引用の文" },
  { name: "注意書き", before: "> [!NOTE]\n> 注意の文" },
  { name: "区切り線", before: "---" },
  {
    name: "タブ",
    before:
      "<!-- tabs -->\n\n### タブ A\n\nA の本文\n\n### タブ B\n\nB の本文\n\n<!-- /tabs -->",
  },
  {
    name: "ステップ",
    before: "<!-- steps -->\n\n1. 一つ目\n2. 二つ目\n\n<!-- /steps -->",
  },
  {
    name: "埋め込んだ HTML",
    before:
      "<!-- html -->\n\n```html\n<div>埋め込み</div>\n```\n\n<!-- /html -->",
  },
];
const SPACING_CODE = "```ts\nconst a = 1;\n```";
const SPACING_TREE = "```tree\napp/\n└── a.ts\n```";
// 本文の直下・セクションの中身・タブの中身のブロックの間（`--mdmark-space` の既定）と、リストの項目・引用・details・行の詳細の中の間
const BLOCK_SPACE = 14;
const NESTED_SPACE = 7;

/** 描く先の要素の中のブロックを読み込む順に返却する（セクションの中身は中のブロックに分ける） */
const spacingBlocks = (parent: Element): HTMLElement[] =>
  [...parent.children].flatMap((child) => {
    if (!(child instanceof HTMLElement)) {
      return [];
    }
    if (child.classList.contains("mdmark-section-body")) {
      return spacingBlocks(child);
    }
    return child.hasAttribute("data-source-line") ||
      child.matches(
        ".mdmark-tree, .mdmark-heading, .mdmark-table, .mdmark-html",
      )
      ? [child]
      : [];
  });

/** 前のブロックの下端から後のブロックの上端までの間 */
const gapBetween = (before: Element, after: Element): number =>
  after.getBoundingClientRect().top - before.getBoundingClientRect().bottom;

/** 要素の上か下の余白の計算値（px） */
const marginOf = (element: Element, side: "start" | "end"): number => {
  const style = getComputedStyle(element);
  return Number.parseFloat(
    side === "start" ? style.marginBlockStart : style.marginBlockEnd,
  );
};

/** 入れ物の中で、段落からコードブロック、コードブロックからファイルツリーまでの間が期待値と同じか確認する */
const expectContainerGaps = ({
  container,
  expected,
  label,
}: {
  container: Element;
  expected: number;
  label: string;
}): void => {
  const paragraph = find(container, "p:not(.mdmark-tab-title)");
  const code = find(container, ".mdmark-code");
  const tree = find(container, ".mdmark-tree");
  expect(
    Math.abs(gapBetween(paragraph, code) - expected),
    `${label}の中のコードブロック`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(gapBetween(code, tree) - expected),
    `${label}の中のファイルツリー`,
  ).toBeLessThanOrEqual(1);
};

test("test_normal_when_block_spacing", async () => {
  const config = { features: { "side-toc": false } };
  // 本文の直下: 2 つずつの全ての組み合わせ
  for (const before of SPACING_BLOCKS) {
    for (const after of SPACING_BLOCKS) {
      // 準備
      const el = createElement();
      // 実行（1 行目の `---` と後ろの `---` はフロントマターになるため、空行から始める）
      await mountTracked(el, {
        markdown: `\n${before.before}\n\n${after.after ?? after.before}\n`,
        config,
      });
      // 検証
      const blocks = spacingBlocks(el);
      const pair = `${before.name} → ${after.name}`;
      expect(blocks, pair).toHaveLength(2);
      const [first, second] = blocks as [HTMLElement, HTMLElement];
      const gap = gapBetween(first, second);
      const label = `${pair}: ${gap}px`;
      if (before.name === "区切り線" || after.name === "区切り線") {
        const expected = Math.max(
          marginOf(first, "end"),
          marginOf(second, "start"),
        );
        expect(expected, label).toBeGreaterThan(0);
        expect(Math.abs(gap - expected), label).toBeLessThanOrEqual(1);
      } else if (after.name === "見出し") {
        const expected = marginOf(second, "start");
        expect(expected, label).toBeGreaterThan(0);
        expect(Math.abs(gap - expected), label).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(gap - BLOCK_SPACE), label).toBeLessThanOrEqual(1);
      }
    }
  }

  // 見出しのセクションの中とタブの中
  const sectionEl = createElement();
  await mountTracked(sectionEl, {
    markdown: `## 見出し\n\n段落の文。\n\n${SPACING_CODE}\n\n${SPACING_TREE}\n`,
    config,
  });
  expectContainerGaps({
    container: find(sectionEl, ".mdmark-section-body"),
    expected: BLOCK_SPACE,
    label: "見出しのセクション",
  });
  const tabEl = createElement();
  await mountTracked(tabEl, {
    markdown: `<!-- tabs -->\n\n### タブ A\n\n段落の文。\n\n${SPACING_CODE}\n\n${SPACING_TREE}\n\n### タブ B\n\nB の本文\n\n<!-- /tabs -->\n`,
    config,
  });
  expectContainerGaps({
    container: find(tabEl, ".mdmark-tab-panel"),
    expected: BLOCK_SPACE,
    label: "タブ",
  });

  // 箇条書きの項目・引用・details・行の詳細の中
  const indent = (text: string, prefix: string) =>
    text
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
  const nested = [
    {
      label: "箇条書きの項目",
      markdown: `- 段落の文。\n\n${indent(SPACING_CODE, "  ")}\n\n${indent(SPACING_TREE, "  ")}\n`,
      container: "li",
    },
    {
      label: "引用",
      markdown: `> 段落の文。\n>\n${indent(SPACING_CODE, "> ")}\n>\n${indent(SPACING_TREE, "> ")}\n`,
      container: "blockquote",
    },
    {
      label: "details",
      markdown: `<details open>\n<summary>概要</summary>\n\n段落の文。\n\n${SPACING_CODE}\n\n${SPACING_TREE}\n\n</details>\n`,
      container: "details",
    },
  ];
  for (const { label, markdown, container } of nested) {
    const el = createElement();
    await mountTracked(el, { markdown, config });
    expectContainerGaps({
      container: find(el, container),
      expected: NESTED_SPACE,
      label,
    });
  }
  const detailEl = createElement();
  await mountTracked(detailEl, {
    markdown: `| 名前 | 値 |\n| --- | --- |\n| りんご | 10 |\n\n<!-- row-detail: {"at": 1} -->\n\n段落の文。\n\n${SPACING_CODE}\n\n${SPACING_TREE}\n\n<!-- /row-detail -->\n`,
    config,
  });
  find<HTMLButtonElement>(detailEl, "button.mdmark-row-toggle").click();
  const detail = find<HTMLElement>(detailEl, ".mdmark-row-detail > td");
  await vi.waitFor(() => {
    expect(detail.getBoundingClientRect().height).toBeGreaterThan(0);
  });
  expectContainerGaps({
    container: detail,
    expected: NESTED_SPACE,
    label: "行の詳細",
  });

  // 先頭: 内側の余白の内側の上端と同じ
  for (const [label, markdown] of [
    [
      "タイトルを持つコードブロック",
      `<!-- code: {"title": "a.ts"} -->\n${SPACING_CODE}\n`,
    ],
    ["タイトルを持たないコードブロック", `${SPACING_CODE}\n`],
    ["ファイルツリー", `${SPACING_TREE}\n`],
  ] as const) {
    const el = createElement();
    await mountTracked(el, { markdown, config });
    const first = find<HTMLElement>(el, ".mdmark-code, .mdmark-tree");
    if (label === "タイトルを持つコードブロック") {
      expect(first.tagName).toBe("FIGURE");
    }
    const contentTop =
      el.getBoundingClientRect().top +
      el.clientTop +
      Number.parseFloat(getComputedStyle(el).paddingTop);
    expect(
      Math.abs(first.getBoundingClientRect().top - contentTop),
      `先頭の${label}`,
    ).toBeLessThanOrEqual(1);
  }
});

/** mermaid の図を描き終えるまでの待ちの上限（5MB の mermaid のモジュールを読み込む） */
const MERMAID_WAIT_MS = 60_000;

/** mermaid（`mermaid@12.3.0` の `dist/`）を `name` の名前で配る ES モジュールの URL（`mermaid.url` に指定する） */
function mermaidUrl(name: string): string {
  return `/fixtures/mermaid/${name}/mermaid.esm.min.mjs`;
}

/** front matter の `title` を持つ flowchart と、`actor` を持つ sequenceDiagram の mermaid のコードブロックを持つ文書 */
const MERMAID_MARKDOWN = [
  "```mermaid",
  "---",
  "title: 問い合わせの受付",
  "---",
  "flowchart LR",
  "  A[問い合わせを受ける] --> B{担当がいるか}",
  "  B -->|いる| C[担当へ回す]",
  "```",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  actor U as 読者",
  "  participant M as mdmark",
  "  U->>M: ページを開く",
  "```",
  "",
].join("\n");

/** flowchart の mermaid のコードブロックを 1 つ持つ文書 */
const MERMAID_FLOWCHART = [
  "```mermaid",
  "flowchart LR",
  "  A[受付] --> B[回答]",
  "```",
  "",
].join("\n");

/** 描く先の中で `value` の色を計算済みの色（`rgb(…)`）にする */
function mermaidColor(el: HTMLElement, value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  el.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** 描いた mermaid の図の枠を、文書の順に並べて返却する */
function mermaidFigures(el: Element): HTMLElement[] {
  return [
    ...el.querySelectorAll<HTMLElement>(
      'figure.mdmark-diagram[data-diagram="mermaid"]',
    ),
  ];
}

/** 図の枠の中の、画面に出ている mermaid の SVG を返却する */
function visibleMermaidSvgs(figure: Element): SVGSVGElement[] {
  return [
    ...figure.querySelectorAll<SVGSVGElement>(".mdmark-mermaid svg[id]"),
  ].filter((svg) => svg.checkVisibility());
}

/** SVG の中の flowchart の最初のノードの構造 */
function firstNodeShape(svg: Element): SVGElement {
  const shape = svg.querySelector<SVGElement>(
    "g.node rect.label-container, g.node path.label-container, g.node rect, g.node path",
  );
  if (!shape) {
    throw new Error("flowchart のノードが無い");
  }
  return shape;
}

/** OS の配色をエミュレートする */
async function emulateMermaidMedia(
  scheme: "light" | "dark",
  media = "",
): Promise<void> {
  await cdp().send("Emulation.setEmulatedMedia", {
    media,
    features: [{ name: "prefers-color-scheme", value: scheme }],
  });
}

// mermaid のコードブロックがあるときだけ mermaid を読み込み、描く先の要素の CSS 変数から作ったテーマで図にして図の枠に入れる（正常系）
test(
  "test_normal_when_mermaid_drawn",
  async () => {
    // 準備
    const el = createElement();
    const name = "drawn";
    // 実行
    await mountTracked(el, {
      markdown: MERMAID_MARKDOWN,
      config: { mermaid: { url: mermaidUrl(name) } },
    });
    // 検証: import() が終わる前
    expect(
      el.querySelectorAll('div.mdmark-embed[data-mdmark-slot="mermaid"]'),
    ).toHaveLength(2);
    for (const block of el.querySelectorAll<HTMLElement>("div.mdmark-code")) {
      expect(block.hidden).toBe(true);
    }
    // 検証: 描いた後
    await vi.waitFor(() => expect(mermaidFigures(el)).toHaveLength(2), {
      timeout: MERMAID_WAIT_MS,
    });
    expect(countRequests(mermaidUrl(name))).toBe(1);
    expect(el.querySelector("div.mdmark-code")).toBeNull();
    expect(el.querySelector(".mdmark-embed")).toBeNull();
    const [flowchart, sequence] = mermaidFigures(el);
    expect(flowchart?.querySelector("figcaption")?.textContent?.trim()).toBe(
      "問い合わせの受付",
    );
    expect(sequence?.querySelector("figcaption")?.textContent?.trim()).toBe(
      "シーケンス図",
    );
    const svg = visibleMermaidSvgs(flowchart as HTMLElement)[0];
    const shape = firstNodeShape(svg as SVGSVGElement);
    const style = getComputedStyle(shape);
    expect(style.fill).toBe(mermaidColor(el, "var(--mdmark-color-surface)"));
    expect(style.stroke).toBe(mermaidColor(el, "var(--mdmark-color-border)"));
    expect(style.stroke.startsWith("url(")).toBe(false);
    const label = (svg as SVGSVGElement).querySelector(".nodeLabel, text");
    expect(label && getComputedStyle(label).color).toBe(
      mermaidColor(el, "var(--mdmark-color-text)"),
    );
    expect(sequence?.querySelector("svg.mdmark-mermaid-actor")).not.toBeNull();
    for (const figure of mermaidFigures(el)) {
      expect(figure.querySelector('button[aria-label="拡大"]')).not.toBeNull();
      expect(figure.querySelector('button[aria-label="縮小"]')).not.toBeNull();
      expect(
        figure.querySelector('button[aria-label="全画面で開く"]'),
      ).not.toBeNull();
      expect(figure.querySelector(".mdmark-diagram-resize")).not.toBeNull();
    }
  },
  MERMAID_WAIT_MS + 30_000,
);

// 描く先の配色の明暗が変わったら、変わった後の CSS 変数で mermaid の図を再描画する（正常系）
test(
  "test_normal_when_mermaid_scheme_changed",
  async () => {
    // 準備
    await loadStylesheet();
    await emulateMermaidMedia("light");
    const el = createElement();
    const name = "scheme";
    try {
      await mountTracked(el, {
        markdown: MERMAID_FLOWCHART,
        config: { mermaid: { url: mermaidUrl(name) } },
      });
      await vi.waitFor(() => expect(mermaidFigures(el)).toHaveLength(1), {
        timeout: MERMAID_WAIT_MS,
      });
      // 実行
      await emulateMermaidMedia("dark");
      // 検証
      await vi.waitFor(
        () => {
          const figure = mermaidFigures(el)[0] as HTMLElement;
          const svg = visibleMermaidSvgs(figure)[0] as SVGSVGElement;
          expect(getComputedStyle(firstNodeShape(svg)).fill).toBe(
            mermaidColor(el, "var(--mdmark-color-surface)"),
          );
          expect(mermaidColor(el, "var(--mdmark-color-bg)")).toBe(
            mermaidColor(el, DARK_BG),
          );
        },
        { timeout: MERMAID_WAIT_MS },
      );
      expect(countRequests(mermaidUrl(name))).toBe(1);
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", {
        media: "",
        features: [],
      });
    }
  },
  MERMAID_WAIT_MS * 2,
);

// ダークで開いた文書では明るい配色の SVG も先に描いて並べ、印刷のメディアでは明るい配色の SVG だけを出す（正常系）
test(
  "test_normal_when_mermaid_printed",
  async () => {
    // 準備
    await loadStylesheet();
    await emulateMermaidMedia("dark");
    const el = createElement();
    try {
      // 実行
      await mountTracked(el, {
        markdown: MERMAID_FLOWCHART,
        config: { mermaid: { url: mermaidUrl("printed") } },
      });
      await vi.waitFor(() => expect(mermaidFigures(el)).toHaveLength(1), {
        timeout: MERMAID_WAIT_MS,
      });
      const figure = mermaidFigures(el)[0] as HTMLElement;
      // 検証: 画面のメディア
      const screen = visibleMermaidSvgs(figure);
      expect(screen).toHaveLength(1);
      expect(
        getComputedStyle(firstNodeShape(screen[0] as SVGSVGElement)).fill,
      ).toBe(mermaidColor(el, "var(--mdmark-color-surface)"));
      expect(figure.querySelectorAll(".mdmark-mermaid svg[id]")).toHaveLength(
        2,
      );
      // 検証: 印刷のメディア
      await emulateMermaidMedia("dark", "print");
      await vi.waitFor(() => {
        const printed = visibleMermaidSvgs(figure);
        expect(printed).toHaveLength(1);
        expect(printed[0]?.closest(".mdmark-mermaid-print")).not.toBeNull();
        expect(
          getComputedStyle(firstNodeShape(printed[0] as SVGSVGElement)).fill,
        ).toBe(mermaidColor(el, LIGHT_SURFACE));
      });
      // 検証: OS の配色がライトの文書では SVG が 1 つ
      await emulateMermaidMedia("light");
      const light = createElement();
      await mountTracked(light, {
        markdown: MERMAID_FLOWCHART,
        config: { mermaid: { url: mermaidUrl("printed-light") } },
      });
      await vi.waitFor(() => expect(mermaidFigures(light)).toHaveLength(1), {
        timeout: MERMAID_WAIT_MS,
      });
      expect(
        mermaidFigures(light)[0]?.querySelectorAll(".mdmark-mermaid svg[id]"),
      ).toHaveLength(1);
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", {
        media: "",
        features: [],
      });
    }
  },
  MERMAID_WAIT_MS * 3,
);

// 設定で mermaid のテーマの名前を選び、変数を上書きする。useGradient・dropShadow は上書きできず、知らないテーマの名前は mdmark にする（正常系）
test(
  "test_normal_when_mermaid_theme_configured",
  async () => {
    // 準備
    const neutral = createElement();
    const unknown = createElement();
    // 実行
    await mountTracked(neutral, {
      markdown: MERMAID_FLOWCHART,
      config: {
        mermaid: {
          url: mermaidUrl("theme"),
          theme: "neutral",
          themeVariables: { mainBkg: "#e0f2f1", useGradient: "true" },
        },
      },
    });
    await mountTracked(unknown, {
      markdown: MERMAID_FLOWCHART,
      config: { mermaid: { url: mermaidUrl("theme"), theme: "no-such-theme" } },
    });
    await vi.waitFor(
      () => {
        expect(mermaidFigures(neutral)).toHaveLength(1);
        expect(mermaidFigures(unknown)).toHaveLength(1);
      },
      { timeout: MERMAID_WAIT_MS },
    );
    // 検証
    const first = firstNodeShape(
      visibleMermaidSvgs(
        mermaidFigures(neutral)[0] as HTMLElement,
      )[0] as SVGSVGElement,
    );
    expect(getComputedStyle(first).fill).toBe("rgb(224, 242, 241)");
    expect(getComputedStyle(first).stroke.startsWith("url(")).toBe(false);
    const second = firstNodeShape(
      visibleMermaidSvgs(
        mermaidFigures(unknown)[0] as HTMLElement,
      )[0] as SVGSVGElement,
    );
    expect(getComputedStyle(second).fill).toBe(
      mermaidColor(unknown, "var(--mdmark-color-surface)"),
    );
  },
  MERMAID_WAIT_MS + 30_000,
);

// mermaid のコードブロックが無い文書と、機能 mermaid を除外した文書では、mermaid を読み込まない（正常系）
test("test_normal_when_no_mermaid_target", async () => {
  // 準備
  const plain = createElement();
  const disabled = createElement();
  const name = "no-target";
  // 実行
  await mountTracked(plain, {
    markdown: "```ts\nconst a = 1;\n```\n",
    config: { mermaid: { url: mermaidUrl(name) } },
  });
  await mountTracked(disabled, {
    markdown: `<!-- features: {"mermaid": false} -->\n\n${MERMAID_FLOWCHART}`,
    config: { mermaid: { url: mermaidUrl(name) } },
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  // 検証
  expect(countRequests(mermaidUrl(name))).toBe(0);
  const block = find<HTMLElement>(disabled, "div.mdmark-code");
  expect(block.hidden).toBe(false);
  expect(block.querySelector("code.language-mermaid")).not.toBeNull();
});

// mermaid を読み込めないとき、mermaid のコードブロックの前に通知ブロックを配置し、コードブロックのまま残す（異常系）
test("test_error_when_mermaid_not_found", async () => {
  // 準備
  const el = createElement();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    // 実行
    const handle = await mountTracked(el, {
      markdown: MERMAID_MARKDOWN,
      config: { mermaid: { url: "/fixtures/missing/mermaid.esm.min.mjs" } },
    });
    // 検証
    expect(handle).toBeDefined();
    await vi.waitFor(() =>
      expect(el.querySelectorAll(".mdmark-notice")).toHaveLength(2),
    );
    const blocks = [...el.querySelectorAll<HTMLElement>("div.mdmark-code")];
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.hidden).toBe(false);
      expect(
        block.previousElementSibling?.classList.contains("mdmark-notice"),
      ).toBe(true);
    }
    expect(el.querySelector(".mdmark-embed")).toBeNull();
    expect(
      consoleError.mock.calls
        .flat()
        .some((value) =>
          String(value).includes("/fixtures/missing/mermaid.esm.min.mjs"),
        ),
    ).toBe(true);
  } finally {
    consoleError.mockRestore();
  }
});

// mermaid が解釈できないソースは、記載の警告を前に配置してコードブロックのまま残し、ほかの mermaid のコードブロックは描く（異常系）
test(
  "test_error_when_mermaid_syntax_invalid",
  async () => {
    // 準備
    const el = createElement();
    const markdown = [
      "```mermaid",
      "問い合わせを受ける --> 担当へ回す",
      "```",
      "",
      MERMAID_FLOWCHART,
    ].join("\n");
    // 実行
    await mountTracked(el, {
      markdown,
      config: { mermaid: { url: mermaidUrl("invalid") } },
    });
    // 検証
    await vi.waitFor(
      () => {
        expect(mermaidFigures(el)).toHaveLength(1);
        expect(el.querySelector(".mdmark-syntax-warning")).not.toBeNull();
      },
      { timeout: MERMAID_WAIT_MS },
    );
    const block = find<HTMLElement>(el, "div.mdmark-code");
    const warning = block.previousElementSibling;
    expect(warning?.classList.contains("mdmark-syntax-warning")).toBe(true);
    expect(warning?.textContent).toContain("mermaid の図を描けません（");
    expect(block.hidden).toBe(false);
    expect(document.querySelector('[id^="dmdmark-mermaid"]')).toBeNull();
  },
  MERMAID_WAIT_MS + 30_000,
);

/** 1〜4 行目にフロントマター、6 行目に見出し、8 行目に段落、10 行目に節を持つ文書 */
const FRONTMATTER_MARKDOWN_LINES = [
  "---",
  "title: テスト",
  "tags: [a, b]",
  "---",
  "",
  "# 見出し",
  "",
  "段落",
  "",
  "## 節",
  "",
];

/** 本文の見出しの文字を、現れた順に返却する */
function headingTexts(el: HTMLElement): string[] {
  return [
    ...find(el, ".mdmark-content").querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ].map((heading) => heading.textContent?.trim() ?? "");
}

/** 右側の目次の項目の文字を、現れた順に返却する */
function sideTocTexts(el: HTMLElement): string[] {
  return [
    ...find(el, "aside.mdmark-side-toc").querySelectorAll("a[data-heading-id]"),
  ].map((link) => link.textContent?.trim() ?? "");
}

// 先頭のフロントマターを本文・見出し・右側の目次に出さず、元の行番号は元の Markdown のままにする（正常系（フロントマターを除外する））
test("test_normal_when_frontmatter", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    // 実行
    await mountTracked(el, { markdown: FRONTMATTER_MARKDOWN_LINES.join("\n") });
    // 検証
    expect(el.textContent).not.toContain("title: テスト");
    expect(el.textContent).not.toContain("tags: [a, b]");
    expect(el.querySelector(".mdmark-frontmatter")).toBeNull();
    expect(headingTexts(el)).toEqual(["見出し", "節"]);
    expect(sideTocTexts(el)).toEqual(["見出し", "節"]);
    expect(
      find(el, ".mdmark-content h1").getAttribute("data-source-line"),
    ).toBe("5");
    expect(find(el, ".mdmark-content p").getAttribute("data-source-line")).toBe(
      "7",
    );
  });
});

// 文書のマーカーで機能 frontmatter をオンにすると、本文の先頭の閉じた折りたたみに描き、見出しを押すと開く（正常系（フロントマターの表示をオンにする））
test("test_normal_when_frontmatter_enabled", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    const lines = [...FRONTMATTER_MARKDOWN_LINES];
    lines.splice(4, 0, '<!-- features: {"frontmatter": true} -->');
    // 実行
    await mountTracked(el, { markdown: lines.join("\n") });
    // 検証: 描いた直後
    const content = find<HTMLElement>(el, ".mdmark-content");
    const details = content.firstElementChild as HTMLDetailsElement;
    expect(details.matches("details.mdmark-frontmatter")).toBe(true);
    expect(details.open).toBe(false);
    const summary = find<HTMLElement>(details, "summary");
    expect(summary.textContent?.trim()).toBe("フロントマター");
    // 実行: 見出しを押す
    await userEvent.click(summary);
    // 検証: 開いた後
    expect(details.open).toBe(true);
    const code = find<HTMLElement>(details, "code.language-yaml");
    expect(code.textContent).toContain("title: テスト");
    expect(code.textContent).toContain("tags: [a, b]");
    expect(sideTocTexts(el)).toEqual(["見出し", "節"]);
    // 実行: マーカーでオフにし、設定でオンにする
    const off = createElement();
    lines[4] = '<!-- features: {"frontmatter": false} -->';
    await mountTracked(off, {
      markdown: lines.join("\n"),
      config: { features: { frontmatter: true } },
    });
    // 検証
    expect(off.querySelector(".mdmark-frontmatter")).toBeNull();
  });
});

/** 名前・説明・更新日の 3 列 3 行の表の Markdown（`mark` は表のマーカーの中身。省くと囲まない） */
function resizeTable(mark?: string): string {
  const table = [
    "| 名前 | 説明 | 更新日 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 2026-10-01 |",
    "| みかん | 印刷を修正する | 2026-10-10 |",
    "| りんご飴 | 描画の崩れを修正する | 2026-10-20 |",
    "",
  ];
  return (
    mark === undefined
      ? table
      : [`<!-- table: ${mark} -->`, "", ...table, "<!-- /table -->", ""]
  ).join("\n");
}

/** 列の幅のつまみに `pointerdown` から `pointerup` までを送信する（`dx` は横の移動量の px） */
function dragResizeHandle(
  handle: HTMLElement,
  dx: number,
  pointerType: "mouse" | "touch" = "mouse",
): void {
  const rect = handle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType };
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...init, clientX: x, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...init, clientX: x + dx, clientY: y }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...init, clientX: x + dx, clientY: y }),
  );
}

/** 表の最下段の見出しのセルと、そのつまみ */
function resizeParts(table: Element): {
  heads: HTMLTableCellElement[];
  handles: HTMLElement[];
} {
  const heads = [...table.querySelectorAll<HTMLTableCellElement>("thead th")];
  const handles = heads.map((head) =>
    find<HTMLElement>(head, ":scope > .mdmark-col-resize"),
  );
  return { heads, handles };
}

/** 見出しのセルの `offsetWidth` の並び */
function headWidths(heads: HTMLTableCellElement[]): number[] {
  return heads.map((head) => head.offsetWidth);
}

// resize の表の見出しの右端につまみを付け、ドラッグでその列の幅だけを変え、列の最小幅で止め、ダブルクリックで描いた直後の幅に戻す（正常系（列の幅を変える））
test("test_normal_when_column_resized", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const el = createElement();
  const markdown = [
    resizeTable(
      '{"kind": "data", "columns": {"説明": {"width": {"mode": "nowrap"}}}}',
    ),
    resizeTable('{"kind": "data", "features": {"resize": {"enabled": false}}}'),
    resizeTable('{"kind": "plain"}'),
  ].join("\n");
  await mountTracked(el, { markdown });
  const [first, off, plain] = [
    ...el.querySelectorAll<HTMLElement>(".mdmark-table"),
  ] as [HTMLElement, HTMLElement, HTMLElement];
  const { heads, handles } = resizeParts(first);
  const [nameHandle, noteHandle] = handles as [HTMLElement, HTMLElement];
  // 検証: つまみの属性
  for (const handle of handles) {
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("tabindex")).toBe("0");
    expect(getComputedStyle(handle).cursor).toBe("col-resize");
  }
  expect(nameHandle.getAttribute("aria-label")).toBe("「名前」の列の幅");
  const opened = headWidths(heads);
  const names = () =>
    [...first.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector("td")?.textContent,
    );
  const order = names();
  const sort = heads[0]?.getAttribute("aria-sort");
  // 実行: 名前の列のつまみを右へ 80px ドラッグする
  dragResizeHandle(nameHandle, 80);
  // 検証: 名前の列の幅だけが 80px 広がり、並べ替えない
  const dragged = headWidths(heads);
  expect(dragged[0]).toBe((opened[0] ?? 0) + 80);
  expect(dragged.slice(1)).toEqual(opened.slice(1));
  expect(heads[0]?.getAttribute("aria-sort")).toBe(sort);
  expect(names()).toEqual(order);
  // 実行: 説明の列のつまみを、列の最小幅より狭くなるまで左へドラッグする
  dragResizeHandle(noteHandle, -2000);
  // 検証: 列の最小幅で止まり、wide= の列も折り返す
  expect(String(heads[1]?.offsetWidth)).toBe(
    noteHandle.getAttribute("aria-valuemin"),
  );
  const noteCell = first.querySelector<HTMLElement>("tbody td:nth-child(2)");
  expect(noteCell && getComputedStyle(noteCell).whiteSpace).not.toBe("nowrap");
  // 実行: 名前の列と説明の列のつまみをダブルクリックする
  for (const handle of [nameHandle, noteHandle]) {
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  }
  // 検証: 描いた直後の幅に戻る
  expect(headWidths(heads).slice(0, 2)).toEqual(opened.slice(0, 2));
  // 検証: -resize の表と plain の表につまみが無い
  expect(off.querySelector(".mdmark-col-resize")).toBeNull();
  expect(plain.querySelector(".mdmark-col-resize")).toBeNull();
});

// つまみにフォーカスした ←・→ キーで 16px ずつ幅を変え、Enter で描いた直後の幅に戻し、つまみの値を今の幅にする（正常系（キーボードで列の幅を変える））
test("test_normal_when_column_resized_by_keyboard", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, { markdown: resizeTable('{"kind": "data"}') });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  const { heads, handles } = resizeParts(table);
  const head = heads[0] as HTMLTableCellElement;
  const handle = handles[0] as HTMLElement;
  const opened = head.offsetWidth;
  // 検証: つまみの値
  expect(handle.getAttribute("aria-valuenow")).toBe(String(opened));
  expect(handle.getAttribute("aria-valuetext")).toBe(`${opened}px`);
  const min = Number(handle.getAttribute("aria-valuemin"));
  expect(min).toBeGreaterThan(0);
  expect(min).toBeLessThanOrEqual(opened);
  expect(handle.getAttribute("aria-valuemax")).toBe(
    String(Math.floor(scroller.clientWidth)),
  );
  const scrollLeft = scroller.scrollLeft;
  const scrollX = window.scrollX;
  // 実行: つまみにフォーカスし、→ キーを 2 回押す
  handle.focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  // 検証
  expect(head.offsetWidth).toBe(opened + 32);
  expect(handle.getAttribute("aria-valuenow")).toBe(String(opened + 32));
  // 実行・検証: ← キーを 1 回押す
  await userEvent.keyboard("{ArrowLeft}");
  expect(head.offsetWidth).toBe(opened + 16);
  // 実行・検証: Enter で描いた直後の幅に戻り、フォーカスはつまみに残る
  await userEvent.keyboard("{Enter}");
  expect(head.offsetWidth).toBe(opened);
  expect(document.activeElement).toBe(handle);
  // 検証: キーで表とページがスクロールしない
  expect(scroller.scrollLeft).toBe(scrollLeft);
  expect(window.scrollX).toBe(scrollX);
});

// 留めた列の幅を変えるたびに留める位置を計算し直し、留めた列の幅の合計が見えている幅に収まる幅で止める（正常系（留めた列の幅を変える））
test("test_normal_when_pinned_column_resized", async () => {
  // 準備: 表がはみ出す幅に、10 列 30 行の既定の種類の表を描く
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const el = createElement();
  el.style.width = "500px";
  const headers = Array.from({ length: 10 }, (_, i) => `列${i + 1}`);
  const markdown = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...Array.from(
      { length: 30 },
      (_, row) =>
        `| ${headers.map((_h, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
    ),
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  const pins = [
    ...table.querySelectorAll<HTMLButtonElement>("button.mdmark-pin"),
  ];
  await vi.waitFor(() => expect(pins[2]?.hidden).toBe(false));
  const { heads, handles } = resizeParts(table);
  const firstRow = find<HTMLTableRowElement>(table, "tbody tr");
  // 実行: 3 列目と 9 列目を留め、1 列目のつまみを右へ 60px ドラッグして、右端までスクロールする
  pins[2]?.click();
  pins[8]?.click();
  dragResizeHandle(handles[0] as HTMLElement, 60);
  scroller.scrollLeft = scroller.scrollWidth;
  await nextFrames();
  // 検証: 3 列目は広げた 1 列目の右に留まる
  const firstWidth = `${heads[0]?.offsetWidth}px`;
  expect(heads[2]?.style.left).toBe(firstWidth);
  expect(firstRow.cells[2]?.style.left).toBe(firstWidth);
  // 実行: 1 列目のつまみを、表の見えている幅を超えるまで右へドラッグする
  dragResizeHandle(handles[0] as HTMLElement, 5000);
  // 検証: 上限の幅で止まる
  expect(heads[0]?.offsetWidth).toBeLessThanOrEqual(
    scroller.clientWidth -
      (heads[2]?.offsetWidth ?? 0) -
      (heads[8]?.offsetWidth ?? 0),
  );
  expect(handles[0]?.getAttribute("aria-valuenow")).toBe(
    handles[0]?.getAttribute("aria-valuemax"),
  );
  // 実行: 1 列目のつまみをダブルクリックし、左端までスクロールして、9 列目のつまみを右へ 40px ドラッグする
  handles[0]?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  scroller.scrollLeft = 0;
  await nextFrames();
  const ninth = heads[8]?.offsetWidth ?? 0;
  dragResizeHandle(handles[8] as HTMLElement, 40);
  // 検証: 9 列目を広げて右端に留める
  expect(heads[8]?.offsetWidth).toBe(ninth + 40);
  expect(heads[8]?.style.right).toBe("0px");
  for (const index of [0, 2, 8]) {
    expect(pins[index]?.getAttribute("aria-pressed")).toBe("true");
  }
});

// タッチのドラッグで幅を変え、ダブルタップで描いた直後の幅に戻し、ポインターが粗い画面ではつまみを常に出す（正常系（タッチで列の幅を変える））
test("test_normal_when_column_resized_by_touch", async () => {
  // 準備: 幅 390px のポインターが粗い画面
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const original = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(390, 844);
  await cdp().send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  try {
    expect(matchMedia("(pointer: coarse)").matches).toBe(true);
    const el = createElement();
    await mountTracked(el, { markdown: resizeTable('{"kind": "data"}') });
    const table = find<HTMLElement>(el, ".mdmark-table");
    const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
    const { heads, handles } = resizeParts(table);
    const handle = handles[0] as HTMLElement;
    // 検証: つまみを常に出し、押せる幅を 24px にする
    expect(Number(getComputedStyle(handle, "::after").opacity)).toBeGreaterThan(
      0,
    );
    expect(handle.offsetWidth).toBe(24);
    expect(getComputedStyle(handle).touchAction).toBe("none");
    const opened = headWidths(heads);
    const scrollLeft = scroller.scrollLeft;
    // 実行: タッチで右へ 60px 動かす
    dragResizeHandle(handle, 60, "touch");
    // 検証
    const dragged = headWidths(heads);
    expect(dragged[0]).toBe((opened[0] ?? 0) + 60);
    expect(dragged.slice(1)).toEqual(opened.slice(1));
    expect(scroller.scrollLeft).toBe(scrollLeft);
    // 実行: 2 回タップする
    dragResizeHandle(handle, 0, "touch");
    dragResizeHandle(handle, 0, "touch");
    // 検証
    expect(heads[0]?.offsetWidth).toBe(opened[0]);
  } finally {
    await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await page.viewport(original.width, original.height);
  }
});

// 列の幅を変えても、最終列を畳むかは決め直さない（正常系（狭い幅で列の幅を変える））
test("test_normal_when_column_resized_in_narrow_width", async () => {
  // 準備: 最終列を畳む幅に、説明が 1 行に収まる表を描く
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const el = createElement();
  el.style.width = "600px";
  const markdown = [
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 名前 | 状態 | 説明 |",
    "| --- | --- | --- |",
    "| りんご | 新規 | 描画を速くするための改善 |",
    "| みかん | 進行 | 印刷で崩れる表の修正 |",
    "| ぶどう | 完了 | 目次の位置を合わせる変更 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  await mountTracked(el, { markdown });
  const table = find<HTMLElement>(el, ".mdmark-table");
  const scroller = find<HTMLElement>(table, ".mdmark-table-scroll");
  const { heads, handles } = resizeParts(table);
  const note = heads[2] as HTMLTableCellElement;
  await nextFrames();
  expect(note.hidden).toBe(false);
  const noteWidth = note.offsetWidth;
  // 実行: 名前の列のつまみを、表がはみ出すまで右へドラッグする
  dragResizeHandle(handles[0] as HTMLElement, 600);
  await nextFrames();
  // 検証: 最終列は畳まず、幅も変わらない
  expect(note.offsetWidth).toBe(noteWidth);
  expect(note.hidden).toBe(false);
  expect(table.querySelector(".mdmark-fold-toggle")).toBeNull();
  expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  // 実行: 説明の列のつまみを、説明のセルが折り返すまで左へドラッグする
  dragResizeHandle(handles[2] as HTMLElement, -2000);
  await nextFrames();
  // 検証の前提: 最終列のセルが、畳む判定の折り返し（行の高さの 1.5 倍を超える）になっている
  expect(
    [...table.querySelectorAll<HTMLElement>("tbody td:last-child")].some(
      (cell) => {
        const style = getComputedStyle(cell);
        const content =
          cell.scrollHeight -
          Number.parseFloat(style.paddingTop) -
          Number.parseFloat(style.paddingBottom);
        return content > Number.parseFloat(style.lineHeight) * 1.5;
      },
    ),
  ).toBe(true);
  // 検証: 最終列は畳まない
  expect(note.hidden).toBe(false);
  expect(table.querySelector(".mdmark-fold-toggle")).toBeNull();
});

// map の図: 図の枠が描かれるまで待つ時間（dist/map.js の読み込みを含む）
const MAP_WAIT_MS = 10_000;

/** map の図の見本の構成図（見本の Mermaid に太い線を 1 本足す） */
const MAP_FLOW_THICK = `${MAP_FLOW}  mount ==> frame\n`;

/** 矩形 */
type MapRect = { left: number; top: number; right: number; bottom: number };

/** 2 つの矩形が重なるか（辺が接するだけは重ならない） */
const mapOverlaps = (a: MapRect, b: MapRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** URL のクエリ文字列から map-* を消す */
function clearMapQuery(): void {
  const url = new URL(location.href);
  for (const key of [...url.searchParams.keys()])
    if (key.startsWith("map-")) url.searchParams.delete(key);
  history.replaceState(null, "", url);
}

/** map の範囲を描き、map の図の枠が描かれるまで待つ（sessionStorage と map-* のクエリ文字列は描く前に空にする） */
async function mountMap(
  markdown: string,
  config: Record<string, unknown> = {},
  options: { search?: string } = {},
): Promise<{ el: HTMLElement; figures: () => HTMLElement[] }> {
  sessionStorage.clear();
  clearMapQuery();
  if (options.search !== undefined)
    history.replaceState(null, "", `${location.pathname}${options.search}`);
  const el = createElement();
  el.style.width = "1200px";
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG, ...config } as Parameters<
      Built["mount"]
    >[1]["config"],
  });
  const figures = () => [
    ...el.querySelectorAll<HTMLElement>(
      'figure.mdmark-diagram[data-diagram="map"]',
    ),
  ];
  await vi.waitFor(() => expect(figures().length).toBeGreaterThan(0), {
    timeout: MAP_WAIT_MS,
  });
  return { el, figures };
}

/** 描いた map を片付け、同じ要素に同じ Markdown をもう一度描く（sessionStorage とクエリ文字列は残す） */
async function remountMap(
  el: HTMLElement,
  markdown: string,
  config: Record<string, unknown> = {},
): Promise<void> {
  handles.pop()?.destroy();
  el.replaceChildren();
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG, ...config } as Parameters<
      Built["mount"]
    >[1]["config"],
  });
  await vi.waitFor(
    () =>
      expect(
        el.querySelector('figure.mdmark-diagram[data-diagram="map"]'),
      ).not.toBeNull(),
    { timeout: MAP_WAIT_MS },
  );
}

/** 構成図とシーケンス図の 2 つの map を持つ Markdown（シーケンス図は構成図の上で再生する） */
const MAP_BOTH = `${mapRange({ args: '{"title": "全体の構成"}', mermaid: MAP_FLOW, data: MAP_DATA })}\n${mapRange({ args: '{"title": "描くまでの流れ"}', mermaid: MAP_SEQUENCE, data: '{"version": 1, "plays_over": 1}' })}`;

/** 要素の矩形の中心 */
const mapCenter = (element: Element): [number, number] => {
  const box = element.getBoundingClientRect();
  return [box.x + box.width / 2, box.y + box.height / 2];
};

/** 図の中の data-node の要素（構成図のノードかシーケンス図の参加者） */
const mapNode = (figure: Element, id: string): HTMLElement =>
  find<HTMLElement>(figure, `.mdmark-diagram-node[data-node="${id}"]`);

/** 薄くした（map-dim を持つ）か */
const mapDimmed = (element: Element): boolean =>
  element.classList.contains("map-dim");

/** 図の中の要素を、ポインターで押して離す（動かさない） */
function pressMap(target: Element, dx = 0, dy = 0): void {
  const box = target.getBoundingClientRect();
  const at = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  };
  target.dispatchEvent(new PointerEvent("pointerdown", at));
  if (dx !== 0 || dy !== 0) {
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        ...at,
        clientX: at.clientX + dx,
        clientY: at.clientY + dy,
      }),
    );
  }
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      ...at,
      clientX: at.clientX + dx,
      clientY: at.clientY + dy,
    }),
  );
}

// map の構成図を描く（正常系）
test("test_normal_when_map_flowchart_drawn", async () => {
  // 準備・実行
  const { figures } = await mountMap(
    mapRange({
      args: '{"title": "全体の構成"}',
      mermaid: MAP_FLOW_THICK,
      data: MAP_DATA,
    }),
  );
  const figure = figures()[0] as HTMLElement;
  // 検証: タイトルと、範囲と更新日を出さない
  expect(figure.querySelector(".mdmark-diagram-title")?.textContent).toBe(
    "全体の構成",
  );
  expect(figure.querySelector(".mdmark-diagram-meta")).toBeNull();
  // 検証: 入れ子とノード・グループの重なり
  const read = find<HTMLElement>(figure, '.map-group[data-group="read"]');
  const lib = find<HTMLElement>(figure, '.map-group[data-group="lib"]');
  const inner = read.getBoundingClientRect();
  const outer = lib.getBoundingClientRect();
  expect(inner.left).toBeGreaterThanOrEqual(outer.left);
  expect(inner.right).toBeLessThanOrEqual(outer.right);
  const nodes = [
    ...figure.querySelectorAll<HTMLElement>(
      ".mdmark-diagram-stage > .mdmark-diagram-node[data-node]",
    ),
  ];
  expect(nodes.length).toBe(10);
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      expect(
        mapOverlaps(a.getBoundingClientRect(), b.getBoundingClientRect()),
        `${a.dataset.node} と ${b.dataset.node}`,
      ).toBe(false);
    }
    // 名前がノードに収まり、種類の行がノードの左上にある
    const name = find<HTMLElement>(a, ".mdmark-diagram-node-name");
    expect(a.scrollHeight).toBeLessThanOrEqual(a.clientHeight + 1);
    const kind = find<HTMLElement>(a, ".mdmark-diagram-node-kind");
    expect(kind.getBoundingClientRect().top).toBeLessThan(
      name.getBoundingClientRect().top,
    );
    expect(kind.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  }
  // 検証: 種類の行と形・色
  const store = find<HTMLElement>(figure, '[data-node="index"]');
  expect(store.dataset.shape).toBe("rect");
  expect(store.querySelector(".mdmark-diagram-node-kind")?.textContent).toBe(
    "保存先",
  );
  expect(store.querySelector(".mdmark-diagram-node-kind svg")).not.toBeNull();
  expect(find<HTMLElement>(figure, '[data-node="user"]').dataset.shape).toBe(
    "pill",
  );
  expect(figure.querySelector(".mdmark-diagram-legend li")).toBeNull();
  // 検証: 線の模様・太さ・矢じり
  const dashed = find<SVGPathElement>(
    figure,
    '.mdmark-diagram-wire[data-wire="doc->marker"]',
  );
  expect(dashed.getAttribute("stroke-dasharray")).toBeTruthy();
  const thick = find<SVGPathElement>(
    figure,
    '.mdmark-diagram-wire[data-wire="mount->frame"]',
  );
  expect(Number(thick.getAttribute("stroke-width"))).toBeGreaterThan(2);
  const both = find<SVGPathElement>(
    figure,
    '.mdmark-diagram-wire[data-wire="route->frame"]',
  );
  expect(both.getAttribute("marker-start")).toBeTruthy();
  expect(both.getAttribute("marker-end")).toBeTruthy();
  // 検証: 右上のツールと、図を動かす矢印のボタンが無い
  const tools = [
    ...figure.querySelectorAll<HTMLButtonElement>(
      '.mdmark-diagram-tools-group[data-group="map"] [data-tool]',
    ),
  ];
  expect(tools.map((tool) => tool.dataset.tool)).toEqual([
    "back",
    "expandAll",
    "collapseAll",
    "reset",
  ]);
  expect(tools[0]?.disabled).toBe(true);
  expect(tools[3]?.disabled).toBe(true);
  expect(
    figure.querySelector('.mdmark-diagram-tools-group[data-group="pan"]'),
  ).toBeNull();
  // 検証: 案内の帯
  const band = find<HTMLElement>(
    figure.parentElement as HTMLElement,
    ".map-band",
  );
  expect(band.querySelector(".map-band-count")?.textContent).toBe("–/4");
  expect(band.querySelectorAll("button[data-band]")).toHaveLength(4);
  expect(
    band.querySelector<HTMLButtonElement>('[data-band="stop"]')?.disabled,
  ).toBe(true);
  // 検証: 線にポインターを当てると、ほかが薄くなり印が流れる
  const hit = find<SVGPathElement>(
    figure,
    '.map-wire-hit[data-wire="mount->marker"]',
  );
  hit.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  expect(
    figure.querySelectorAll('.map-packet[data-wire="mount->marker"]').length,
  ).toBeGreaterThan(0);
  expect(
    find<HTMLElement>(figure, '[data-node="index"]').classList.contains(
      "map-dim",
    ),
  ).toBe(true);
  expect(
    find<HTMLElement>(figure, '[data-node="mount"]').classList.contains(
      "map-dim",
    ),
  ).toBe(false);
  hit.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  expect(figure.querySelectorAll(".map-packet")).toHaveLength(0);
  // 検証: mermaid のライブラリを読み込まない
  expect(
    performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/npm/mermaid@"))
      .map((entry) => entry.name),
  ).toEqual([]);
});

// map のグループの中へ入る・開閉する（正常系）
test("test_normal_when_map_group_entered_and_collapsed", async () => {
  // 準備
  const markdown = mapRange({ mermaid: MAP_FLOW, data: MAP_DATA });
  const { el, figures } = await mountMap(markdown);
  const figure = () => figures()[0] as HTMLElement;
  const before = history.length;
  // 実行: 中へ入る
  find<HTMLButtonElement>(figure(), '[data-group-enter="read"]').click();
  // 検証
  expect(
    find<HTMLElement>(figure(), '[data-node="mount"]').classList.contains(
      "map-faded",
    ),
  ).toBe(true);
  expect(figure().querySelector('[data-group-enter="read"]')).toBeNull();
  expect(find<HTMLButtonElement>(figure(), '[data-tool="back"]').disabled).toBe(
    false,
  );
  expect(new URLSearchParams(location.search).get("map-1")).toBe("read");
  expect(history.length).toBe(before);
  // 実行・検証: 戻る
  find<HTMLButtonElement>(figure(), '[data-tool="back"]').click();
  expect(new URLSearchParams(location.search).get("map-1")).toBe("lib");
  find<HTMLButtonElement>(figure(), '[data-tool="back"]').click();
  expect(new URLSearchParams(location.search).has("map-1")).toBe(false);
  // 実行: 閉じる
  find<HTMLButtonElement>(
    figure(),
    'button[aria-label="データを閉じる"]',
  ).click();
  // 検証: 1 つのノードになり、中への線を相手ごとに 1 本にまとめ（marker と data の 2 本）、ラベルを出さない
  const closed = find<HTMLElement>(
    figure(),
    '.map-closed-group[data-group="store"]',
  );
  expect(
    closed.querySelector('button[aria-label="データを開く"]'),
  ).not.toBeNull();
  const toStore = [
    ...figure().querySelectorAll<SVGPathElement>(
      ".mdmark-diagram-wire[data-wire]",
    ),
  ].filter((path) => path.dataset.wire?.includes("store"));
  expect(toStore.map((path) => path.dataset.wire).sort()).toEqual([
    "store->data",
    "store->marker",
  ]);
  // 実行・検証: もう一度 mount しても閉じたまま
  handles.pop()?.destroy();
  el.replaceChildren();
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG } as Parameters<Built["mount"]>[1]["config"],
  });
  await vi.waitFor(
    () =>
      expect(
        el.querySelector('.map-closed-group[data-group="store"]'),
      ).not.toBeNull(),
    { timeout: MAP_WAIT_MS },
  );
  // 実行・検証: Shift で中のグループごと閉じる
  find<HTMLButtonElement>(
    el,
    'button[aria-label="mdmarkを閉じる"]',
  ).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  expect(
    el.querySelector('.map-closed-group[data-group="lib"]'),
  ).not.toBeNull();
  find<HTMLButtonElement>(el, '[data-tool="expandAll"]').click();
  expect(el.querySelectorAll(".map-closed-group")).toHaveLength(0);
  find<HTMLButtonElement>(el, '[data-tool="collapseAll"]').click();
  expect(el.querySelectorAll(".map-closed-group").length).toBeGreaterThan(0);
  // 実行・検証: クエリ文字列のグループの中から描く。無い ID は無視する
  history.replaceState(null, "", `${location.pathname}?map-1=read`);
  sessionStorage.clear();
  handles.pop()?.destroy();
  el.replaceChildren();
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG } as Parameters<Built["mount"]>[1]["config"],
  });
  await vi.waitFor(
    () =>
      expect(el.querySelector(".map-group-title.is-current")?.textContent).toBe(
        "記法の読み取り",
      ),
    { timeout: MAP_WAIT_MS },
  );
  history.replaceState(null, "", `${location.pathname}?map-1=ghost`);
  sessionStorage.clear();
  handles.pop()?.destroy();
  el.replaceChildren();
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG } as Parameters<Built["mount"]>[1]["config"],
  });
  await vi.waitFor(
    () => expect(el.querySelector("figure.mdmark-diagram")).not.toBeNull(),
    { timeout: MAP_WAIT_MS },
  );
  expect(el.querySelector(".map-group-title.is-current")).toBeNull();
});

// map の案内を進める（正常系）
test("test_normal_when_map_walkthrough_played", async () => {
  // 準備
  const { figures } = await mountMap(
    mapRange({ args: '{"interval": 3}', mermaid: MAP_FLOW, data: MAP_DATA }),
  );
  const figure = () => figures()[0] as HTMLElement;
  const press = (action: string) =>
    find<HTMLButtonElement>(figure(), `[data-band="${action}"]`).click();
  const count = () => figure().querySelector(".map-band-count")?.textContent;
  const viewport = find<HTMLElement>(figure(), ".mdmark-diagram-viewport");
  const scroll = [viewport.scrollLeft, viewport.scrollTop];
  // 実行: 次へ
  press("next");
  // 検証: 手順 1 の強調・薄くする要素・データの印
  expect(count()).toBe("1/4");
  expect(figure().querySelector(".map-band-title")?.textContent).toBe(
    "mount に渡す",
  );
  expect(mapDimmed(mapNode(figure(), "user"))).toBe(false);
  expect(mapDimmed(mapNode(figure(), "mount"))).toBe(false);
  expect(getComputedStyle(mapNode(figure(), "mount")).opacity).toBe("1");
  expect(getComputedStyle(mapNode(figure(), "index")).opacity).toBe("0.25");
  const label = find<HTMLElement>(
    figure(),
    '.mdmark-diagram-label[data-wire="marker->mermaid"]',
  );
  expect(mapDimmed(label)).toBe(true);
  expect(
    figure().querySelectorAll('.map-packet[data-wire="user->mount"]').length,
  ).toBeGreaterThan(0);
  const kept = find<SVGPathElement>(
    figure(),
    '.mdmark-diagram-wire[data-wire="user->mount"]',
  );
  expect(getComputedStyle(kept).opacity).not.toBe("0");
  expect([viewport.scrollLeft, viewport.scrollTop]).toEqual(scroll);
  // 実行・検証: 2 手順目の説明の文は改行のまま出し、説明の行数によらずボタンの位置が変わらない
  const actions = () =>
    find<HTMLElement>(figure(), ".map-band-actions").getBoundingClientRect();
  const first = actions();
  press("next");
  const text = find<HTMLElement>(figure(), ".map-band-text");
  expect(text.textContent?.split("\n")).toHaveLength(3);
  expect(getComputedStyle(text).whiteSpace).toMatch(/^pre/);
  expect(actions().top).toBeCloseTo(first.top, 0);
  expect(actions().left).toBeCloseTo(first.left, 0);
  // 実行・検証: 手順 3 で「配置」の中へ入る
  press("next");
  expect(count()).toBe("3/4");
  expect(
    figure().querySelector(".map-group-title.is-current")?.textContent,
  ).toBe("配置");
  expect(
    getComputedStyle(
      find<SVGPathElement>(
        figure(),
        '.mdmark-diagram-wire[data-wire="layout->route"]',
      ),
    ).opacity,
  ).not.toBe("0");
  // 実行・検証: 最後の次へで最初へ回る
  press("next");
  press("next");
  expect(count()).toBe("1/4");
  expect([viewport.scrollLeft, viewport.scrollTop]).toEqual(scroll);
  // 実行・検証: 停止で強調が解け、案内を始めた全体の図に戻る
  press("stop");
  expect(count()).toBe("–/4");
  expect(figure().querySelectorAll(".map-dim")).toHaveLength(0);
  expect(figure().querySelector(".map-group-title.is-current")).toBeNull();
  // 実行・検証: 始める前の前へで最後の手順へ回る
  press("prev");
  expect(count()).toBe("4/4");
  press("stop");
  // 実行・検証: 自動で進める間は 3 秒ごとに進み、強調するノードへスクロールする
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    const scrollTo = vi.spyOn(viewport, "scrollTo");
    press("auto");
    expect(count()).toBe("1/4");
    vi.advanceTimersByTime(2999);
    expect(count()).toBe("1/4");
    vi.advanceTimersByTime(1);
    expect(count()).toBe("2/4");
    expect(scrollTo).toHaveBeenCalled();
    // 図の枠をホイールで動かした後は、自動で進め直すまでスクロールしない
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    scrollTo.mockClear();
    vi.advanceTimersByTime(3000);
    expect(count()).toBe("3/4");
    expect(scrollTo).not.toHaveBeenCalled();
    press("auto");
    press("auto");
    vi.advanceTimersByTime(3000);
    expect(scrollTo).toHaveBeenCalled();
    press("stop");
  } finally {
    vi.useRealTimers();
  }
});

// map のシーケンス図を描いて再生する（正常系）
test("test_normal_when_map_sequence_played", async () => {
  // 準備
  const { figures } = await mountMap(MAP_BOTH);
  await vi.waitFor(() => expect(figures()).toHaveLength(2), {
    timeout: MAP_WAIT_MS,
  });
  const flow = () => figures()[0] as HTMLElement;
  const seq = () => figures()[1] as HTMLElement;
  // 検証: ブロックの枠・タブ・else の破線と見出し・注記・活性化の帯
  const fragments = [
    ...seq().querySelectorAll<SVGRectElement>(".map-seq-fragment"),
  ];
  expect(fragments).toHaveLength(3);
  for (const rect of fragments)
    expect(getComputedStyle(rect).strokeWidth).toBe("1px");
  const tabs = [
    ...seq().querySelectorAll<HTMLElement>(".map-seq-fragment-tab"),
  ];
  expect(tabs.map((tab) => tab.dataset.kind)).toEqual(["rect", "loop", "alt"]);
  expect(tabs[0]?.textContent).toContain("描く前の準備");
  expect(
    getComputedStyle(find<SVGLineElement>(seq(), ".map-seq-section"))
      .strokeDasharray,
  ).not.toBe("none");
  expect(seq().querySelector(".map-seq-section-label")?.textContent).toBe(
    "[ブロックが無い]",
  );
  const note = find<HTMLElement>(seq(), ".map-seq-note");
  expect(note.textContent).toBe("全ての範囲を描き終えてから返す");
  const labels = [
    ...seq().querySelectorAll<HTMLElement>(".mdmark-diagram-label"),
  ];
  for (const item of labels) {
    for (const other of [note, ...tabs])
      expect(
        mapOverlaps(
          item.getBoundingClientRect(),
          other.getBoundingClientRect(),
        ),
        item.textContent ?? "",
      ).toBe(false);
  }
  // 検証: 点線・× の矢じり・番号
  expect(
    find<SVGPathElement>(
      seq(),
      '.mdmark-diagram-wire[data-message="6"]',
    ).getAttribute("stroke-dasharray"),
  ).toBeTruthy();
  expect(
    find<SVGPathElement>(
      seq(),
      '.mdmark-diagram-wire[data-message="5"]',
    ).getAttribute("marker-end"),
  ).toContain("head-cross");
  expect(labels[0]?.textContent).toBe("1 設定と Markdown");
  // 検証: 活性化の帯に入る線が帯の端で止まる
  const activation = find<SVGRectElement>(seq(), ".map-seq-activation");
  const first = find<SVGPathElement>(
    seq(),
    '.mdmark-diagram-wire[data-message="0"]',
  );
  expect(first.getBoundingClientRect().right).toBeLessThanOrEqual(
    activation.getBoundingClientRect().left + 1,
  );
  // 検証: 最初の行が一番高い参加者の箱の下から始まる
  const heads = [...seq().querySelectorAll<HTMLElement>(".map-participant")];
  expect(heads).toHaveLength(5);
  const bottom = Math.max(
    ...heads.map((head) => head.getBoundingClientRect().bottom),
  );
  expect(first.getBoundingClientRect().top).toBeGreaterThan(bottom);
  for (const head of heads)
    expect(head.scrollHeight).toBeLessThanOrEqual(head.clientHeight + 1);
  // 実行: シーケンス図の帯の次へ
  find<HTMLButtonElement>(seq(), '[data-band="next"]').click();
  // 検証: 両方の図でメッセージ 1 のほかが薄くなり、印が流れる
  expect(seq().querySelector(".map-band-title")?.textContent).toBe(
    "設定と Markdown",
  );
  expect(mapDimmed(find(seq(), '.mdmark-diagram-wire[data-message="0"]'))).toBe(
    false,
  );
  expect(mapDimmed(find(seq(), '.mdmark-diagram-wire[data-message="1"]'))).toBe(
    true,
  );
  expect(mapDimmed(mapNode(seq(), "marker"))).toBe(true);
  expect(mapDimmed(mapNode(seq(), "mount"))).toBe(false);
  expect(
    seq().querySelectorAll('.map-packet[data-message="0"]').length,
  ).toBeGreaterThan(0);
  expect(mapDimmed(mapNode(flow(), "user"))).toBe(false);
  expect(mapDimmed(mapNode(flow(), "mount"))).toBe(false);
  expect(mapDimmed(mapNode(flow(), "index"))).toBe(true);
  expect(
    flow().querySelectorAll('.map-packet[data-wire="user->mount"]').length,
  ).toBeGreaterThan(0);
  // 実行・検証: 構成図の案内を始めると、シーケンス図の強調が解ける
  find<HTMLButtonElement>(flow(), '[data-band="next"]').click();
  expect(seq().querySelector(".map-band-count")?.textContent).toBe("–/7");
  expect(seq().querySelectorAll(".map-dim")).toHaveLength(0);
  expect(flow().querySelector(".map-band-count")?.textContent).toBe("1/4");
  expect(mapDimmed(mapNode(flow(), "index"))).toBe(true);
  // 実行: シーケンス図の帯の自動で進める
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const flowViewport = find<HTMLElement>(flow(), ".mdmark-diagram-viewport");
  const flowScroll = vi
    .spyOn(flowViewport, "scrollTo")
    .mockImplementation(() => {});
  find<HTMLButtonElement>(seq(), '[data-band="auto"]').click();
  vi.advanceTimersByTime(2000);
  // 検証: 構成図の図の枠の中を、送り手と受け手のノードへスクロールする
  expect(seq().querySelector(".map-band-count")?.textContent).toBe("2/7");
  expect(flowScroll).toHaveBeenCalledTimes(1);
  // 実行・検証: 構成図の図の枠をホイールで動かした後は、自動で進め直すまでスクロールしない
  flowViewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  vi.advanceTimersByTime(2000);
  expect(flowScroll).toHaveBeenCalledTimes(1);
  find<HTMLButtonElement>(seq(), '[data-band="auto"]').click();
  find<HTMLButtonElement>(seq(), '[data-band="auto"]').click();
  vi.advanceTimersByTime(2000);
  expect(flowScroll).toHaveBeenCalledTimes(2);
});

// map のノード・参加者・線を選ぶ（正常系）
test("test_normal_when_map_items_selected", async () => {
  // 準備
  const { figures } = await mountMap(MAP_BOTH);
  await vi.waitFor(() => expect(figures()).toHaveLength(2), {
    timeout: MAP_WAIT_MS,
  });
  const flow = () => figures()[0] as HTMLElement;
  const seq = () => figures()[1] as HTMLElement;
  const kindOf = (figure: Element, id: string) =>
    find<HTMLElement>(mapNode(figure, id), ".mdmark-diagram-node-kind");
  const wire = (id: string) =>
    find<SVGPathElement>(flow(), `.mdmark-diagram-wire[data-wire="${id}"]`);
  const hit = (id: string) =>
    find<SVGPathElement>(flow(), `.map-wire-hit[data-wire="${id}"]`);
  const reset = () =>
    find<HTMLButtonElement>(flow(), '[data-tool="reset"]').disabled;
  expect(reset()).toBe(true);
  // 実行: mount の種類の行を押す
  pressMap(kindOf(flow(), "mount"));
  // 検証: mount とその線のほかが薄くなり、その線に印が流れる
  expect(mapNode(flow(), "mount").classList.contains("is-selected")).toBe(true);
  expect(mapDimmed(wire("mount->marker"))).toBe(false);
  expect(mapDimmed(wire("user->mount"))).toBe(false);
  expect(mapDimmed(mapNode(flow(), "marker"))).toBe(true);
  expect(
    flow().querySelectorAll('.map-packet[data-wire="mount->marker"]').length,
  ).toBeGreaterThan(0);
  expect(reset()).toBe(false);
  // 実行・検証: 2 つ選ぶと、選んだノードどうしの線だけが残る
  pressMap(kindOf(flow(), "marker"));
  expect(mapDimmed(wire("mount->marker"))).toBe(false);
  expect(mapDimmed(wire("user->mount"))).toBe(true);
  // 実行・検証: 両端が選ばれた線を押すと両方が解け、3px 動かして押すと両方が選ばれる
  pressMap(hit("mount->marker"));
  expect(flow().querySelectorAll(".is-selected")).toHaveLength(0);
  pressMap(kindOf(flow(), "mount"));
  pressMap(hit("mount->marker"), 3, 0);
  expect(
    [...flow().querySelectorAll<HTMLElement>(".is-selected")]
      .map((node) => node.dataset.node)
      .sort(),
  ).toEqual(["marker", "mount"]);
  // 検証: 名前の文字の上を押しても選択は変わらず、名前の文字は選べて種類の行の文字は選べない
  const name = find<HTMLElement>(
    mapNode(flow(), "user"),
    ".mdmark-diagram-node-name",
  );
  pressMap(name);
  name.click();
  expect(mapNode(flow(), "user").classList.contains("is-selected")).toBe(false);
  expect(getComputedStyle(name).userSelect).not.toBe("none");
  expect(getComputedStyle(kindOf(flow(), "user")).userSelect).toBe("none");
  // 実行・検証: Esc で選択が解ける
  flow().dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(flow().querySelectorAll(".is-selected")).toHaveLength(0);
  expect(reset()).toBe(true);
  // 実行・検証: 選んだノードの強調が、案内の強調より優先される
  find<HTMLButtonElement>(flow(), '[data-band="next"]').click();
  pressMap(kindOf(flow(), "index"));
  expect(mapDimmed(mapNode(flow(), "index"))).toBe(false);
  expect(mapDimmed(mapNode(flow(), "user"))).toBe(true);
  find<HTMLButtonElement>(flow(), '[data-tool="reset"]').click();
  expect(flow().querySelectorAll(".is-selected")).toHaveLength(0);
  // 実行: シーケンス図の参加者の種類の行を押す
  kindOf(seq(), "mount").click();
  // 検証: その参加者のメッセージとライフラインのほかが薄くなる
  expect(mapNode(seq(), "mount").classList.contains("is-selected")).toBe(true);
  expect(mapDimmed(find(seq(), '.mdmark-diagram-wire[data-message="0"]'))).toBe(
    false,
  );
  expect(mapDimmed(find(seq(), '.mdmark-diagram-wire[data-message="2"]'))).toBe(
    true,
  );
  expect(
    mapDimmed(find(seq(), '.mdmark-diagram-lifeline[data-lifeline="marker"]')),
  ).toBe(true);
  const seqReset = () =>
    find<HTMLButtonElement>(seq(), '[data-tool="reset"]').disabled;
  expect(seqReset()).toBe(false);
  // 実行・検証: メッセージの線を押すと送り手と受け手が選ばれる
  seq().dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  expect(seqReset()).toBe(true);
  find<SVGPathElement>(seq(), '.map-wire-hit[data-message="1"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
  expect(
    [...seq().querySelectorAll<HTMLElement>(".map-participant.is-selected")]
      .map((node) => node.dataset.participant)
      .sort(),
  ).toEqual(["marker", "mount"]);
  find<HTMLButtonElement>(seq(), '[data-tool="reset"]').click();
  expect(seq().querySelectorAll(".is-selected")).toHaveLength(0);
});

// map のノード・グループ・線を動かす（正常系）
test("test_normal_when_map_items_moved", async () => {
  // 準備
  const { el, figures } = await mountMap(MAP_BOTH);
  await vi.waitFor(() => expect(figures()).toHaveLength(2), {
    timeout: MAP_WAIT_MS,
  });
  const flow = () => figures()[0] as HTMLElement;
  const seq = () => figures()[1] as HTMLElement;
  const box = (id: string) => mapNode(flow(), id).getBoundingClientRect();
  const groupBox = (id: string) =>
    find<HTMLElement>(
      flow(),
      `.map-group[data-group="${id}"]`,
    ).getBoundingClientRect();
  const route = box("route");
  const user = box("user");
  const mount = box("mount");
  const place = groupBox("place");
  // 検証: ドラッグできる場所は grab、名前の文字の上は text
  const kind = find<HTMLElement>(
    mapNode(flow(), "route"),
    ".mdmark-diagram-node-kind",
  );
  expect(getComputedStyle(kind).cursor).toBe("grab");
  expect(
    getComputedStyle(
      find<HTMLElement>(mapNode(flow(), "route"), ".mdmark-diagram-node-name"),
    ).cursor,
  ).toBe("text");
  expect(
    getComputedStyle(
      find<HTMLElement>(
        flow(),
        '.map-group[data-group="place"] .map-group-bar',
      ),
    ).cursor,
  ).toBe("grab");
  // 実行: 2 段目のグループの中のノードを下へ 40px ドラッグする
  pressMap(kind, 0, 40);
  // 検証: ノードだけが動き、グループが広がる
  expect(Math.abs(box("route").top - route.top - 40)).toBeLessThanOrEqual(1);
  expect(Math.abs(box("route").left - route.left)).toBeLessThanOrEqual(1);
  for (const [id, before] of [
    ["user", user],
    ["mount", mount],
  ] as const) {
    expect(Math.abs(box(id).left - before.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(box(id).top - before.top)).toBeLessThanOrEqual(1);
  }
  expect(groupBox("place").height).toBeGreaterThan(place.height);
  // 実行・検証: 4px 未満の動きは押した扱い
  pressMap(
    find<HTMLElement>(mapNode(flow(), "route"), ".mdmark-diagram-node-kind"),
    0,
    3,
  );
  expect(Math.abs(box("route").top - route.top - 40)).toBeLessThanOrEqual(1);
  expect(mapNode(flow(), "route").classList.contains("is-selected")).toBe(true);
  flow().dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  // 実行: グループのタイトルの行を下へ 60px ドラッグする
  const grown = groupBox("place");
  const layoutBefore = box("layout");
  pressMap(
    find<HTMLElement>(flow(), '.map-group[data-group="place"] .map-group-bar'),
    0,
    60,
  );
  // 検証: グループが中身ごと動く
  expect(Math.abs(groupBox("place").top - grown.top - 60)).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(box("layout").top - layoutBefore.top - 60),
  ).toBeLessThanOrEqual(1);
  // 実行: 線の真ん中の区間を動かす
  const hits = [
    ...flow().querySelectorAll<SVGPathElement>(".map-wire-hit[data-wire]"),
  ];
  const points = (path: SVGPathElement) =>
    [...(path.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(
      (match) => [Number(match[1]), Number(match[2])] as [number, number],
    );
  const bent = hits.find((path) => points(path).length >= 4) as SVGPathElement;
  expect(bent).toBeDefined();
  const id = bent.dataset.wire ?? "";
  const before = points(bent);
  const middle = Math.floor((before.length - 2) / 2);
  const a = before[middle] as [number, number];
  const b = before[middle + 1] as [number, number];
  const horizontal = a[1] === b[1];
  const stage = find<HTMLElement>(flow(), ".mdmark-diagram-stage");
  const origin = stage.getBoundingClientRect();
  const at = {
    clientX: origin.left + (a[0] + b[0]) / 2,
    clientY: origin.top + (a[1] + b[1]) / 2,
  };
  bent.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, ...at }));
  // 検証: 区間の上は動かせる向きのポインター
  expect(bent.style.cursor).toBe(horizontal ? "ns-resize" : "ew-resize");
  const base = { bubbles: true, pointerId: 1, button: 0 };
  bent.dispatchEvent(new PointerEvent("pointerdown", { ...base, ...at }));
  const moved = {
    clientX: at.clientX + (horizontal ? 0 : 12),
    clientY: at.clientY + (horizontal ? 12 : 0),
  };
  window.dispatchEvent(new PointerEvent("pointermove", { ...base, ...moved }));
  window.dispatchEvent(new PointerEvent("pointerup", { ...base, ...moved }));
  // 検証: 区間が 12px 動く
  const after = points(
    find<SVGPathElement>(flow(), `.map-wire-hit[data-wire="${id}"]`),
  );
  const axis = horizontal ? 1 : 0;
  expect((after[middle] as [number, number])[axis] - a[axis]).toBe(12);
  // 実行: シーケンス図の 5 人目の参加者を 2 人目の位置へドラッグする
  const order = () =>
    [...seq().querySelectorAll<HTMLElement>(".map-participant")].map(
      (head) => head.dataset.participant,
    );
  expect(order()).toEqual(["user", "mount", "marker", "mermaid", "layout"]);
  const fifth = find<HTMLElement>(
    mapNode(seq(), "layout"),
    ".mdmark-diagram-node-kind",
  );
  const [fromX, fromY] = mapCenter(mapNode(seq(), "layout"));
  const [toX] = mapCenter(mapNode(seq(), "mount"));
  fifth.dispatchEvent(
    new PointerEvent("pointerdown", {
      ...base,
      clientX: fromX,
      clientY: fromY,
    }),
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { ...base, clientX: toX, clientY: fromY }),
  );
  // 検証: 移す先に縦の線が出る
  expect(seq().querySelector(".map-insert-line:not([hidden])")).not.toBeNull();
  window.dispatchEvent(
    new PointerEvent("pointerup", { ...base, clientX: toX, clientY: fromY }),
  );
  fifth.click();
  // 検証: 並び順が変わり、離した直後の押した扱いで選ばない
  expect(order()).toEqual(["user", "layout", "mount", "marker", "mermaid"]);
  expect(seq().querySelector(".is-dragging")).toBeNull();
  expect(seq().querySelectorAll(".is-selected")).toHaveLength(0);
  // 実行・検証: Alt + 左右の矢印でも 1 列ずつ動く
  mapNode(seq(), "layout").dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
    }),
  );
  expect(order()).toEqual(["user", "mount", "layout", "marker", "mermaid"]);
  // 実行・検証: もう一度 mount しても、動かした位置と並び順のまま描かれる
  const kept = box("route");
  await remountMap(el, MAP_BOTH);
  await vi.waitFor(() => expect(figures()).toHaveLength(2), {
    timeout: MAP_WAIT_MS,
  });
  expect(Math.abs(box("route").top - kept.top)).toBeLessThanOrEqual(1);
  expect(order()).toEqual(["user", "mount", "layout", "marker", "mermaid"]);
  // 実行・検証: 「配置と選択を元に戻す」で自動配置に戻る
  find<HTMLButtonElement>(flow(), '[data-tool="reset"]').click();
  expect(Math.abs(box("route").top - route.top)).toBeLessThanOrEqual(1);
});

// map のシーケンス図のブロックを開閉する（正常系）
test("test_normal_when_map_sequence_blocks_toggled", async () => {
  // 準備
  const { figures } = await mountMap(MAP_BOTH);
  await vi.waitFor(() => expect(figures()).toHaveLength(2), {
    timeout: MAP_WAIT_MS,
  });
  const seq = () => figures()[1] as HTMLElement;
  const count = () => seq().querySelector(".map-band-count")?.textContent;
  // 検証: 右上のツールが構成図と同じ並びで、戻るは押せない
  const names = (figure: Element) =>
    [
      ...figure.querySelectorAll<HTMLButtonElement>(
        '.mdmark-diagram-tools-group[data-group="map"] [data-tool]',
      ),
    ].map((tool) => tool.dataset.tool);
  expect(names(seq())).toEqual(names(figures()[0] as HTMLElement));
  expect(find<HTMLButtonElement>(seq(), '[data-tool="back"]').disabled).toBe(
    true,
  );
  expect(count()).toBe("–/7");
  // 実行: alt のタブの山形を押す
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="2"]').click();
  // 検証: 名前とメッセージの数の 1 行になり、帯の数が減る
  const closed = find<HTMLElement>(
    seq(),
    '.map-seq-fragment-tab[data-fragment="2"]',
  );
  expect(closed.textContent).toContain("alt");
  expect(closed.textContent).toContain("mermaid のブロックがある");
  expect(closed.querySelector(".map-seq-fragment-count")?.textContent).toBe(
    "メッセージ 4 件",
  );
  expect(count()).toBe("–/3");
  // 実行・検証: 閉じたブロックの中で始まる活性化の帯が、閉じた行から描かれる
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="0"]').click();
  expect(seq().querySelector(".map-seq-activation")).not.toBeNull();
  find<HTMLButtonElement>(seq(), '[data-tool="expandAll"]').click();
  expect(count()).toBe("–/7");
  // 実行: loop のタブの名前を押す
  find<HTMLButtonElement>(seq(), '[data-fragment-enter="1"]').click();
  // 検証: loop の枠とタブが残り、名前が押せず山形が無く、関わる参加者だけが並ぶ
  const current = find<HTMLElement>(
    seq(),
    '.map-seq-fragment-tab[data-fragment="1"]',
  );
  expect(
    current.querySelector(".map-seq-fragment-title.is-current"),
  ).not.toBeNull();
  expect(current.querySelector("button")).toBeNull();
  expect(
    [...seq().querySelectorAll<HTMLElement>(".map-participant")].map(
      (head) => head.dataset.participant,
    ),
  ).toEqual(["mount", "marker", "mermaid", "layout"]);
  expect(new URLSearchParams(location.search).get("map-2")).toBe("1");
  expect(find<HTMLButtonElement>(seq(), '[data-tool="back"]').disabled).toBe(
    false,
  );
  // 実行・検証: 戻るで全体の図に戻る
  find<HTMLButtonElement>(seq(), '[data-tool="back"]').click();
  expect(seq().querySelectorAll(".map-participant")).toHaveLength(5);
  expect(new URLSearchParams(location.search).has("map-2")).toBe(false);
  // 実行・検証: Shift を押しながら山形を押すと、中のブロックも開閉する
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="1"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true }),
  );
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="1"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true }),
  );
  expect(
    find<HTMLButtonElement>(seq(), '[data-fragment-toggle="2"]').getAttribute(
      "aria-expanded",
    ),
  ).toBe("true");
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="1"]').dispatchEvent(
    new MouseEvent("click", { bubbles: true, shiftKey: true }),
  );
  find<HTMLButtonElement>(seq(), '[data-fragment-toggle="1"]').click();
  expect(
    find<HTMLButtonElement>(seq(), '[data-fragment-toggle="2"]').getAttribute(
      "aria-expanded",
    ),
  ).toBe("false");
});

// map の状態をクエリ文字列に保たない（正常系）
test("test_normal_when_map_url_state_disabled", async () => {
  // 準備
  const config = { map: { ...MAP_CONFIG, url_state: false } };
  const markdown = mapRange({ mermaid: MAP_FLOW, data: MAP_DATA });
  const { el, figures } = await mountMap(markdown, config, {
    search: "?map-1=read",
  });
  const replaceState = vi.spyOn(history, "replaceState");
  // 検証: クエリ文字列を読まずに全体の図から描く
  expect(
    (figures()[0] as HTMLElement).querySelector(".map-group-title.is-current"),
  ).toBeNull();
  // 実行: 「配置」のタイトルを押す
  find<HTMLButtonElement>(
    figures()[0] as HTMLElement,
    '[data-group-enter="place"]',
  ).click();
  // 検証: クエリ文字列を変えない
  expect(location.search).toBe("?map-1=read");
  expect(replaceState).not.toHaveBeenCalled();
  // 実行・検証: もう一度 mount すると、sessionStorage の状態で描く
  await remountMap(el, markdown, config);
  expect(
    (figures()[0] as HTMLElement).querySelector(".map-group-title.is-current")
      ?.textContent,
  ).toBe("配置");
  clearMapQuery();
});

// map の印の引数で最初の見せ方を決める（正常系）
test("test_normal_when_map_args", async () => {
  // 準備: シーケンス図は 2 画面目より下
  const filler = Array.from({ length: 120 }, (_, i) => `段落 ${i + 1}`).join(
    "\n\n",
  );
  const markdown = [
    mapRange({
      args: '{"title": "全体の構成", "focus": "read", "collapse": {"open": false}}',
      mermaid: MAP_FLOW,
      data: MAP_DATA,
    }),
    filler,
    mapRange({
      args: '{"play": "autoplay", "interval": 1}',
      mermaid: MAP_SEQUENCE,
      data: '{"version": 1, "plays_over": 1}',
    }),
  ].join("\n\n");
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  try {
    const { el, figures } = await mountMap(markdown);
    await vi.waitFor(() => expect(figures()).toHaveLength(2), {
      timeout: MAP_WAIT_MS,
    });
    const seq = () => figures()[1] as HTMLElement;
    const count = () => seq().querySelector(".map-band-count")?.textContent;
    // 検証: 構成図が閉じた折りたたみに入り、開くと read の中へ入った図
    const details = find<HTMLDetailsElement>(el, "details.map-collapse");
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("全体の構成");
    details.open = true;
    const flow = figures()[0] as HTMLElement;
    expect(flow.querySelector(".map-group-title.is-current")?.textContent).toBe(
      "記法の読み取り",
    );
    expect(find<HTMLButtonElement>(flow, '[data-tool="back"]').disabled).toBe(
      false,
    );
    // 検証: 画面に入るまで再生が始まらない
    expect(count()).toBe("–/7");
    // 実行: シーケンス図を画面に入れる
    seq().scrollIntoView();
    // 検証: 押さずに再生が始まり、1 秒ごとに次のメッセージへ進む
    await vi.waitFor(() => expect(count()).toBe("1/7"));
    vi.advanceTimersByTime(1000);
    expect(count()).toBe("2/7");
    // 実行・検証: 別のグループの中へ入ってから、もう一度 mount すると保ったグループの中から描く
    find<HTMLButtonElement>(flow, '[data-tool="back"]').click();
    find<HTMLButtonElement>(flow, '[data-tool="back"]').click();
    find<HTMLButtonElement>(
      figures()[0] as HTMLElement,
      '[data-group-enter="store"]',
    ).click();
    await remountMap(el, markdown);
    expect(el.querySelector(".map-group-title.is-current")?.textContent).toBe(
      "データ",
    );
    // 実行・検証: クエリ文字列の map-1 は sessionStorage より優先する
    history.replaceState(null, "", `${location.pathname}?map-1=place`);
    await remountMap(el, markdown);
    expect(el.querySelector(".map-group-title.is-current")?.textContent).toBe(
      "配置",
    );
    clearMapQuery();
    // 実行: 動きを減らす設定で、画面に入ったシーケンス図を描き直す
    const originalMatchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
      query === "(prefers-reduced-motion: reduce)"
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          } satisfies MediaQueryList)
        : originalMatchMedia(query),
    );
    await remountMap(el, markdown);
    await vi.waitFor(() => expect(figures()).toHaveLength(2), {
      timeout: MAP_WAIT_MS,
    });
    seq().scrollIntoView();
    await new Promise<void>((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(seq());
    });
    vi.advanceTimersByTime(1000);
    // 検証: 自動で始めず、止めた帯のまま。再生を押すとデータの印が流れる
    expect(count()).toBe("–/7");
    find<HTMLButtonElement>(seq(), '[data-band="auto"]').click();
    expect(seq().querySelectorAll(".map-packet").length).toBeGreaterThan(0);
    find<HTMLButtonElement>(seq(), '[data-band="stop"]').click();
  } finally {
    vi.useRealTimers();
  }
});

// map の機能を解除する（正常系）
test("test_normal_when_map_disabled", async () => {
  // 準備・実行
  const el = createElement();
  await mountTracked(el, {
    markdown: `<!-- features: {"map": false} -->\n\n${mapRange({ mermaid: MAP_FLOW, data: MAP_DATA })}`,
    config: { features: { mermaid: false } },
  });
  // 検証
  expect(
    el.querySelector('figure.mdmark-diagram[data-diagram="map"]'),
  ).toBeNull();
  expect(el.textContent).not.toContain("map-data");
  expect(el.textContent).not.toContain('"version"');
  expect(el.querySelector(".mdmark-syntax-warning")).toBeNull();
  expect(el.querySelector("code.language-mermaid")).not.toBeNull();
});

// map の設定に無いクラスと線の名前（正常系）
test("test_normal_when_map_config_names_missing", async () => {
  // 準備
  const mermaid = MAP_FLOW.replace(
    'frame["図の枠"]:::step',
    'frame["図の枠"]:::queue',
  );
  const data = JSON.stringify({
    version: 1,
    layout: { "layout->route": { line: "back2" } },
  });
  // 実行
  const { el, figures } = await mountMap(mapRange({ mermaid, data }));
  const figure = figures()[0] as HTMLElement;
  // 検証
  const warnings = el.querySelectorAll(".mdmark-syntax-warning");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.textContent).toContain("queue");
  expect(warnings[0]?.textContent).toContain("map.kinds");
  expect(warnings[0]?.textContent).toContain("back2");
  expect(warnings[0]?.textContent).toContain("map.lines");
  const queue = find<HTMLElement>(figure, '[data-node="frame"]');
  expect(
    find<HTMLElement>(queue, ".mdmark-diagram-node-kind").classList.contains(
      "is-empty",
    ),
  ).toBe(true);
  expect(queue.dataset.shape).toBe("rounded");
  const back = find<SVGPathElement>(
    figure,
    '.mdmark-diagram-wire[data-wire="layout->route"]',
  );
  expect(back.getAttribute("stroke-dasharray")).toBeNull();
  expect(back.getAttribute("stroke-width")).toBe("1.5");
});

// map の線と配置の上書き（正常系）
test("test_normal_when_map_overrides", async () => {
  // 準備
  const data = JSON.stringify({
    version: 1,
    layout: {
      "layout->route": {
        ends: { from: { side: "right" }, to: { side: "right" } },
      },
      "mount->marker": { via: [{ x: 0, y: 0 }] },
      store: { collapsed: true },
    },
  });
  // 実行
  const { figures } = await mountMap(mapRange({ mermaid: MAP_FLOW, data }));
  const figure = figures()[0] as HTMLElement;
  // 検証: 最初に閉じる
  expect(
    figure.querySelector('.map-closed-group[data-group="store"]'),
  ).not.toBeNull();
  // 検証: ends の線は元のノードの右の辺から出て、先のノードの右の辺に入る
  const stage = find<HTMLElement>(figure, ".mdmark-diagram-stage");
  const rectOf = (id: string) => {
    const node = find<HTMLElement>(stage, `[data-node="${id}"]`);
    return {
      x: node.offsetLeft,
      y: node.offsetTop,
      w: node.offsetWidth,
      h: node.offsetHeight,
    };
  };
  const numbers = (id: string) =>
    (
      find<SVGPathElement>(stage, `.map-wire-hit[data-wire="${id}"]`)
        .getAttribute("d")
        ?.match(/-?[\d.]+/g) ?? []
    ).map(Number);
  const ends = numbers("layout->route");
  const from = rectOf("layout");
  const to = rectOf("route");
  expect(ends[0]).toBeCloseTo(from.x + from.w, 0);
  expect(ends.at(-2)).toBeCloseTo(to.x + to.w, 0);
  // 検証: ノード・グループが重ならない
  const nodes = [
    ...stage.querySelectorAll<HTMLElement>(":scope > .mdmark-diagram-node"),
  ];
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      expect(
        mapOverlaps(a.getBoundingClientRect(), b.getBoundingClientRect()),
      ).toBe(false);
    }
  }
});

// map の書き方の警告を描く（正常系）
test("test_normal_when_map_warnings", async () => {
  // 準備
  const mermaid =
    "flowchart LR\n  A --> B\n  A -> B\n  subgraph g [グループ]\n    C\n";
  // 実行
  const { el, figures } = await mountMap(
    mapRange({
      args: '{"title": "全体", "mdoe": 1}',
      mermaid,
      data: '{"version": 1, "layuot": {}}',
    }),
  );
  // 検証
  const warnings = el.querySelectorAll(".mdmark-syntax-warning");
  expect(warnings).toHaveLength(1);
  const text = warnings[0]?.textContent ?? "";
  expect(text).toContain("A -> B");
  expect(text).toContain("-->");
  expect(text).toContain("layuot");
  expect(text).not.toContain("mdoe");
  const figure = figures()[0] as HTMLElement;
  expect(figure.querySelector('[data-node="A"]')).not.toBeNull();
  expect(figure.querySelector('[data-node="B"]')).not.toBeNull();
});

// map のノードの名前とシーケンス図の文に用語の下線を付ける（正常系（map の用語の下線））
test("test_normal_when_map_terms", async () => {
  // 準備
  sessionStorage.clear();
  clearMapQuery();
  const el = createElement();
  el.style.width = "1200px";
  const sequence = `${MAP_SEQUENCE.replace(
    "mount->>marker: map の範囲",
    "mount->>marker: 補足を読む",
  )}  ghost->>mount: 外からの呼び出し\n`;
  const data = MAP_DATA.replace(
    "内側のグループから配置し、グループの大きさを決めてから外側を配置する",
    "補足の上書きを当てて、内側のグループから配置する",
  );
  const markdown = `${mapRange({ mermaid: MAP_FLOW, data })}\n${mapRange({ mermaid: sequence, data: '{"version": 1, "plays_over": 1, "notes": {"2": {"text": "補足を渡す"}}}' })}`;
  // 実行
  await mountTracked(el, {
    markdown,
    config: { map: MAP_CONFIG } as Parameters<Built["mount"]>[1]["config"],
    index: {
      schema: 2,
      docs: [],
      terms: [
        { id: "data", term: "補足", meaning: "map の範囲の上書きと説明" },
      ],
    },
  });
  await vi.waitFor(
    () =>
      expect(
        el.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
      ).toHaveLength(2),
    { timeout: MAP_WAIT_MS },
  );
  const [flow, seq] = [
    ...el.querySelectorAll<HTMLElement>(
      'figure.mdmark-diagram[data-diagram="map"]',
    ),
  ] as [HTMLElement, HTMLElement];
  // 検証: ノードの名前の中の用語
  const name = find<HTMLElement>(
    mapNode(flow, "data"),
    ".mdmark-diagram-node-name",
  );
  const term = find<HTMLElement>(name, ".mdmark-term");
  expect(term.textContent).toBe("補足");
  expect(name.textContent).toBe("補足の検査");
  // 検証: 用語にフォーカスすると、図の枠のツールチップに意味が出る
  term.focus();
  await vi.waitFor(() =>
    expect(
      [...flow.querySelectorAll<HTMLElement>(".mdmark-diagram-tip")].some(
        (tip) =>
          !tip.hidden && tip.textContent?.includes("map の範囲の上書きと説明"),
      ),
    ).toBe(true),
  );
  term.blur();
  // 検証: ノードの説明のマーカーにフォーカスすると、説明のツールチップが出る
  find<HTMLElement>(mapNode(flow, "layout"), ".mdmark-diagram-info").focus();
  await vi.waitFor(() =>
    expect(
      [...flow.querySelectorAll<HTMLElement>(".mdmark-diagram-tip")].some(
        (tip) =>
          !tip.hidden &&
          tip.textContent?.includes("内側のグループから配置する"),
      ),
    ).toBe(true),
  );
  // 検証: 説明の中の用語は、フォーカスを持たない下線と、末尾の意味の行
  const noteTip = [
    ...flow.querySelectorAll<HTMLElement>(".mdmark-diagram-tip"),
  ].find((tip) => tip.dataset.tipFor === "node:layout") as HTMLElement;
  const plain = find<HTMLElement>(noteTip, ".mdmark-term");
  expect(plain.textContent).toBe("補足");
  expect(plain.hasAttribute("tabindex")).toBe(false);
  expect(noteTip.textContent).toContain("補足：map の範囲の上書きと説明");
  // 検証: シーケンス図のメッセージの文の中の用語
  expect(
    find<HTMLElement>(
      seq,
      '.mdmark-diagram-label[data-message="1"]',
    ).querySelector(".mdmark-term")?.textContent,
  ).toBe("補足");
  // 検証: 説明を持つメッセージの線の押せる帯にポインターを当てると、説明のツールチップが出る
  const hit = find<SVGPathElement>(seq, '.map-wire-hit[data-message="1"]');
  expect(
    seq
      .querySelector('.map-wire-hit[data-message="0"]')
      ?.hasAttribute("data-tip-owner"),
  ).toBe(false);
  hit.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  hit.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
  // 検証: その線と送り手・受け手のほかが薄くなる
  expect(mapDimmed(mapNode(seq, "mount"))).toBe(false);
  expect(mapDimmed(mapNode(seq, "marker"))).toBe(false);
  expect(mapDimmed(mapNode(seq, "user"))).toBe(true);
  expect(mapDimmed(find(seq, '.mdmark-diagram-wire[data-message="0"]'))).toBe(
    true,
  );
  await vi.waitFor(() => {
    const shown = [
      ...seq.querySelectorAll<HTMLElement>(".mdmark-diagram-tip"),
    ].find((tip) => !tip.hidden && tip.textContent?.includes("を渡す"));
    expect(shown).toBeDefined();
    expect(shown?.querySelector(".mdmark-term")?.hasAttribute("tabindex")).toBe(
      false,
    );
    expect(shown?.textContent).toContain("補足：map の範囲の上書きと説明");
  });
  hit.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
  hit.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  expect(seq.querySelectorAll(".map-dim")).toHaveLength(0);
  // 検証: 閉じたグループのノードの数
  find<HTMLButtonElement>(flow, '[data-group-toggle="read"]').click();
  expect(
    find<HTMLElement>(el, '.map-closed-group[data-group="read"]').textContent,
  ).toContain("ノード 3 件");
  // 検証: 構成図に無い再生の相手を書き方の警告にし、そのメッセージでは構成図を強調しない
  expect(
    [...el.querySelectorAll(".mdmark-syntax-warning")].some((warning) =>
      warning.textContent?.includes("ghost"),
    ),
  ).toBe(true);
  find<HTMLButtonElement>(seq, '[data-band="prev"]').click();
  expect(seq.querySelector(".map-band-title")?.textContent).toBe(
    "外からの呼び出し",
  );
  expect(flow.querySelectorAll(".map-dim")).toHaveLength(0);
  find<HTMLButtonElement>(seq, '[data-band="stop"]').click();
  // 検証: グループのタイトルのボタンには付けない
  expect(flow.querySelector(".map-group-title .mdmark-term")).toBeNull();
});

/** 全角の文字を `count` 文字並べる */
function fullWidth(count: number): string {
  return "あ".repeat(count);
}

/** 列の幅を中身から決める確認の 6 列 3 行の表（`No`・`状態`・`更新日`・`名前`・`手順`・`説明`）の Markdown（`mark` は表のマーカーの中身） */
function contentTableMarkdown(mark = '{"kind": "data"}'): string {
  return [
    `<!-- table: ${mark} -->`,
    "",
    "| No | 状態 | 更新日 | 名前 | 手順 | 説明 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[1, 2, 3].map(
      (no) =>
        `| ${no} | \`badge:対応中\` | 2026-11-0${no} | ${fullWidth(6)} | ${fullWidth(10)}<br>${fullWidth(8)}<br>${fullWidth(6)} | ${fullWidth(120)} |`,
    ),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 列名と行ごとのセルの文字から、表のマーカーで囲んだ表の Markdown を作る */
function markedTableMarkdown(
  mark: string,
  columns: string[],
  rows: string[][],
): string {
  return [
    `<!-- table: ${mark} -->`,
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 名前・説明（全角 120 文字）・備考（全角 80 文字）の 3 列 3 行の表の Markdown */
const LONG_NOTE_TABLE_MARKDOWN = markedTableMarkdown(
  '{"kind": "data"}',
  ["名前", "説明", "備考"],
  [1, 2, 3].map((no) => [`名前${no}`, fullWidth(120), fullWidth(80)]),
);

/** 本文の段落と表を描き、全ての表に自動の列の幅が入るまで待って、表の囲みを返却する */
async function mountAutoTables(
  el: HTMLElement,
  markdown: string,
  config: Record<string, unknown> = {},
): Promise<HTMLElement[]> {
  await mountTracked(el, {
    markdown: `本文の段落。\n\n${markdown}`,
    config: { features: { "side-toc": false }, ...config },
  });
  const wrappers = [...el.querySelectorAll<HTMLElement>(".mdmark-table")];
  await vi.waitFor(() => {
    for (const wrapper of wrappers) {
      expect(find(wrapper, "table").hasAttribute("data-auto-width")).toBe(true);
    }
  });
  return wrappers;
}

/** 本文の段落の幅 */
function bodyWidth(el: HTMLElement): number {
  return find<HTMLElement>(el, "p").getBoundingClientRect().width;
}

/** 表の左右の枠線を除いた幅 */
function innerTableWidth(wrapper: HTMLElement): number {
  const table = find<HTMLElement>(wrapper, "table");
  const style = getComputedStyle(table);
  return (
    table.getBoundingClientRect().width -
    Number.parseFloat(style.borderLeftWidth) -
    Number.parseFloat(style.borderRightWidth)
  );
}

/** 最下段の見出しのセルを左から並べて返却する */
function headCellsOf(wrapper: HTMLElement): HTMLElement[] {
  return [...wrapper.querySelectorAll<HTMLElement>("thead th")];
}

/** セルの中に文字を折り返さずに置いたときの幅に、余白と罫線と 2px を足して切り上げた幅（列の最も長い行の幅） */
function lineWidthIn(cell: HTMLElement, text: string): number {
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap";
  probe.textContent = text;
  cell.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  const style = getComputedStyle(cell);
  return Math.ceil(
    width +
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth) +
      2,
  );
}

/** 見出しのセルの文字の大きさ（px）に `em` を掛けた幅 */
function emWidth(head: HTMLElement, em: number): number {
  return Number.parseFloat(getComputedStyle(head).fontSize) * em;
}

/** ページが横にはみ出していないことを確認する */
function expectNoPageOverflow(): void {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    document.documentElement.clientWidth,
  );
}

// 列ごとに最も長い行の幅を測り、長文でない列を最も長い行の幅で、長文の説明の列を残りの幅で折り返して描く（正常系（列の幅を中身から決める））
test("test_normal_when_column_widths_fit_content", async () => {
  await withViewport(1280, async () => {
    // 準備・実行
    const el = createElement();
    const [wrapper] = (await mountAutoTables(el, contentTableMarkdown())) as [
      HTMLElement,
    ];
    // 検証: No・状態・更新日・名前の列は 1 行
    for (const column of [0, 1, 2, 3]) {
      for (const cell of columnCells(wrapper, column)) {
        expect(textLineCount(cell)).toBe(1);
      }
    }
    // 検証: 手順の列の幅は 3 行のうち最も長い行の幅
    const heads = headCellsOf(wrapper);
    const step = columnCells(wrapper, 4)[1] as HTMLElement;
    expect(
      Math.abs(
        (heads[4]?.getBoundingClientRect().width ?? 0) -
          lineWidthIn(step, fullWidth(10)),
      ),
    ).toBeLessThanOrEqual(1);
    // 検証: 説明の列は折り返し、45em 以上
    const note = columnCells(wrapper, 5)[1] as HTMLElement;
    expect(textLineCount(note)).toBeGreaterThan(1);
    expect(heads[5]?.getBoundingClientRect().width ?? 0).toBeGreaterThanOrEqual(
      emWidth(heads[5] as HTMLElement, 45) - 1,
    );
    // 検証: 表は本文の幅に広がり、横にスクロールしない
    const body = bodyWidth(el);
    expect(
      Math.abs(wrapper.getBoundingClientRect().width - body),
    ).toBeLessThanOrEqual(1);
    const table = find<HTMLElement>(wrapper, "table").getBoundingClientRect();
    expect(body - table.width).toBeGreaterThanOrEqual(0);
    expect(body - table.width).toBeLessThanOrEqual(heads.length);
    const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
    expectNoPageOverflow();
  });
});

// 1 行で収まる長文の列は折り返さず、本文の幅まで広げずに列の幅の合計で描く（正常系（長文の列が折り返さずに収まる））
test("test_normal_when_long_column_fits", async () => {
  await withViewport(1280, async () => {
    // 準備・実行
    const el = createElement();
    el.style.width = "1000px";
    const [wrapper] = (await mountAutoTables(
      el,
      markedTableMarkdown(
        '{"kind": "data"}',
        ["名前", "説明"],
        [20, 22, 24].map((count, index) => [
          `名前${index + 1}あ`,
          fullWidth(count),
        ]),
      ),
    )) as [HTMLElement];
    // 検証
    for (const cell of columnCells(wrapper, 1).slice(1)) {
      expect(textLineCount(cell)).toBe(1);
    }
    const sum = headCellsOf(wrapper).reduce(
      (total, head) => total + head.getBoundingClientRect().width,
      0,
    );
    expect(innerTableWidth(wrapper)).toBeLessThan(bodyWidth(el));
    expect(Math.abs(innerTableWidth(wrapper) - sum)).toBeLessThanOrEqual(1);
  });
});

// 長文の列が 2 つあるとき、最小の幅を下回る備考の列を最も長い行の幅で止め、残りの幅を説明の列へ分ける（正常系（長文の列が 2 つある））
test("test_normal_when_two_long_columns", async () => {
  await withViewport(1280, async () => {
    // 準備・実行
    const el = createElement();
    const notes = [fullWidth(20), fullWidth(24)];
    const [wrapper] = (await mountAutoTables(
      el,
      markedTableMarkdown(
        '{"kind": "data"}',
        ["名前", "説明", "備考"],
        notes.map((note) => ["あいう", fullWidth(120), note]),
      ),
    )) as [HTMLElement];
    // 検証: 備考の列は最も長い行の幅で 1 行
    const heads = headCellsOf(wrapper);
    const noteCells = columnCells(wrapper, 2).slice(1);
    expect(
      Math.abs(
        (heads[2]?.getBoundingClientRect().width ?? 0) -
          lineWidthIn(noteCells[1] as HTMLElement, fullWidth(24)),
      ),
    ).toBeLessThanOrEqual(1);
    for (const cell of noteCells) {
      expect(textLineCount(cell)).toBe(1);
    }
    // 検証: 説明の列が残りの幅を使い、表が本文の幅に広がる
    const body = bodyWidth(el);
    const table = find<HTMLElement>(wrapper, "table").getBoundingClientRect();
    expect(body - table.width).toBeGreaterThanOrEqual(0);
    expect(body - table.width).toBeLessThanOrEqual(heads.length);
    const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
    expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
  });
});

// 列の少ない表は、マーカーの有無によらず本文の幅まで広げず列の幅の合計で描く（正常系（余白の多い表を中身の幅で描く））
test("test_normal_when_table_fits_content", async () => {
  await withViewport(1280, async () => {
    // 準備・実行
    const el = createElement();
    el.style.width = "1000px";
    const rows = [
      ["りんご", "3"],
      ["みかん", "5"],
      ["ぶどう", "2"],
    ];
    const plain = [
      "| 名前 | 数量 |",
      "| --- | --- |",
      ...rows.map((row) => `| ${row.join(" | ")} |`),
      "",
    ].join("\n");
    const wrappers = await mountAutoTables(
      el,
      `${markedTableMarkdown('{"kind": "data"}', ["名前", "数量"], rows)}\n${plain}`,
    );
    // 検証
    expect(wrappers).toHaveLength(2);
    for (const wrapper of wrappers) {
      const sum = headCellsOf(wrapper).reduce(
        (total, head) => total + head.getBoundingClientRect().width,
        0,
      );
      expect(innerTableWidth(wrapper)).toBeLessThan(bodyWidth(el));
      expect(Math.abs(innerTableWidth(wrapper) - sum)).toBeLessThanOrEqual(1);
      for (const column of [0, 1]) {
        for (const cell of columnCells(wrapper, column)) {
          expect(textLineCount(cell)).toBe(1);
        }
      }
      const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
      expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
    }
  });
});

// 狭い幅では長文の列を最小の幅で折り返し、全ての列の最小の幅の合計が見える幅を超える表は表の中で横にスクロールする（正常系（狭い幅で横にスクロールする））
test("test_normal_when_table_scrolls_in_narrow_width", async () => {
  await withViewport(390, async () => {
    // 準備・実行
    const el = createElement();
    const many = Array.from({ length: 12 }, (_, i) => `列${i + 1}`);
    const [first, second] = (await mountAutoTables(
      el,
      `${LONG_NOTE_TABLE_MARKDOWN}\n${dataTableMarkdown(many)}`,
    )) as [HTMLElement, HTMLElement];
    // 検証: 説明・備考の列は 45em で折り返す
    const heads = headCellsOf(first);
    for (const column of [1, 2]) {
      const head = heads[column] as HTMLElement;
      expect(
        Math.abs(head.getBoundingClientRect().width - emWidth(head, 45)),
      ).toBeLessThanOrEqual(1);
      expect(
        textLineCount(columnCells(first, column)[1] as HTMLElement),
      ).toBeGreaterThan(1);
    }
    // 検証: 2 つの表とも本文の幅で、表の中で横にスクロールする
    for (const wrapper of [first, second]) {
      expect(
        Math.abs(wrapper.getBoundingClientRect().width - bodyWidth(el)),
      ).toBeLessThanOrEqual(1);
      const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
      expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    }
    // 検証: 12 列の表の各列は、その列の最も長い行の幅以上
    headCellsOf(second).forEach((head, column) => {
      const cells = columnCells(second, column);
      const longest = Math.max(
        ...cells
          .slice(1)
          .map((cell) => lineWidthIn(cell, cell.textContent ?? "")),
      );
      expect(head.getBoundingClientRect().width).toBeGreaterThanOrEqual(
        longest - 1,
      );
    });
    expectNoPageOverflow();
  });
});

// 列の幅の範囲と width.mode: nowrap を、自動の判定より優先する（正常系（列の幅の範囲を指定する））
test("test_normal_when_column_width_range_specified", async () => {
  await withViewport(1280, async () => {
    // 準備・実行
    const el = createElement();
    el.style.width = "1000px";
    const [wrapper] = (await mountAutoTables(
      el,
      markedTableMarkdown(
        '{"kind": "data", "columns": {"説明": {"width": {"min": 20, "max": 30}}, "名前": {"width": {"mode": "nowrap"}}}}',
        ["名前", "説明", "備考"],
        [1, 2, 3].map(() => [fullWidth(30), fullWidth(200), fullWidth(4)]),
      ),
    )) as [HTMLElement];
    // 検証
    const head = headCellsOf(wrapper)[1] as HTMLElement;
    const width = head.getBoundingClientRect().width;
    expect(width).toBeGreaterThanOrEqual(emWidth(head, 20) - 1);
    expect(width).toBeLessThanOrEqual(emWidth(head, 30) + 1);
    expect(
      textLineCount(columnCells(wrapper, 1)[1] as HTMLElement),
    ).toBeGreaterThan(1);
    expect(textLineCount(columnCells(wrapper, 0)[1] as HTMLElement)).toBe(1);
    expect(textLineCount(columnCells(wrapper, 2)[1] as HTMLElement)).toBe(1);
  });
});

// 並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、表の見える幅が変わったらつまみで変えていない列の幅を決め直す（正常系（表の見える幅が変わったら列の幅を決め直す））
test("test_normal_when_column_widths_recalculated_on_resize", async () => {
  await withViewport(1280, async () => {
    // 準備
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
      () => {},
    );
    const el = createElement();
    el.style.width = "1280px";
    const [wrapper] = (await mountAutoTables(
      el,
      contentTableMarkdown(
        '{"kind": "data", "features": {"columns": {}}, "columns": {"状態": {"filter": {}}}}',
      ),
    )) as [HTMLElement];
    const heads = headCellsOf(wrapper);
    const widths = () =>
      heads.map((head) => head.getBoundingClientRect().width);
    const expectSame = (actual: number[], expected: number[]) => {
      actual.forEach((width, index) => {
        expect(Math.abs(width - (expected[index] ?? 0))).toBeLessThanOrEqual(1);
      });
    };
    const before = widths();
    // 実行: 名前の列で並べ替え、状態の列で絞り込む
    find<HTMLButtonElement>(heads[3] as HTMLElement, ".mdmark-sort").click();
    find<HTMLButtonElement>(heads[1] as HTMLElement, ".mdmark-filter").click();
    const drawer = find<HTMLElement>(
      wrapper,
      ".mdmark-filter-drawer:not([hidden])",
    );
    find<HTMLInputElement>(drawer, 'input[type="checkbox"]').click();
    await nextFrames();
    // 検証: 列の幅は変わらない
    expectSame(widths(), before);
    // 実行: 手順の列を隠す
    find<HTMLButtonElement>(
      wrapper,
      '.mdmark-table-settings-item[data-column="4"] button.mdmark-table-settings-eye',
    ).click();
    await nextFrames();
    // 検証: 残った列の幅は変わらない
    expect(heads[4]?.hidden).toBe(true);
    const shown = [0, 1, 2, 3, 5];
    expectSame(
      shown.map((column) => widths()[column] ?? 0),
      shown.map((column) => before[column] ?? 0),
    );
    // 実行: 名前の列のつまみを右へ 40px ドラッグする
    const handle = find<HTMLElement>(
      heads[3] as HTMLElement,
      ":scope > .mdmark-col-resize",
    );
    dragResizeHandle(handle, 40);
    const dragged = heads[3]?.getBoundingClientRect().width ?? 0;
    // 実行: 描く先の幅を 900px にする
    el.style.width = "900px";
    // 検証: 説明の列は 45em に狭まり、表の中で横にスクロールし、短い列は 1 行のまま
    const note = heads[5] as HTMLElement;
    await vi.waitFor(() => {
      expect(
        Math.abs(note.getBoundingClientRect().width - emWidth(note, 45)),
      ).toBeLessThanOrEqual(1);
    });
    const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    for (const column of [0, 1, 2]) {
      for (const cell of columnCells(wrapper, column).slice(1)) {
        expect(textLineCount(cell)).toBe(1);
      }
    }
    // 検証: つまみで変えた名前の列の幅は変わらない
    expect(
      Math.abs((heads[3]?.getBoundingClientRect().width ?? 0) - dragged),
    ).toBeLessThanOrEqual(1);
    expectNoPageOverflow();
  });
});

// 設定の table.long_column_min で長文の列の最小の幅を変え、数でない値は既定の 45em にする（正常系（長文の列の最小の幅を設定で変える））
test("test_normal_when_long_column_min_configured", async () => {
  await withViewport(390, async () => {
    for (const [value, em] of [
      [30, 30],
      ["wide", 45],
    ] as const) {
      // 準備・実行
      const el = createElement();
      const [wrapper] = (await mountAutoTables(el, LONG_NOTE_TABLE_MARKDOWN, {
        table: { long_column_min: value },
      })) as [HTMLElement];
      // 検証
      const heads = headCellsOf(wrapper);
      for (const column of [1, 2]) {
        const head = heads[column] as HTMLElement;
        expect(
          Math.abs(head.getBoundingClientRect().width - emWidth(head, em)),
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});

// 狭い幅でも最終列を畳まず、表の中で横にスクロールして全ての列を出す（正常系（狭い幅でも最終列を畳まない））
test("test_normal_when_last_column_not_collapsed", async () => {
  await withViewport(390, async () => {
    // 準備・実行
    const el = createElement();
    const [wrapper] = (await mountAutoTables(el, FOLD_TABLE_MARKDOWN)) as [
      HTMLElement,
    ];
    // 検証: 3 列の見出しとセルが表示され、行に開閉のボタンが無い
    for (const column of [0, 1, 2]) {
      for (const cell of columnCells(wrapper, column)) {
        expect(isShown(cell)).toBe(true);
      }
    }
    expect(wrapper.querySelectorAll("tbody button")).toHaveLength(0);
    // 検証: 表は本文の幅で、横にスクロールすると説明の列が見える
    expect(
      Math.abs(wrapper.getBoundingClientRect().width - bodyWidth(el)),
    ).toBeLessThanOrEqual(1);
    const scroller = find<HTMLElement>(wrapper, ".mdmark-table-scroll");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    scroller.scrollLeft = scroller.scrollWidth;
    await nextFrames();
    const note = columnCells(wrapper, 2)[1] as HTMLElement;
    const view = scroller.getBoundingClientRect();
    const rect = note.getBoundingClientRect();
    expect(rect.left).toBeLessThan(view.right);
    expect(rect.right).toBeGreaterThan(view.left);
    expectNoPageOverflow();
    // 検証: 印刷の媒体でも行に開閉のボタンが無い
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    try {
      expect(wrapper.querySelectorAll("tbody button")).toHaveLength(0);
      expect(isShown(columnCells(wrapper, 2)[1])).toBe(true);
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", {
        media: "",
        features: [],
      });
    }
  });
});

// 狭い幅でも最終列を畳まず、行の詳細を持つ行にだけ開閉のボタンを配置し、行の詳細だけを開閉する（正常系（狭い幅の行の詳細））
test("test_normal_when_row_detail_in_narrow_width", async () => {
  await withViewport(390, async () => {
    // 準備・実行
    const el = createElement();
    const [wrapper] = (await mountAutoTables(
      el,
      [
        FOLD_TABLE_MARKDOWN,
        '<!-- row-detail: {"at": 2} -->',
        "",
        "行の詳細の段落",
        "",
        "<!-- /row-detail -->",
        "",
      ].join("\n"),
    )) as [HTMLElement];
    // 検証: 説明の列が表示され、開閉のボタンは 2 行目に 1 つだけ
    for (const cell of columnCells(wrapper, 2)) {
      expect(isShown(cell)).toBe(true);
    }
    const toggles = [
      ...wrapper.querySelectorAll<HTMLButtonElement>("tbody button"),
    ];
    expect(toggles).toHaveLength(1);
    const toggle = toggles[0] as HTMLButtonElement;
    const rows = [
      ...wrapper.querySelectorAll<HTMLTableRowElement>(
        "tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
      ),
    ];
    expect(rows[1]?.contains(toggle)).toBe(true);
    // 実行・検証: 開く
    toggle.click();
    const detail = rows[1]?.nextElementSibling as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(detail.classList.contains("mdmark-row-detail")).toBe(true);
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain("行の詳細の段落");
    expect(detail.textContent).not.toContain("印刷で折り畳みを開き");
    // 実行・検証: 閉じる
    toggle.click();
    expect(detail.hidden).toBe(true);
  });
});

/** 帯と、帯の直後の `pre` と、言語のラベルの計算値 */
function codeBarStyles(bar: HTMLElement): {
  bar: CSSStyleDeclaration;
  pre: CSSStyleDeclaration;
  lang: HTMLElement;
} {
  const pre = bar.nextElementSibling as HTMLElement;
  return {
    bar: getComputedStyle(bar),
    pre: getComputedStyle(pre),
    lang: find<HTMLElement>(bar, ".mdmark-code-lang"),
  };
}

// コードブロックの帯を本文と同じ地にし、帯と本文の間に線を出さず、言語のラベルを帯の上端に接した塗りのタブにする（正常系（コードブロックの帯と本文の間に線を出さない））
test("test_normal_when_code_bar_without_divider", async () => {
  const markdown = [
    "```ts",
    "const a = 1;",
    "```",
    "",
    '<!-- code: {"title": "設定 例.ts"} -->',
    "",
    "```ts",
    "const b = 2;",
    "```",
    "",
  ].join("\n");
  for (const colorScheme of ["light", "dark"]) {
    // 準備・実行
    const el = createElement();
    await mountTracked(el, { markdown, config: { colorScheme } });
    const bars = [...el.querySelectorAll<HTMLElement>(".mdmark-code-bar")];
    expect(bars).toHaveLength(2);
    for (const element of bars) {
      // 検証
      const { bar, pre, lang } = codeBarStyles(element);
      expect(pre.borderTopWidth).toBe("0px");
      expect(bar.borderBottomWidth).toBe("0px");
      expect(bar.backgroundColor).toBe(pre.backgroundColor);
      expect(Number.parseFloat(bar.borderTopWidth)).toBeGreaterThanOrEqual(1);
      expect(Number.parseFloat(bar.borderLeftWidth)).toBeGreaterThanOrEqual(1);
      expect(Number.parseFloat(bar.borderRightWidth)).toBeGreaterThanOrEqual(1);
      expect(Number.parseFloat(pre.borderBottomWidth)).toBeGreaterThanOrEqual(
        1,
      );
      expect(Number.parseFloat(pre.borderLeftWidth)).toBeGreaterThanOrEqual(1);
      expect(Number.parseFloat(pre.borderRightWidth)).toBeGreaterThanOrEqual(1);
      expect(bar.borderTopLeftRadius).not.toBe("0px");
      expect(pre.borderBottomLeftRadius).not.toBe("0px");
      const langStyle = getComputedStyle(lang);
      expect(langStyle.borderTopWidth).toBe("0px");
      expect(langStyle.backgroundColor).not.toBe(bar.backgroundColor);
      expect(
        Math.abs(
          lang.getBoundingClientRect().top -
            element.getBoundingClientRect().top,
        ),
      ).toBeLessThanOrEqual(1);
    }
    // 検証: 印刷の媒体でも、帯の直後の pre の上の線が無い
    await cdp().send("Emulation.setEmulatedMedia", { media: "print" });
    try {
      for (const element of bars) {
        expect(codeBarStyles(element).pre.borderTopWidth).toBe("0px");
      }
    } finally {
      await cdp().send("Emulation.setEmulatedMedia", {
        media: "",
        features: [],
      });
    }
  }
});

// 右側の目次で閉じたセクションの見出しを押すと、囲むセクションと見出し自身のセクションを開いてから移り、描き直しても開いたまま（正常系（右側の目次で閉じたセクションの見出しを押す））
test("test_normal_when_side_toc_opens_own_section", async () => {
  await withViewport(1280, async () => {
    // 準備
    const el = createElement();
    const lines = (note: string) => [
      sideTocFiller(),
      "## 補足",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "### 注意",
      "",
      '<!-- section: {"open": false} -->',
      "",
      note,
      "",
      "## 付録",
      "",
      '<!-- section: {"open": false} -->',
      "",
      "付録の段落",
      "",
    ];
    const handle = await mountTracked(el, {
      markdown: lines("注意の段落").join("\n"),
    });
    const { linkOf } = sideTocOf(el);
    const paragraph = (text: string) =>
      [...el.querySelectorAll("p")].find((p) => p.textContent === text);
    // 実行・検証: 「注意」を押す（ほかのテストの重なりに左右されないよう、項目を直に押す）
    linkOf("注意").click();
    await vi.waitFor(() => {
      expect(expandedOf(el, ["補足", "注意"])).toEqual(["true", "true"]);
      expect(isShown(paragraph("注意の段落"))).toBe(true);
    });
    // 実行・検証: 「付録」を押す
    linkOf("付録").click();
    await vi.waitFor(() => {
      expect(expandedOf(el, ["補足", "注意", "付録"])).toEqual([
        "true",
        "true",
        "true",
      ]);
      expect(isShown(paragraph("付録の段落"))).toBe(true);
      expect(decodeURIComponent(location.hash)).toBe("#付録");
    });
    // 実行・検証: 段落の文字を書き換えて描き直しても開いたまま
    handle.update(lines("注意の段落を書き換えた").join("\n"));
    await vi.waitFor(() => {
      expect(expandedOf(el, ["補足", "注意", "付録"])).toEqual([
        "true",
        "true",
        "true",
      ]);
    });
  });
});
