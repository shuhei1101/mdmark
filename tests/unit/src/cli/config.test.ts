import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 設定を読む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/config.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// 上のフォルダの設定ファイルを見つける（正常系）
test("test_find_config_file", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, { "mdmark.config.yaml": "features: {}\n" });
  const cwd = join(root, "a", "b");
  await mkdir(cwd, { recursive: true });
  // 実行
  const found = await findConfigFile(cwd, undefined);
  // 検証
  expect(found).toBe(join(root, "mdmark.config.yaml"));
});

// --config のパスを優先する（正常系）
test("test_find_config_file_when_explicit", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": "features: {}\n",
    "docs/mdmark.config.yaml": "features: {}\n",
  });
  // 実行
  const found = await findConfigFile(root, "docs/mdmark.config.yaml");
  // 検証
  expect(found).toBe(join(root, "docs", "mdmark.config.yaml"));
});

// 見つからないと CliError を投げる（異常系）
test("test_find_config_file_when_missing", async () => {
  // 準備
  const { findConfigFile } = await loadModule();
  const { CliError } = await loadMain();
  const cwd = await createTempDir();
  // 実行
  const result = findConfigFile(cwd, undefined);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("mdmark init");
});

// 読んだ値とフォルダを返す（正常系）
test("test_load_config", async () => {
  // 準備
  const { loadConfig } = await loadModule();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": 'build:\n  include: ["*.md"]\n  out: a.html\n',
  });
  // 実行
  const loaded = await loadConfig(join(root, "mdmark.config.yaml"));
  // 検証
  expect(loaded.dir).toBe(root);
  expect(loaded.raw).toMatchObject({ build: { out: "a.html" } });
});

// 読めない行を示す CliError を投げる（異常系）
test("test_load_config_when_yaml_broken", async () => {
  // 準備
  const { loadConfig } = await loadModule();
  const { CliError } = await loadMain();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": "features:\n  print: true\n table: false\n",
  });
  // 実行
  const result = loadConfig(join(root, "mdmark.config.yaml"));
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("3 行目");
});

// 形の合う設定はずれ 0 件（正常系）
test("test_validate_config", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = {
    version: "v0.3.0",
    theme: "theme.css",
    extensions: ["extensions/example.ts"],
    build: { include: ["**/*.md"], out: "dist/docs.html" },
    title: "知らないキー",
  };
  // 実行
  const { issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toEqual([]);
});

// build.out が無いと schema のずれを返す（正常系）
test("test_validate_config_when_build_out_missing", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = { build: { include: ["**/*.md"] } };
  // 実行
  const { issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ where: "build", kind: "schema" });
  expect(issues[0]?.message).toContain("build.out");
});

// 空の設定ファイル（null）を schema のずれにする（正常系）
test("test_validate_config_when_empty", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const { issues } = validateConfig(null, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ where: "", kind: "schema" });
});

// 形の違う libraries を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_libraries_not_object", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = { libraries: "chart.js" };
  // 実行
  const { config, issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ where: "libraries", kind: "schema" });
  expect(config.libraries).toBeUndefined();
});

// 書式の違う version を schema のずれにする（異常系）
test("test_validate_config_when_version_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = { version: "0.3" };
  // 実行
  const { issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ where: "version", kind: "schema" });
});

// 印の名前の書式に合わない check.ignore の値を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_check_ignore_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = { check: { ignore: ["prettier-ignore", "Bad Name"] } };
  // 実行
  const { config, issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ where: "check.ignore[1]", kind: "schema" });
  expect(config.check?.ignore).toEqual(["prettier-ignore"]);
});

// 形が合わないと mdmark check を添えた CliError を投げる（異常系）
test("test_require_config_when_invalid", async () => {
  // 準備
  const { requireConfig } = await loadModule();
  const { CliError } = await loadMain();
  const root = await createTempDir();
  await writeFiles(root, { "mdmark.config.yaml": "libraries: chart.js\n" });
  // 実行
  const result = requireConfig(root, undefined);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("libraries");
  await expect(result).rejects.toThrow("mdmark check");
});

// top・bottom 以外の tooltips.placement を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_tooltip_placement_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig(
    { tooltips: { placement: "left" } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { tooltips: { placement: "bottom" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "tooltips.placement",
    kind: "schema",
  });
  expect(invalid.config.tooltips).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config.tooltips?.placement).toBe("bottom");
});

// 文字列でない syntax.url を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_syntax_url_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig({ syntax: { url: 1 } }, "mdmark.config.yaml");
  const valid = validateConfig(
    { syntax: { url: "/vendor/hl/" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "syntax.url",
    kind: "schema",
  });
  expect(invalid.config.syntax).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config.syntax?.url).toBe("/vendor/hl/");
});

// hover・fixed 以外の side-toc.mode を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_side_toc_mode_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig(
    { "side-toc": { mode: "left" } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { "side-toc": { mode: "fixed" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "side-toc.mode",
    kind: "schema",
  });
  expect(invalid.config["side-toc"]).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config["side-toc"]?.mode).toBe("fixed");
});

// 文字列でない colorTheme を schema のずれにして落とし、知らない名前はそのまま残す（正常系）
test("test_validate_config_when_color_theme_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig({ colorTheme: 1 }, "mdmark.config.yaml");
  const unknown = validateConfig({ colorTheme: "sepia" }, "mdmark.config.yaml");
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "colorTheme",
    kind: "schema",
  });
  expect(invalid.config.colorTheme).toBeUndefined();
  expect(unknown.issues).toEqual([]);
  expect(unknown.config.colorTheme).toBe("sepia");
});

// aliases の Schema に合わない行を schema のずれにし、行の位置を保つ（異常系）
test("test_validate_config_when_aliases_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const valid = {
    id: "terms",
    paths: ["terms/*.yaml"],
    metadata: { alias_type: { type: "custom", value: "term" } },
  };
  const invalid = {
    id: "memos",
    paths: ["memos/*.yaml"],
    metadata: { alias_type: { type: "custom", value: "memo" } },
  };
  // 実行
  const { config, issues } = validateConfig(
    { aliases: [valid, invalid] },
    "mdmark.config.yaml",
  );
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.kind).toBe("schema");
  expect(issues[0]?.where).toBe("aliases[1].metadata.alias_type.value");
  expect(config.aliases).toHaveLength(2);
  expect(config.aliases?.[0]).toEqual(valid);
  expect(config.aliases?.[1]).toBeNull();
});
