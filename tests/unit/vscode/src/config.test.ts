import { expect, test, vi } from "vitest";

/** 設定ファイルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../vscode/src/config.ts");

/** 端末の設定の場所 */
const SETTINGS = "/s/settings.yaml";

/** メモリのファイルの表から作った `loadConfig` の引数 */
const loadOptions = (
  files: Record<string, string>,
  overrides: { cwd?: string; configPath?: string } = {},
) => ({
  cwd: overrides.cwd ?? "/w",
  configPath: overrides.configPath ?? "",
  baseDir: "/w",
  purpose: "preview" as const,
  env: { MDMARK_CONFIG: SETTINGS },
  home: "/h",
  readFile: vi.fn(async (path: string) => {
    const text = files[path];
    if (text === undefined) {
      throw Object.assign(new Error("no such file"), { code: "ENOENT" });
    }
    return text;
  }),
  isFile: vi.fn(async (path: string) => path in files),
});

// 相対パスは基準のフォルダから、絶対パスはそのまま（正常系）
test("test_resolve_config_path", async () => {
  // 準備
  const { resolveConfigPath } = await loadModule();
  // 実行
  const relative = resolveConfigPath({
    configPath: "docs/mdmark.config.yaml",
    baseDir: "/ws",
  });
  const absolute = resolveConfigPath({
    configPath: "/etc/mdmark.yaml",
    baseDir: "/ws",
  });
  // 検証
  expect(relative).toBe("/ws/docs/mdmark.config.yaml");
  expect(absolute).toBe("/etc/mdmark.yaml");
});

// 重ねた設定から mount のキー・theme・extensions を取り出す（正常系）
test("test_load_config", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\n",
    "/w/docs/mdmark.config.yaml":
      "theme: ./t.css\nextensions: [./e.js]\nbuild: { include: ['*.md'], out: a.html }\n",
  };
  // 実行
  const result = await load(loadOptions(files, { cwd: "/w/docs" }));
  // 検証
  expect(result.config).toEqual({ features: { callout: false } });
  expect(result.theme).toBe("/w/docs/t.css");
  expect(result.extensions).toEqual(["/w/docs/e.js"]);
  expect(result.files).toEqual([SETTINGS, "/w/docs/mdmark.config.yaml"]);
  expect(result.nearest).toBe("/w/docs/mdmark.config.yaml");
  expect(result.problem).toBeUndefined();
});

// 設定ファイルが 1 つも無ければ空の設定（正常系）
test("test_load_config_when_missing", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  // 実行
  const result = await load(loadOptions({}));
  // 検証
  expect(result.config).toEqual({});
  expect(result.extensions).toEqual([]);
  expect(result.files).toEqual([]);
  expect(result.nearest).toBeUndefined();
  expect(result.problem).toBeUndefined();
});

// assets.root を書いた設定ファイルのフォルダから解決する（正常系）
test("test_load_config_when_assets_root", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = { "/w/mdmark.config.yaml": "assets: { root: ./assets }\n" };
  // 実行
  const result = await load(loadOptions(files, { cwd: "/w" }));
  // 検証
  expect(result.assetsRoot).toBe("/w/assets");
  expect("assets" in result.config).toBe(false);
});

// YAML として読めないファイルを problem にし、残りを重ねる（正常系）
test("test_load_config_when_unreadable", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\n",
    "/w/mdmark.config.yaml":
      "features:\n  table: false\nx: 1\nlibraries: [a, b}\n",
  };
  // 実行
  const result = await load(loadOptions(files, { cwd: "/w" }));
  // 検証
  expect(result.problem?.path).toBe("/w/mdmark.config.yaml");
  expect(result.problem?.line).toBe(4);
  expect(result.config).toEqual({ features: { callout: false } });
});

// 形の合わないファイルを problem にしてキーを返す（正常系）
test("test_load_config_when_invalid", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = { [SETTINGS]: "features:\n  callout: maybe\n" };
  // 実行
  const result = await load(loadOptions(files));
  // 検証
  expect(result.problem?.path).toBe(SETTINGS);
  expect(result.problem?.settingKey).toBe("features.callout");
  expect(result.problem?.line).toBeUndefined();
});

// mdmark.configPath のファイルが無ければ上へ探さず端末の設定だけを重ねる（正常系）
test("test_load_config_when_config_path_missing", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    [SETTINGS]: "features:\n  callout: false\n",
    "/w/mdmark.config.yaml": "features:\n  table: false\n",
  };
  // 実行
  const result = await load(
    loadOptions(files, { cwd: "/w", configPath: "missing.yaml" }),
  );
  // 検証
  expect(result.config).toEqual({ features: { callout: false } });
  expect(result.files).toEqual([SETTINGS]);
  expect(result.nearest).toBeUndefined();
});

