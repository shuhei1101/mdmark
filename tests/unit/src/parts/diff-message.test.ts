import { expect, test } from "vitest";
import { findTag, plainText } from "../../helpers/html.ts";

/** 差分の状態の文の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMessage = () => import("../../../../src/parts/diff-message.ts");

// 種類ごとの文を出す（正常系）
test("test_render_diff_message", async () => {
  // 準備
  const { renderDiffMessage } = await loadMessage();
  // 実行
  const same = renderDiffMessage({ kind: "same" });
  const single = renderDiffMessage({ kind: "single" });
  const loading = renderDiffMessage({ kind: "loading", spinner: true });
  const loadingPlain = renderDiffMessage({ kind: "loading" });
  // 検証
  expect(plainText(same)).toContain(
    "選んだ 2 つのリビジョンの本文に、変更はありません。",
  );
  expect(plainText(single)).toContain(
    "この文書のリビジョンは 1 つだけのため、比較対象のリビジョンがありません。",
  );
  expect(plainText(loading)).toContain("変更を読み込んでいます");
  expect(loading).not.toContain("role=");
  expect(findTag(loading, "mdmark-diff-spinner")).toContain(
    'aria-hidden="true"',
  );
  expect(plainText(loadingPlain)).toContain("変更を読み込んでいます");
  expect(loadingPlain).not.toContain("mdmark-diff-spinner");
});
