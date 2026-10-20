import { afterEach, expect, test } from "vitest";
import { wrapHtml } from "../../helpers/charts.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** 操作を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInteract = () => import("../../../../src/interact/index.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

// オフの記法には操作を付けない（正常系）
test("test_attach_interactions", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const { root, features } = createRoot(
    [
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
      "<!-- table: data -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 実行
  detachers.push(
    attachInteractions({ root, features: { ...features, tabs: false } }),
  );
  // 検証
  expect(root.querySelector('[role="tablist"]')).toBeNull();
  expect(root.querySelector("thead th button")).not.toBeNull();
});

// hints がオフなら埋め込んだ HTML にツールチップの操作を付けない（正常系）
test("test_attach_interactions_when_hints_off", async () => {
  // 準備
  const { attachInteractions } = await loadInteract();
  const markdown = wrapHtml('<div data-hint="説明">本文</div>');
  const on = createRoot(markdown);
  const off = createRoot(markdown);
  detachers.push(
    attachInteractions({
      root: on.root,
      features: { ...on.features, hints: true },
    }),
    attachInteractions({
      root: off.root,
      features: { ...off.features, hints: false },
    }),
  );
  const onMark = on.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  const offMark = off.root.querySelector<HTMLElement>(".mdmark-hint-mark");
  if (!onMark || !offMark) {
    throw new Error("ヒントの印が描かれていない");
  }
  const onTip = on.root.querySelector<HTMLElement>('[role="tooltip"]');
  const offTip = off.root.querySelector<HTMLElement>('[role="tooltip"]');
  // 実行・検証: オンでは印にフォーカスすると開く
  onMark.focus();
  expect(onTip?.hidden).toBe(false);
  // 実行・検証: オフでは印にフォーカスしても閉じたまま
  offMark.focus();
  expect(offTip?.hidden).toBe(true);
});
