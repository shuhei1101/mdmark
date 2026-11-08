import { existsSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { parse, stringify } from "yaml";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rename: vi.fn(original.rename) };
});

/** テンプレートの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTemplates = () => import("../../../../src/plugin/templates.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/** 索引の行 */
type Row = { name: string; file: string; description: string; tags?: string[] };

/** テンプレートのフォルダに CSS と索引を書き込む */
async function writeTemplates(
  dir: string,
  rows: Row[],
  css: Record<string, string> = {},
): Promise<void> {
  await writeFiles(dir, {
    "templates.yaml": stringify({ schema: 1, templates: rows }),
    ...css,
  });
}

/** テンプレートのフォルダの索引を読み込む */
async function readIndex(dir: string): Promise<{ templates: Row[] }> {
  return parse(await readFile(join(dir, "templates.yaml"), "utf8"));
}

/** 見出しの色を変える CSS */
const BRAND_CSS = "h1 { color: #c00; }\n";

/** 中身を書き換えた CSS */
const CHANGED_CSS = "h1 { color: #00c; }\n";

// `MDMARK_CONFIG` のフォルダの下にする（正常系）
test("test_resolve_templates_dir", async () => {
  // 準備
  const { resolveTemplatesDir } = await loadTemplates();
  // 実行
  const dir = resolveTemplatesDir({
    env: { MDMARK_CONFIG: "/tmp/a/settings.yaml" },
    home: "/home/u",
  });
  // 検証
  expect(dir).toBe("/tmp/a/templates/css");
});

// `MDMARK_CONFIG` が無ければ `XDG_CONFIG_HOME` の下にする（正常系）
test("test_resolve_templates_dir_when_xdg", async () => {
  // 準備
  const { resolveTemplatesDir } = await loadTemplates();
  // 実行
  const dir = resolveTemplatesDir({
    env: { XDG_CONFIG_HOME: "/x" },
    home: "/home/u",
  });
  // 検証
  expect(dir).toBe("/x/mdmark/templates/css");
});

// 合う索引は `undefined`（正常系）
test("test_validate_templates_index", async () => {
  // 準備
  const { validateTemplatesIndex } = await loadTemplates();
  // 実行
  const message = validateTemplatesIndex({
    value: {
      schema: 1,
      templates: [
        { name: "brand", file: "brand.css", description: "x", tags: [] },
      ],
    },
    path: "/t/templates.yaml",
  });
  // 検証
  expect(message).toBeUndefined();
});

// 行の `file` が無い（異常系）
test("test_validate_templates_index_when_file_missing", async () => {
  // 準備
  const { validateTemplatesIndex } = await loadTemplates();
  // 実行
  const message = validateTemplatesIndex({
    value: { schema: 1, templates: [{ name: "brand", description: "x" }] },
    path: "/t/templates.yaml",
  });
  // 検証
  expect(message).toContain("/t/templates.yaml");
  expect(message).toContain("templates[0].file");
});

// `file` に `/` か `..` がある（異常系）
test("test_validate_templates_index_when_file_has_slash", async () => {
  // 準備
  const { validateTemplatesIndex } = await loadTemplates();
  // 実行
  const message = validateTemplatesIndex({
    value: {
      schema: 1,
      templates: [{ name: "brand", file: "../x.css", description: "x" }],
    },
    path: "/t/templates.yaml",
  });
  // 検証
  expect(message).toContain("templates[0].file");
});

// 同じ `name` の行が 2 つある（異常系）
test("test_validate_templates_index_when_name_duplicated", async () => {
  // 準備
  const { validateTemplatesIndex } = await loadTemplates();
  const row = { name: "brand", file: "brand.css", description: "x" };
  // 実行
  const message = validateTemplatesIndex({
    value: { schema: 1, templates: [row, row] },
    path: "/t/templates.yaml",
  });
  // 検証
  expect(message).toContain("templates[1].name");
});

// 索引を読み込み、省いた `tags` を空の並びにする（正常系）
test("test_read_templates_index", async () => {
  // 準備
  const { readTemplatesIndex } = await loadTemplates();
  const dir = await createTempDir();
  await writeTemplates(dir, [
    { name: "brand", file: "brand.css", description: "x" },
  ]);
  // 実行
  const index = await readTemplatesIndex(dir);
  // 検証
  expect(index.templates[0]?.tags).toEqual([]);
});

// フォルダが無ければ空の索引を返却し、フォルダを作らない（正常系）
test("test_read_templates_index_when_missing", async () => {
  // 準備
  const { readTemplatesIndex } = await loadTemplates();
  const dir = join(await createTempDir(), "templates", "css");
  // 実行
  const index = await readTemplatesIndex(dir);
  // 検証
  expect(index.templates).toEqual([]);
  expect(existsSync(dir)).toBe(false);
});

