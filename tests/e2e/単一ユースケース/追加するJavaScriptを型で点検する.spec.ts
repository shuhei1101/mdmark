import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, runCli, test } from "../cli.ts";
import { listFiles, placeDeclarations, runTsc } from "../diagram.ts";

// 雛形の拡張の、`draw` の中身（この行を型に合わない値に書き換える）
// biome-ignore lint/suspicious/noTemplateCurlyInString: 雛形のファイルの中身の一行
const VALID_LINE = 'slot.textContent = `こんにちは、${value.args[0] ?? ""}`;';
const INVALID_LINE = "slot.textContent = value.args.length;";

/** JavaScript の雛形を置き、配布物の型定義を `mdmark/` に置いたフォルダを作る */
async function prepare(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init", "--js"], dir);
  expect(init.code).toBe(0);
  await placeDeclarations(builtRoot, dir);
  return dir;
}

// 型に合う JavaScript の拡張は、誤り 0 件・終了コード 0 で通り、JavaScript の出力は増えない（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await prepare(builtRoot, tempDir);
  const before = await listFiles(dir);
  // 実行
  const result = await runTsc(dir);
  // 検証
  expect(result.stdout).toBe("");
  expect(result.code).toBe(0);
  expect(await listFiles(dir)).toEqual(before);
});

// 型に合わない JavaScript は、誤ったファイルと行を出して終了コード 0 以外で落ち、ファイルは書き換えない（異常シナリオ（型が合わない））
test("test_error_when_type_mismatch", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await prepare(builtRoot, tempDir);
  const file = join(dir, "extensions", "example.js");
  const source = await readFile(file, "utf8");
  expect(source).toContain(VALID_LINE);
  const broken = source.replace(VALID_LINE, INVALID_LINE);
  await writeFile(file, broken);
  const before = await listFiles(dir);
  // 実行
  const result = await runTsc(dir);
  // 検証
  expect(result.code).not.toBe(0);
  const line =
    broken.split("\n").findIndex((text) => text.includes(INVALID_LINE)) + 1;
  expect(result.stdout).toContain(`extensions/example.js(${line},`);
  expect(await readFile(file, "utf8")).toBe(broken);
  expect(await listFiles(dir)).toEqual(before);
});
