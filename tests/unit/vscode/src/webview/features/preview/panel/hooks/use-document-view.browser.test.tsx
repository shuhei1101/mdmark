import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { createMdmark, renderMessage } from "../../../../webview-helpers.ts";

/** 描いた文書の hook を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHook = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/hooks/use-document-view.ts"
  );

afterEach(() => {
  cleanup();
});

// 描き直しても同じ view で、外すと detach する（正常系）
test("test_use_document_view", async () => {
  // 準備
  const { useDocumentView } = await loadHook();
  const root = document.createElement("div");
  const element = document.createElement("div");
  const { mdmark, record } = createMdmark();
  const { result, rerender, unmount } = renderHook(() =>
    useDocumentView({ root }),
  );
  const first = result.current.view;
  rerender();
  rerender();
  // 実行
  result.current.documentRef(element);
  result.current.view.useMdmark(mdmark as never);
  result.current.view.render(renderMessage("# 本文"));
  unmount();
  // 検証
  expect(result.current.view).toBe(first);
  expect(record.destroy).toHaveBeenCalledTimes(1);
});