// labels を config に入れ、labels がマップでない設定ファイルは重ねない（正常系）
test("test_load_config_when_labels", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    "/w/mdmark.config.yaml": "labels:\n  paramCopy: コピー\n",
    "/w/b/mdmark.config.yaml": "labels: コピー\n",
  };
  // 実行
  const map = await load(loadOptions(files, { cwd: "/w" }));
  const text = await load(loadOptions(files, { cwd: "/w/b" }));
  // 検証
  expect(map.config).toEqual({ labels: { paramCopy: "コピー" } });
  expect(text.config).not.toHaveProperty("labels");
  expect(text.problem?.settingKey).toBe("labels");
});

// 空でない mdmark.colorTheme が設定ファイルに勝ち、空なら設定ファイルのまま（正常系）
test("test_apply_color_theme", async () => {
  // 準備
  const { applyColorTheme } = await loadModule();
  const config = { colorTheme: "theme-paper", features: { callout: false } };
  const snapshot = structuredClone(config);
  // 実行
  const overridden = applyColorTheme({ config, colorTheme: "theme-slate" });
  const kept = applyColorTheme({ config, colorTheme: "" });
  const empty = applyColorTheme({ config: {}, colorTheme: "" });
  // 検証
  expect(overridden).toEqual({
    colorTheme: "theme-slate",
    features: { callout: false },
  });
  expect(kept).toEqual({
    colorTheme: "theme-paper",
    features: { callout: false },
  });
  expect(empty).toEqual({});
  expect(config).toEqual(snapshot);
});

// 固定した配色のときだけ設定の明暗を外す（正常系）
test("test_apply_preview_theme", async () => {
  // 準備
  const { applyPreviewTheme } = await loadModule();
  const config = { colorScheme: "light", colorTheme: "theme-paper" };
  const snapshot = structuredClone(config);
  // 実行
  const fixed = applyPreviewTheme({ config, theme: "dark" });
  const auto = applyPreviewTheme({ config, theme: "auto" });
  // 検証
  expect(fixed).toEqual({ colorTheme: "theme-paper" });
  expect(auto).toEqual({ colorScheme: "light", colorTheme: "theme-paper" });
  expect(config).toEqual(snapshot);
});

// 相対パスだけを設定ファイルのフォルダから直す（正常系）
test("test_resolve_libraries", async () => {
  // 準備
  const { resolveLibraries } = await loadModule();
  const libraries = {
    a: "./libs/a.js",
    b: "https://cdn.example.com/b.js",
    c: "../c.js",
  };
  // 実行
  const resolved = resolveLibraries({
    libraries,
    configDir: "/ws/docs",
    toUrl: (path: string) => `web:${path}`,
  });
  // 検証
  expect(resolved).toEqual({
    a: "web:/ws/docs/libs/a.js",
    b: "https://cdn.example.com/b.js",
    c: "web:/ws/c.js",
  });
});

// http・https の origin だけを重なりなく拾う（正常系）
test("test_library_origins", async () => {
  // 準備
  const { libraryOrigins } = await loadModule();
  const libraries = {
    a: "https://cdn.example.com/a.js",
    b: "https://cdn.example.com/b.js",
    c: "./c.js",
    d: 1,
  };
  // 実行
  const origins = libraryOrigins(libraries);
  // 検証
  expect(origins).toEqual([
    "https://cdn.example.com",
    "https://cdn.jsdelivr.net",
  ]);
});

// 相対パスの url だけを設定ファイルのフォルダから直す（正常系）
test("test_resolve_html_scripts", async () => {
  // 準備
  const { resolveHtmlScripts } = await loadModule();
  const resolve = (htmlScripts: Record<string, unknown>) =>
    resolveHtmlScripts({
      htmlScripts,
      configDir: "/ws/docs",
      toUrl: (path: string) => `web:${path}`,
    });
  // 実行
  const relative = resolve({ url: "./libs/babel.mjs" });
  const absolute = resolve({ url: "https://cdn.example.com/babel.mjs" });
  const number = resolve({ url: 1 });
  // 検証
  expect(relative).toEqual({ url: "web:/ws/docs/libs/babel.mjs" });
  expect(absolute).toEqual({ url: "https://cdn.example.com/babel.mjs" });
  expect(number).toEqual({ url: 1 });
});

// html-scripts.url の http・https の origin を足し、それ以外の url では足さない（正常系）
test("test_library_origins_when_html_scripts", async () => {
  // 準備
  const { libraryOrigins } = await loadModule();
  const libraries = { a: "https://cdn.example.com/a.js" };
  // 実行
  const remote = libraryOrigins(libraries, {
    url: "https://babel.example.com/b.mjs",
  });
  const local = libraryOrigins(libraries, { url: "./babel.mjs" });
  // 検証
  expect(remote).toEqual([
    "https://cdn.example.com",
    "https://babel.example.com",
  ]);
  expect(local).toEqual(["https://cdn.example.com"]);
});
