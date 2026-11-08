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

// 端末の設定を雛形から作り、settings.json の env に MDMARK_CONFIG を記載する（正常系）
test("test_normal", async () => {
  // 準備
  const terminal = await createTerminal();
  // 実行
  const result = await runSetupScript({
    args: ["write-settings", "--set", "features.table=false"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.version).toBe("v0.0.1");
  expect(settings.features.table).toBe(false);
  const claude = JSON.parse(
    await readFile(terminal.claudeSettingsPath, "utf8"),
  );
  expect(claude.env.MDMARK_CONFIG).toBe(terminal.settingsPath);
  expect(JSON.parse(result.stdout).written).toEqual(
    expect.arrayContaining([
      terminal.settingsPath,
      terminal.claudeSettingsPath,
    ]),
  );
});

// 指定したキーだけを書き換え、コメントとほかのキーを残す（正常系（既にある設定のキーを変える））
test("test_normal_when_settings_exist", async () => {
  // 準備
  const terminal = await createTerminal();
  await writeFiles(join(terminal.home, "config"), {
    "settings.yaml":
      "# 手元の設定\nversion: v0.0.1\nfeatures:\n  callout: false\n",
  });
  // 実行
  const result = await runSetupScript({
    args: ["write-settings", "--set", "serve.tmuxSession=mdmark-test"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(0);
  const after = await readFile(terminal.settingsPath, "utf8");
  expect(after).toContain("# 手元の設定");
  expect(after).toContain("  callout: false");
  expect(parse(after).serve.tmuxSession).toBe("mdmark-test");
});

// 端末の設定が既定のパスなら settings.json を書き込まない（正常系（既定のパス））
test("test_normal_when_default_path", async () => {
  // 準備
  const terminal = await createTerminal();
  const xdg = await createTempDir();
  const env = { ...terminal.env, XDG_CONFIG_HOME: xdg };
  delete (env as Record<string, string | undefined>).MDMARK_CONFIG;
  // 実行
  const result = await runSetupScript({
    args: ["write-settings"],
    env: { ...env, MDMARK_CONFIG: "" },
  });
  // 検証
  expect(result.code).toBe(0);
  expect(existsSync(join(xdg, "mdmark", "settings.yaml"))).toBe(true);
  expect(existsSync(terminal.claudeSettingsPath)).toBe(false);
});

// Schema に合わない値は何も書き込まずに終わる（異常系（Schema に合わない値・終了コード 1））
test("test_error_when_value_invalid", async () => {
  // 準備
  const terminal = await createTerminal();
  // 実行
  const result = await runSetupScript({
    args: ["write-settings", "--set", "config.cascade=yes"],
    env: terminal.env,
  });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("config.cascade");
  expect(result.stderr).toContain("true か false");
  expect(existsSync(terminal.settingsPath)).toBe(false);
  expect(existsSync(terminal.claudeSettingsPath)).toBe(false);
});
