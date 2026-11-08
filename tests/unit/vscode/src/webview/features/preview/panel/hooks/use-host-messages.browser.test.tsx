import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { sendHostMessage } from "../../../../webview-helpers.ts";

/** 拡張機能のメッセージの hook を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHook = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/hooks/use-host-messages.ts"
  );

afterEach(() => {
  cleanup();
});

// 描き直した後の処理にメッセージを渡し、外した後は渡さない（正常系）
test("test_use_host_messages", async () => {
  // 準備
  const { useHostMessages } = await loadHook();
  const first = vi.fn();
  const second = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ onMessage }) => useHostMessages(onMessage),
    { initialProps: { onMessage: first } },
  );
  rerender({ onMessage: second });
  // 実行
  sendHostMessage({ type: "configOk" });
  unmount();
  sendHostMessage({ type: "configOk" });
  // 検証
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledWith({ type: "configOk" });
});

// type を持たない data は処理に渡さない（正常系）
test("test_use_host_messages_when_not_object", async () => {
  // 準備
  const { useHostMessages } = await loadHook();
  const onMessage = vi.fn();
  renderHook(() => useHostMessages(onMessage));
  // 実行
  sendHostMessage(null);
  sendHostMessage("configOk");
  sendHostMessage({ line: 3 });
  // 検証
  expect(onMessage).not.toHaveBeenCalled();
});
