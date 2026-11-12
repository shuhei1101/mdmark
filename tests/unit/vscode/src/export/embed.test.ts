import { expect, test } from "vitest";

/** 相対パスのライブラリを埋める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbed = () => import("../../../../../vscode/src/export/embed.ts");

/** 書き出す HTML の処理を読み込む */
const loadHtml = () => import("../../../../../vscode/src/export/html.ts");

/** 範囲の `ts` を持つ `<!-- html -->` の範囲 */
const RANGE = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): void => { root.title = 'a'; };",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** パスごとに `export default "{パス}"` を返却し、指定されたパスを記録する `bundle` */
function recordingBundle(failing: string[] = []) {
  const calls: string[] = [];
  const bundle = async (paths: string[]) => {
    calls.push(...paths);
    return paths.map((path) =>
      failing.includes(path)
        ? { path, error: "読み込めない" }
        : { path, code: `export default ${JSON.stringify(path)};` },
    );
  };
  return { bundle, calls };
}

// マーカーがある相対パスのライブラリと変換のライブラリだけを data: の URL に替える（正常系）
test("test_embed_local_libraries", async () => {
  // 準備
  const { embedLocalLibraries } = await loadEmbed();
  const { moduleDataUrl } = await loadHtml();
  const { bundle, calls } = recordingBundle();
  const markdown = [
    '<!-- test-lib: {"items": ["a"]} -->',
    "",
    "<!-- cdn-lib -->",
    "",
    RANGE,
  ].join("\n");
  // 実行
  const result = await embedLocalLibraries({
    markdown,
    libraries: {
      "test-lib": "/ws/libs/test.js",
      "unused-lib": "/ws/libs/unused.js",
      "cdn-lib": "https://example.com/a.js",
    },
    htmlScripts: { url: "/ws/libs/babel.js" },
    config: { features: { "html-scripts": true } },
    bundle,
  });
  // 検証
  expect(result.libraries).toEqual({
    "test-lib": moduleDataUrl('export default "/ws/libs/test.js";'),
    "cdn-lib": "https://example.com/a.js",
  });
  expect(result.htmlScripts).toEqual({
    url: moduleDataUrl('export default "/ws/libs/babel.js";'),
  });
  expect([...calls].sort()).toEqual(["/ws/libs/babel.js", "/ws/libs/test.js"]);
  expect(result.failures).toEqual([]);
});

// まとめられないものは削除して誤りを返却し、範囲が無ければ変換のライブラリをまとめない（異常系）
test("test_embed_local_libraries_when_bundle_fails", async () => {
  // 準備
  const { embedLocalLibraries } = await loadEmbed();
  const { bundle, calls } = recordingBundle(["/ws/libs/test.js"]);
  // 実行
  const result = await embedLocalLibraries({
    markdown: '<!-- test-lib: {"items": ["a"]} -->\n',
    libraries: { "test-lib": "/ws/libs/test.js" },
    htmlScripts: { url: "/ws/libs/babel.js" },
    config: { features: { "html-scripts": true } },
    bundle,
  });
  // 検証
  expect(result.libraries).toEqual({});
  expect(result.htmlScripts).toEqual({});
  expect(result.failures).toEqual([
    { path: "/ws/libs/test.js", error: "読み込めない" },
  ]);
  expect(calls).not.toContain("/ws/libs/babel.js");
});

// mermaid のコードブロックがある文書のときだけ、相対パスの mermaid.url を data の URL に替える（正常系）
test("test_embed_local_libraries_when_mermaid", async () => {
  // 準備
  const { embedLocalLibraries } = await loadEmbed();
  const { moduleDataUrl } = await loadHtml();
  const used = recordingBundle();
  const unused = recordingBundle();
  const mermaid = { url: "/ws/libs/mermaid.mjs", theme: "neutral" };
  const options = {
    libraries: undefined,
    htmlScripts: undefined,
    config: {},
    mermaid,
  };
  // 実行
  const withBlock = await embedLocalLibraries({
    ...options,
    markdown: "```mermaid\nflowchart LR\n```\n",
    bundle: used.bundle,
  });
  const withoutBlock = await embedLocalLibraries({
    ...options,
    markdown: "# タイトル\n",
    bundle: unused.bundle,
  });
  // 検証
  expect(withBlock.mermaid).toEqual({
    url: moduleDataUrl('export default "/ws/libs/mermaid.mjs";'),
    theme: "neutral",
  });
  expect(used.calls).toContain("/ws/libs/mermaid.mjs");
  expect(unused.calls).not.toContain("/ws/libs/mermaid.mjs");
  expect(withoutBlock.mermaid).toEqual(mermaid);
});

