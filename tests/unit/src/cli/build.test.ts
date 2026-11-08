import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  createIo,
  readPayload,
  useTempDirs,
  writeDist,
  writeFiles,
} from "../../helpers/cli.ts";

/** まとめる処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBuild = () => import("../../../../src/cli/build.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

/** build の設定を持つ設定ファイルの中身を作る */
function createConfig(buildLines: string[]): string {
  return ["build:", ...buildLines, ""].join("\n");
}

// 3 つの文書をまとめて build.out に書く（正常系）
test("test_run_build", async () => {
  // 準備
  const { runBuild } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["**/*.md"]',
      "  out: dist/docs.html",
    ]),
    "README.md": "# 入口\n",
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
  const distDir = await writeDist(dir);
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runBuild({ distDir }, io);
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual(["書き出した: dist/docs.html（文書 3 件）"]);
  const payload = readPayload(
    await readFile(join(dir, "dist", "docs.html"), "utf8"),
  );
  expect(payload.docs).toHaveLength(3);
});

// 1 枚に含まれない文書へのリンクを警告に出す（正常系）
test("test_run_build_when_link_outside_bundle", async () => {
  // 準備
  const { runBuild } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["**/*.md"]',
      '  exclude: ["下書き/**"]',
      "  out: dist/docs.html",
    ]),
    "README.md": "[メモ](下書き/メモ.md)\n",
    "a.md": "# A\n",
    "下書き/メモ.md": "# メモ\n",
  });
  const distDir = await writeDist(dir);
  const { io, stderr } = createIo(dir);
  // 実行
  const code = await runBuild({ distDir }, io);
  // 検証
  expect(code).toBe(0);
  expect(
    stderr.some(
      (line) =>
        line.startsWith("警告: README.md:") && line.includes("下書き/メモ.md"),
    ),
  ).toBe(true);
});

// 索引が無くても build.glossary の用語を参照の表に入れる（正常系）
test("test_run_build_when_glossary_without_index", async () => {
  // 準備
  const { runBuild } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["*.md"]',
      '  glossary: ["用語集.md"]',
      "  out: dist/docs.html",
    ]),
    "README.md": "印を書く。\n",
    "用語集.md": [
      "<!-- glossary: term=用語 meaning=意味 -->",
      "",
      "| 用語 | 意味 |",
      "| --- | --- |",
      "| 印 | HTML コメントで書く指定 |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
  });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  await runBuild({ distDir }, io);
  // 検証
  const payload = readPayload(
    await readFile(join(dir, "dist", "docs.html"), "utf8"),
  );
  expect(payload.references?.glossary.map((entry) => entry.term)).toContain(
    "印",
  );
});

// build が無いと CliError（異常系）
test("test_run_build_when_build_missing", async () => {
  // 準備
  const { runBuild } = await loadBuild();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "a.md": "# A\n",
  });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runBuild({ distDir }, io);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("build.include");
  await expect(result).rejects.toThrow("build.out");
});

// 対象が 0 件だと CliError で HTML を書かない（異常系）
test("test_run_build_when_no_documents", async () => {
  // 準備
  const { runBuild } = await loadBuild();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["nothing/**/*.md"]',
      "  out: dist/docs.html",
    ]),
    "a.md": "# A\n",
  });
  const distDir = await writeDist(dir);
  const { io } = createIo(dir);
  // 実行
  const result = runBuild({ distDir }, io);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  expect(existsSync(join(dir, "dist", "docs.html"))).toBe(false);
});

// まとめて絶対パスと文書の数を返す（正常系）
test("test_build_site", async () => {
  // 準備
  const { buildSite } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["**/*.md"]',
      "  out: dist/docs.html",
    ]),
    "a.md": "# A\n",
    "b.md": "# B\n",
  });
  const distDir = await writeDist(dir);
  // 実行
  const result = await buildSite({ cwd: dir, distDir });
  // 検証
  expect(result.out).toBe(join(dir, "dist", "docs.html"));
  expect(existsSync(result.out)).toBe(true);
  expect(result.docs).toBe(2);
  expect(result.warnings).toEqual([]);
});

// まとめる文書に当たらない build.entry を警告で返す（正常系）
test("test_build_site_when_entry_outside", async () => {
  // 準備
  const { buildSite } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["**/*.md"]',
      "  entry: missing.md",
      "  out: dist/docs.html",
    ]),
    "a.md": "# A\n",
  });
  const distDir = await writeDist(dir);
  // 実行
  const result = await buildSite({ cwd: dir, distDir });
  // 検証
  expect(
    result.warnings.some((warning) => warning.includes("missing.md")),
  ).toBe(true);
});

// build が無いと CliError（異常系）
test("test_build_site_when_build_missing", async () => {
  // 準備
  const { buildSite } = await loadBuild();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "features:\n  print: true\n" });
  const distDir = await writeDist(dir);
  // 実行
  const result = buildSite({ cwd: dir, distDir });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("build.include");
  await expect(result).rejects.toThrow("build.out");
});

// 同じ画像を 1 回だけ埋める（正常系）
test("test_build_site_when_shared_image", async () => {
  // 準備
  const { buildSite } = await loadBuild();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": createConfig([
      '  include: ["**/*.md"]',
      "  out: dist/docs.html",
    ]),
    "a.md": "# A\n\n![図](img/a.png)\n",
    "b.md": "# B\n\n![図](img/a.png)\n",
    "img/a.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
  const distDir = await writeDist(dir);
  // 実行
  const result = await buildSite({ cwd: dir, distDir });
  // 検証
  const html = await readFile(result.out, "utf8");
  expect(html.match(/data:image\/png;base64,/g) ?? []).toHaveLength(1);
  expect(Object.keys(readPayload(html).assets ?? {})).toHaveLength(1);
});
