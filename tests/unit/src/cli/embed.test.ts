import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, vi } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 埋め込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbed = () => import("../../../../src/cli/embed.ts");

/** esbuild を指定してまとめる処理を読み込む */
const loadBundleModule = () => import("../../../../src/bundle-module.ts");

const createTempDir = useTempDirs();

// ビューのマーカーがあるときだけ部品をまとめる（正常系）
test("test_used_parts", async () => {
  // 準備
  const { usedParts } = await loadEmbed();
  const marked =
    '<!-- view: {"board": {"group": {"column": "状態"}}} -->\n\n| タイトル |\n| --- |\n| a |\n\n<!-- /view -->\n';
  const unmarked =
    '<!-- table: {"kind": "data"} -->\n\n| タイトル |\n| --- |\n| a |\n\n<!-- /table -->\n';
  // 実行
  const withView = usedParts({ markdowns: [unmarked, marked] });
  const withoutView = usedParts({ markdowns: [unmarked] });
  // 検証
  expect(withView).toBe(true);
  expect(withoutView).toBe(false);
});

// 手元のファイルとその import を 1 つにまとめる（正常系）
test("test_bundle_module", async () => {
  // 準備
  const { bundleModule } = await loadBundleModule();
  const { build } = await import("esbuild");
  const dir = await createTempDir();
  await writeFiles(dir, {
    "lib.ts": [
      'import { label } from "./dep.ts";',
      "export function draw(slot: HTMLElement): void {",
      "  slot.textContent = label;",
      "}",
      "",
    ].join("\n"),
    "dep.ts": 'export const label: string = "ラベル";\n',
  });
  // 実行
  const result = await bundleModule("lib.ts", dir, undefined, build);
  // 検証
  if (!("code" in result)) {
    throw new Error(`まとめられなかった: ${result.error}`);
  }
  expect(result.code).not.toMatch(/\bimport\b/);
  expect(result.code).toContain("draw");
  expect(result.code).toMatch(/\bexport\b/);
});

// URL とそのルート相対の import を fetchText で読み込んでまとめる（正常系）
test("test_bundle_module_when_url", async () => {
  // 準備
  const { bundleModule } = await loadBundleModule();
  const { build } = await import("esbuild");
  const dir = await createTempDir();
  const bodies: Record<string, string> = {
    "https://cdn.example/npm/a/+esm":
      'import { b } from "/npm/b/+esm"; export const draw = () => b;',
    "https://cdn.example/npm/b/+esm": "export const b = 1;",
  };
  const fetchText = vi.fn(async (url: string) => {
    const body = bodies[url];
    if (body === undefined) {
      throw new Error(`読み込めない URL: ${url}`);
    }
    return body;
  });
  // 実行
  const result = await bundleModule(
    "https://cdn.example/npm/a/+esm",
    dir,
    fetchText,
    build,
  );
  // 検証
  if (!("code" in result)) {
    throw new Error(`まとめられなかった: ${result.error}`);
  }
  expect(fetchText).toHaveBeenCalledWith("https://cdn.example/npm/b/+esm");
  expect(result.code).not.toContain("https:");
  expect(result.code).not.toContain("/npm/");
});

// 読み込めないモジュールは理由を返却する（異常系）
test("test_bundle_module_when_unreachable", async () => {
  // 準備
  const { bundleModule } = await loadBundleModule();
  const { build } = await import("esbuild");
  const dir = await createTempDir();
  // 実行
  const result = await bundleModule("missing.js", dir, undefined, build);
  // 検証
  if (!("error" in result)) {
    throw new Error("まとめられてしまった");
  }
  expect(result.error).toContain("missing.js");
});

// 相対パスの画像を data: URL に替える（正常系）
test("test_inline_images", async () => {
  // 準備
  const { inlineImages } = await loadEmbed();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "img/a.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  // 実行
  const result = await inlineImages("![図](img/a.png)\n", join(dir, "doc.md"));
  // 検証
  expect(result.markdown).toContain("data:image/png;base64,");
  expect(result.warnings).toEqual([]);
});

// 読み込めない画像は残して警告にする（正常系）
test("test_inline_images_when_missing", async () => {
  // 準備
  const { inlineImages } = await loadEmbed();
  const dir = await createTempDir();
  const markdown = "![図](img/missing.png)\n";
  // 実行
  const result = await inlineImages(markdown, join(dir, "doc.md"));
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.warnings.join("\n")).toContain("img/missing.png");
});

