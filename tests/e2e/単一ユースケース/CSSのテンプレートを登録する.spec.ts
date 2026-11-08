import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { expect, test, writeFiles } from "../cli.ts";
import { callTool, withMcpClient } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 見出しの色を変える CSS */
const BRAND_CSS = "h1 { color: #c00; }\n";

/** 見出しの色を書き換えた CSS */
const CHANGED_CSS = "h1 { color: #00c; }\n";

/** 登録の引数 */
const ARGS = {
  file: "brand.css",
  name: "brand",
  description: "見出しを社の色にする",
  tags: ["見出し", "色"],
};

/** 一時フォルダの端末の設定と、`brand.css` を持つ作業のフォルダを作る */
async function createFixture(tempDir: () => Promise<string>): Promise<{
  env: Record<string, string>;
  templatesDir: string;
  work: string;
}> {
  const settingsDir = await tempDir();
  await writeFiles(settingsDir, { "settings.yaml": "features: {}\n" });
  const work = await tempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": "features: {}\n",
    "brand.css": BRAND_CSS,
  });
  return {
    env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") },
    templatesDir: join(settingsDir, "templates", "css"),
    work,
  };
}

// add_template で登録し、list_templates が名前・説明・タグを返す（正常シナリオ（登録する））
test("test_normal_when_registering", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, work } = await createFixture(tempDir);
  const config = await readFile(join(work, "mdmark.config.yaml"), "utf8");
  // 実行
  const { added, listed } = await withMcpClient(
    { builtRoot, projectDir: work, env },
    async (client) => ({
      added: await callTool(client, "add_template", ARGS),
      listed: await callTool(client, "list_templates"),
    }),
  );
  // 検証
  expect(added.isError).toBe(false);
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    BRAND_CSS,
  );
  const index = parse(
    await readFile(join(templatesDir, "templates.yaml"), "utf8"),
  );
  expect(index.templates).toHaveLength(1);
  expect(JSON.parse(listed.texts[0] ?? "").templates).toEqual([
    {
      name: "brand",
      description: "見出しを社の色にする",
      tags: ["見出し", "色"],
      path: join(templatesDir, "brand.css"),
    },
  ]);
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(work, "mdmark.config.yaml"), "utf8")).toBe(config);
});

// 同じ名前を上書きを指定して登録すると、CSS が置き換わり行は 1 つのまま（正常シナリオ（上書きして登録する））
test("test_normal_when_overwriting", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, work } = await createFixture(tempDir);
  // 実行
  const result = await withMcpClient(
    { builtRoot, projectDir: work, env },
    async (client) => {
      await callTool(client, "add_template", ARGS);
      await writeFiles(work, { "brand.css": CHANGED_CSS });
      return callTool(client, "add_template", {
        ...ARGS,
        description: "見出しを青にする",
        tags: ["青"],
        overwrite: true,
      });
    },
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    CHANGED_CSS,
  );
  const index = parse(
    await readFile(join(templatesDir, "templates.yaml"), "utf8"),
  );
  expect(index.templates).toHaveLength(1);
  expect(index.templates[0].description).toBe("見出しを青にする");
  expect(index.templates[0].tags).toEqual(["青"]);
});

// 上書きを指定せずに同じ名前を登録すると、エラーになり何も書き換わらない（異常シナリオ（同じ名前のテンプレートがある））
test("test_error_when_template_name_exists", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, work } = await createFixture(tempDir);
  // 実行
  const { result, before } = await withMcpClient(
    { builtRoot, projectDir: work, env },
    async (client) => {
      await callTool(client, "add_template", ARGS);
      const index = await readFile(
        join(templatesDir, "templates.yaml"),
        "utf8",
      );
      await writeFiles(work, { "brand.css": CHANGED_CSS });
      return {
        result: await callTool(client, "add_template", ARGS),
        before: index,
      };
    },
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("brand");
  expect(result.texts[0]).toContain("overwrite");
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    BRAND_CSS,
  );
  expect(await readFile(join(templatesDir, "templates.yaml"), "utf8")).toBe(
    before,
  );
});
