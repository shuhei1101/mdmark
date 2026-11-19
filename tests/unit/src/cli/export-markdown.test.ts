import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { INQUIRY_COUNT_TEXT } from "../../helpers/charts.ts";
import {
  createIo,
  useTempDirs,
  writeDist,
  writeFiles,
} from "../../helpers/cli.ts";
import { parsed, wrapDirective } from "../../helpers/diagrams.ts";

/** Markdown への書き出しの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExportMarkdown = () =>
  import("../../../../src/cli/export-markdown.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

/** 見本のグラフのタイトルと系列の名前 */
const INQUIRY = parsed<{ title: string; series: { name: string }[] }>(
  INQUIRY_COUNT_TEXT,
);

/** chart を 1 つ持つ文書 */
const CHART_DOCUMENT = [
  "# 件数",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
].join("\n");

/** フォルダの中のファイルの名前を、下のフォルダも含めて並べる */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

// 既定の出力のフォルダに書き込む（正常系）
test("test_run_export_markdown", async () => {
  // 準備
  const { runExportMarkdown } = await loadExportMarkdown();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.mark.md": CHART_DOCUMENT,
  });
  const distDir = await writeDist(dir);
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runExportMarkdown({ file: "guide.mark.md", distDir }, io);
  // 検証
  expect(code).toBe(0);
  expect(existsSync(join(dir, "guide-markdown", "guide.md"))).toBe(true);
  expect(
    existsSync(join(dir, "guide-markdown", "images", "figure-1.svg")),
  ).toBe(true);
  expect(stdout).toEqual(["書き出した: guide-markdown/guide.md （SVG 1 件）"]);
});

// 無い文書は CliError（異常系）
test("test_run_export_markdown_when_document_missing", async () => {
  // 準備
  const { runExportMarkdown } = await loadExportMarkdown();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runExportMarkdown({ file: "missing.md", distDir }, io);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  expect(existsSync(join(dir, "missing-markdown"))).toBe(false);
});

// 出力のフォルダがファイルを指す（異常系）
test("test_run_export_markdown_when_output_unwritable", async () => {
  // 準備
  const { runExportMarkdown } = await loadExportMarkdown();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.mark.md": CHART_DOCUMENT,
    blocked: "ファイル",
  });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runExportMarkdown(
    { file: "guide.mark.md", out: "blocked", distDir },
    io,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow(/blocked[\s\S]*--out/);
  const files = await listFiles(dir);
  expect(files.some((name) => name.endsWith(".svg"))).toBe(false);
  expect(files.filter((name) => name.endsWith(".md"))).toEqual([
    "guide.mark.md",
  ]);
});

// 拡張子ごとの名前（正常系）
test("test_markdown_out_dir", async () => {
  // 準備
  const { markdownOutDir } = await loadExportMarkdown();
  // 実行・検証
  expect(markdownOutDir("/d/guide.mark.md")).toEqual({
    name: "guide",
    dir: "/d/guide-markdown",
  });
  expect(markdownOutDir("/d/notes.md")).toEqual({
    name: "notes",
    dir: "/d/notes-markdown",
  });
});

// chart の場所をタイトル・画像・系列の行にする（正常系）
test("test_export_markdown_files_figure_lines", async () => {
  // 準備
  const { exportMarkdownFiles } = await loadExportMarkdown();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.mark.md": CHART_DOCUMENT });
  const distDir = await writeDist(dir);
  const loaded = { path: join(dir, "mdmark.config.yaml"), dir, config: {} };
  // 実行
  const result = await exportMarkdownFiles({
    file: join(dir, "guide.mark.md"),
    loaded,
    distDir,
  });
  // 検証
  expect(result.markdown).toContain(`**${INQUIRY.title}**`);
  expect(result.markdown).toContain(`![${INQUIRY.title}](images/figure-1.svg)`);
  for (const series of INQUIRY.series) {
    expect(result.markdown).toContain(`- ${series.name}`);
  }
  expect(result.images.map((image) => image.name)).toEqual(["figure-1.svg"]);
  expect(result.images[0]?.svg.startsWith("<svg")).toBe(true);
});

// 読み込めない拡張は警告にして続ける（正常系）
test("test_export_markdown_files_when_extension_unloadable", async () => {
  // 準備
  const { exportMarkdownFiles } = await loadExportMarkdown();
  const dir = await createTempDir();
  await writeFiles(dir, { "guide.mark.md": "# 文書\n" });
  const distDir = await writeDist(dir);
  const loaded = {
    path: join(dir, "mdmark.config.yaml"),
    dir,
    config: { extensions: ["extensions/missing.js"] },
  };
  // 実行
  const result = await exportMarkdownFiles({
    file: join(dir, "guide.mark.md"),
    loaded,
    distDir,
  });
  // 検証
  expect(result.warnings.some((w) => w.includes("extensions/missing.js"))).toBe(
    true,
  );
  expect(result.markdown).toContain("# 文書");
});

// 前の書き出しの SVG を残さない（正常系）
test("test_write_markdown_files_replaces_images", async () => {
  // 準備
  const { writeMarkdownFiles } = await loadExportMarkdown();
  const dir = await createTempDir();
  await writeFiles(dir, { "out/images/figure-2.svg": "<svg></svg>" });
  // 実行
  const written = await writeMarkdownFiles({
    dir: join(dir, "out"),
    name: "guide",
    markdown: "# a\n",
    images: [{ name: "figure-1.svg", svg: "<svg></svg>" }],
  });
  // 検証
  expect(await readdir(join(dir, "out", "images"))).toEqual(["figure-1.svg"]);
  expect(written.markdown).toBe(join(dir, "out", "guide.md"));
  expect(await readFile(join(dir, "out", "guide.md"), "utf8")).toBe("# a\n");
});

// ファイルを指す出力先は何も書き込まない（異常系）
test("test_write_markdown_files_when_dir_is_file", async () => {
  // 準備
  const { writeMarkdownFiles } = await loadExportMarkdown();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFile(join(dir, "blocked"), "ファイル");
  // 実行
  const result = writeMarkdownFiles({
    dir: join(dir, "blocked"),
    name: "guide",
    markdown: "# a\n",
    images: [{ name: "figure-1.svg", svg: "<svg></svg>" }],
  });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  const files = await listFiles(dir);
  expect(files).toEqual(["blocked"]);
});
