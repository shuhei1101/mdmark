import { afterEach, expect, inject, test, vi } from "vitest";
import type { MdmarkConfig, MountHandle } from "../../../src/index.ts";

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
  opts: { markdown: string; config?: MdmarkConfig },
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
  expect(find(el, "a").getAttribute("href")).toBe("https://example.com/page");
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
  expect(el.innerHTML.trim()).toBe("<h1>新しい見出し</h1>");
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
