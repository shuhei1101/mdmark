import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { useTempDirs, writeFiles } from "../cli.ts";
import { runSetupScript } from "../plugin.ts";
import { useTerminals } from "../terminal.ts";

const { createTerminal } = useTerminals();
const createTempDir = useTempDirs();

// mdmark.config.yaml を雛形から作り、回答した値を入れる（正常系）
test("test_normal", async () => {
  // 準備
  const terminal = await createTerminal();
  const dir = await createTempDir();
  const template = parse(
    await readFile(
      join(import.meta.dirname, "../../../templates/mdmark.config.yaml"),
      "utf8",
    ),
  );
  // 実行
  const result = await runSetupScript({
    args: ["write-config", "--dir", dir, "--set", "features.callout=false"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.version).toBe("v0.0.1");
  expect(config.features.callout).toBe(false);
  expect(config.index).toEqual(template.index);
});

// 指定したキーだけを書き換える（正常系（設定がある））
test("test_normal_when_config_exists", async () => {
  // 準備
  const terminal = await createTerminal();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml":
      "# 文書のフォルダの設定\nversion: v0.0.1\nfeatures:\n  table: false\n",
  });
  // 実行
  const result = await runSetupScript({
    args: ["write-config", "--dir", dir, "--set", "features.callout=false"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const after = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  expect(after).toContain("# 文書のフォルダの設定");
  const config = parse(after);
  expect(config.features).toEqual({ table: false, callout: false });
  expect(config.version).toBe("v0.0.1");
});

// 端末の設定だけのキーは何も書き込まずに終わる（異常系（Schema に合わない値・終了コード 1））
test("test_error_when_value_invalid", async () => {
  // 準備
  const terminal = await createTerminal();
  const dir = await createTempDir();
  // 実行
  const result = await runSetupScript({
    args: ["write-config", "--dir", dir, "--set", "config.cascade=true"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("config.cascade");
  expect(result.stderr).toContain("端末の設定だけ");
  expect(existsSync(join(dir, "mdmark.config.yaml"))).toBe(false);
});
