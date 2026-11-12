import { expect, test } from "vitest";

/** ページの設定のマーカーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPage = () => import("../../../../src/render/page.ts");

// 記載できるキーと値を読み込む（正常系）
test("test_read_page_settings", async () => {
  // 準備
  const { readPageSettings } = await loadPage();
  // 実行
  const settings = readPageSettings([
    { scheme: "dark", theme: "theme-slate", toc: { mode: "fixed" } },
  ]);
  // 検証
  expect(settings).toEqual({
    scheme: "dark",
    theme: "theme-slate",
    toc: "fixed",
  });
});

// 後に記載した値を使用する（正常系）
test("test_read_page_settings_when_repeated", async () => {
  // 準備
  const { readPageSettings } = await loadPage();
  // 実行
  const settings = readPageSettings([
    { scheme: "dark", toc: { mode: "fixed" } },
    { toc: { mode: "hover" } },
  ]);
  // 検証
  expect(settings).toEqual({ scheme: "dark", toc: "hover" });
});
