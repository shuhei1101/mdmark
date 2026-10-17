import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 埋め込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEmbed = () => import("../../../../src/cli/embed.ts");

const createTempDir = useTempDirs();

// 対応表にある印だけを拾う（正常系）
test("test_used_library_marks", async () => {
  // 準備
  const { usedLibraryMarks } = await loadEmbed();
  const markdown = [
    "<!-- chart: a -->",
    "",
    "<!-- table: data -->",
    "",
    "<!-- unknown -->",
    "",
  ].join("\n");
  // 実行
  const marks = usedLibraryMarks([markdown], { chart: "chart.js" });
  // 検証
  expect([...marks]).toEqual(["chart"]);
});

// 手元のファイルとその import を 1 つに束ねる（正常系）
test("test_bundle_module", async () => {
  // 準備
  const { bundleModule } = await loadEmbed();
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
  const result = await bundleModule("lib.ts", dir);
  // 検証
  if (!("code" in result)) {
    throw new Error(`束ねられなかった: ${result.error}`);
  }
  expect(result.code).not.toMatch(/\bimport\b/);
  expect(result.code).toContain("draw");
  expect(result.code).toMatch(/\bexport\b/);
});

// URL とそのルート相対の import を fetchText で読んで束ねる（正常系）
test("test_bundle_module_when_url", async () => {
  // 準備
  const { bundleModule } = await loadEmbed();
  const dir = await createTempDir();
  const bodies: Record<string, string> = {
    "https://cdn.example/npm/a/+esm":
      'import { b } from "/npm/b/+esm"; export const draw = () => b;',
    "https://cdn.example/npm/b/+esm": "export const b = 1;",
  };
  const fetchText = vi.fn(async (url: string) => {
    const body = bodies[url];
    if (body === undefined) {
      throw new Error(`読めない URL: ${url}`);
    }
    return body;
  });
  // 実行
  const result = await bundleModule(
    "https://cdn.example/npm/a/+esm",
    dir,
    fetchText,
  );
  // 検証
  if (!("code" in result)) {
    throw new Error(`束ねられなかった: ${result.error}`);
  }
  expect(fetchText).toHaveBeenCalledWith("https://cdn.example/npm/b/+esm");
  expect(result.code).not.toContain("https:");
  expect(result.code).not.toContain("/npm/");
});

// 読めないモジュールは理由を返す（異常系）
test("test_bundle_module_when_unreachable", async () => {
  // 準備
  const { bundleModule } = await loadEmbed();
  const dir = await createTempDir();
  // 実行
  const result = await bundleModule("missing.js", dir);
  // 検証
  if (!("error" in result)) {
    throw new Error("束ねられてしまった");
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

// 読めない画像は残して警告にする（正常系）
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

// 絶対 URL の画像は読まずに警告にする（正常系）
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

// まとめる文書に無い .md へのリンクだけを返す（正常系）
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
