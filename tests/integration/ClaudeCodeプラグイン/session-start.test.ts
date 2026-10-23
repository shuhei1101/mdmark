import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs } from "../cli.ts";
import {
  builtPluginDir,
  copyBuiltPlugin,
  runSessionStartHook,
} from "../plugin.ts";

const createTempDir = useTempDirs();

// 同梱した索引を additionalContext で返す（正常系）
test("test_normal", async () => {
  // 準備
  const pluginDir = builtPluginDir();
  const index = JSON.parse(
    await readFile(join(pluginDir, "guide", "index.json"), "utf8"),
  ) as { guides: { name: string; page: string }[] };
  // 実行
  const result = await runSessionStartHook(pluginDir);
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
  const context: string = output.hookSpecificOutput.additionalContext;
  for (const guide of index.guides) {
    expect(context).toContain(guide.name);
    // 本文のページは含めない
    expect(context).not.toContain(guide.page);
  }
  expect(context.length).toBeLessThanOrEqual(10_000);
});

// 同梱した索引が無いときは何も渡さず、入れ直しを知らせる（異常系）
test("test_error_when_index_unreadable", async () => {
  // 準備
  const pluginDir = join(await createTempDir(), "plugin");
  await copyBuiltPlugin(pluginDir);
  await rm(join(pluginDir, "guide", "index.json"));
  // 実行
  const result = await runSessionStartHook(pluginDir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("index.json");
  expect(result.stderr).toContain("入れ直して");
});
