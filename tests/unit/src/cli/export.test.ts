import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  createIo,
  useTempDirs,
  writeDist,
  writeFiles,
} from "../../helpers/cli.ts";

/** 書き出しの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExport = () => import("../../../../src/cli/export.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

/** URL を読み込まない書き出しで使用する、呼ばれたら拒否する URL を読み込む関数 */
const NO_FETCH = async (url: string): Promise<string> => {
  throw new Error(`URL を読み込まない: ${url}`);
};

/** 読み込んだ設定を作る */
function createLoaded(dir: string, config: Record<string, unknown>) {
  return { path: join(dir, "mdmark.config.yaml"), dir, config };
}

// マーカーのあるモジュールだけをまとめ、拡張と theme を読み込む（正常系）
test("test_prepare_embeds", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": '<!-- test-lib: {"items": ["a"]} -->\n',
    "lib/test-lib.js":
      "export function draw(slot) { slot.textContent = 'x'; }\n",
    "lib/other.js": "export function draw(slot) { slot.textContent = 'y'; }\n",
    "extensions/greet.js":
      'export default { name: "greet", directive: "greet", load: async () => ({ draw() {} }) };\n',
    "theme.css": ".mdmark { --mdmark-radius: 0; }\n",
  });
  const loaded = createLoaded(dir, {
    libraries: { "test-lib": "lib/test-lib.js", other: "lib/other.js" },
    extensions: ["extensions/greet.js"],
    theme: "theme.css",
  });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(Object.keys(result.embeds.libraries)).toEqual(["test-lib"]);
  expect(result.embeds.extensions).toEqual([join(dir, "extensions/greet.js")]);
  expect(result.themeCss).toContain("--mdmark-radius");
  expect(result.warnings).toEqual([]);
});

// 読み込めないものを警告にして続ける（正常系）
test("test_prepare_embeds_when_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": '<!-- test-lib: {"items": ["a"]} -->\n',
  });
  const loaded = createLoaded(dir, {
    libraries: { "test-lib": "lib/missing.js" },
    theme: "missing.css",
  });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.embeds.libraries).toEqual({});
  const warnings = result.warnings.join("\n");
  expect(warnings).toContain("test-lib");
  expect(warnings).toContain("missing.css");
});

// 索引があれば参照の表と docId を入れる（正常系）
test("test_prepare_embeds_when_index", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: guide",
      "    path: guide.md",
      "    title: Guide",
      "  - id: api",
      "    path: api.md",
      "    title: API",
      "    related: [guide]",
      "",
    ].join("\n"),
    "guide.md": "# Guide\n",
    "api.md": "# API\n",
  });
  const loaded = createLoaded(dir, { index: "index.yaml" });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [
      { path: "guide.md", file: join(dir, "guide.md") },
      { path: "api.md", file: join(dir, "api.md") },
    ],
    kind: "bundle",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.payload.references?.backlinks.guide).toContain("api");
  expect(
    result.payload.docs.find((doc) => doc.path === "guide.md")?.docId,
  ).toBe("guide");
});

// 既定の出力に HTML を書き込む（正常系）
test("test_run_export", async () => {
  // 準備
  const { runExport } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# タイトル\n",
  });
  const distDir = await writeDist(dir);
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runExport({ file: "guide.md", distDir }, io);
  // 検証
  expect(code).toBe(0);
  expect(await readFile(join(dir, "guide.html"), "utf8")).toContain(
    "mdmark-payload",
  );
  expect(stdout).toEqual(["書き出した: guide.html"]);
});

// 無い文書は CliError（異常系）
test("test_run_export_when_document_missing", async () => {
  // 準備
  const { runExport } = await loadExport();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runExport({ file: "missing.md", distDir }, io);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("missing.md");
});

// 書き込めない出力先は CliError（異常系）
test("test_run_export_when_output_unwritable", async () => {
  // 準備
  const { runExport } = await loadExport();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# タイトル\n",
    blocked: "ファイル\n",
  });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runExport(
    { file: "guide.md", out: "blocked/guide.html", distDir },
    io,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("blocked/guide.html");
});

// HTML を書き込んで絶対パスと警告を返却する（正常系）
test("test_export_document", async () => {
  // 準備
  const { exportDocument } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# タイトル\n\n![図](missing.png)\n",
  });
  const distDir = await writeDist(dir);
  // 実行
  const result = await exportDocument({ cwd: dir, file: "guide.md", distDir });
  // 検証
  expect(result.out).toBe(join(dir, "guide.html"));
  expect(await readFile(result.out, "utf8")).toContain("mdmark-payload");
  expect(result.display).toBe("guide.html");
  expect(result.warnings).toHaveLength(1);
});

