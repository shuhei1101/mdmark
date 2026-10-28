import { afterEach, expect, test } from "vitest";
import { mount } from "../../../../../src/mount.ts";
import { addStyles } from "../../../helpers/dom.ts";

/** スクロールの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadScroll = () => import("../../../../../vscode/src/webview/scroll.ts");

/** 元の行番号と、スクロールする要素の先頭からの位置 */
type Anchor = { line: number; top: number };

const placed: HTMLElement[] = [];

/** 要素をページの末尾に置く */
function place<T extends HTMLElement>(element: T, parent?: HTMLElement): T {
  (parent ?? document.body).append(element);
  if (parent === undefined) {
    placed.push(element);
  }
  return element;
}

/** 元の行番号と高さを持つ要素を作る */
function block(line: number, height: number): HTMLElement {
  const element = document.createElement("div");
  element.dataset.sourceLine = String(line);
  element.style.height = `${height}px`;
  return element;
}

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

/** 幅 `width`（px）の要素に `markdown` を `mount` で描き、描いた要素を返す */
function mountDocument(markdown: string, width: number): HTMLElement {
  addStyles();
  const element = place(document.createElement("div"));
  element.style.width = `${width}px`;
  handles.push(mount(element, { markdown }));
  return element;
}

/** スクロールする要素 */
function pageScroller(): Element {
  return document.scrollingElement ?? document.documentElement;
}

// 行と位置が増えていく並びにする（正常系）
test("test_collect_anchors", async () => {
  // 準備
  const { collectAnchors } = await loadScroll();
  const scroller = place(document.createElement("div"));
  scroller.style.cssText = "height: 300px; overflow-y: auto;";
  const root = place(document.createElement("div"), scroller);
  // 行が 0・2・2（2 つ目の中）・1・5 の要素を上から並べる
  place(block(0, 40), root);
  const second = place(block(2, 100), root);
  place(block(2, 50), second);
  place(block(1, 40), root);
  place(block(5, 40), root);
  // 実行
  const anchors = collectAnchors({ root, scroller });
  // 検証
  expect(anchors.map((anchor: Anchor) => anchor.line)).toEqual([0, 2, 5]);
  const tops = anchors.map((anchor: Anchor) => anchor.top);
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  expect(new Set(tops).size).toBe(tops.length);
});

// 印の間を行の割合で内分する（正常系）
test("test_top_for_line", async () => {
  // 準備
  const { topForLine } = await loadScroll();
  const anchors = [
    { line: 0, top: 0 },
    { line: 10, top: 400 },
  ];
  // 実行
  const tops = [5, 0, 30].map((line) => topForLine(anchors, line));
  // 検証
  expect(tops).toEqual([200, 0, 400]);
});

// 印が無ければ先頭（正常系）
test("test_top_for_line_when_no_anchor", async () => {
  // 準備
  const { topForLine } = await loadScroll();
  // 実行
  const top = topForLine([], 5);
  // 検証
  expect(top).toBe(0);
});

// 印の間を内分して切り捨てる（正常系）
test("test_line_for_top", async () => {
  // 準備
  const { lineForTop } = await loadScroll();
  const anchors = [
    { line: 0, top: 0 },
    { line: 10, top: 400 },
  ];
  // 実行
  const lines = [210, 900].map((top) => lineForTop(anchors, top));
  // 検証
  expect(lines).toEqual([5, 10]);
});

// 狭い幅の帯の下端までの高さを返す（正常系）
test("test_top_inset_when_band", async () => {
  // 準備
  const { topInset } = await loadScroll();
  const root = mountDocument("# 手引き\n\n## 導入\n\n段落\n", 390);
  const band = root.querySelector(".mdmark-side-toc") as HTMLElement;
  // 実行
  const inset = topInset({ root, scroller: pageScroller() });
  // 検証
  expect(inset).toBeGreaterThan(0);
  expect(inset).toBe(band.getBoundingClientRect().bottom);
});

// 広い幅の右の列では 0（正常系）
test("test_top_inset_when_wide", async () => {
  // 準備
  const { topInset } = await loadScroll();
  const root = mountDocument("# 手引き\n\n## 導入\n\n段落\n", 1280);
  // 実行
  const inset = topInset({ root, scroller: pageScroller() });
  // 検証
  expect(root.querySelector(".mdmark-side-toc")).not.toBeNull();
  expect(inset).toBe(0);
});

// 右側の目次が無い文書では 0（正常系）
test("test_top_inset_when_no_side_toc", async () => {
  // 準備
  const { topInset } = await loadScroll();
  const root = mountDocument("段落だけの文書\n", 390);
  // 実行
  const inset = topInset({ root, scroller: pageScroller() });
  // 検証
  expect(root.querySelector(".mdmark-side-toc")).toBeNull();
  expect(inset).toBe(0);
});
