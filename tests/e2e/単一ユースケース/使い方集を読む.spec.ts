import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "../cli.ts";
import { callTool, withMcpClient } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 索引の行 */
type Guide = { name: string; page: string };

/** ビルドした `plugin/` の使い方集の索引の行を読む */
async function readGuides(pluginDir: string): Promise<Guide[]> {
  const index = JSON.parse(
    await readFile(join(pluginDir, "guide", "index.json"), "utf8"),
  );
  return index.guides;
}

// 索引の名前 2 つの本文が、索引の指すページの本文と一致して返る（正常シナリオ）
test("test_normal", async ({ builtRoot }) => {
  // 準備
  const pluginDir = join(builtRoot, "plugin");
  const guides = (await readGuides(pluginDir)).slice(0, 2);
  // 実行
  const result = await withMcpClient({ builtRoot }, (client) =>
    callTool(client, "read_guide", {
      names: guides.map((guide) => guide.name),
    }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(result.texts).toHaveLength(2);
  for (const [position, guide] of guides.entries()) {
    const lines = (result.texts[position] ?? "").split("\n");
    expect(lines[0]).toBe(`# ${guide.name}`);
    const body = await readFile(join(pluginDir, "guide", guide.page), "utf8");
    expect(lines.slice(2).join("\n")).toBe(body);
  }
});

// 索引に無い名前は本文を返さず、名前と近い名前を添えたエラーを返す（異常シナリオ）
test("test_error_when_name_unknown", async ({ builtRoot }) => {
  // 準備
  const pluginDir = join(builtRoot, "plugin");
  const [first] = await readGuides(pluginDir);
  const name = first?.name ?? "";
  // 索引の名前の 1 字を変えた名前
  const unknown = `${name.slice(0, -1)}${name.endsWith("x") ? "y" : "x"}`;
  // 実行
  const result = await withMcpClient({ builtRoot }, (client) =>
    callTool(client, "read_guide", { names: [unknown] }),
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts).toHaveLength(1);
  expect(result.texts[0]).toContain(unknown);
  expect(result.texts[0]).toContain(name);
  expect(result.texts[0]).not.toMatch(/^# /m);
});
