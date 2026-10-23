import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

/** 一時ファイルからの置き換えを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadWrite = () => import("../../../../../vscode/src/export/write.ts");

const roots: string[] = [];

/** 一時フォルダを作る */
async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-write-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

// 無いフォルダを作って書き、一時ファイルを残さない（正常系）
test("test_write_file_atomically", async () => {
  // 準備
  const { writeFileAtomically } = await loadWrite();
  const root = await createRoot();
  const path = join(root, "out", "guide.html");
  // 実行
  await writeFileAtomically({ path, content: "<p>本文</p>" });
  // 検証
  expect(await readFile(path, "utf8")).toBe("<p>本文</p>");
  const names = await readdir(join(root, "out"));
  expect(names).toEqual(["guide.html"]);
});

// 書けなければ一時ファイルを消して投げ直す（異常系・置き換えられない）
test("test_write_file_atomically_when_not_writable", async () => {
  // 準備
  const { writeFileAtomically } = await loadWrite();
  const root = await createRoot();
  // 書き出す先が既にあるフォルダのため、置き換え（rename）が失敗する
  const path = join(root, "guide.html");
  await mkdir(path);
  // 実行・検証
  await expect(
    writeFileAtomically({ path, content: "<p>本文</p>" }),
  ).rejects.toThrow();
  const names = await readdir(root);
  expect(names.filter((name) => name.endsWith(".tmp"))).toEqual([]);
});
