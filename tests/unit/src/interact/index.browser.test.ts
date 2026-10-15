import { afterEach, expect, test } from "vitest";
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
