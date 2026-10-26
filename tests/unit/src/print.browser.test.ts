import { afterEach, expect, test } from "vitest";
import {
  createRoot as createDocumentRoot,
  removeRoots,
} from "../helpers/dom.ts";

/** 印刷の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPrint = () => import("../../../src/print.ts");

/** 記法の操作を付ける処理を読み込む */
const loadInteract = () => import("../../../src/interact/index.ts");

// 詳細を持つ行の表、2 つの中身のタブ、閉じた節を持つ文書
const SYNTAX_MARKDOWN = [
  "| 名前 | 値 |",
  "| --- | --- |",
  "| a | 1 |",
  "",
  "<!-- row-detail: 1 -->",
  "",
  "詳細",
  "",
  "<!-- /row-detail -->",
  "",
  "<!-- tabs -->",
  "",
  "### A",
  "",
  "a",
  "",
  "### B",
  "",
  "b",
  "",
  "<!-- /tabs -->",
  "",
  "## 閉じる",
  "",
  "<!-- section: closed -->",
  "",
  "本文",
  "",
].join("\n");

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
  removeRoots();
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

// 印刷の前に閉じた節・行の詳細・タブの中身を出し、後に戻す（正常系）
test("test_attach_print_when_syntax", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createDocumentRoot(SYNTAX_MARKDOWN);
  detachers.push(attachInteractions({ root, features, placement: "top" }));
  root.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
  await attachTracked(root, () => true);
  const section = root.querySelector<HTMLElement>('[id="section-閉じる"]');
  const detail = root.querySelector<HTMLElement>("tr.mdmark-row-detail");
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  // 実行
  window.dispatchEvent(new Event("beforeprint"));
  // 検証
  expect(section?.hasAttribute("hidden")).toBe(false);
  expect(detail?.hasAttribute("hidden")).toBe(false);
  for (const panel of panels) {
    expect(panel.hasAttribute("hidden")).toBe(false);
  }
  // 実行
  window.dispatchEvent(new Event("afterprint"));
  // 検証
  expect(section?.getAttribute("hidden")).toBe("until-found");
  expect(detail?.hasAttribute("hidden")).toBe(true);
  expect(panels[0].hasAttribute("hidden")).toBe(true);
  expect(panels[1].hasAttribute("hidden")).toBe(false);
});