// keepTraces のときは名前を置き換えない（正常系）
test("test_export_document_when_traces_kept", async () => {
  // 準備
  const { exportDocument } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# タイトル\n",
  });
  const distDir = await writeDist(dir);
  await writeFiles(dir, {
    "dist/index.css": ':root{--mdmark-version:"v0.12.0"}\n.mdmark{}',
  });
  // 実行
  const kept = await exportDocument({
    cwd: dir,
    file: "guide.md",
    out: "kept.html",
    distDir,
    keepTraces: true,
  });
  const hidden = await exportDocument({
    cwd: dir,
    file: "guide.md",
    out: "hidden.html",
    distDir,
  });
  // 検証
  const keptHtml = await readFile(kept.out, "utf8");
  const hiddenHtml = await readFile(hidden.out, "utf8");
  expect(keptHtml).toContain('id="mdmark-payload"');
  expect(keptHtml).toContain("--mdmark-version");
  expect(hiddenHtml).not.toContain('id="mdmark-payload"');
  expect(hiddenHtml).not.toContain("--mdmark-version");
});

// 無い文書は何も書き込まずに CliError（異常系）
test("test_export_document_when_document_missing", async () => {
  // 準備
  const { exportDocument } = await loadExport();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const distDir = await writeDist(dir);
  // 実行
  const result = exportDocument({ cwd: dir, file: "missing.md", distDir });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("missing.md");
  expect(existsSync(join(dir, "missing.html"))).toBe(false);
});

// 設定の tooltips を埋める設定に写す（正常系）
test("test_prepare_embeds_when_tooltip_placement", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const withTooltips = await prepare({ tooltips: { placement: "bottom" } });
  const withoutTooltips = await prepare({ features: { print: true } });
  // 検証
  expect(withTooltips.payload.config.tooltips).toEqual({
    placement: "bottom",
  });
  expect(withoutTooltips.payload.config).not.toHaveProperty("tooltips");
});

// 設定の labels を埋める設定に写す（正常系）
test("test_prepare_embeds_when_labels", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const withLabels = await prepare({ labels: { paramCopy: "コピー" } });
  const withoutLabels = await prepare({ features: { print: true } });
  // 検証
  expect(withLabels.payload.config.labels).toEqual({ paramCopy: "コピー" });
  expect(withoutLabels.payload.config).not.toHaveProperty("labels");
});

// 設定の map を埋める設定に写す（正常系）
test("test_prepare_embeds_when_map", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  const map = { kinds: { store: { label: "保存先" } } };
  // 実行
  const withMap = await prepare({ map });
  const withoutMap = await prepare({ features: { print: true } });
  // 検証
  expect(withMap.payload.config.map).toEqual(map);
  expect(withoutMap.payload.config).not.toHaveProperty("map");
});

// 設定の side-toc を埋める設定に写す（正常系）
test("test_prepare_embeds_when_side_toc_mode", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const withSideToc = await prepare({ "side-toc": { mode: "fixed" } });
  const withoutSideToc = await prepare({ features: { print: true } });
  // 検証
  expect(withSideToc.payload.config["side-toc"]).toEqual({ mode: "fixed" });
  expect(withoutSideToc.payload.config).not.toHaveProperty("side-toc");
});

// 設定の table を埋める設定に写す（正常系）
test("test_prepare_embeds_when_table_pin", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const withTable = await prepare({ table: { pin: "through" } });
  const withoutTable = await prepare({ features: { print: true } });
  // 検証
  expect(withTable.payload.config.table).toEqual({ pin: "through" });
  expect(withoutTable.payload.config).not.toHaveProperty("table");
});

// 設定の colorTheme を埋める設定にコピーし、知らない名前はコピーして警告する（正常系）
test("test_prepare_embeds_when_color_theme", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const known = await prepare({ colorTheme: "theme-slate" });
  const unknown = await prepare({ colorTheme: "sepia" });
  const omitted = await prepare({ features: { print: true } });
  // 検証
  expect(known.payload.config.colorTheme).toBe("theme-slate");
  expect(known.warnings).toEqual([]);
  expect(unknown.payload.config.colorTheme).toBe("sepia");
  expect(unknown.warnings).toHaveLength(1);
  expect(unknown.warnings[0]).toContain("sepia");
  expect(omitted.payload.config).not.toHaveProperty("colorTheme");
});

