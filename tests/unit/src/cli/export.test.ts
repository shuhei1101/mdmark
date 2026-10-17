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
