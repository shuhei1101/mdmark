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

/** 端末の設定・リポジトリ A（`brand.css`）・リポジトリ B（`theme` を持たない設定と文書）を作る */
async function createFixture(tempDir: () => Promise<string>): Promise<{
  env: Record<string, string>;
  templatesDir: string;
  repoA: string;
  repoB: string;
}> {
  const settingsDir = await tempDir();
  await writeFiles(settingsDir, { "settings.yaml": "features: {}\n" });
  const repoA = await tempDir();
  await writeFiles(repoA, {
    "mdmark.config.yaml": "features: {}\n",
    "brand.css": BRAND_CSS,
  });
  const repoB = await tempDir();
  await writeFiles(repoB, {
    "mdmark.config.yaml": "features: {}\n",
    "guide.md": "# ガイド\n\n本文\n",
  });
  return {
    env: { MDMARK_CONFIG: join(settingsDir, "settings.yaml") },
    templatesDir: join(settingsDir, "templates", "css"),
    repoA,
    repoB,
  };
}

// リポジトリ A で登録し、リポジトリ B で一覧から選んで配置し、theme に記載して書き出した HTML に規則が入る（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, repoA, repoB } = await createFixture(tempDir);
  const configA = await readFile(join(repoA, "mdmark.config.yaml"), "utf8");
  // 実行
  const added = await withMcpClient(
    { builtRoot, projectDir: repoA, env },
    (client) => callTool(client, "add_template", ARGS),
  );
  const { listed, applied, exported } = await withMcpClient(
    { builtRoot, projectDir: repoB, env },
    async (client) => {
      const listed = await callTool(client, "list_templates");
      const applied = await callTool(client, "apply_template", {
        name: "brand",
      });
      const theme = JSON.parse(applied.texts[0] ?? "").theme as string;
      await writeFiles(repoB, {
        "mdmark.config.yaml": `features: {}\ntheme: ${theme}\n`,
      });
      const exported = await callTool(client, "export_html", {
        file: "guide.md",
      });
      return { listed, applied, exported };
    },
  );
  // 検証
  expect(added.isError).toBe(false);
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    BRAND_CSS,
  );
  const index = parse(
    await readFile(join(templatesDir, "templates.yaml"), "utf8"),
  );
  expect(index.templates[0]).toEqual({
    name: "brand",
    file: "brand.css",
    description: "見出しを社の色にする",
    tags: ["見出し", "色"],
  });
  expect(JSON.parse(listed.texts[0] ?? "").templates[0]).toMatchObject({
    name: "brand",
    description: "見出しを社の色にする",
    tags: ["見出し", "色"],
  });
  expect(JSON.parse(applied.texts[0] ?? "")).toMatchObject({
    path: join(repoB, "brand.css"),
    theme: "./brand.css",
  });
  expect(exported.isError).toBe(false);
  const html = await readFile(
    JSON.parse(exported.texts[0] ?? "").out as string,
    "utf8",
  );
  expect(html).toContain("color: #c00");
  expect(await readFile(join(repoA, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(repoA, "mdmark.config.yaml"), "utf8")).toBe(
    configA,
  );
});

// 同じ名前の登録がエラーになり、上書きして登録すると、配置した CSS が書き換えた中身になる（異常シナリオ（同じ名前のテンプレートがある））
test("test_error_when_template_name_exists", async ({ builtRoot, tempDir }) => {
  // 準備
  const { env, templatesDir, repoA, repoB } = await createFixture(tempDir);
  await withMcpClient({ builtRoot, projectDir: repoA, env }, (client) =>
    callTool(client, "add_template", ARGS),
  );
  const before = await readFile(join(templatesDir, "templates.yaml"), "utf8");
  await writeFiles(repoA, { "brand.css": CHANGED_CSS });
  // 実行
  const { rejected, overwritten } = await withMcpClient(
    { builtRoot, projectDir: repoA, env },
    async (client) => {
      const rejected = await callTool(client, "add_template", ARGS);
      const cssAfterReject = await readFile(
        join(templatesDir, "brand.css"),
        "utf8",
      );
      const indexAfterReject = await readFile(
        join(templatesDir, "templates.yaml"),
        "utf8",
      );
      const overwritten = await callTool(client, "add_template", {
        ...ARGS,
        overwrite: true,
      });
      return {
        rejected: { ...rejected, cssAfterReject, indexAfterReject },
        overwritten,
      };
    },
  );
  const applied = await withMcpClient(
    { builtRoot, projectDir: repoB, env },
    (client) => callTool(client, "apply_template", { name: "brand" }),
  );
  // 検証
  expect(rejected.isError).toBe(true);
  expect(rejected.cssAfterReject).toBe(BRAND_CSS);
  expect(rejected.indexAfterReject).toBe(before);
  expect(overwritten.isError).toBe(false);
  expect(await readFile(join(templatesDir, "brand.css"), "utf8")).toBe(
    CHANGED_CSS,
  );
  expect(
    parse(await readFile(join(templatesDir, "templates.yaml"), "utf8"))
      .templates,
  ).toHaveLength(1);
  expect(applied.isError).toBe(false);
  expect(await readFile(join(repoB, "brand.css"), "utf8")).toBe(CHANGED_CSS);
});
