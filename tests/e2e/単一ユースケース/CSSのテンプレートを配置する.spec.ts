import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, writeFiles } from "../cli.ts";
import { callTool, withMcpClient } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** テンプレートの CSS */
const BRAND_CSS = "h1 { color: #c00; }\n";

/** 中身の違う CSS */
const OTHER_CSS = "h1 { color: #00c; }\n";

/** 端末の設定（テンプレートを登録するかを選ぶ）と、`mdmark.config.yaml` を直下に持ち作業のフォルダを `docs/` にした配置先を作る */
async function createFixture(
  tempDir: () => Promise<string>,
  options: { registered: boolean } = { registered: true },
): Promise<{
  env: Record<string, string>;
  templatesDir: string;
  work: string;
}> {
  const settingsDir = await tempDir();
  await writeFiles(settingsDir, {
    "settings.yaml": "features: {}\n",
    ...(options.registered
      ? {
          "templates/css/templates.yaml":
            "schema: 1\ntemplates:\n  - name: brand\n    file: brand.css\n    description: 見出しを社の色にする\n",
          "templates/css/brand.css": BRAND_CSS,
        }
      : {}),
  });
  const work = await tempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/guide.md": "# ガイド\n",
  });
  return {
    env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") },
    templatesDir: join(settingsDir, "templates", "css"),
    work,
  };
}

// 一覧から選んで最も近い設定ファイルのフォルダへ配置し、theme に記載する値を受け取る（正常シナリオ（一覧から選んで配置する））
test("test_normal_when_applying_from_list", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, work } = await createFixture(tempDir);
  const config = await readFile(join(work, "mdmark.config.yaml"), "utf8");
  const index = await readFile(join(templatesDir, "templates.yaml"), "utf8");
  // 実行
  const { listed, applied } = await withMcpClient(
    { builtRoot, projectDir: join(work, "docs"), env },
    async (client) => ({
      listed: await callTool(client, "list_templates"),
      applied: await callTool(client, "apply_template", { name: "brand" }),
    }),
  );
  // 検証
  expect(JSON.parse(listed.texts[0] ?? "").templates[0].name).toBe("brand");
  expect(applied.isError).toBe(false);
  const json = JSON.parse(applied.texts[0] ?? "");
  expect(json.path).toBe(join(work, "brand.css"));
  expect(json.theme).toBe("./brand.css");
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(work, "mdmark.config.yaml"), "utf8")).toBe(config);
  expect(await readFile(join(templatesDir, "templates.yaml"), "utf8")).toBe(
    index,
  );
});

// テンプレートのフォルダが無い端末で、空の一覧を返しフォルダを作らない（正常シナリオ（テンプレートが無い））
test("test_normal_when_no_templates", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, work } = await createFixture(tempDir, {
    registered: false,
  });
  // 実行
  const result = await withMcpClient(
    { builtRoot, projectDir: join(work, "docs"), env },
    (client) => callTool(client, "list_templates"),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "").templates).toEqual([]);
  expect(existsSync(templatesDir)).toBe(false);
});

// 上書きを指定すると、配置先の同じ名前の CSS がテンプレートの中身になる（正常シナリオ（上書きして配置する））
test("test_normal_when_overwriting", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, work } = await createFixture(tempDir);
  await writeFiles(work, { "brand.css": OTHER_CSS });
  // 実行
  const result = await withMcpClient(
    { builtRoot, projectDir: join(work, "docs"), env },
    (client) =>
      callTool(client, "apply_template", { name: "brand", overwrite: true }),
  );
  // 検証
  expect(result.isError).toBe(false);
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
});

// 上書きを指定しないと、配置先の同じ名前の CSS を書き換えずにエラーにする（異常シナリオ（配置先に同じ名前の CSS がある））
test("test_error_when_css_exists", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, work } = await createFixture(tempDir);
  await writeFiles(work, { "brand.css": OTHER_CSS });
  // 実行
  const result = await withMcpClient(
    { builtRoot, projectDir: join(work, "docs"), env },
    (client) => callTool(client, "apply_template", { name: "brand" }),
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain(join(work, "brand.css"));
  expect(result.texts[0]).toContain("overwrite");
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(OTHER_CSS);
});

// 配置先を省き、上に設定ファイルが無ければエラーにして何も配置しない（異常シナリオ（配置先の設定ファイルが無い））
test("test_error_when_config_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env } = await createFixture(tempDir);
  const empty = await tempDir();
  // 実行
  const result = await withMcpClient(
    { builtRoot, projectDir: empty, env },
    (client) => callTool(client, "apply_template", { name: "brand" }),
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("dir");
  expect(result.texts[0]).toContain("mdmark init");
  expect(existsSync(join(empty, "brand.css"))).toBe(false);
});