// 絶対 URL の画像は読み込まずに警告にする（正常系）
test("test_inline_images_when_absolute_url", async () => {
  // 準備
  const { inlineImages } = await loadEmbed();
  const dir = await createTempDir();
  const markdown = "![図](https://example.com/a.png)\n";
  // 実行
  const result = await inlineImages(markdown, join(dir, "doc.md"));
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.warnings.join("\n")).toContain("https://example.com/a.png");
});

// まとめる文書に無い .md へのリンクだけを返却する（正常系）
test("test_find_outside_links", async () => {
  // 準備
  const { findOutsideLinks } = await loadEmbed();
  const markdown = [
    "[a](使い方/guide.md)",
    "[b](下書き/メモ.md)",
    "[c](#見出し)",
    "[d](https://example.com/x.md)",
    "",
  ].join("\n");
  // 実行
  const links = findOutsideLinks(
    markdown,
    "README.md",
    new Set(["README.md", "使い方/guide.md"]),
  );
  // 検証
  expect(links).toEqual(["下書き/メモ.md"]);
});

// アセットのルートの画像とフラグメントと poster を替える（正常系）
test("test_inline_images_when_assets_root", async () => {
  // 準備
  const { inlineImages } = await loadEmbed();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "assets/a.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  const markdown = [
    "![図](a.png#only-dark)",
    "",
    "![操作](demo.mp4){poster=a.png}",
    "",
  ].join("\n");
  // 実行
  const result = await inlineImages(markdown, join(dir, "doc.md"), {
    assetsRoot: join(dir, "assets"),
  });
  // 検証
  expect(result.markdown).toMatch(
    /!\[図\]\(data:image\/png;base64,[A-Za-z0-9+/=]+#only-dark\)/,
  );
  expect(result.markdown).toMatch(
    /\{poster=data:image\/png;base64,[A-Za-z0-9+/=]+\}/,
  );
  expect(result.markdown).toContain("](demo.mp4)");
});

// build では同じ画像を 1 つのキーにする（正常系）
test("test_inline_images_when_shared", async () => {
  // 準備
  const { inlineImages } = await loadEmbed();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "img/a.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  const assets = new Map<string, { key: string; url: string }>();
  // 実行
  const first = await inlineImages("![図](img/a.png)\n", join(dir, "a.md"), {
    assets,
  });
  const second = await inlineImages(
    "![同じ図](img/a.png)\n",
    join(dir, "b.md"),
    { assets },
  );
  // 検証
  const keyOf = (markdown: string) =>
    /\]\((mdmark-asset:[^)\s]+)\)/.exec(markdown)?.[1];
  expect(keyOf(first.markdown)).toBeDefined();
  expect(keyOf(second.markdown)).toBe(keyOf(first.markdown));
  expect(assets.size).toBe(1);
});

// 残った動的 import を見つけ、無ければ false（正常系）
test("test_has_dynamic_import", async () => {
  // 準備
  const { hasDynamicImport } = await loadEmbed();
  // 実行・検証
  expect(hasDynamicImport("a.load=()=>import(n)")).toBe(true);
  expect(hasDynamicImport("import (n)")).toBe(true);
  expect(hasDynamicImport("const x=1")).toBe(false);
});

// 同じ URL を 1 回だけ読み込む（正常系）
test("test_cache_fetch_text", async () => {
  // 準備
  const { cacheFetchText } = await loadEmbed();
  const fetchText = vi.fn(async (url: string) => `本文:${url}`);
  const cached = cacheFetchText(fetchText);
  // 実行
  const first = await cached("https://cdn.example/a.js");
  const second = await cached("https://cdn.example/a.js");
  const other = await cached("https://cdn.example/b.js");
  // 検証
  expect(fetchText).toHaveBeenCalledTimes(2);
  expect(second).toBe(first);
  expect(other).toBe("本文:https://cdn.example/b.js");
});

