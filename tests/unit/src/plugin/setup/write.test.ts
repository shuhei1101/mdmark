import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { useTempDirs, writeFiles } from "../../../helpers/cli.ts";

/** 書き込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadWrite = () => import("../../../../../src/plugin/setup/write.ts");

const createTempDir = useTempDirs();

/** プラグインの直下（`settings.sample.yaml` を持つ） */
const PLUGIN_ROOT = join(import.meta.dirname, "../../../../../plugin");

/** 一時の端末の環境変数（端末の設定は既定と違うパス） */
async function createTerminal(): Promise<{
  env: NodeJS.ProcessEnv;
  settingsPath: string;
  claudeSettingsPath: string;
}> {
  const home = await createTempDir();
  const settingsPath = join(home, "x", "settings.yaml");
  const claudeDir = join(home, "c");
  return {
    env: { HOME: home, MDMARK_CONFIG: settingsPath, CLAUDE_CONFIG_DIR: claudeDir },
    settingsPath,
    claudeSettingsPath: join(claudeDir, "settings.json"),
  };
}

// 値を YAML として読む（正常系）
test("test_parse_set_args", async () => {
  // 準備
  const { parseSetArgs } = await loadWrite();
  // 実行
  const sets = parseSetArgs(["features.table=false", "serve.tmuxSession=x"]);
  // 検証
  expect(sets).toEqual([
    { path: ["features", "table"], value: false },
    { path: ["serve", "tmuxSession"], value: "x" },
  ]);
});

// = が無ければ SetupError（異常系）
test("test_parse_set_args_when_no_equal", async () => {
  // 準備
  const { parseSetArgs } = await loadWrite();
  // 実行・検証
  expect(() => parseSetArgs(["features.table"])).toThrow(
    expect.objectContaining({ exitCode: 1 }),
  );
});

// 雛形から作り env を書く（正常系）
test("test_write_settings", async () => {
  // 準備
  const { writeSettings } = await loadWrite();
  const terminal = await createTerminal();
  // 実行
  const result = await writeSettings({
    env: terminal.env,
    pluginRoot: PLUGIN_ROOT,
    version: "v0.10.0",
    sets: ["features.table=false"],
  });
  // 検証
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.version).toBe("v0.10.0");
  expect(settings.features.table).toBe(false);
  const claude = JSON.parse(await readFile(terminal.claudeSettingsPath, "utf8"));
  expect(claude.env.MDMARK_CONFIG).toBe(terminal.settingsPath);
  expect(result.written).toEqual(
    expect.arrayContaining([terminal.settingsPath, terminal.claudeSettingsPath]),
  );
  expect(result.keys).toContain("features.table");
});

// Schema に合わなければ書かない（異常系）
test("test_write_settings_when_invalid", async () => {
  // 準備
  const { writeSettings } = await loadWrite();
  const terminal = await createTerminal();
  // 実行
  const result = writeSettings({
    env: terminal.env,
    pluginRoot: PLUGIN_ROOT,
    version: "v0.10.0",
    sets: ["config.cascade=yes"],
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  expect(existsSync(terminal.settingsPath)).toBe(false);
  expect(existsSync(terminal.claudeSettingsPath)).toBe(false);
});

// コメントを残す（正常系）
test("test_write_settings_when_comment", async () => {
  // 準備
  const { writeSettings } = await loadWrite();
  const terminal = await createTerminal();
  const before = [
    "# 手元の端末の設定",
    "version: v0.9.0",
    "features:",
    "  callout: false",
    "",
  ].join("\n");
  await writeFiles(join(terminal.settingsPath, ".."), { "settings.yaml": before });
  // 実行
  await writeSettings({
    env: terminal.env,
    pluginRoot: PLUGIN_ROOT,
    version: "v0.10.0",
    sets: ["serve.tmuxSession=x"],
  });
  // 検証
  const after = await readFile(terminal.settingsPath, "utf8");
  expect(after).toContain("# 手元の端末の設定");
  expect(after).toContain("  callout: false");
  const settings = parse(after);
  expect(settings.version).toBe("v0.9.0");
  expect(settings.serve.tmuxSession).toBe("x");
});

// ほかのキーを残して env を書く（正常系）
test("test_write_claude_env", async () => {
  // 準備
  const { writeClaudeEnv } = await loadWrite();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "settings.json": JSON.stringify({ model: "x", env: { A: "1" } }),
  });
  const path = join(dir, "settings.json");
  // 実行
  const written = await writeClaudeEnv({ path, key: "MDMARK_CONFIG", value: "/p" });
  // 検証
  expect(written).toBe(true);
  const after = JSON.parse(await readFile(path, "utf8"));
  expect(after.env).toEqual({ A: "1", MDMARK_CONFIG: "/p" });
  expect(after.model).toBe("x");
});

// 同じ値なら書かない（正常系）
test("test_write_claude_env_when_same", async () => {
  // 準備
  const { writeClaudeEnv } = await loadWrite();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "settings.json": JSON.stringify({ env: { MDMARK_CONFIG: "/p" } }),
  });
  const path = join(dir, "settings.json");
  const before = (await stat(path)).mtimeMs;
  // 実行
  const written = await writeClaudeEnv({ path, key: "MDMARK_CONFIG", value: "/p" });
  // 検証
  expect(written).toBe(false);
  expect((await stat(path)).mtimeMs).toBe(before);
});

// 雛形から作る（正常系）
test("test_write_config", async () => {
  // 準備
  const { writeConfig } = await loadWrite();
  const dir = await createTempDir();
  // 実行
  await writeConfig({
    env: { HOME: dir },
    pluginRoot: PLUGIN_ROOT,
    version: "v0.10.0",
    dir,
    sets: ["features.callout=false"],
  });
  // 検証
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.version).toBe("v0.10.0");
  expect(config.features.callout).toBe(false);
});

// 端末の設定だけのキーは書かない（異常系）
test("test_write_config_when_settings_key", async () => {
  // 準備
  const { writeConfig } = await loadWrite();
  const dir = await createTempDir();
  // 実行
  const result = writeConfig({
    env: { HOME: dir },
    pluginRoot: PLUGIN_ROOT,
    version: "v0.10.0",
    dir,
    sets: ["config.cascade=true"],
  });
  // 検証
  await expect(result).rejects.toMatchObject({ exitCode: 1 });
  expect(existsSync(join(dir, "mdmark.config.yaml"))).toBe(false);
});