// YAML として読み込めない索引（異常系）
test("test_read_templates_index_when_unreadable", async () => {
  // 準備
  const { readTemplatesIndex } = await loadTemplates();
  const { CliError } = await loadErrors();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "templates.yaml": "schema: 1\ntemplates:\ntags: [a, b}\n",
  });
  // 実行
  const reading = readTemplatesIndex(dir);
  // 検証
  await expect(reading).rejects.toBeInstanceOf(CliError);
  await expect(reading).rejects.toThrow(join(dir, "templates.yaml"));
  await expect(reading).rejects.toThrow("3");
});

// 索引の順に `path` を付けて返却する（正常系）
test("test_list_templates", async () => {
  // 準備
  const { listTemplates } = await loadTemplates();
  const dir = await createTempDir();
  await writeTemplates(dir, [
    { name: "brand", file: "brand.css", description: "社の色", tags: ["色"] },
    { name: "paper", file: "paper.css", description: "紙", tags: [] },
  ]);
  // 実行
  const templates = await listTemplates(dir);
  // 検証
  expect(templates).toEqual([
    {
      name: "brand",
      description: "社の色",
      tags: ["色"],
      path: join(dir, "brand.css"),
    },
    {
      name: "paper",
      description: "紙",
      tags: [],
      path: join(dir, "paper.css"),
    },
  ]);
});

// 記載した索引を再読み込みでき、一時ファイルが残らない（正常系）
test("test_write_templates_index", async () => {
  // 準備
  const { addTemplate, readTemplatesIndex } = await loadTemplates();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "css");
  await writeFiles(work, { "brand.css": BRAND_CSS });
  // 実行
  await addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "社の色",
    tags: ["色"],
    overwrite: false,
  });
  // 検証
  const index = await readTemplatesIndex(dir);
  expect(index.templates).toEqual([
    { name: "brand", file: "brand.css", description: "社の色", tags: ["色"] },
  ]);
  expect((await readdir(dir)).filter((name) => name.endsWith(".tmp"))).toEqual(
    [],
  );
});

// フォルダと索引を作って登録する（正常系）
test("test_add_template", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "templates", "css");
  await writeFiles(work, { "brand.css": BRAND_CSS });
  // 実行
  const result = await addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "社の色",
    tags: [],
    overwrite: false,
  });
  // 検証
  expect(await readFile(join(dir, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect((await readIndex(dir)).templates).toEqual([
    { name: "brand", file: "brand.css", description: "社の色", tags: [] },
  ]);
  expect(result).toEqual({
    name: "brand",
    path: join(dir, "brand.css"),
    replaced: false,
  });
});

// 同じ名前を置き換え、行の位置を変えない（正常系）
test("test_add_template_when_overwrite", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const work = await createTempDir();
  const dir = await createTempDir();
  await writeTemplates(
    dir,
    [
      { name: "brand", file: "brand.css", description: "古い", tags: [] },
      { name: "paper", file: "paper.css", description: "紙", tags: [] },
    ],
    { "brand.css": BRAND_CSS, "paper.css": "p {}" },
  );
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const result = await addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "新しい",
    tags: ["色"],
    overwrite: true,
  });
  // 検証
  const { templates } = await readIndex(dir);
  expect(templates.map((row) => row.name)).toEqual(["brand", "paper"]);
  expect(templates[0]?.description).toBe("新しい");
  expect(await readFile(join(dir, "brand.css"), "utf8")).toBe(CHANGED_CSS);
  expect(result.replaced).toBe(true);
});

// 別の名前の登録が重なっても、両方の行が残る（正常系）
test("test_add_template_when_concurrent", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "css");
  await writeFiles(work, { "brand.css": BRAND_CSS, "paper.css": "p {}" });
  const add = (name: string) =>
    addTemplate({
      dir,
      source: join(work, `${name}.css`),
      name,
      description: name,
      tags: [],
      overwrite: false,
    });
  // 実行
  await Promise.all([add("brand"), add("paper")]);
  // 検証
  const names = (await readIndex(dir)).templates.map((row) => row.name);
  expect(names.sort()).toEqual(["brand", "paper"]);
  expect(existsSync(join(dir, "brand.css"))).toBe(true);
  expect(existsSync(join(dir, "paper.css"))).toBe(true);
});

