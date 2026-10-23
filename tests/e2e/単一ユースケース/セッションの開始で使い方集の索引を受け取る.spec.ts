import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "../cli.ts";
import { runSessionStartHook } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 索引の文字数の上限（非機能要件）
const CONTEXT_LIMIT = 10_000;

// SessionStart のフックが使い方集の索引だけを additionalContext で渡す（正常シナリオ）
test("test_normal", async ({ builtRoot }) => {
  // 準備
  const pluginDir = join(builtRoot, "plugin");
  const index = JSON.parse(
    await readFile(join(pluginDir, "guide", "index.json"), "utf8"),
  ) as {
    guides: { name: string; when: string; summary: string; page: string }[];
  };
  // 実行
  const result = await runSessionStartHook(pluginDir);
  // 検証
  expect(result.code).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe("SessionStart");
  const context: string = output.hookSpecificOutput.additionalContext;
  for (const guide of index.guides) {
    expect(context).toContain(guide.name);
    expect(context).toContain(guide.when);
    expect(context).toContain(guide.summary);
    // 本文は渡さない
    expect(context).not.toContain(guide.page);
    const body = await readFile(join(pluginDir, "guide", guide.page), "utf8");
    expect(context).not.toContain(body.slice(0, 200));
  }
  expect(context.length).toBeLessThanOrEqual(CONTEXT_LIMIT);
});
