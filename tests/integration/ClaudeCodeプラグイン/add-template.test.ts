import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** 見出しの色を変える CSS */
const BRAND_CSS = "h1 { color: #c00; }\n";

/** 中身を書き換えた CSS */
const CHANGED_CSS = "h1 { color: #00c; }\n";

/** 一時フォルダの端末の設定・テンプレートのフォルダと、`brand.css` を持つ作業のフォルダ */
async function createFixture(css: string = BRAND_CSS): Promise<{
  env: Record<string, string>;
  templatesDir: string;
  work: string;
}> {
  const settingsDir = await createTempDir();
  await writeFiles(settingsDir, { "settings.yaml": "features: {}\n" });
  const work = await createTempDir();
  await writeFiles(work, { "brand.css": css });
  return {
    env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") },
    templatesDir: join(settingsDir, "templates", "css"),
    work,
  };
}

/** 登録の引数 */
const ARGS = {
  file: "brand.css",
  name: "brand",
  description: "見出しを社の色にする",
  tags: ["見出し", "色"],
};

// フォルダと索引を作り、CSS をコピーして行を追加する（正常系）
test("test_normal", async () => {
  // 準備
  const { env, templatesDir, work } = await createFixture();
  const client = await connectHttp({ projectDir: work, env });
  // 実行
  const result = await callTool(client, "add_template", ARGS);
  // 検証
  expect(result.isError).toBe(false);
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    BRAND_CSS,
  );
  const index = parse(
    await readFile(join(templatesDir, "templates.yaml"), "utf8"),
  );
  expect(index).toEqual({
    schema: 1,
    templates: [
      {
        name: "brand",
        file: "brand.css",
        description: "見出しを社の色にする",
        tags: ["見出し", "色"],
      },
    ],
  });
  expect(JSON.parse(result.texts[0] ?? "").replaced).toBe(false);
});

// 同じ名前を overwrite で置き換え、行を 1 つのままにする（正常系（上書きする））
test("test_normal_when_overwriting", async () => {
  // 準備
  const { env, templatesDir, work } = await createFixture();
  const client = await connectHttp({ projectDir: work, env });
  await callTool(client, "add_template", ARGS);
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const result = await callTool(client, "add_template", {
    ...ARGS,
    description: "見出しを青にする",
    tags: ["青"],
    overwrite: true,
  });
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
  expect(JSON.parse(result.texts[0] ?? "").replaced).toBe(true);
});

// overwrite なしの同じ名前は、何も書き換えずにエラーにする（異常系（同じ名前のテンプレートがある））
test("test_error_when_name_exists", async () => {
  // 準備
  const { env, templatesDir, work } = await createFixture();
  const client = await connectHttp({ projectDir: work, env });
  await callTool(client, "add_template", ARGS);
  const before = await readFile(join(templatesDir, "templates.yaml"), "utf8");
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const result = await callTool(client, "add_template", ARGS);
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

// 無い CSS は、フォルダと索引を作らずにエラーにする（異常系（CSS が無い））
test("test_error_when_file_missing", async () => {
  // 準備
  const { env, templatesDir, work } = await createFixture();
  const client = await connectHttp({ projectDir: work, env });
  // 実行
  const result = await callTool(client, "add_template", {
    ...ARGS,
    file: "missing.css",
  });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("missing.css");
  expect(existsSync(templatesDir)).toBe(false);
});
