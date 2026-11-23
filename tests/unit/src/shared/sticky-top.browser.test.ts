import { afterEach, expect, test } from "vitest";
import { loadSource } from "../../helpers/lazy.ts";

/** 留める位置の換算を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadStickyTop = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/shared/sticky-top.ts")>(
      "../../../../src/shared/sticky-top.ts",
    ),
  );

const elements: HTMLElement[] = [];

/** `--mdmark-sticky-top` を適用した要素をページに配置する */
function createElement(stickyTop?: string): HTMLElement {
  const el = document.createElement("div");
  if (stickyTop !== undefined) {
    el.style.setProperty("--mdmark-sticky-top", stickyTop);
  }
  document.body.append(el);
  elements.push(el);
  return el;
}

afterEach(() => {
  for (const el of elements.splice(0)) {
    el.remove();
  }
  document.documentElement.style.removeProperty("font-size");
});

// px の指定をそのまま返却する（正常系）
test("test_read_sticky_top_when_px", async () => {
  // 準備
  const { readStickyTop } = await loadStickyTop();
  const el = createElement("48px");
  // 実行
  const top = readStickyTop(el);
  // 検証
  expect(top).toBe(48);
});

// calc() と rem の指定を px に換算する（正常系）
test("test_read_sticky_top_when_calc", async () => {
  // 準備
  const { readStickyTop } = await loadStickyTop();
  document.documentElement.style.fontSize = "16px";
  const calc = createElement("calc(.25rem * 24)");
  const rem = createElement("6rem");
  const childrenBefore = [calc.childElementCount, rem.childElementCount];
  // 実行
  const tops = [readStickyTop(calc), readStickyTop(rem)];
  // 検証
  expect(tops).toEqual([96, 96]);
  expect([calc.childElementCount, rem.childElementCount]).toEqual(
    childrenBefore,
  );
});

// 指定が無いときは 0 を返却する（正常系）
test("test_read_sticky_top_when_unset", async () => {
  // 準備
  const { readStickyTop } = await loadStickyTop();
  const el = createElement();
  // 実行
  const top = readStickyTop(el);
  // 検証
  expect(top).toBe(0);
});
