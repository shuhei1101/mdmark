import { cleanup, render } from "@testing-library/react";
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

// 描き直しても同じ view で文書を残し、外すと detach する（正常系）
test("test_use_document_view", async () => {
  // 準備: hook の ref を描く先の要素に渡す部品で描く
  const { useDocumentView } = await loadHook();
  const root = document.createElement("div");
  const { mdmark, record } = createMdmark();
  const views: unknown[] = [];
  const Probe = () => {
    const { view, documentRef } = useDocumentView({ root });
    views.push(view);
    return <div ref={documentRef} />;
  };
  const { rerender, unmount } = render(<Probe />);
  rerender(<Probe />);
  rerender(<Probe />);
  // 実行
  const view = views[0] as {
    useMdmark: (value: never) => void;
    render: (message: ReturnType<typeof renderMessage>) => void;
  };
  view.useMdmark(mdmark as never);
  view.render(renderMessage("# 本文"));
  rerender(<Probe />);
  rerender(<Probe />);
  const destroyedBeforeUnmount = record.destroy.mock.calls.length;
  unmount();
  // 検証
  expect(new Set(views).size).toBe(1);
  expect(destroyedBeforeUnmount).toBe(0);
  expect(record.destroy).toHaveBeenCalledTimes(1);
});
