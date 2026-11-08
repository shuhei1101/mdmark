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
