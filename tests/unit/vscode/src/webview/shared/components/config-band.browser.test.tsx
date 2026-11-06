import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

/** 設定ファイルを読めない帯を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  import(
    "../../../../../../../vscode/src/webview/shared/components/config-band.tsx"
  );

afterEach(() => {
  cleanup();
});

// タイトル・パス・行とボタンを出し、パスを文字のまま出す（正常系）
test("test_config_band", async () => {
  // 準備
  const { ConfigBand } = await loadPart();
  // 実行
  const { container } = render(
    <ConfigBand path="a<b>.yaml" line={4} onOpenConfig={() => undefined} />,
  );
  // 検証
  const band = screen.getByRole("status");
  expect(band.querySelector("h2")?.textContent).toBe(
    "設定ファイルを読み込めません",
  );
  expect(band.querySelector("code")?.textContent).toBe("a<b>.yaml");
  expect(container.querySelector("b")).toBeNull();
  expect(band.textContent).toContain("4 行目");
  expect(
    band.querySelector('button[data-action="openConfig"]')?.textContent,
  ).toBe("設定ファイルを開く");
});

// 設定ファイルを開くを押すと onOpenConfig を呼ぶ（正常系）
test("test_config_band_when_clicked", async () => {
  // 準備
  const { ConfigBand } = await loadPart();
  const onOpenConfig = vi.fn();
  render(
    <ConfigBand
      path="mdmark.config.yaml"
      line={4}
      onOpenConfig={onOpenConfig}
    />,
  );
  // 実行
  await userEvent.click(
    screen.getByRole("button", { name: "設定ファイルを開く" }),
  );
  // 検証
  expect(onOpenConfig).toHaveBeenCalledTimes(1);
});
