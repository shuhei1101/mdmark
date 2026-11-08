import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 一時フォルダの端末の設定と、そのテンプレートのフォルダ */
async function createSettings(): Promise<{
  env: Record<string, string>;
  templatesDir: string;
}> {
  const settingsDir = await createTempDir();
  await writeFiles(settingsDir, { "settings.yaml": "features: {}\n" });
  return {
    env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") },
    templatesDir: join(settingsDir, "templates", "css"),
  };
}

// 索引の行を、名前・説明・タグ・CSS の絶対パスで返却する（正常系）
test("test_normal", async () => {
  // 準備
  const { env, templatesDir } = await createSettings();
  await writeFiles(templatesDir, {
    "templates.yaml": [
      "schema: 1",
      "templates:",
      "  - name: brand",
      "    file: brand.css",
      "    description: 見出しを社の色にする",
      "    tags: [見出し, 色]",
      "  - name: paper",
      "    file: paper.css",
      "    description: 紙の色",
      "",
    ].join("\n"),
    "brand.css": "h1 { color: #c00; }",
    "paper.css": "body { background: #fffdf5; }",
  });
  const client = await connectHttp({ projectDir: await createTempDir(), env });
  // 実行
  const result = await callTool(client, "list_templates", {});
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").templates).toEqual([
    {
      name: "brand",
      description: "見出しを社の色にする",
      tags: ["見出し", "色"],
      path: join(templatesDir, "brand.css"),
    },
    {
      name: "paper",
      description: "紙の色",
      tags: [],
      path: join(templatesDir, "paper.css"),
    },
  ]);
});

// フォルダが無いとき、作らずに空の一覧を返却する（正常系（テンプレートのフォルダが無い））
test("test_normal_when_folder_missing", async () => {
  // 準備
  const { env, templatesDir } = await createSettings();
  const client = await connectHttp({ projectDir: await createTempDir(), env });
  // 実行
  const result = await callTool(client, "list_templates", {});
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").templates).toEqual([]);
  expect(existsSync(templatesDir)).toBe(false);
});

// 索引がスキーマに合わないとき、合わないキーを示してエラーにする（異常系（索引を読み込めない））
test("test_error_when_index_invalid", async () => {
  // 準備
  const { env, templatesDir } = await createSettings();
  await writeFiles(templatesDir, {
    "templates.yaml":
      "schema: 1\ntemplates:\n  - name: brand\n    description: x\n",
  });
  const client = await connectHttp({ projectDir: await createTempDir(), env });
  // 実行
  const result = await callTool(client, "list_templates", {});
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain(join(templatesDir, "templates.yaml"));
  expect(result.texts[0]).toContain("templates[0].file");
});
