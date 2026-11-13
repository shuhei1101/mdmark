import { expect, test } from "vitest";

/** 書き出す HTML の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtml = () => import("../../../../../vscode/src/export/html.ts");

const BUILD_OPTIONS = {
  config: {},
  title: "guide.md",
  distJs: "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js",
  distCss: "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.css",
  baseHref: "file:///ws/docs/",
  extensions: [] as string[],
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

// 復号すると元のコードに戻る（正常系）
test("test_module_data_url", async () => {
  // 準備
  const { moduleDataUrl } = await loadHtml();
  const code = 'export default "a b#%あ";';
  const prefix = "data:text/javascript;charset=utf-8,";
  // 実行
  const url = moduleDataUrl(code);
  // 検証
  expect(url.startsWith(prefix)).toBe(true);
  expect(decodeURIComponent(url.slice(prefix.length))).toBe(code);
});

// 本文の script の閉じを含んでも `<` を残さず、読み込み戻すと同じ値（正常系）
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
    markdown: "# タイトル\n</script>",
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
  expect(JSON.parse(json?.[1] ?? "").markdown).toBe("# タイトル\n</script>");
  const module = html.match(
    /<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/,
  );
  expect(module?.[1]).toContain(BUILD_OPTIONS.distJs);
  expect(module?.[1]).toContain("mount");
  expect(html).not.toContain("window.print");
});

// 印刷を待つ処理を追加する（正常系）
test("test_build_export_html_when_print", async () => {
  // 準備
  const { buildExportHtml, PRINT_WAIT_MS } = await loadHtml();
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# タイトル",
    print: true,
  });
  // 検証
  expect(PRINT_WAIT_MS).toBe(10000);
  expect(html).toContain("window.print()");
  expect(html).toContain("document.fonts.ready");
  expect(html).toContain(String(PRINT_WAIT_MS));
});

// theme の CSS を配布物の CSS の後に埋め、拡張を mount の前に登録する（正常系）
test("test_build_export_html_when_theme_and_extensions", async () => {
  // 準備
  const { buildExportHtml } = await loadHtml();
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# タイトル",
    print: false,
    themeCss: ".a{color:red}</style>",
    extensions: ["export default {name:'x'}"],
  });
  const plain = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# タイトル",
    print: false,
  });
  // 検証
  const style = html.match(/<style>([\s\S]*?)<\/style>/);
  expect(style).not.toBeNull();
  expect(style?.[1]).not.toMatch(/<\/style/i);
  expect(html.indexOf(`href="${BUILD_OPTIONS.distCss}"`)).toBeLessThan(
    html.indexOf("<style>"),
  );
  const module = html.match(
    /<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/,
  );
  const code = module?.[1] ?? "";
  expect(code.indexOf("registerExtension")).toBeGreaterThan(-1);
  expect(code.lastIndexOf("registerExtension")).toBeLessThan(
    code.lastIndexOf("mount("),
  );
  expect(plain).not.toContain("<style>");
  expect(plain).not.toContain("registerExtension");
});

// import map を type=module の script より前に埋める（正常系）
test("test_build_export_html_when_import_map", async () => {
  // 準備
  const { buildExportHtml } = await loadHtml();
  const importMap = {
    "file:///ws/hljs/core.min.js": "data:text/javascript;charset=utf-8,a",
  };
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# タイトル",
    print: false,
    importMap,
  });
  const plain = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "# タイトル",
    print: false,
    importMap: {},
  });
  // 検証
  const map = html.match(
    /<script\b[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/,
  );
  expect(map).not.toBeNull();
  expect(JSON.parse(map?.[1] ?? "")).toEqual({ imports: importMap });
  expect(html.indexOf('type="importmap"')).toBeLessThan(
    html.indexOf('type="module"'),
  );
  expect(plain).not.toContain("importmap");
});

// エイリアスを JSON に埋め、mount の opts.aliases に指定する（正常系）
test("test_build_export_html_when_aliases", async () => {
  // 準備
  const { buildExportHtml } = await loadHtml();
  const aliases = [
    {
      alias_type: "term" as const,
      id: "render",
      name: "描画",
      aliases: ["レンダリング"],
    },
  ];
  // 実行
  const html = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "レンダリング",
    print: false,
    aliases,
  });
  const plain = buildExportHtml({
    ...BUILD_OPTIONS,
    markdown: "レンダリング",
    print: false,
  });
  // 検証
  const readJson = (text: string) =>
    JSON.parse(
      text.match(
        /<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
      )?.[1] ?? "",
    );
  const readModule = (text: string) =>
    text.match(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/)?.[1] ??
    "";
  expect(readJson(html).aliases).toEqual(aliases);
  expect(readModule(html)).toContain("aliases: data.aliases");
  expect(readJson(plain)).not.toHaveProperty("aliases");
  expect(readModule(plain)).not.toContain("aliases");
});