// `overwrite` なしの同じ名前（異常系）
test("test_add_template_when_name_exists", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const work = await createTempDir();
  const dir = await createTempDir();
  await writeTemplates(
    dir,
    [{ name: "brand", file: "brand.css", description: "古い", tags: [] }],
    { "brand.css": BRAND_CSS },
  );
  const before = await readFile(join(dir, "templates.yaml"), "utf8");
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const adding = addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "新しい",
    tags: [],
    overwrite: false,
  });
  // 検証
  await expect(adding).rejects.toBeInstanceOf(CliError);
  await expect(adding).rejects.toThrow("brand");
  await expect(adding).rejects.toThrow("overwrite");
  expect(await readFile(join(dir, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(dir, "templates.yaml"), "utf8")).toBe(before);
});

// `name` に許さない文字がある（異常系）
test("test_add_template_when_name_invalid", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "css");
  await writeFiles(work, { "brand.css": BRAND_CSS });
  // 実行
  const adding = addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "Bad_Name",
    description: "x",
    tags: [],
    overwrite: false,
  });
  // 検証
  await expect(adding).rejects.toBeInstanceOf(CliError);
  await expect(adding).rejects.toThrow("name");
  await expect(adding).rejects.toThrow("英小文字");
  await expect(adding).rejects.not.toThrow("templates[0]");
  expect(existsSync(dir)).toBe(false);
});

// `tags` に空の文字列がある（異常系）
test("test_add_template_when_tags_empty", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "css");
  await writeFiles(work, { "brand.css": BRAND_CSS });
  // 実行
  const adding = addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "x",
    tags: [""],
    overwrite: false,
  });
  // 検証
  await expect(adding).rejects.toBeInstanceOf(CliError);
  await expect(adding).rejects.toThrow("tags");
  expect(existsSync(dir)).toBe(false);
});

// 無い CSS（異常系）
test("test_add_template_when_source_missing", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const work = await createTempDir();
  const dir = join(await createTempDir(), "css");
  const source = join(work, "missing.css");
  // 実行
  const adding = addTemplate({
    dir,
    source,
    name: "brand",
    description: "x",
    tags: [],
    overwrite: false,
  });
  // 検証
  await expect(adding).rejects.toBeInstanceOf(CliError);
  await expect(adding).rejects.toThrow(source);
  expect(existsSync(dir)).toBe(false);
});

// 索引を書き込めなければ CSS を戻す（異常系）
test("test_add_template_when_index_write_fails", async () => {
  // 準備
  const { addTemplate } = await loadTemplates();
  const work = await createTempDir();
  const dir = await createTempDir();
  await writeTemplates(
    dir,
    [{ name: "brand", file: "brand.css", description: "古い", tags: [] }],
    { "brand.css": BRAND_CSS },
  );
  const before = await readFile(join(dir, "templates.yaml"), "utf8");
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  vi.mocked(fsPromises.rename).mockRejectedValueOnce(new Error("EIO"));
  // 実行
  const adding = addTemplate({
    dir,
    source: join(work, "brand.css"),
    name: "brand",
    description: "新しい",
    tags: [],
    overwrite: true,
  });
  // 検証
  await expect(adding).rejects.toThrow("EIO");
  expect(await readFile(join(dir, "brand.css"), "utf8")).toBe(BRAND_CSS);
  expect(await readFile(join(dir, "templates.yaml"), "utf8")).toBe(before);
});

/** 登録済みのテンプレートのフォルダと、`mdmark.config.yaml` を直下に持つ作業のフォルダを作る */
async function createApplyFixture(): Promise<{ dir: string; work: string }> {
  const dir = await createTempDir();
  await writeTemplates(
    dir,
    [{ name: "brand", file: "brand.css", description: "社の色", tags: [] }],
    { "brand.css": BRAND_CSS },
  );
  const work = await createTempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/guide.md": "# 見出し\n",
    "styles/.keep": "",
  });
  return { dir, work };
}

// 最も近い設定ファイルのフォルダへ配置する（正常系）
test("test_apply_template", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { dir, work } = await createApplyFixture();
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: join(work, "docs"),
    target: undefined,
    overwrite: false,
  });
  // 検証
  expect(result).toEqual({
    path: join(work, "brand.css"),
    theme: "./brand.css",
    replaced: false,
  });
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
});

// `target` から上の設定ファイルを基準にする（正常系）
test("test_apply_template_when_target_given", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { dir, work } = await createApplyFixture();
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: join(work, "docs"),
    target: join(work, "styles"),
    overwrite: false,
  });
  // 検証
  expect(result.path).toBe(join(work, "styles", "brand.css"));
  expect(result.theme).toBe("./styles/brand.css");
  expect(existsSync(join(work, "brand.css"))).toBe(false);
});

