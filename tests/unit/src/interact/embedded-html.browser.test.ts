import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 埋め込んだ HTML の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbedded = () => import("../../../../src/interact/embedded-html.ts");

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  removeRoots();
});

/** 幅 600px の描く先の要素に、幅 900px の中身と幅 300px の中身の `div.mdmark-html` を置く */
function createEmbeddedRoot(): {
  root: HTMLElement;
  wide: HTMLElement;
  narrow: HTMLElement;
} {
  const root = createRootFromHtml(
    [
      '<div class="mdmark-html"><div style="width:900px">広い</div></div>',
      '<div class="mdmark-html"><div style="width:300px">狭い</div></div>',
    ].join(""),
  );
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  const [wide, narrow] = root.querySelectorAll<HTMLElement>("div.mdmark-html");
  if (wide === undefined || narrow === undefined) {
    throw new Error("埋め込んだ HTML が置かれていない");
  }
  return { root, wide, narrow };
}

/** 横にスクロールさせている印（class `is-wide` と `tabindex="0"`）を持つか */
function isScrolling(element: HTMLElement): boolean {
  return (
    element.classList.contains("is-wide") &&
    element.getAttribute("tabindex") === "0"
  );
}

/** 横にスクロールさせる印を何も持たないか */
function isPlain(element: HTMLElement): boolean {
  return (
    !element.classList.contains("is-wide") && !element.hasAttribute("tabindex")
  );
}

// 列より広い間だけ横にスクロールさせる（正常系）
test("test_attach_embedded_html", async () => {
  // 準備
  const { attachEmbeddedHtml } = await loadEmbedded();
  const { root, wide, narrow } = createEmbeddedRoot();
  // 実行
  const detach = attachEmbeddedHtml(root);
  // 検証
  await vi.waitFor(() => expect(isScrolling(wide)).toBe(true));
  expect(isPlain(narrow)).toBe(true);
  // 実行: 幅を広げると、どちらも列に収まる
  root.style.width = "1000px";
  // 検証
  await vi.waitFor(() => expect(isPlain(wide)).toBe(true));
  expect(isPlain(narrow)).toBe(true);
  // 実行: 幅を戻して広い中身がはみ出してから、外す
  root.style.width = "600px";
  await vi.waitFor(() => expect(isScrolling(wide)).toBe(true));
  detach();
  // 検証
  expect(isPlain(wide)).toBe(true);
  expect(isPlain(narrow)).toBe(true);
});
