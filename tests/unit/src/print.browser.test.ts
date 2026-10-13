import { afterEach, expect, test } from "vitest";

/** 印刷の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPrint = () => import("../../../src/print.ts");

// 閉じた折り畳みと、開いた折り畳みを 1 つずつ持つ HTML
const DETAILS_HTML =
  '<details id="closed"><summary>s</summary>b</details><details id="opened" open><summary>s</summary>b</details>';

const detachers: Array<() => void> = [];

/** 折り畳みを持つ描く先の要素を作る */
function createRoot(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = DETAILS_HTML;
  return root;
}

/** 印刷の受け取りを付け、後始末のために外す関数を控える */
async function attachTracked(
  root: HTMLElement,
  isEnabled: () => boolean,
): Promise<() => void> {
  const { attachPrint } = await loadPrint();
  const detach = attachPrint({ root, isEnabled });
  detachers.push(detach);
  return detach;
}

/** 要素の中の折り畳みを id で返す */
function findDetails(root: HTMLElement, id: string): HTMLDetailsElement {
  const details = root.querySelector<HTMLDetailsElement>(`#${id}`);
  if (!details) {
    throw new Error(`折り畳みが無い: ${id}`);
  }
  return details;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
});

// 印刷の前に閉じた折り畳みを開き、後に開いたものだけを閉じ直す（正常系）
test("test_attach_print", async () => {
  // 準備
  const root = createRoot();
  await attachTracked(root, () => true);
  // 実行
  window.dispatchEvent(new Event("beforeprint"));
  // 検証
  expect(findDetails(root, "closed").open).toBe(true);
  expect(findDetails(root, "opened").open).toBe(true);
  // 実行
  window.dispatchEvent(new Event("afterprint"));
  // 検証
  expect(findDetails(root, "closed").open).toBe(false);
  expect(findDetails(root, "opened").open).toBe(true);
});

// 印刷の機能がオフなら開かない（正常系）
test("test_attach_print_when_disabled", async () => {
  // 準備
  const root = createRoot();
  await attachTracked(root, () => false);
  // 実行
  window.dispatchEvent(new Event("beforeprint"));
  // 検証
  expect(findDetails(root, "closed").open).toBe(false);
});

// 外した後は受け取らない（正常系）
test("test_attach_print_when_detached", async () => {
  // 準備
  const root = createRoot();
  const detach = await attachTracked(root, () => true);
  detach();
  // 実行
  window.dispatchEvent(new Event("beforeprint"));
  // 検証
  expect(findDetails(root, "closed").open).toBe(false);
});
