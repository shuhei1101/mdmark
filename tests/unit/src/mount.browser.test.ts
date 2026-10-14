import { afterEach, expect, test } from "vitest";
import type { MountHandle, MountOptions } from "../../../src/mount.ts";

/** 描く処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMount = () => import("../../../src/mount.ts");

// 閉じた折り畳みを 1 つ持つ文書
const DETAILS_MARKDOWN = "<details><summary>s</summary>b</details>\n";

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];

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
  opts: MountOptions,
): Promise<MountHandle> {
  const { mount } = await loadMount();
  const handle = mount(el, opts);
  handles.push(handle);
  return handle;
}

/** 要素の中の折り畳みを返す */
function findDetails(el: HTMLElement): HTMLDetailsElement {
  const details = el.querySelector("details");
  if (!details) {
    throw new Error("details が描かれていない");
  }
  return details;
}

/** 印刷の前のイベントを送る */
function sendBeforePrint(): void {
  window.dispatchEvent(new Event("beforeprint"));
}

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
});

// 要素に本文を描き、class を付ける（正常系）
test("test_mount", async () => {
  // 準備
  const el = createElement();
  // 実行
  const handle = await mountTracked(el, { markdown: "# 見出し" });
  // 検証
  expect(el.classList.contains("mdmark")).toBe(true);
  expect(el.innerHTML).toContain("<h1>見出し</h1>");
  expect(typeof handle.update).toBe("function");
  expect(typeof handle.destroy).toBe("function");
});

// update で本文だけを描き直す（正常系）
test("test_mount_when_updated", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# A" });
  // 実行
  handle.update("# B");
  // 検証
  expect(el.innerHTML.trim()).toBe("<h1>B</h1>");
  expect(el.classList.contains("mdmark")).toBe(true);
});

// destroy で片付け、その後の update と 2 回目の destroy は何もしない（正常系）
test("test_mount_when_destroyed", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "# A" });
  // 実行
  handle.destroy();
  // 検証
  expect(() => {
    handle.update("# B");
    handle.destroy();
  }).not.toThrow();
  expect(el.innerHTML).toBe("");
  expect(el.classList.contains("mdmark")).toBe(false);
});

// 同じ要素へもう一度描くと、前の描画を片付けてから描く（正常系）
test("test_mount_when_remounted", async () => {
  // 準備
  const el = createElement();
  const first = await mountTracked(el, { markdown: "# A" });
  await mountTracked(el, { markdown: "# B" });
  // 実行
  first.update("# C");
  // 検証
  expect(el.innerHTML.trim()).toBe("<h1>B</h1>");
});

// 文書の印で印刷の機能を外すと、印刷の前に折り畳みを開かない（正常系）
test("test_mount_when_print_disabled_by_mark", async () => {
  // 準備
  const el = createElement();
  await mountTracked(el, {
    markdown: `<!-- features: -print -->\n\n${DETAILS_MARKDOWN}`,
  });
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});

// update で描き直した文書の印が印刷の機能に効く（正常系）
test("test_mount_when_updated_with_print_mark", async () => {
  // 準備
  const el = createElement();
  const handle = await mountTracked(el, { markdown: "段落\n" });
  handle.update(`<!-- features: -print -->\n\n${DETAILS_MARKDOWN}`);
  // 実行
  sendBeforePrint();
  // 検証
  expect(findDetails(el).open).toBe(false);
});
