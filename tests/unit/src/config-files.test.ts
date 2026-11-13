import { expect, test } from "vitest";

/** 設定を重ねて読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../src/config-files.ts");

/** 端末の設定の場所 */
const SETTINGS = "/s/settings.yaml";

/** メモリのファイルの表から、`readFile`（無ければ `ENOENT` を投げる）と `isFile` を作る */
const memoryFiles = (files: Record<string, string>) => ({
  readFile: async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    }
    return text;
  },
  isFile: async (path: string): Promise<boolean> => path in files,
});

/** `loadLayeredConfig` の共通の引数 */
const options = (
  files: Record<string, string>,
  overrides: {
    cwd?: string;
    explicit?: string;
    purpose?: "preview" | "export";
  } = {},
) => ({
  cwd: overrides.cwd ?? "/w/a",
  explicit: overrides.explicit,
  purpose: overrides.purpose ?? "preview",
  env: { MDMARK_CONFIG: SETTINGS },
  home: "/h",
  explicitName: "--config のパス",
  ...memoryFiles(files),
});

// 端末の設定・上・近いを重ね、相対パスを記載したファイルから解決する（正常系）
test("test_load_layered_config", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    [SETTINGS]: "config:\n  cascade: true\nfeatures:\n  callout: false\n",
    "/w/mdmark.config.yaml": "theme: ./theme.css\n",
    "/w/a/mdmark.config.yaml": "features:\n  table: false\n",
  };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.config.features).toEqual({ callout: false, table: false });
  expect(layered.config.theme).toBe("/w/theme.css");
  expect(layered.files.map((file) => file.path)).toEqual([
    SETTINGS,
    "/w/mdmark.config.yaml",
    "/w/a/mdmark.config.yaml",
  ]);
  expect(layered.files.map((file) => file.layer)).toEqual([
    "settings",
    "folder",
    "folder",
  ]);
  expect(layered.nearest).toBe("/w/a/mdmark.config.yaml");
  expect("config" in layered.config).toBe(false);
});

// config.cascade が false なら近い 1 つだけ（正常系）
test("test_load_layered_config_when_first_only", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\n",
    "/w/mdmark.config.yaml": "theme: ./theme.css\n",
    "/w/a/mdmark.config.yaml": "features:\n  table: false\n",
  };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.files.map((file) => file.path)).toEqual([
    SETTINGS,
    "/w/a/mdmark.config.yaml",
  ]);
  expect(layered.config.theme).toBeUndefined();
});

// config.applyToExport: false の書き出しで端末の設定を重ねない（正常系）
test("test_load_layered_config_when_export_without_settings", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    [SETTINGS]:
      "config:\n  applyToExport: false\nfeatures:\n  callout: false\n",
    "/w/a/mdmark.config.yaml": "features:\n  table: false\n",
  };
  // 実行
  const layered = await loadLayeredConfig(
    options(files, { purpose: "export" }),
  );
  // 検証
  expect(layered.files.map((file) => file.path)).toEqual([
    "/w/a/mdmark.config.yaml",
  ]);
  expect(layered.config.features?.callout).toBeUndefined();
});

// 端末の設定が無ければ空の設定として扱う（正常系）
test("test_load_layered_config_when_settings_missing", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = { "/w/a/mdmark.config.yaml": "features:\n  table: false\n" };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.files.map((file) => file.path)).toEqual([
    "/w/a/mdmark.config.yaml",
  ]);
  expect(layered.unreadable).toBeUndefined();
  expect(layered.issues).toEqual([]);
});

// YAML として読み込めないファイルを unreadable にして重ねない（正常系）
test("test_load_layered_config_when_unreadable", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\nlibraries: [a, b}\n",
    "/w/a/mdmark.config.yaml": "features:\n  table: false\n",
  };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.unreadable?.path).toBe(SETTINGS);
  expect(layered.unreadable?.line).toBe(3);
  expect(layered.files.map((file) => file.path)).not.toContain(SETTINGS);
});

