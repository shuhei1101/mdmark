import { afterEach, expect, test } from "vitest";

/** スクロールする場所を見つける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadScroller = () => import("../../../../src/interact/scroller.ts");

const elements: HTMLElement[] = [];

/** 高さ 600px の縦にスクロールする枠の中に、指定した高さの中身を入れてページに置き、中身を返す */
function createBox(innerHeight: number): {
  box: HTMLElement;
  inner: HTMLElement;
} {
  const box = document.createElement("div");
  box.style.height = "600px";
  box.style.overflowY = "auto";
  const inner = document.createElement("div");
  inner.style.height = `${innerHeight}px`;
  box.append(inner);
  document.body.append(box);
  elements.push(box);
  return { box, inner };
}

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
});

// 中身がはみ出す一番近いスクロールする祖先の要素を返す（正常系）
test("test_find_scroll_container", async () => {
  // 準備
  const { findScrollContainer } = await loadScroller();
  const { box, inner } = createBox(2000);
  const from = document.createElement("div");
  inner.append(from);
  // 実行
  const found = findScrollContainer(from);
  // 検証
  expect(found.target).toBe(box);
  expect(found.page).toBe(false);
});

// 中身がはみ出さない祖先の要素は飛ばして画面全体を返す（正常系）
test("test_find_scroll_container_when_not_overflowing", async () => {
  // 準備
  const { findScrollContainer } = await loadScroller();
  const { inner } = createBox(100);
  const from = document.createElement("div");
  inner.append(from);
  // 実行
  const found = findScrollContainer(from);
  // 検証
  expect(found.target).toBe(document.scrollingElement);
  expect(found.page).toBe(true);
});
