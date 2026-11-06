import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

/** プレビューの状態の表示を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  import(
    "../../../../../../../vscode/src/webview/shared/components/preview-status.tsx"
  );

afterEach(() => {
  cleanup();
});

// 指定したバージョンが無い理由とリロードを出し、バージョンを文字のまま出す（正常系）
test("test_preview_status", async () => {
  // 準備
  const { PreviewStatus } = await loadPart();
  // 実行
  const { container } = render(
    <PreviewStatus
      state="versionMissing"
      version="v9.9.9<b>"
      onReload={() => undefined}
    />,
  );
  // 検証
  const status = screen.getByRole("status");
  expect(
    status.querySelector("h1")?.textContent,
  ).toBe("プレビューを表示できません");
  const codes = [...status.querySelectorAll("code")].map(
    (code) => code.textContent,
  );
  expect(codes).toContain("v9.9.9<b>");
  expect(container.querySelector("b")).toBeNull();
  expect(
    status.querySelector('button[data-action="reload"]')?.textContent,
  ).toBe("リロード");
});

// 読み込み中はタイトルと Spinner だけ（正常系）
test("test_preview_status_when_loading", async () => {
  // 準備
  const { PreviewStatus } = await loadPart();
  // 実行
  const { container } = render(
    <PreviewStatus state="loading" onReload={() => undefined} />,
  );
  // 検証
  expect(container.querySelector("h1")?.textContent).toBe(
    "mdmark を読み込んでいます",
  );
  const spinner = container.querySelector('svg[role="img"]');
  expect(spinner?.getAttribute("aria-label")).toBe("読み込み中");
  expect(container.querySelector("button")).toBeNull();
});

// 差分に対応しないバージョンの理由とリロードを出す（正常系）
test("test_preview_status_when_diff_unsupported", async () => {
  // 準備
  const { PreviewStatus } = await loadPart();
  // 実行
  render(
    <PreviewStatus
      state="diffUnsupported"
      version="v0.8.0"
      onReload={() => undefined}
    />,
  );
  // 検証: 部品設計の状態 DiffUnsupported の文言
  const status = screen.getByRole("status");
  const codes = [...status.querySelectorAll("code")].map(
    (code) => code.textContent,
  );
  expect(codes).toEqual(["v0.8.0", "mdmark.version", "latest"]);
  expect(status.textContent).toContain(
    "読み込んだ mdmark（v0.8.0）は差分の表示に対応していません。",
  );
  expect(status.textContent).toContain("リロードしてください。");
  expect(status.querySelector("button")).not.toBeNull();
});

// 描画の失敗の理由とリロードを出す（正常系）
test("test_preview_status_when_unexpected", async () => {
  // 準備
  const { PreviewStatus } = await loadPart();
  // 実行
  render(<PreviewStatus state="unexpected" onReload={() => undefined} />);
  // 検証: 部品設計の状態 Unexpected の文言
  const status = screen.getByRole("status");
  expect(status.querySelector("h1")?.textContent).toBe(
    "プレビューを表示できません",
  );
  expect(status.querySelector("p")?.textContent).toBe(
    "プレビューの表示中にエラーが発生しました。リロードしてください。",
  );
  expect(status.querySelector("button")).not.toBeNull();
});

// リロードを押すと onReload を呼ぶ（正常系）
test("test_preview_status_when_reload_clicked", async () => {
  // 準備
  const { PreviewStatus } = await loadPart();
  const onReload = vi.fn();
  render(<PreviewStatus state="offline" version="v0.7.0" onReload={onReload} />);
  // 実行
  await userEvent.click(screen.getByRole("button", { name: "リロード" }));
  // 検証
  expect(onReload).toHaveBeenCalledTimes(1);
});
