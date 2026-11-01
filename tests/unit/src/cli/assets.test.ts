import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** ファイルの参照の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAssets = () => import("../../../../src/cli/assets.ts");

const createTempDir = useTempDirs();

/** 中身を持たない動画のファイル */
const VIDEO_BYTES = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);

// 画像・動画・poster・添付を拾う（正常系）
test("test_collect_asset_refs", async () => {
  // 準備
  const { collectAssetRefs } = await loadAssets();
  const markdown = [
    "![図](a.png#only-dark)",
    "![操作](demo.mp4){poster=demo.png}",
    "[仕様](spec.pdf)",
    "[外](https://example.com/b.png)",
    "",
  ].join("\n");
  // 実行
  const refs = collectAssetRefs(markdown);
  // 検証
  expect(refs).toEqual([
    { src: "a.png#only-dark", kind: "image", line: 1 },
    { src: "demo.mp4", kind: "video", line: 2 },
    { src: "demo.png", kind: "poster", line: 2 },
    { src: "spec.pdf", kind: "attachment", line: 3 },
  ]);
});

// コードの中は拾わない（正常系）
test("test_collect_asset_refs_when_code", async () => {
  // 準備
  const { collectAssetRefs } = await loadAssets();
  const markdown = [
    "```markdown",
    "![図](a.png)",
    "```",
    "",
    "`![図](b.png)`",
    "",
  ].join("\n");
  // 実行
  const refs = collectAssetRefs(markdown);
  // 検証
  expect(refs).toEqual([]);
});

// 文書のフォルダを先に、無ければアセットのルートで探す（正常系）
test("test_resolve_asset_file", async () => {
  // 準備
  const { resolveAssetFile } = await loadAssets();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "docs/a.png": "a",
    "assets/a.png": "a",
    "assets/b.png": "b",
  });
  const options = {
    docDir: join(dir, "docs"),
    assetsRoot: join(dir, "assets"),
  };
  // 実行
  const found = await Promise.all(
    ["a.png?v=1#x", "b.png", "c.png"].map((src) =>
      resolveAssetFile(src, options),
    ),
  );
  // 検証
  expect(found).toEqual([
    join(dir, "docs", "a.png"),
    join(dir, "assets", "b.png"),
    undefined,
  ]);
});

// 動画をコピーして src を替え、同じファイルは 1 回だけコピーする（正常系）
test("test_copy_media", async () => {
  // 準備
  const { copyMedia } = await loadAssets();
  const dir = await createTempDir();
  await writeFiles(dir, { "docs/media/demo.mp4": VIDEO_BYTES });
  const markdown = [
    "![操作](media/demo.mp4#t=3)",
    "",
    "![操作](media/demo.mp4)",
    "",
  ].join("\n");
  const copied = new Map<string, string>();
  // 実行
  const result = await copyMedia({
    markdown,
    docFile: join(dir, "docs", "guide.md"),
    baseDir: dir,
    out: join(dir, "out", "guide.html"),
    copied,
  });
  // 検証
  const copiedDir = join(dir, "out", "guide_files", "docs", "media");
  expect(await readdir(copiedDir)).toEqual(["demo.mp4"]);
  expect(result.markdown).toContain("](guide_files/docs/media/demo.mp4#t=3)");
  expect(result.markdown).toContain("](guide_files/docs/media/demo.mp4)");
  expect(copied.size).toBe(1);
  expect(result.warnings).toEqual([]);
});

// 基準の外のファイルは external に名前を重ねずに置く（正常系）
test("test_copy_media_when_outside", async () => {
  // 準備
  const { copyMedia } = await loadAssets();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "x/demo.mp4": VIDEO_BYTES,
    "y/demo.mp4": VIDEO_BYTES,
  });
  const markdown = ["![x](../x/demo.mp4)", "", "![y](../y/demo.mp4)", ""].join(
    "\n",
  );
  // 実行
  await copyMedia({
    markdown,
    docFile: join(dir, "project", "guide.md"),
    baseDir: join(dir, "project"),
    out: join(dir, "project", "guide.html"),
    copied: new Map(),
  });
  // 検証
  const external = join(dir, "project", "guide_files", "external");
  expect((await readdir(external)).sort()).toEqual(["demo-1.mp4", "demo.mp4"]);
});

// 見つからない動画は残して警告にする（正常系）
test("test_copy_media_when_missing", async () => {
  // 準備
  const { copyMedia } = await loadAssets();
  const dir = await createTempDir();
  const markdown = "![操作](none.mp4)\n";
  // 実行
  const result = await copyMedia({
    markdown,
    docFile: join(dir, "guide.md"),
    baseDir: dir,
    out: join(dir, "guide.html"),
    copied: new Map(),
  });
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.warnings.join("\n")).toContain("none.mp4");
  expect(existsSync(join(dir, "guide_files"))).toBe(false);
});

// コピー先を作れなければ CliError（異常系）
test("test_copy_media_when_unwritable", async () => {
  // 準備
  const { copyMedia } = await loadAssets();
  const { CliError } = await import("../../../../src/cli/errors.ts");
  const dir = await createTempDir();
  await writeFiles(dir, {
    "demo.mp4": VIDEO_BYTES,
    "out/guide_files": "ファイル",
  });
  // 実行
  const result = copyMedia({
    markdown: "![操作](demo.mp4)\n",
    docFile: join(dir, "guide.md"),
    baseDir: dir,
    out: join(dir, "out", "guide.html"),
    copied: new Map(),
  });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("guide_files");
});

// 見つからない画像と添付をずれにする（正常系）
test("test_check_missing_files", async () => {
  // 準備
  const { checkMissingFiles } = await loadAssets();
  const dir = await createTempDir();
  await writeFiles(dir, { "a.png": "a" });
  const markdown = [
    "# 文書",
    "",
    "![図](none.png)",
    "",
    "[仕様](none.pdf)",
    "",
    "![図](a.png)",
    "",
  ].join("\n");
  // 実行
  const issues = await checkMissingFiles({
    markdown,
    docFile: join(dir, "a.md"),
    file: "a.md",
  });
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual([
    "missing_file",
    "missing_file",
  ]);
  expect(issues.map((issue) => issue.where)).toEqual(["3", "5"]);
  expect(issues[0]?.message).toContain("none.png");
  expect(issues[0]?.message).toContain("画像");
  expect(issues[1]?.message).toContain("none.pdf");
  expect(issues[1]?.message).toContain("添付");
});
