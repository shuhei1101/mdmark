import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

/** 読んだ設定を作る */
function createLoaded(dir: string, config: Record<string, unknown>) {
  return { path: join(dir, "mdmark.config.yaml"), dir, config };
}

// 印のあるモジュールだけを束ね、拡張と theme を読む（正常系）
test("test_prepare_embeds", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "<!-- test-lib: a -->\n",
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
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  expect(Object.keys(result.payload.modules)).toEqual(["test-lib"]);
  expect(result.payload.extensions).toHaveLength(1);
  expect(result.themeCss).toContain("--mdmark-radius");
  expect(result.warnings).toEqual([]);
});

// 読めないものを警告にして続ける（正常系）
test("test_prepare_embeds_when_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "<!-- test-lib: a -->\n" });
  const loaded = createLoaded(dir, {
    libraries: { "test-lib": "lib/missing.js" },
    theme: "missing.css",
  });
  // 実行
  const result = await prepareEmbeds({
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  expect(result.payload.modules).toEqual({});
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
      "schema: 1",
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
    loaded,
    docs: [
      { path: "guide.md", file: join(dir, "guide.md") },
      { path: "api.md", file: join(dir, "api.md") },
    ],
    kind: "bundle",
    entry: "guide.md",
  });
  // 検証
  expect(result.payload.references?.backlinks.guide).toContain("api");
  expect(
    result.payload.docs.find((doc) => doc.path === "guide.md")?.docId,
  ).toBe("guide");
});

// 既定の出力に HTML を書く（正常系）
test("test_run_export", async () => {
  // 準備
  const { runExport } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# 題\n",
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

// 書けない出力先は CliError（異常系）
test("test_run_export_when_output_unwritable", async () => {
  // 準備
  const { runExport } = await loadExport();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# 題\n",
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

// HTML を書いて絶対パスと警告を返す（正常系）
test("test_export_document", async () => {
  // 準備
  const { exportDocument } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# 題\n\n![図](missing.png)\n",
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

// 無い文書は何も書かずに CliError（異常系）
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
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
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

// 設定の side-toc を埋める設定に写す（正常系）
test("test_prepare_embeds_when_side_toc_mode", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
    });
  // 実行
  const withSideToc = await prepare({ "side-toc": { mode: "fixed" } });
  const withoutSideToc = await prepare({ features: { print: true } });
  // 検証
  expect(withSideToc.payload.config["side-toc"]).toEqual({ mode: "fixed" });
  expect(withoutSideToc.payload.config).not.toHaveProperty("side-toc");
});

// 設定の colorTheme を埋める設定に写し、知らない名前は写して警告する（正常系）
test("test_prepare_embeds_when_color_theme", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "# Guide\n" });
  const docs = [{ path: "guide.md", file: join(dir, "guide.md") }];
  const prepare = (config: Record<string, unknown>) =>
    prepareEmbeds({
      loaded: createLoaded(dir, config),
      docs,
      kind: "document",
      entry: "guide.md",
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

/** 色分けのライブラリの代役のモジュールを書く（`hl/` の下に本体と言語の分を置く） */
const SYNTAX_MODULES = {
  "hl/core.min.js":
    "export default { registerLanguage() {}, highlight() {} };\n",
  "hl/languages/typescript.min.js":
    'export default function typescript() { return { name: "TypeScript" }; }\n',
  "hl/languages/yaml.min.js":
    'export default function yaml() { return { name: "YAML" }; }\n',
};

// 文書が使う言語だけ色分けのモジュールを束ね、埋める設定に syntax を写さない（正常系）
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
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  expect(result.payload.syntax?.core).toBeTruthy();
  expect(Object.keys(result.payload.syntax?.languages ?? {})).toEqual([
    "typescript",
  ]);
  expect(result.payload.config).not.toHaveProperty("syntax");
  expect(result.warnings).toEqual([]);
});

// 色分けの本体を束ねられなければ警告にして埋めずに続ける（正常系）
test("test_prepare_embeds_when_syntax_unreadable", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.md": "```ts\nconst a = 1;\n```\n" });
  const loaded = createLoaded(dir, { syntax: { url: "missing/" } });
  // 実行
  const result = await prepareEmbeds({
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  expect(result.payload.syntax).toBeUndefined();
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("missing/core.min.js");
  expect(result.warnings[0]).toContain("syntax.url");
});

// 束ねられない言語だけ埋めずに警告にし、他の言語は埋める（正常系）
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
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  expect(Object.keys(result.payload.syntax?.languages ?? {})).toEqual([
    "typescript",
  ]);
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("hl/languages/yaml.min.js");
  expect(result.warnings[0]).toContain("syntax.url");
});

// エイリアスを payload に入れ、ずれを警告にする（正常系）
test("test_prepare_embeds_when_aliases", async () => {
  // 準備
  const { prepareEmbeds } = await loadExport();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "guide.md": "テストを流すと開発サーバーを使う。\n",
    "aliases/command.yaml":
      "alias_type: command\nid: run-test\nname: テストを流す\ncommand: npm test\n",
    "aliases/env.yaml":
      "alias_type: env\nid: dev-server\nname: 開発サーバー\nurl: http://127.0.0.1:8767/\n",
    "aliases/term.yaml": "alias_type: term\nid: empty-term\nname: 空の用語\n",
  });
  const loaded = createLoaded(dir, {
    aliases: [
      {
        id: "records",
        paths: ["aliases/*.yaml"],
        metadata: { alias_type: { type: "ref", field: "alias_type" } },
      },
    ],
  });
  // 実行
  const result = await prepareEmbeds({
    loaded,
    docs: [{ path: "guide.md", file: join(dir, "guide.md") }],
    kind: "document",
    entry: "guide.md",
  });
  // 検証
  // env は埋めず、使えるコマンドだけが入る
  expect(result.payload.aliases).toHaveLength(1);
  expect(result.payload.aliases?.[0]).toMatchObject({
    alias_type: "command",
    id: "run-test",
  });
  expect(JSON.stringify(result.payload)).not.toContain("dev-server");
  // description が空の用語は、`{ファイル}:{場所}: {種類}: {内容}` の警告 1 件
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain(
    "aliases/term.yaml:description: alias_required_empty: ",
  );
});
