import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createFakeVsCodeApi } from "../../../../../../../../../vscode/src/webview/testing/fake-vscode-api.ts";
import {
  createMdmark,
  nextFrames,
  renderMessage,
  scroller,
  topOfLine,
} from "../../../../webview-helpers.ts";

/** スクロールの hook を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHook = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/hooks/use-scroll-sync.ts"
  );
/** 描いた文書を読み込む */
const loadDocumentView = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/document-view.ts"
  );

const placed: HTMLElement[] = [];

beforeEach(() => {
  document.body.style.margin = "0";
});

afterEach(() => {
  cleanup();
  scroller().scrollTop = 0;
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

// スクロールするたびに見えている先頭の行を送って保存し、描く前は保存しない（正常系）
test("test_use_scroll_sync", async () => {
  // 準備: 縦に 40 個のブロックを描く代役（元の行番号 30 を先頭に置けるよう下に余白を足す）
  const { useScrollSync } = await loadHook();
  const { createDocumentView } = await loadDocumentView();
  const api = createFakeVsCodeApi();
  const root = document.createElement("div");
  const element = document.createElement("div");
  root.append(element);
  const spacer = document.createElement("div");
  spacer.style.height = "4000px";
  document.body.append(root, spacer);
  placed.push(root, spacer);
  const { mdmark } = createMdmark();
  const view = createDocumentView({ root, mdmark: mdmark as never });
  view.attach(element);
  renderHook(() => useScrollSync({ view, api }));
  // 実行: 描く前のスクロールの知らせ
  window.dispatchEvent(new Event("scroll"));
  await nextFrames();
  const statesBeforeRender = api.states.length;
  // 実行: 描いた後に元の行番号 30 のブロックを先頭へ動かす
  view.render(renderMessage("# 本文"));
  scroller().scrollTop = topOfLine(30);
  // 検証
  expect(statesBeforeRender).toBe(0);
  await vi.waitFor(() => {
    const last = api.states.at(-1)?.line;
    expect(last).toBeTypeOf("number");
    expect(Math.abs((last ?? 0) - 30)).toBeLessThan(0.05);
  });
  expect(api.posted).toContainEqual({ type: "revealLine", line: 30 });
});