// `target` から上に設定ファイルが無ければ、配置して `theme` を返却しない（正常系）
test("test_apply_template_when_target_without_config", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { dir, work } = await createApplyFixture();
  const target = await createTempDir();
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: join(work, "docs"),
    target,
    overwrite: false,
  });
  // 検証
  expect(result.path).toBe(join(target, "brand.css"));
  expect(result.theme).toBeUndefined();
});

// 同じ中身のファイルがあればエラーにしない（正常系）
test("test_apply_template_when_same_content", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { dir, work } = await createApplyFixture();
  await writeFiles(work, { "brand.css": BRAND_CSS });
  const before = (await stat(join(work, "brand.css"))).mtimeMs;
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target: undefined,
    overwrite: false,
  });
  // 検証
  expect(result.replaced).toBe(false);
  expect((await stat(join(work, "brand.css"))).mtimeMs).toBe(before);
});

// 索引の `file` が名前と違う行は、`file` から読み込んで `{name}.css` に配置する（正常系）
test("test_apply_template_when_file_differs_from_name", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { work } = await createApplyFixture();
  const dir = await createTempDir();
  await writeTemplates(
    dir,
    [{ name: "brand", file: "corporate.css", description: "社の色" }],
    { "corporate.css": CHANGED_CSS },
  );
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target: undefined,
    overwrite: false,
  });
  // 検証
  expect(result.path).toBe(join(work, "brand.css"));
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(CHANGED_CSS);
});

// 配置先の中身の違う同じ名前のファイルを `overwrite` で置き換える（正常系）
test("test_apply_template_when_overwrite", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { dir, work } = await createApplyFixture();
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const result = await applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target: undefined,
    overwrite: true,
  });
  // 検証
  expect(result.replaced).toBe(true);
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(BRAND_CSS);
});

// 中身の違う同じ名前のファイル（異常系）
test("test_apply_template_when_css_exists", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const { dir, work } = await createApplyFixture();
  await writeFiles(work, { "brand.css": CHANGED_CSS });
  // 実行
  const applying = applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target: undefined,
    overwrite: false,
  });
  // 検証
  await expect(applying).rejects.toBeInstanceOf(CliError);
  await expect(applying).rejects.toThrow(join(work, "brand.css"));
  await expect(applying).rejects.toThrow("overwrite");
  expect(await readFile(join(work, "brand.css"), "utf8")).toBe(CHANGED_CSS);
});

// `target` なしで設定ファイルが無い（異常系）
test("test_apply_template_when_config_missing", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const { dir } = await createApplyFixture();
  const cwd = await createTempDir();
  // 実行
  const applying = applyTemplate({
    dir,
    name: "brand",
    cwd,
    target: undefined,
    overwrite: false,
  });
  // 検証
  await expect(applying).rejects.toBeInstanceOf(CliError);
  await expect(applying).rejects.toThrow("dir");
  await expect(applying).rejects.toThrow("mdmark init");
  expect(await readdir(cwd)).toEqual([]);
});

// `target` のフォルダが無い（異常系）
test("test_apply_template_when_target_missing", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const { dir, work } = await createApplyFixture();
  const target = join(work, "missing");
  // 実行
  const applying = applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target,
    overwrite: false,
  });
  // 検証
  await expect(applying).rejects.toBeInstanceOf(CliError);
  await expect(applying).rejects.toThrow(target);
  expect(existsSync(target)).toBe(false);
});

// 索引に行があり、テンプレートのフォルダに CSS が無い（異常系）
test("test_apply_template_when_css_missing", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const { work } = await createApplyFixture();
  const dir = await createTempDir();
  await writeTemplates(dir, [
    { name: "brand", file: "gone.css", description: "社の色" },
  ]);
  // 実行
  const applying = applyTemplate({
    dir,
    name: "brand",
    cwd: work,
    target: undefined,
    overwrite: false,
  });
  // 検証
  await expect(applying).rejects.toBeInstanceOf(CliError);
  await expect(applying).rejects.toThrow("brand");
  await expect(applying).rejects.toThrow(join(dir, "gone.css"));
  await expect(applying).rejects.toThrow("add_template");
  expect(existsSync(join(work, "brand.css"))).toBe(false);
});

// 索引に無い名前（異常系）
test("test_apply_template_when_name_missing", async () => {
  // 準備
  const { applyTemplate } = await loadTemplates();
  const { CliError } = await loadErrors();
  const { dir, work } = await createApplyFixture();
  // 実行
  const applying = applyTemplate({
    dir,
    name: "missing",
    cwd: work,
    target: undefined,
    overwrite: false,
  });
  // 検証
  await expect(applying).rejects.toBeInstanceOf(CliError);
  await expect(applying).rejects.toThrow("missing");
  await expect(applying).rejects.toThrow("list_templates");
});
