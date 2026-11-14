import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import {
  createIo,
  failingAsk,
  useTempDirs,
  writeFiles,
} from "../../helpers/cli.ts";

/** CLI の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

afterEach(() => {
  vi.unstubAllGlobals();
});

// コマンド名で init を呼び、その終了コードを返却する（正常系）
test("test_main", async () => {
  // 準備
  const { main } = await loadMain();
  vi.stubGlobal("__MDMARK_VERSION__", "v0.5.0");
  const dir = await createTempDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await main(["init", dir], io, failingAsk);
  // 検証
  expect(code).toBe(0);
  expect(stdout.some((line) => line.startsWith("配置した:"))).toBe(true);
});

// --keep-traces を keepTraces にして書き出しへ指定する（正常系）
test("test_main_when_keep_traces", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  print: true\n",
    "guide.md": "# タイトル\n",
  });
  const { io } = createIo(dir);
  // 実行
  const code = await main(
    ["export", "guide.md", "--keep-traces"],
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  expect(await readFile(join(dir, "guide.html"), "utf8")).toContain(
    'id="mdmark-payload"',
  );
});

// 知らないコマンドは一覧を出して 1 を返却する（異常系）
test("test_main_when_command_unknown", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  const { io, stderr } = createIo(dir);
  // 実行
  const code = await main(["deploy"], io, failingAsk);
  // 検証
  expect(code).toBe(1);
  const text = stderr.join("\n");
  for (const command of ["init", "check", "export", "build", "serve"]) {
    expect(text).toContain(command);
  }
});

// コマンドが投げた CliError の文を出して 1 を返却する（異常系）
test("test_main_when_cli_error", async () => {
  // 準備
  const { main } = await loadMain();
  const dir = await createTempDir();
  const { io, stderr } = createIo(dir);
  // 実行
  const code = await main(["check"], io, failingAsk);
  // 検証
  expect(code).toBe(1);
  expect(stderr.join("\n")).toContain("mdmark init");
});

// upgrade を呼び、--plan を runUpgrade に指定する（正常系）
test("test_main_when_upgrade", async () => {
  // 準備
  const { main } = await loadMain();
  vi.stubGlobal("__MDMARK_VERSION__", "v0.5.0");
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": "version: v0.5.0\n" });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await main(["upgrade", "--plan"], io, failingAsk);
  // 検証
  expect(code).toBe(0);
  expect(stdout.join("\n")).toContain("適用する手順はありません");
});
