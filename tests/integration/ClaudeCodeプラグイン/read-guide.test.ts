import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import {
  builtPluginDir,
  callTool,
  copyBuiltPackage,
  useMcpServers,
} from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

// 索引の名前 2 つの本文を返す（正常系）
test("test_normal", async () => {
  // 準備
  const client = await connectHttp();
  const index = JSON.parse(
    await readFile(join(builtPluginDir(), "guide", "index.json"), "utf8"),
  ) as { guides: { name: string; page: string }[] };
  const names = ["notation", "extension"];
  // 実行
  const result = await callTool(client, "read_guide", { names });
  // 検証
  expect(result.isError).toBe(false);
  expect(result.texts).toHaveLength(2);
  for (const [position, name] of names.entries()) {
    const lines = (result.texts[position] ?? "").split("\n");
    expect(lines[0]).toBe(`# ${name}`);
    const page = index.guides.find((guide) => guide.name === name)?.page ?? "";
    const body = await readFile(join(builtPluginDir(), "guide", page), "utf8");
    expect(lines.slice(2).join("\n")).toBe(body);
  }
});

// 索引に無い名前を、近い名前を添えてエラーにする（異常系）
test("test_error_when_name_unknown", async () => {
  // 準備
  const client = await connectHttp();
  // 実行
  const result = await callTool(client, "read_guide", {
    names: ["notatoin", "extension"],
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts).toHaveLength(1);
  expect(result.texts[0]).toContain("notatoin");
  expect(result.texts[0]).toContain("notation");
  // extension の本文も返らない
  expect(result.texts[0]).not.toContain("# extension");
});

// 本文の合計が上限を超えるときは読まずに分けて呼ぶよう返す（異常系）
test("test_error_when_result_too_large", async () => {
  // 準備
  const packageDir = await createTempDir();
  await copyBuiltPackage(packageDir);
  const entry = (name: string) => ({
    name,
    when: `${name} を書くとき`,
    summary: `${name} の概要`,
    page: `docs/${name}.md`,
  });
  await writeFiles(join(packageDir, "plugin", "guide"), {
    "index.json": JSON.stringify({
      schema: 1,
      guides: [entry("large-a"), entry("large-b")],
    }),
    "docs/large-a.md": "あ".repeat(30_000),
    "docs/large-b.md": "あ".repeat(30_000),
  });
  const client = await connectHttp({ packageDir });
  // 実行
  const result = await callTool(client, "read_guide", {
    names: ["large-a", "large-b"],
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts).toHaveLength(1);
  const text = result.texts[0] ?? "";
  expect(text).toMatch(/large-a[\s\S]*30,?0\d{2}/);
  expect(text).toMatch(/large-b[\s\S]*30,?0\d{2}/);
  expect(text).toContain("分けて");
  expect(text).not.toContain("あ".repeat(100));
});