// 構造の合わないファイルのずれを返却して重ねない（正常系）
test("test_load_layered_config_when_invalid", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    "/w/a/mdmark.config.yaml": "features:\n  callout: maybe\n",
  };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.issues[0]?.file).toBe("/w/a/mdmark.config.yaml");
  expect(layered.issues[0]?.where).toBe("features.callout");
  expect(layered.files).toEqual([]);
});

// フォルダの設定の config のキーは読み込まない（正常系）
test("test_load_layered_config_when_folder_has_config_key", async () => {
  // 準備
  const { loadLayeredConfig } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\n",
    "/w/mdmark.config.yaml": "theme: ./theme.css\n",
    "/w/a/mdmark.config.yaml": "config:\n  cascade: true\n",
  };
  // 実行
  const layered = await loadLayeredConfig(options(files));
  // 検証
  expect(layered.files.map((file) => file.path)).toEqual([
    SETTINGS,
    "/w/a/mdmark.config.yaml",
  ]);
});

// explicit のファイルが無い（異常系）
test("test_load_layered_config_when_explicit_missing", async () => {
  // 準備
  const { loadLayeredConfig, ConfigNotFoundError } = await loadModule();
  // 実行
  const result = loadLayeredConfig(
    options({}, { explicit: "docs/missing.yaml" }),
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(ConfigNotFoundError);
  await expect(result).rejects.toThrow("docs/missing.yaml");
});

// MDMARK_CONFIG を優先する（正常系）
test("test_resolve_settings_path", async () => {
  // 準備
  const { resolveSettingsPath } = await loadModule();
  // 実行
  const path = resolveSettingsPath({
    env: { MDMARK_CONFIG: "/x/my.yaml", XDG_CONFIG_HOME: "/xdg" },
    home: "/h",
  });
  // 検証
  expect(path).toBe("/x/my.yaml");
});

// XDG_CONFIG_HOME の下を使用する（正常系）
test("test_resolve_settings_path_when_xdg", async () => {
  // 準備
  const { resolveSettingsPath } = await loadModule();
  // 実行
  const path = resolveSettingsPath({
    env: { XDG_CONFIG_HOME: "/xdg" },
    home: "/h",
  });
  // 検証
  expect(path).toBe("/xdg/mdmark/settings.yaml");
});

// ホームの .config の下を使用する（正常系）
test("test_resolve_settings_path_when_no_env", async () => {
  // 準備
  const { resolveSettingsPath } = await loadModule();
  // 実行
  const path = resolveSettingsPath({ env: {}, home: "/h" });
  // 検証
  expect(path).toBe("/h/.config/mdmark/settings.yaml");
});

/** 2 段上と起点に設定ファイルを配置した `isFile` */
const chainFiles = memoryFiles({
  "/w/mdmark.config.yaml": "",
  "/w/a/b/mdmark.config.yaml": "",
}).isFile;

// 全て集めて上 → 近いの順に返却する（正常系）
test("test_find_config_chain", async () => {
  // 準備
  const { findConfigChain } = await loadModule();
  // 実行
  const chain = await findConfigChain({
    cwd: "/w/a/b",
    cascade: true,
    isFile: chainFiles,
  });
  // 検証
  expect(chain).toEqual(["/w/mdmark.config.yaml", "/w/a/b/mdmark.config.yaml"]);
});

// cascade: false なら近い 1 つ（正常系）
test("test_find_config_chain_when_first_only", async () => {
  // 準備
  const { findConfigChain } = await loadModule();
  // 実行
  const chain = await findConfigChain({
    cwd: "/w/a/b",
    cascade: false,
    isFile: chainFiles,
  });
  // 検証
  expect(chain).toEqual(["/w/a/b/mdmark.config.yaml"]);
});

// 見つからなければ空（正常系）
test("test_find_config_chain_when_none", async () => {
  // 準備
  const { findConfigChain } = await loadModule();
  // 実行
  const chain = await findConfigChain({
    cwd: "/w/a/b",
    cascade: true,
    isFile: memoryFiles({}).isFile,
  });
  // 検証
  expect(chain).toEqual([]);
});

// 相対パスを絶対パスにし、URL は替えない（正常系）
test("test_absolutize_config_paths", async () => {
  // 準備
  const { absolutizeConfigPaths } = await loadModule();
  const config = {
    theme: "./theme.css",
    libraries: { a: "./a.js", b: "https://x/b.js" },
    build: { include: ["*.md"], out: "site.html" },
  };
  // 実行
  const result = absolutizeConfigPaths({ config, dir: "/w/docs" });
  // 検証
  expect(result.theme).toBe("/w/docs/theme.css");
  expect(result.libraries).toEqual({ a: "/w/docs/a.js", b: "https://x/b.js" });
  expect(result.build?.include[0]).toBe("/w/docs/*.md");
  expect(config.theme).toBe("./theme.css");
});

// マップはキーごと、配列と文字列は置き換え（正常系）
test("test_merge_configs", async () => {
  // 準備
  const { mergeConfigs } = await loadModule();
  // 実行
  const merged = mergeConfigs([
    { features: { a: true }, extensions: ["x"], theme: "t1" },
    { features: { b: false }, extensions: ["y"], theme: "t2" },
  ]);
  // 検証
  expect(merged).toEqual({
    features: { a: true, b: false },
    extensions: ["y"],
    theme: "t2",
  });
});

// 基準の中は相対パス（正常系）
test("test_display_config_path", async () => {
  // 準備
  const { displayConfigPath } = await loadModule();
  // 実行
  const shown = displayConfigPath({
    path: "/w/docs/mdmark.config.yaml",
    base: "/w",
    home: "/h",
  });
  // 検証
  expect(shown).toBe("docs/mdmark.config.yaml");
});

// 基準の外でホームの下は ~ のパス（正常系）
test("test_display_config_path_when_home", async () => {
  // 準備
  const { displayConfigPath } = await loadModule();
  // 実行
  const shown = displayConfigPath({
    path: "/h/.config/mdmark/settings.yaml",
    base: "/w",
    home: "/h",
  });
  // 検証
  expect(shown).toBe("~/.config/mdmark/settings.yaml");
});

// どちらの外も絶対パス（正常系）
test("test_display_config_path_when_outside", async () => {
  // 準備
  const { displayConfigPath } = await loadModule();
  // 実行
  const shown = displayConfigPath({
    path: "/etc/mdmark/settings.yaml",
    base: "/w",
    home: "/h",
  });
  // 検証
  expect(shown).toBe("/etc/mdmark/settings.yaml");
});

// 真偽値ならずれが無い（正常系）
test("test_validate_settings_keys", async () => {
  // 準備
  const { validateSettingsKeys } = await loadModule();
  // 実行
  const issues = validateSettingsKeys(
    { config: { cascade: true, applyToExport: false } },
    SETTINGS,
  );
  // 検証
  expect(issues).toEqual([]);
});

// 真偽値でない値をずれにする（正常系）
test("test_validate_settings_keys_when_not_boolean", async () => {
  // 準備
  const { validateSettingsKeys } = await loadModule();
  // 実行
  const issues = validateSettingsKeys(
    { config: { cascade: "maybe" } },
    SETTINGS,
  );
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.where).toBe("config.cascade");
  expect(issues[0]?.kind).toBe("schema");
});