// 部品と色分けを静的に、外部ライブラリと拡張を関数で取り込む（正常系）
test("test_create_viewer_entry", async () => {
  // 準備
  const { createViewerEntry } = await loadEmbed();
  // 実行
  const source = createViewerEntry({
    viewer: "/w/dist/viewer.js",
    view: "/w/dist/view.js",
    embeds: {
      view: true,
      libraries: { chart: "https://cdn.example/chart.js" },
      extensions: ["/w/ext.js"],
      syntax: {
        core: "/w/hl/core.min.js",
        languages: { typescript: "/w/hl/languages/typescript.min.js" },
      },
    },
  });
  // 検証
  const staticImports = [
    ...source.matchAll(/^import\s.*from\s*"([^"]+)"/gm),
  ].map((match) => match[1]);
  expect(staticImports).toEqual(
    expect.arrayContaining([
      "/w/dist/viewer.js",
      "/w/dist/view.js",
      "/w/hl/core.min.js",
      "/w/hl/languages/typescript.min.js",
    ]),
  );
  expect(source).toContain('() => import("https://cdn.example/chart.js")');
  expect(source).toContain('() => import("/w/ext.js")');
  expect(staticImports).not.toContain("https://cdn.example/chart.js");
  expect(staticImports).not.toContain("/w/ext.js");
  expect(source.match(/startViewer\(document,/g)).toHaveLength(1);
});

// 埋めるものが無ければ起動の処理だけを取り込む（正常系）
test("test_create_viewer_entry_when_nothing_embedded", async () => {
  // 準備
  const { createViewerEntry } = await loadEmbed();
  // 実行
  const source = createViewerEntry({
    viewer: "/w/dist/viewer.js",
    view: "/w/dist/view.js",
    embeds: { view: false, libraries: {}, extensions: [] },
  });
  // 検証
  const imports = source.match(/^import\s/gm) ?? [];
  expect(imports).toHaveLength(1);
  expect(source).toMatch(
    /^import\s.*startViewer.*from\s*"\/w\/dist\/viewer\.js"/m,
  );
  expect(source).toContain("parts: {}");
  expect(source).not.toContain("syntax");
});

// mermaid を名前空間で静的に取り込む（正常系）
test("test_create_viewer_entry_when_mermaid", async () => {
  // 準備
  const { createViewerEntry } = await loadEmbed();
  const url =
    "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
  // 実行
  const source = createViewerEntry({
    viewer: "/w/dist/viewer.js",
    view: "/w/dist/view.js",
    embeds: { view: false, libraries: {}, extensions: [], mermaid: url },
  });
  // 検証
  const mermaidImports = source
    .split("\n")
    .filter(
      (line) =>
        /^import \* as \w+ from /.test(line) &&
        line.includes(JSON.stringify(url)),
    );
  expect(mermaidImports).toHaveLength(1);
  expect(source).toMatch(/startViewer\(document,[\s\S]*\bmermaid\b/);
});

/** startViewer を export する起動の処理と、load の中で ./part.js を動的 import で読み込む拡張を配置する */
async function writeViewerFixture(
  dir: string,
  extension: string,
): Promise<void> {
  await writeFiles(dir, {
    "viewer.js":
      "export function startViewer(doc, embedded) { globalThis.__embedded = embedded; }\n",
    "ext.js": extension,
    "part.js": 'export const partMarker = "part-module-marker";\n',
  });
}

/** viewer.js を静的に、ext.js を関数で取り込む入口 */
function fixtureEntry(dir: string): string {
  return [
    `import { startViewer } from ${JSON.stringify(join(dir, "viewer.js"))};`,
    `startViewer(document, { parts: {}, libraries: {}, extensions: [() => import(${JSON.stringify(join(dir, "ext.js"))})] });`,
  ].join("\n");
}

// 入口と関数で取り込んだモジュールを 1 つにまとめ、動的 import を残さない（正常系）
test("test_bundle_viewer", async () => {
  // 準備
  const { bundleViewer } = await loadEmbed();
  const dir = await createTempDir();
  await writeViewerFixture(
    dir,
    'export default { name: "ext", load: () => import("./part.js") };\n',
  );
  // 実行
  const script = await bundleViewer({
    entry: fixtureEntry(dir),
    baseDir: dir,
    fetchText: vi.fn(),
  });
  // 検証
  expect(script).not.toContain("import(");
  expect(script).not.toContain('from"');
  expect(script).toContain("part-module-marker");
});

// </script を替えて返却する（正常系）
test("test_bundle_viewer_when_script_close", async () => {
  // 準備
  const { bundleViewer } = await loadEmbed();
  const dir = await createTempDir();
  await writeViewerFixture(
    dir,
    '/*! </SCRIPT> */\nexport default { name: "ext", load: async () => ({}) };\n',
  );
  // 実行
  const script = await bundleViewer({
    entry: fixtureEntry(dir),
    baseDir: dir,
    fetchText: vi.fn(),
  });
  // 検証
  expect(script).not.toMatch(/<\/script/i);
  expect(script).toContain("<\\/SCRIPT>");
});

// <!-- を替え、評価した文字列は元と同じ（正常系）
test("test_bundle_viewer_when_html_comment_open", async () => {
  // 準備
  const { bundleViewer } = await loadEmbed();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "ext.js": 'export const value = "<!-- <script>";\n',
  });
  // 実行
  const script = await bundleViewer({
    entry: `export { value } from ${JSON.stringify(join(dir, "ext.js"))};`,
    baseDir: dir,
    fetchText: vi.fn(),
  });
  // 検証
  expect(script).not.toContain("<!--");
  await writeFiles(dir, { "out.mjs": script });
  const evaluated = (await import(
    /* @vite-ignore */ pathToFileURL(join(dir, "out.mjs")).href
  )) as { value: string };
  expect(evaluated.value).toBe("<!-- <script>");
});