// 設定の colorScheme を埋める設定に写す（正常系）
test("test_prepare_embeds_when_color_scheme", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      fetchText: NO_FETCH,
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
      out: join(dir, "guide.html"),
    });
  // 実行
  const given = await prepare({ colorScheme: "dark" });
  const omitted = await prepare({ features: { print: true } });
  // 検証
  expect(given.payload.config.colorScheme).toBe("dark");
  expect(omitted.payload.config).not.toHaveProperty("colorScheme");
});

/** 色分けのライブラリの代役のモジュールを記載する（`hl/` の下に本体と言語の分を配置する） */
const SYNTAX_MODULES = {
  "hl/core.min.js":
    "export default { registerLanguage() {}, highlight() {} };\n",
  "hl/languages/typescript.min.js":
    'export default function typescript() { return { name: "TypeScript" }; }\n',
  "hl/languages/yaml.min.js":
    'export default function yaml() { return { name: "YAML" }; }\n',
};

// 文書が使用する言語だけ色分けのモジュールをまとめ、埋める設定に syntax を写さない（正常系）
test("test_prepare_embeds_when_syntax", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "```ts\nconst a = 1;\n```\n",
    ...SYNTAX_MODULES,
  });
  const loaded = createLoaded(dir, { syntax: { url: "hl/" } });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.embeds.syntax?.core).toBe(join(dir, "hl/core.min.js"));
  expect(Object.keys(result.embeds.syntax?.languages ?? {})).toEqual([
    "typescript",
  ]);
  expect(result.payload.config).not.toHaveProperty("syntax");
  expect(result.warnings).toEqual([]);
});

// 色分けの本体をまとめられなければ警告にして埋めずに続ける（正常系）
test("test_prepare_embeds_when_syntax_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "```ts\nconst a = 1;\n```\n" });
  const loaded = createLoaded(dir, { syntax: { url: "missing/" } });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.embeds.syntax).toBeUndefined();
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("missing/core.min.js");
  expect(result.warnings[0]).toContain("syntax.url");
});

// mermaid のコードブロックがある文書だけ mermaid をまとめ、埋める設定に url を写さない（正常系）
test("test_prepare_embeds_when_mermaid", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "```mermaid\nflowchart LR\n```\n",
    "plain.md": "# タイトル\n",
    "vendor/mermaid.mjs": "export default { initialize() {}, render() {} };\n",
  });
  const loaded = createLoaded(dir, {
    mermaid: { url: "vendor/mermaid.mjs", theme: "neutral" },
  });
  const options = {
    fetchText: NO_FETCH,
    loaded,
    kind: "document" as const,
  };
  // 実行
  const used = await prepareEmbeds({
    ...options,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  const unused = await prepareEmbeds({
    ...options,
    docs: [{ path: "plain.md", file: join(dir, "plain.md") }],
    entry: "plain.md",
    out: join(dir, "plain.html"),
  });
  // 検証
  expect(used.embeds.mermaid).toBe(join(dir, "vendor/mermaid.mjs"));
  expect(used.payload.config.mermaid).toEqual({ theme: "neutral" });
  expect(used.warnings).toEqual([]);
  expect(unused.embeds.mermaid).toBeUndefined();
});

// mermaid をまとめられなければ警告にして埋めずに続ける（正常系）
test("test_prepare_embeds_when_mermaid_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "```mermaid\nflowchart LR\n```\n" });
  const loaded = createLoaded(dir, { mermaid: { url: "missing/mermaid.mjs" } });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.embeds.mermaid).toBeUndefined();
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("missing/mermaid.mjs");
  expect(result.warnings[0]).toContain("mermaid.url");
});

// まとめられない言語だけ埋めずに警告にし、他の言語は埋める（正常系）
test("test_prepare_embeds_when_syntax_language_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  const { "hl/languages/yaml.min.js": _yaml, ...withoutYaml } = SYNTAX_MODULES;
  await writeFiles(dir, {
    "guide.md": "```ts\nconst a = 1;\n```\n\n```yml\na: 1\n```\n",
    ...withoutYaml,
  });
  const loaded = createLoaded(dir, { syntax: { url: "hl/" } });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(Object.keys(result.embeds.syntax?.languages ?? {})).toEqual([
    "typescript",
  ]);
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("hl/languages/yaml.min.js");
  expect(result.warnings[0]).toContain("syntax.url");
});

