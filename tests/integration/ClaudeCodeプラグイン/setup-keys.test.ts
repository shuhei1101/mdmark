import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { runSetupScript } from "../plugin.ts";
import { useTerminals } from "../terminal.ts";

const { createTerminal } = useTerminals();
const createTempDir = useTempDirs();

/** keys の結果を、キーから行を引く表にする */
const byKey = (stdout: string) =>
  new Map(
    (JSON.parse(stdout).keys as Array<{ key: string }>).map((entry) => [
      entry.key,
      entry as Record<string, unknown>,
    ]),
  );

// 端末の設定のキーごとに、今の値・既定・説明を返す（正常系）
test("test_normal", async () => {
  // 準備
  const terminal = await createTerminal();
  await writeFiles(join(terminal.home, "config"), {
    "settings.yaml": "features:\n  table: false\n",
  });
  // 実行
  const result = await runSetupScript({
    args: ["keys", "--target", "settings"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const keys = byKey(result.stdout);
  expect(keys.get("features.table")?.current).toBe(false);
  for (const key of ["config.cascade", "serve.tmuxSession"]) {
    expect(keys.get(key)).toHaveProperty("default");
    expect(keys.get(key)).toHaveProperty("description");
  }
});

// mdmark.config.yaml のキーを、端末の設定で重なる値つきで返し、端末の設定だけのキーを含めない（正常系（文書のフォルダの設定））
test("test_normal_when_config", async () => {
  // 準備
  const terminal = await createTerminal();
  await writeFiles(join(terminal.home, "config"), {
    "settings.yaml": "features:\n  table: false\n",
  });
  const dir = await createTempDir();
  // 実行
  const result = await runSetupScript({
    args: ["keys", "--target", "config", "--dir", dir],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const keys = byKey(result.stdout);
  expect(keys.get("features.table")?.current).toBeNull();
  expect(keys.get("features.table")?.inherited).toBe(false);
  expect(keys.has("config.cascade")).toBe(false);
  expect(keys.has("serve.tmuxSession")).toBe(false);
});
