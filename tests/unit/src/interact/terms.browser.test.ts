import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 用語のツールチップの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTerms = () => import("../../../../src/interact/terms.ts");

/** 用語のツールチップの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTermTip = () => import("../../../../src/parts/term-tip.ts");

const detachers: Array<() => void> = [];

/** 意味だけのツールチップを持つ語の HTML */
async function termHtml(): Promise<string> {
  const { renderTermTip } = await loadTermTip();
  return renderTermTip({
    text: "ワークスペース",
    id: "tip",
    meaning: "話し合いの記録を置くフォルダ",
  });
}

/** 今フォーカスのある要素にキーを押す */
function press(key: string): void {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true }),
  );
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

// フォーカスで開き Esc で閉じる（正常系）
test("test_attach_term_tips", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const root = createRootFromHtml(await termHtml());
  const wrap = root.querySelector<HTMLElement>(".mdmark-term-wrap");
  const term = root.querySelector<HTMLElement>(".mdmark-term");
  // 実行・検証
  const detach = attachTermTips(root);
  expect(wrap?.classList.contains("is-open")).toBe(false);
  term?.focus();
  expect(wrap?.classList.contains("is-open")).toBe(true);
  press("Escape");
  expect(wrap?.classList.contains("is-open")).toBe(false);
  expect(wrap?.classList.contains("is-dismissed")).toBe(true);
  expect(document.activeElement).toBe(term);
  detach();
  for (const name of ["is-open", "is-dismissed", "is-above"]) {
    expect(wrap?.classList.contains(name)).toBe(false);
  }
});

// 同じページに 2 回描いても id が重ならない（正常系）
test("test_attach_term_tips_unique_ids", async () => {
  // 準備
  const { attachTermTips } = await loadTerms();
  const html = await termHtml();
  const roots = [createRootFromHtml(html), createRootFromHtml(html)];
  // 実行
  for (const root of roots) {
    detachers.push(attachTermTips(root));
  }
  // 検証
  const ids = roots.flatMap((root) =>
    [...root.querySelectorAll("[id]")].map((element) => element.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const root of roots) {
    const term = root.querySelector(".mdmark-term");
    const tip = root.querySelector(".mdmark-term-tip");
    const describedBy = term?.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toBe(tip);
  }
});
