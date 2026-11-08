import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createFakeVsCodeApi } from "../../../../../../vscode/src/webview/testing/fake-vscode-api.ts";

// 画面を、描くと例外を投げる代役にする
vi.mock(
  "../../../../../../vscode/src/webview/features/preview/panel/panel-screen.tsx",
  () => ({
    PanelScreen: () => {
      throw new Error("描画の失敗");
    },
  }),
);

/** Webview のアプリを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadApp = () =>
  import("../../../../../../vscode/src/webview/app/app.tsx");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 画面の描画で例外が出たら、描画の失敗とリロードを出す（異常系）
test("test_app_when_render_error", async () => {
  // 準備
  const { App } = await loadApp();
  const api = createFakeVsCodeApi();
  // Error Boundary が受けた例外の出力をテストの出力に出さない
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const root = document.createElement("div");
  const boot = {
    root,
    distJs: undefined,
    version: undefined,
    status: undefined,
    configPath: "",
    extensions: [],
    test: false,
  };
  // 実行
  render(<App boot={boot} api={api} />);
  await userEvent.click(screen.getByRole("button", { name: "リロード" }));
  // 検証
  const status = screen.getByRole("status");
  expect(status.querySelector("h1")?.textContent).toBe(
    "プレビューを表示できません",
  );
  expect(status.textContent).toContain(
    "プレビューの表示中にエラーが発生しました。",
  );
  expect(api.posted).toEqual([{ type: "reload" }]);
});
