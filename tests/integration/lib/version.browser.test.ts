import { expect, inject, test } from "vitest";

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

// 配布物を読んだページで version() を呼ぶと、埋めた版を返し、CSS 変数も同じ版になる（正常系）
test("test_normal", async () => {
  // 準備
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = distUrl("index.css");
  const loaded = new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
  });
  document.head.append(link);
  await loaded;
  const built: { version: () => string } = await import(
    /* @vite-ignore */ distUrl("index.js")
  );
  // 実行
  const version = built.version();
  // 検証
  expect(version).toBe("v0.0.1");
  expect(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--mdmark-version",
    ),
  ).toBe('"v0.0.1"');
});
