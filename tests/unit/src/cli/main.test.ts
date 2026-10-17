import { expect, test } from "vitest";
import { createIo, useTempDirs } from "../../helpers/cli.ts";

/** CLI の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// コマンド名で init を呼び、その終了コードを返す（正常系）
test("test_main", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await main(["init", dir], io);
  // 検証
  expect(code).toBe(0);
  expect(stdout.some((line) => line.startsWith("置いた:"))).toBe(true);
});

// 知らないコマンドは一覧を出して 1 を返す（異常系）
test("test_main_when_command_unknown", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  const { io, stderr } = createIo(dir);
  // 実行
  const code = await main(["serve"], io);
  // 検証
  expect(code).toBe(1);
  const text = stderr.join("\n");
  for (const command of ["init", "check", "export", "build"]) {
    expect(text).toContain(command);
  }
});

// コマンドが投げた CliError の文を出して 1 を返す（異常系）
test("test_main_when_cli_error", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  const { io, stderr } = createIo(dir);
  // 実行
  const code = await main(["check"], io);
  // 検証
  expect(code).toBe(1);
  expect(stderr.join("\n")).toContain("mdmark init");
});