/** 範囲に `html` と、言語 `lang` のコードブロックを配置した文書 */
function rangeScriptDoc(lang: string, code: string): string {
  return [
    "<!-- html -->",
    "",
    "```html",
    '<button class="toggle" type="button">開く</button>',
    "```",
    "",
    `\`\`\`${lang}`,
    code,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
}

/** 型の注釈を持つ既定のエクスポートの関数の `ts` */
const TYPED_SCRIPT =
  'export default (root: HTMLElement): void => { root.classList.add("is-open"); };';

// 範囲の `ts` の型を削除して CommonJS にし、同じコードは 1 つにする（正常系）
test("test_compile_html_scripts", async () => {
  // 準備
  const { compileHtmlScripts } = await loadEmbed();
  const markdown = rangeScriptDoc("ts", TYPED_SCRIPT);
  // 実行
  const { scripts, warnings } = await compileHtmlScripts({
    documents: [
      { path: "a.md", markdown },
      { path: "b.md", markdown },
    ],
    config: { features: { "html-scripts": true } },
  });
  // 検証
  expect(scripts).toHaveLength(1);
  expect(scripts[0]?.source).toContain("root: HTMLElement");
  expect(scripts[0]?.code).toMatch(/exports\.default\s*=|default:\s*\(\)\s*=>/);
  expect(scripts[0]?.code).not.toContain(": HTMLElement");
  expect(scripts[0]?.code).not.toContain("): void");
  expect(warnings).toEqual([]);
});

// `html-scripts` がオフの文書は変えない（正常系）
test("test_compile_html_scripts_when_off", async () => {
  // 準備
  const { compileHtmlScripts } = await loadEmbed();
  // 実行
  const { scripts } = await compileHtmlScripts({
    documents: [{ path: "a.md", markdown: rangeScriptDoc("ts", TYPED_SCRIPT) }],
    config: {},
  });
  // 検証
  expect(scripts).toEqual([]);
});

// 変えられない範囲は警告にし、返却しない（異常系）
test("test_compile_html_scripts_when_syntax_error", async () => {
  // 準備
  const { compileHtmlScripts } = await loadEmbed();
  const markdown = rangeScriptDoc("js", "export default (root) => {");
  // 実行
  const { scripts, warnings } = await compileHtmlScripts({
    documents: [{ path: "docs/broken.md", markdown }],
    config: { features: { "html-scripts": true } },
  });
  // 検証
  expect(scripts).toEqual([]);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("docs/broken.md");
  expect(warnings[0]).not.toContain("\n");
});

// map の範囲があるときだけ（正常系）
test("test_uses_map", async () => {
  // 準備
  const { usesMap } = await loadEmbed();
  const { mapRange, FLOW } = await import("../../helpers/map.ts");
  // 実行
  const withMap = usesMap({
    markdowns: ["# A\n", mapRange({ mermaid: FLOW })],
    config: {},
  });
  const withoutMap = usesMap({ markdowns: ["# A\n"], config: {} });
  // 検証
  expect(withMap).toBe(true);
  expect(withoutMap).toBe(false);
});

// 機能を外した文書（正常系）
test("test_uses_map_when_disabled", async () => {
  // 準備
  const { usesMap } = await loadEmbed();
  const { mapRange, FLOW } = await import("../../helpers/map.ts");
  // 実行
  const used = usesMap({
    markdowns: [
      `<!-- features: {"map": false} -->\n\n${mapRange({ mermaid: FLOW })}`,
    ],
    config: {},
  });
  // 検証
  expect(used).toBe(false);
});
