import { expect, test } from "vitest";

/** ページの設定の印の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPage = () => import("../../../../src/render/page.ts");

/** 印の引数を読む処理を読み込む */
const loadMarks = () => import("../../../../src/render/marks.ts");

// 書けるキーと値を読む（正常系）
test("test_read_page_settings", async () => {
  // 準備
  const { readPageSettings } = await loadPage();
  const { parseMarkArgs } = await loadMarks();
  // 実行
  const result = readPageSettings(
    parseMarkArgs("scheme=dark theme=theme-slate toc=fixed"),
  );
  // 検証
  expect(result).toEqual({
    settings: { scheme: "dark", theme: "theme-slate", toc: "fixed" },
    unknown: [],
  });
});

// 知らないキー・値を残りと分ける（異常系）
test("test_read_page_settings_when_unknown", async () => {
  // 準備
  const { readPageSettings } = await loadPage();
  const { parseMarkArgs } = await loadMarks();
  // 実行
  const result = readPageSettings(
    parseMarkArgs(
      "scheme=sepia theme=theme-unknown size=wide toc=fixed toc=hover",
    ),
  );
  // 検証
  expect(result).toEqual({
    settings: { toc: "hover" },
    unknown: ["scheme=sepia", "theme=theme-unknown", "size=wide"],
  });
});