// config がマップでない（正常系）
test("test_validate_settings_keys_when_not_map", async () => {
  // 準備
  const { validateSettingsKeys } = await loadModule();
  // 実行
  const issues = validateSettingsKeys({ config: true }, SETTINGS);
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.where).toBe("config");
});

// 下のパスだけを相対パスに戻し、外のパスと URL は替えない（正常系）
test("test_relativize_config_paths", async () => {
  // 準備
  const { relativizeConfigPaths } = await loadModule();
  // 実行
  const result = relativizeConfigPaths({
    config: {
      theme: "/w/docs/theme.css",
      index: "/w/index.yaml",
      libraries: { b: "https://x/b.js" },
      build: { include: ["/w/docs/*.md"], out: "/w/docs/site.html" },
    },
    dir: "/w/docs",
  });
  // 検証
  expect(result.theme).toBe("theme.css");
  expect(result.index).toBe("/w/index.yaml");
  expect(result.libraries).toEqual({ b: "https://x/b.js" });
  expect(result.build?.include[0]).toBe("*.md");
  expect(result.build?.out).toBe("site.html");
});

// 構造の合う設定はずれ 0 件（正常系）
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

// build.out が無いと schema のずれを返却する（正常系）
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

// 構造の違う libraries を schema のずれにし、設定から落とす（正常系）
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