/** 言語 `ts` のコードブロックを 1 つ持つ文書 */
const TS_BLOCK = "```ts\nconst a = 1;\n```\n";

// 文書が使用する言語と本体だけをまとめ、import map で割り当てる（正常系）
test("test_embed_local_syntax", async () => {
  // 準備
  const { embedLocalSyntax } = await loadEmbed();
  const { moduleDataUrl } = await loadHtml();
  const { bundle, calls } = recordingBundle();
  // 実行
  const result = await embedLocalSyntax({
    markdown: TS_BLOCK,
    syntax: { url: "/ws/hljs" },
    config: {},
    bundle,
  });
  // 検証
  expect(result.syntax).toEqual({ url: "file:///ws/hljs/" });
  expect(result.imports).toEqual({
    "file:///ws/hljs/core.min.js": moduleDataUrl(
      'export default "/ws/hljs/core.min.js";',
    ),
    "file:///ws/hljs/languages/typescript.min.js": moduleDataUrl(
      'export default "/ws/hljs/languages/typescript.min.js";',
    ),
  });
  expect([...calls].sort()).toEqual([
    "/ws/hljs/core.min.js",
    "/ws/hljs/languages/typescript.min.js",
  ]);
  expect(result.failures).toEqual([]);
});

// http・https の url と syntax が無いときはそのまま返却する（正常系）
test("test_embed_local_syntax_when_not_local", async () => {
  // 準備
  const { embedLocalSyntax } = await loadEmbed();
  const { bundle, calls } = recordingBundle();
  const remote = { url: "https://cdn.example.com/es/" };
  // 実行
  const withRemote = await embedLocalSyntax({
    markdown: TS_BLOCK,
    syntax: remote,
    config: {},
    bundle,
  });
  const withoutSyntax = await embedLocalSyntax({
    markdown: TS_BLOCK,
    syntax: undefined,
    config: {},
    bundle,
  });
  // 検証
  expect(withRemote.syntax).toEqual(remote);
  expect(withRemote.imports).toEqual({});
  expect(withoutSyntax.syntax).toBeUndefined();
  expect(withoutSyntax.imports).toEqual({});
  expect(calls).toEqual([]);
});

// 色分けの対象が無い文書では url を削除してまとめない（正常系）
test("test_embed_local_syntax_when_unused", async () => {
  // 準備
  const { embedLocalSyntax } = await loadEmbed();
  const { bundle, calls } = recordingBundle();
  // 実行
  const result = await embedLocalSyntax({
    markdown: "# タイトル\n",
    syntax: { url: "/ws/hljs" },
    config: {},
    bundle,
  });
  // 検証
  expect(result.syntax).toBeUndefined();
  expect(result.imports).toEqual({});
  expect(calls).toEqual([]);
});

// まとめられないモジュールは割り当てず誤りを返却する（異常系）
test("test_embed_local_syntax_when_bundle_fails", async () => {
  // 準備
  const { embedLocalSyntax } = await loadEmbed();
  const { bundle } = recordingBundle(["/ws/hljs/languages/typescript.min.js"]);
  // 実行
  const result = await embedLocalSyntax({
    markdown: TS_BLOCK,
    syntax: { url: "/ws/hljs" },
    config: {},
    bundle,
  });
  // 検証
  expect(Object.keys(result.imports)).toEqual(["file:///ws/hljs/core.min.js"]);
  expect(result.failures).toEqual([
    { path: "/ws/hljs/languages/typescript.min.js", error: "読み込めない" },
  ]);
});
