import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";
import { callTool, useMcpServers } from "../plugin.ts";

const createTempDir = useTempDirs();
const { connectHttp } = useMcpServers();

/** テンプレート `brand` の CSS */
const BRAND_CSS = "h1 { color: #c00; }\n";

/** 中身の違う CSS */
const OTHER_CSS = "h1 { color: #00c; }\n";

/** テンプレート `brand` を 1 つ登録した端末の設定と、`/work/mdmark.config.yaml` と `/work/docs` を持つ作業のフォルダ */
async function createFixture(): Promise<{
  env: Record<string, string>;
  work: string;
}> {
  const settingsDir = await createTempDir();
  await writeFiles(settingsDir, {
    "settings.yaml": "features: {}\n",
    "templates/css/templates.yaml":
      "schema: 1\ntemplates:\n  - name: brand\n    file: brand.css\n    description: 見出しを社の色にする\n",
    "templates/css/brand.css": BRAND_CSS,
  });
  const work = await createTempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/guide.md": "# ガイド\n",
    "styles/.keep": "",
  });
  return { env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") }, work };
}

// 最も近い設定ファイルのフォルダへコピーし、theme に記載する値を返却する（正常系）
test("test_normal", async () => {
  // 準備
  const { env, work } = await createFixture();
  const config = await readFile(join(work, "mdmark.config.yaml"), "utf8");
  const client = await connectHttp({ projectDir: join(work, "docs"), env });
  // 実行
  const result = await callTool(client, "apply_template", { name: "brand" });
  // 検証
  expect(result.isError).toBe(false);
  expect(JSON.parse(result.texts[0] ?? "")).toEqual({
    path: join(work, "brand.css"),
    theme: "./brand.css",
    replaced: false,
  });
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(work, "mdmark.config.yaml"), "utf8")).toBe(config);
});

// 配置先の中身の違う同じ名前のファイルを overwrite で置き換える（正常系（上書きする））
test("test_normal_when_overwriting", async () => {
  // 準備
  const { env, work } = await createFixture();
  await writeFiles(work, { "brand.css": OTHER_CSS });
  const client = await connectHttp({ projectDir: join(work, "docs"), env });
  // 実行
  const result = await callTool(client, "apply_template", {
    name: "brand",
    overwrite: true,
  });
  // 検証
  expect(result.isError).toBe(false);
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(JSON.parse(result.texts[0] ?? "").replaced).toBe(true);
});

// 指定したフォルダへ配置し、theme を上の設定ファイルのフォルダからの相対パスにする（正常系（dir を指定する））
test("test_normal_when_dir_given", async () => {
  // 準備
  const { env, work } = await createFixture();
  const client = await connectHttp({ projectDir: join(work, "docs"), env });
  // 実行
  const result = await callTool(client, "apply_template", {
    name: "brand",
    dir: "../styles",
  });
  // 検証
  expect(result.isError).toBe(false);
  const json = JSON.parse(result.texts[0] ?? "");
  expect(json.path).toBe(join(work, "styles", "brand.css"));
  expect(json.theme).toBe("./styles/brand.css");
  expect(await readFile(json.path, "utf8")).toBe(BRAND_CSS);
  expect(existsSync(join(work, "brand.css"))).toBe(false);
});

// overwrite なしで中身の違う同じ名前のファイルがあれば、書き換えずにエラーにする（異常系（配置先に同じ名前の CSS がある））
test("test_error_when_css_exists", async () => {
  // 準備
  const { env, work } = await createFixture();
  await writeFiles(work, { "brand.css": OTHER_CSS });
  const client = await connectHttp({ projectDir: join(work, "docs"), env });
  // 実行
  const result = await callTool(client, "apply_template", { name: "brand" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain(join(work, "brand.css"));
  expect(result.texts[0]).toContain("overwrite");
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(OTHER_CSS);
});

// dir を省き、上に設定ファイルが無ければ、何も書き込まずにエラーにする（異常系（配置先の設定ファイルが無い））
test("test_error_when_config_missing", async () => {
  // 準備
  const { env } = await createFixture();
  const empty = await createTempDir();
  const client = await connectHttp({ projectDir: empty, env });
  // 実行
  const result = await callTool(client, "apply_template", { name: "brand" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("dir");
  expect(result.texts[0]).toContain("mdmark init");
  expect(existsSync(join(empty, "brand.css"))).toBe(false);
});

// 索引に無い名前は、何も書き込まずにエラーにする（異常系（テンプレートが無い））
test("test_error_when_template_missing", async () => {
  // 準備
  const { env, work } = await createFixture();
  const client = await connectHttp({ projectDir: join(work, "docs"), env });
  // 実行
  const result = await callTool(client, "apply_template", { name: "missing" });
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("missing");
  expect(result.texts[0]).toContain("list_templates");
});