// 真偽値でない check.suggestMarkExtension を schema のずれにし、設定から落とす（異常系）
test("test_validate_config_when_suggest_mark_extension_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const raw = { check: { suggestMarkExtension: "no" } };
  // 実行
  const { config, issues } = validateConfig(raw, "mdmark.config.yaml");
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    where: "check.suggestMarkExtension",
    kind: "schema",
  });
  expect(config.check?.suggestMarkExtension).toBeUndefined();
});

// マーカーの名前の書式に合わない check.ignore の値を schema のずれにし、設定から落とす（正常系）
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

// オブジェクトでない labels と、空でない文字列でない labels.paramCopy を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_labels_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const validate = (labels: unknown) =>
    validateConfig({ labels }, "mdmark.config.yaml");
  // 実行
  const notMap = validate("コピー");
  const empty = validate({ paramCopy: "" });
  const notString = validate({ paramCopy: 1 });
  const valid = validate({ paramCopy: "コピー" });
  // 検証
  for (const [result, where] of [
    [notMap, "labels"],
    [empty, "labels.paramCopy"],
    [notString, "labels.paramCopy"],
  ] as const) {
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ where, kind: "schema" });
    expect(result.config.labels).toBeUndefined();
  }
  expect(valid.issues).toEqual([]);
  expect(valid.config.labels?.paramCopy).toBe("コピー");
});

// 文字列でない html-scripts.url を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_html_scripts_url_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig(
    { "html-scripts": { url: 1 } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { "html-scripts": { url: "/vendor/babel.mjs" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "html-scripts.url",
    kind: "schema",
  });
  expect(invalid.config["html-scripts"]).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config["html-scripts"]?.url).toBe("/vendor/babel.mjs");
});

// 構造の合わない mermaid を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_mermaid_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const badUrl = validateConfig({ mermaid: { url: 1 } }, "mdmark.config.yaml");
  const badVariables = validateConfig(
    { mermaid: { themeVariables: "x" } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { mermaid: { url: "/vendor/mermaid.mjs", theme: "no-such-theme" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(badUrl.issues).toHaveLength(1);
  expect(badUrl.issues[0]).toMatchObject({
    where: "mermaid.url",
    kind: "schema",
  });
  expect(badUrl.config.mermaid).toBeUndefined();
  expect(badVariables.issues).toHaveLength(1);
  expect(badVariables.issues[0]).toMatchObject({
    where: "mermaid.themeVariables",
    kind: "schema",
  });
  expect(badVariables.config.mermaid).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config.mermaid).toEqual({
    url: "/vendor/mermaid.mjs",
    theme: "no-such-theme",
  });
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

// each・through 以外の table.pin を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_table_pin_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig(
    { table: { pin: "left" } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { table: { pin: "through" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "table.pin",
    kind: "schema",
  });
  expect(invalid.config.table).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config.table?.pin).toBe("through");
});

// 0 より大きい数でない table.long_column_min を schema のずれにし、設定から落とす（正常系）
test("test_validate_config_when_table_long_column_min_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = [0, "wide"].map((value) =>
    validateConfig({ table: { long_column_min: value } }, "mdmark.config.yaml"),
  );
  const valid = validateConfig(
    { table: { long_column_min: 30 } },
    "mdmark.config.yaml",
  );
  // 検証
  for (const result of invalid) {
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      where: "table.long_column_min",
      kind: "schema",
    });
    expect(result.config.table).toBeUndefined();
  }
  expect(valid.issues).toEqual([]);
  expect(valid.config.table?.long_column_min).toBe(30);
});

