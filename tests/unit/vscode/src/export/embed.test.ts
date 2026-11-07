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
  '<div class="box">箱</div>',
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): void => { root.title = 'a'; };",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** パスごとに `export default "{パス}"` を返し、渡されたパスを記録する `bundle` */
function recordingBundle(failing: string[] = []) {
  const calls: string[] = [];
  const bundle = async (paths: string[]) => {
    calls.push(...paths);
    return paths.map((path) =>
      failing.includes(path)
        ? { path, error: "読めない" }
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
    "<!-- test-lib: a -->",
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

// まとめられないものは外して誤りを返し、範囲が無ければ変換のライブラリをまとめない（異常系）
test("test_embed_local_libraries_when_bundle_fails", async () => {
  // 準備
  const { embedLocalLibraries } = await loadEmbed();
  const { bundle, calls } = recordingBundle(["/ws/libs/test.js"]);
  // 実行
  const result = await embedLocalLibraries({
    markdown: "<!-- test-lib: a -->\n",
    libraries: { "test-lib": "/ws/libs/test.js" },
    htmlScripts: { url: "/ws/libs/babel.js" },
    config: { features: { "html-scripts": true } },
    bundle,
  });
  // 検証
  expect(result.libraries).toEqual({});
  expect(result.htmlScripts).toEqual({});
  expect(result.failures).toEqual([
    { path: "/ws/libs/test.js", error: "読めない" },
  ]);
  expect(calls).not.toContain("/ws/libs/babel.js");
});
