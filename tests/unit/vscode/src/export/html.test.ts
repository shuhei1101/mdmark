import { expect, test } from "vitest";

/** 書き出す HTML の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtml = () => import("../../../../../vscode/src/export/html.ts");

const BUILD_OPTIONS = {
  config: {},
  title: "guide.md",
  distJs: "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js",
  distCss: "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.css",
  baseHref: "file:///ws/docs/",
};

// 空・相対パス・絶対パスのそれぞれで書き出す先を決める（正常系）
test("test_resolve_export_path", async () => {
  // 準備
  const { resolveExportPath } = await loadHtml();
  const base = { markdownPath: "/ws/docs/guide.md", workspaceDir: "/ws" };
  // 実行
  const paths = ["", "out", "/tmp/html"].map((outputDir) =>
    resolveExportPath({ ...base, outputDir }),
  );
  // 検証
  expect(paths).toEqual([
    "/ws/docs/guide.html",
    "/ws/out/guide.html",
    "/tmp/html/guide.html",
  ]);
});

// 本文の script の閉じを含んでも `<` を残さず、読み戻すと同じ値（正常系）
test("test_escape_script_json", async () => {
  // 準備
  const { escapeScriptJson } = await loadHtml();
  const value = { markdown: "a</script><b>" };
  // 実行
  const json = escapeScriptJson(value);
  // 検証
  expect(json).not.toContain("<");
  expect(JSON.parse(json)).toEqual(value);
});

// 本文を JSON で埋め、バージョン付きの配布物で mount する（正常系）
test("test_build_export_html", async () => {
  // 準備
  const { buildExportHtml } = await loadHtml();
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# 題\n</script>",
    print: false,
  });
  // 検証
  expect(html).toMatch(/<base href="file:\/\/\/ws\/docs\/"\s*\/?>/);
  expect(html).toContain(`href="${BUILD_OPTIONS.distCss}"`);
  const json = html.match(
    /<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  expect(json).not.toBeNull();
  expect(json?.[1]).not.toContain("<");
  expect(JSON.parse(json?.[1] ?? "").markdown).toBe("# 題\n</script>");
  const module = html.match(
    /<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/,
  );
  expect(module?.[1]).toContain(BUILD_OPTIONS.distJs);
  expect(module?.[1]).toContain("mount");
  expect(html).not.toContain("window.print");
});

// 印刷を待つ処理を足す（正常系）
test("test_build_export_html_when_print", async () => {
  // 準備
  const { buildExportHtml, PRINT_WAIT_MS } = await loadHtml();
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# 題",
    print: true,
  });
  // 検証
  expect(PRINT_WAIT_MS).toBe(10000);
  expect(html).toContain("window.print()");
  expect(html).toContain("document.fonts.ready");
  expect(html).toContain(String(PRINT_WAIT_MS));
});