// オブジェクトでない map を schema のずれにして落とし、知らない値はそのまま残す（正常系）
test("test_validate_config_when_map_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const unknown = validateConfig(
    { map: { kinds: { store: { shape: "hexagon" } } } },
    "mdmark.config.yaml",
  );
  const notObject = validateConfig({ map: "x" }, "mdmark.config.yaml");
  // 検証
  expect(unknown.issues).toEqual([]);
  expect(
    (unknown.config as { map?: { kinds?: Record<string, { shape?: string }> } })
      .map?.kinds?.store?.shape,
  ).toBe("hexagon");
  expect(notObject.issues.map((issue) => issue.where)).toEqual(["map"]);
  expect((notObject.config as { map?: unknown }).map).toBeUndefined();
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

// 文字列でない colorScheme を schema のずれにして落とし、知らない値はそのまま残す（異常系）
test("test_validate_config_when_color_scheme_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig({ colorScheme: 1 }, "mdmark.config.yaml");
  const unknown = validateConfig(
    { colorScheme: "sepia" },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "colorScheme",
    kind: "schema",
  });
  expect(invalid.config.colorScheme).toBeUndefined();
  expect(unknown.issues).toEqual([]);
  expect(unknown.config.colorScheme).toBe("sepia");
});

// aliases の Schema に合わない行を schema のずれにし、行の位置を保つ（異常系）
test("test_validate_config_when_aliases_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  const valid = {
    id: "terms",
    paths: ["terms/*.yaml"],
    alias_type: "term",
  };
  const invalid = {
    id: "memos",
    paths: ["memos/*.yaml"],
    alias_type: "memo",
  };
  // 実行
  const { config, issues } = validateConfig(
    { aliases: [valid, invalid] },
    "mdmark.config.yaml",
  );
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.kind).toBe("schema");
  expect(issues[0]?.where).toBe("aliases[1].alias_type");
  expect(config.aliases).toHaveLength(2);
  expect(config.aliases?.[0]).toEqual(valid);
  expect(config.aliases?.[1]).toBeNull();
});

// 構造の違う assets.root を schema のずれにする（正常系）
test("test_validate_config_when_assets_not_string", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const result = validateConfig({ assets: { root: 1 } }, "mdmark.config.yaml");
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toMatchObject({
    where: "assets.root",
    kind: "schema",
  });
});

// top・bottom 以外の tooltips.diagramPlacement を schema のずれにし、設定から落とす（異常系）
test("test_validate_config_when_diagram_placement_invalid", async () => {
  // 準備
  const { validateConfig } = await loadModule();
  // 実行
  const invalid = validateConfig(
    { tooltips: { diagramPlacement: "left" } },
    "mdmark.config.yaml",
  );
  const valid = validateConfig(
    { tooltips: { diagramPlacement: "top" } },
    "mdmark.config.yaml",
  );
  // 検証
  expect(invalid.issues).toHaveLength(1);
  expect(invalid.issues[0]).toMatchObject({
    where: "tooltips.diagramPlacement",
    kind: "schema",
  });
  expect(invalid.issues[0]?.message).toContain("top");
  expect(invalid.issues[0]?.message).toContain("bottom");
  expect(invalid.config.tooltips).toBeUndefined();
  expect(valid.issues).toEqual([]);
  expect(valid.config.tooltips?.diagramPlacement).toBe("top");
});