// まとめた後に動的 import が残る拡張を入れたうえで警告にする（正常系）
test("test_prepare_embeds_when_dynamic_import_left", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "# タイトル\n",
    "extensions/dynamic.js": [
      'const name = "./part.js";',
      'export default { name: "dynamic", directive: "dynamic", load: () => import(name) };',
      "",
    ].join("\n"),
  });
  const loaded = createLoaded(dir, { extensions: ["extensions/dynamic.js"] });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.embeds.extensions).toHaveLength(1);
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("extensions/dynamic.js");
  expect(result.warnings[0]).toContain("動的 import()");
});

// エイリアスを payload に入れ、ずれを警告にする（正常系）
test("test_prepare_embeds_when_aliases", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "テストを実行すると開発サーバーを使用する。\n",
    "aliases/commands.yaml":
      "id: run-test\nname: テストを流す\ncommand: npm test\n",
    "aliases/servers.yaml":
      "id: dev-server\nname: 開発サーバー\nurl: http://127.0.0.1:8767/\n",
    "aliases/terms.yaml": "id: empty-term\nname: 空の用語\n",
  });
  const loaded = createLoaded(dir, {
    aliases: [
      {
        id: "commands",
        paths: ["aliases/commands.yaml"],
        alias_type: "command",
      },
      { id: "servers", paths: ["aliases/servers.yaml"], alias_type: "env" },
      { id: "terms", paths: ["aliases/terms.yaml"], alias_type: "term" },
    ],
  });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  // env は埋めず、使用できるコマンドだけが入る
  expect(result.payload.aliases).toHaveLength(1);
  expect(result.payload.aliases?.[0]).toMatchObject({
    alias_type: "command",
    id: "run-test",
  });
  expect(JSON.stringify(result.payload)).not.toContain("dev-server");
  // description が空の用語は、`{ファイル}:{場所}: {種類}: {内容}` の警告 1 件
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain(
    "aliases/terms.yaml:description: alias_required_empty: ",
  );
});

/** 中身を持たない PNG のファイル */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

// 動画をコピーしてから画像を埋める（正常系）
test("test_prepare_embeds_when_media", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": [
      "![操作](demo.mp4){poster=demo.png}",
      "",
      "![図](a.png)",
      "",
    ].join("\n"),
    "assets/demo.mp4": new Uint8Array([0, 0, 0, 24]),
    "assets/demo.png": PNG_BYTES,
    "assets/a.png": PNG_BYTES,
  });
  const loaded = createLoaded(dir, { assets: { root: "assets" } });
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  const copied = await readdir(join(dir, "guide_files"), { recursive: true });
  expect(copied.some((path) => path.endsWith("demo.mp4"))).toBe(true);
  const markdown = result.payload.docs[0]?.markdown ?? "";
  expect(markdown).toMatch(/\]\(guide_files\/[^)\s]*demo\.mp4\)/);
  expect(markdown).toMatch(/\{poster=data:image\/png;base64,[^}\s]+\}/);
  expect(markdown).toMatch(/!\[図\]\(data:image\/png;base64,[^)\s]+\)/);
});

// 動画のコピー先へ書き込めなければ HTML を書き込まずに CliError（異常系）
test("test_export_document_when_media_unwritable", async () => {
  // 準備
  const { exportDocument } = await loadExport();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "![操作](demo.mp4)\n",
    "demo.mp4": new Uint8Array([0, 0, 0, 24]),
    guide_files: "ファイル",
  });
  const distDir = await writeDist(dir);
  // 実行
  const result = exportDocument({ cwd: dir, file: "guide.md", distDir });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  expect(existsSync(join(dir, "guide.html"))).toBe(false);
});

// 設定の tooltips.diagramPlacement を埋める設定に写す（正常系）
test("test_prepare_embeds_when_diagram_placement", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  // 実行
  const result = await prepareEmbeds({
    fetchText: NO_FETCH,
    loaded: createLoaded(dir, {
      tooltips: { placement: "bottom", diagramPlacement: "top" },
    }),
    docs,
    kind: "document",
    entry: "guide.md",
    out: join(dir, "guide.html"),
  });
  // 検証
  expect(result.payload.config.tooltips).toEqual({
    placement: "bottom",
    diagramPlacement: "top",
  });
});
