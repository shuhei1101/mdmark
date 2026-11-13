import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

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

// assets.root を記載した設定ファイルのフォルダから解決する（正常系）
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

// YAML として読み込めないファイルを problem にし、残りを重ねる（正常系）
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

// 構造の合わないファイルを problem にしてキーを返却する（正常系）
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

const createTempDir = useTempDirs();

/** 用語のエイリアスの行 */
const TERM_ROW = [
  "aliases:",
  "  - id: terms",
  "    paths: [glossary.yaml]",
  "    alias_type: term",
  "    records: terms",
];

/** 名前 `描画`・別名 `レンダリング` の用語 1 件 */
const GLOSSARY = [
  "terms:",
  "  - id: render",
  "    name: 描画",
  "    aliases: [レンダリング]",
  "    description: Markdown を HTML にすること",
  "",
].join("\n");

/** 一時フォルダの実のファイルを読み込む `loadConfig` の引数 */
const fsOptions = (options: {
  cwd: string;
  settings: string;
  purpose?: "preview" | "export";
}) => ({
  cwd: options.cwd,
  configPath: "",
  baseDir: options.cwd,
  purpose: options.purpose ?? ("preview" as const),
  env: { MDMARK_CONFIG: options.settings },
  home: options.cwd,
  readFile: (path: string) => readFile(path, "utf8"),
  isFile: async (path: string) => {
    const { isFile } = await loadModule();
    return isFile(path);
  },
});

// プレビューでは重ねた設定の aliases からエイリアスを作り、読み込んだ YAML を返却する（正常系）
test("test_load_config_when_aliases", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": `${TERM_ROW.join("\n")}\n`,
    "glossary.yaml": GLOSSARY,
  });
  // 実行
  const result = await load(
    fsOptions({ cwd: dir, settings: join(dir, "none/settings.yaml") }),
  );
  // 検証
  expect(result.aliases).toHaveLength(1);
  expect(result.aliases?.[0]).toMatchObject({
    alias_type: "term",
    name: "描画",
    aliases: ["レンダリング"],
  });
  expect(result.aliasIssues).toEqual([]);
  expect(result.aliasFiles).toEqual([join(dir, "glossary.yaml")]);
});

// mdmark.config.yaml が無いときは端末の設定ファイルを基準にエイリアスを作る（正常系）
test("test_load_config_when_aliases_without_nearest", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "settings/settings.yaml": `${TERM_ROW.join("\n")}\n`,
    "settings/glossary.yaml": GLOSSARY,
    "docs/guide.md": "# ガイド\n",
  });
  // 実行
  const result = await load(
    fsOptions({
      cwd: join(dir, "docs"),
      settings: join(dir, "settings/settings.yaml"),
    }),
  );
  // 検証
  expect(result.nearest).toBeUndefined();
  expect(result.aliases).toHaveLength(1);
  expect(result.aliasFiles).toEqual([join(dir, "settings/glossary.yaml")]);
});

// 該当するファイルの無い行はずれにして残りで作る（正常系）
test("test_load_config_when_aliases_missing_files", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      ...TERM_ROW,
      "  - id: missing",
      "    paths: [missing/*.yaml]",
      "    alias_type: term",
      "",
    ].join("\n"),
    "glossary.yaml": GLOSSARY,
  });
  // 実行
  const result = await load(
    fsOptions({ cwd: dir, settings: join(dir, "none/settings.yaml") }),
  );
  // 検証
  expect(result.aliases?.map((alias) => alias.name)).toEqual(["描画"]);
  expect(result.aliasIssues).toHaveLength(1);
  expect(result.aliasIssues[0]).toMatchObject({
    kind: "alias_no_files",
    where: "aliases[1].paths",
  });
});

// 書き出しのときもエイリアスを作る（正常系）
test("test_load_config_when_export", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": `${TERM_ROW.join("\n")}\n`,
    "glossary.yaml": GLOSSARY,
  });
  // 実行
  const result = await load(
    fsOptions({
      cwd: dir,
      settings: join(dir, "none/settings.yaml"),
      purpose: "export",
    }),
  );
  // 検証
  expect(result.aliases).toHaveLength(1);
  expect(result.aliases?.[0]).toMatchObject({
    alias_type: "term",
    name: "描画",
    aliases: ["レンダリング"],
  });
  expect(result.aliasIssues).toEqual([]);
  expect(result.aliasFiles).toEqual([join(dir, "glossary.yaml")]);
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

// 固定した配色のときだけ設定の明暗を解除する（正常系）
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

// 相対パスだけを設定ファイルのフォルダから修正する（正常系）
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

// http・https の origin だけを重なりなく取得する（正常系）
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

// 相対パスの url だけを設定ファイルのフォルダから修正する（正常系）
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

// html-scripts.url の http・https の origin を追加し、それ以外の url では追加しない（正常系）
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
  // mermaid.url を省いたので、ライブラリ本体の既定の mermaid の URL の origin も入る
  expect(remote).toEqual([
    "https://cdn.example.com",
    "https://babel.example.com",
    "https://cdn.jsdelivr.net",
  ]);
  expect(local).toEqual([
    "https://cdn.example.com",
    "https://cdn.jsdelivr.net",
  ]);
});

// 相対パスの url だけを設定ファイルのフォルダから修正し、ほかのキーを残す（正常系）
test("test_resolve_mermaid", async () => {
  // 準備
  const { resolveMermaid } = await loadModule();
  const resolve = (mermaid: Record<string, unknown>) =>
    resolveMermaid({
      mermaid,
      configDir: "/ws/docs",
      toUrl: (path: string) => `web:${path}`,
    });
  // 実行
  const relative = resolve({ url: "./libs/mermaid.mjs", theme: "neutral" });
  const absolute = resolve({ url: "https://cdn.example.com/mermaid.mjs" });
  const themeOnly = resolve({ theme: "dark" });
  // 検証
  expect(relative).toEqual({
    url: "web:/ws/docs/libs/mermaid.mjs",
    theme: "neutral",
  });
  expect(absolute).toEqual({ url: "https://cdn.example.com/mermaid.mjs" });
  expect(themeOnly).toEqual({ theme: "dark" });
});

// mermaid.url の http・https の origin を追加し、相対パスでは追加しない（正常系）
test("test_library_origins_when_mermaid", async () => {
  // 準備
  const { libraryOrigins } = await loadModule();
  const htmlScripts = { url: "./babel.mjs" };
  // 実行
  const remote = libraryOrigins({}, htmlScripts, {
    url: "https://mermaid.example.com/m.mjs",
  });
  const local = libraryOrigins({}, htmlScripts, { url: "./m.mjs" });
  // 検証
  expect(remote).toEqual([
    "https://mermaid.example.com",
    "https://cdn.jsdelivr.net",
  ]);
  expect(local).toEqual(["https://cdn.jsdelivr.net"]);
});

// syntax.url の http・https の origin を追加し、相対パスでは追加しない（正常系）
test("test_library_origins_when_syntax", async () => {
  // 準備
  const { libraryOrigins } = await loadModule();
  const htmlScripts = { url: "./babel.mjs" };
  const mermaid = { url: "./m.mjs" };
  // 実行
  const remote = libraryOrigins({}, htmlScripts, mermaid, {
    url: "https://hljs.example.com/es/",
  });
  const local = libraryOrigins({}, htmlScripts, mermaid, { url: "./hljs/" });
  // 検証
  expect(remote).toEqual(["https://hljs.example.com"]);
  expect(local).toEqual([]);
});

// 相対パスの url だけを設定ファイルのフォルダから修正し、末尾に / を付ける（正常系）
test("test_resolve_syntax", async () => {
  // 準備
  const { resolveSyntax } = await loadModule();
  const resolve = (syntax: Record<string, unknown>) =>
    resolveSyntax({
      syntax,
      configDir: "/ws/docs",
      toUrl: (path: string) => `web:${path}`,
    });
  // 実行
  const relative = resolve({ url: "./hljs/" });
  const remote = resolve({ url: "https://cdn.example.com/es/" });
  const notString = resolve({ url: 1 });
  // 検証
  expect(relative).toEqual({ url: "web:/ws/docs/hljs/" });
  expect(remote).toEqual({ url: "https://cdn.example.com/es/" });
  expect(notString).toEqual({ url: 1 });
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

// 設定の table を mount に指定する設定に入れ、マップでない table は入れない（正常系）
test("test_load_config_when_table", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    "/w/mdmark.config.yaml": "table:\n  pin: through\n",
    "/w/b/mdmark.config.yaml": "table: through\n",
  };
  // 実行
  const map = await load(loadOptions(files, { cwd: "/w" }));
  const text = await load(loadOptions(files, { cwd: "/w/b" }));
  // 検証
  expect(map.config).toEqual({ table: { pin: "through" } });
  expect(text.config).not.toHaveProperty("table");
  expect(text.problem?.settingKey).toBe("table");
});

// tooltips と syntax を config に入れ、マップでない値は入れない（正常系）
test("test_load_config_when_tooltips_and_syntax", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const files = {
    "/w/mdmark.config.yaml":
      "tooltips:\n  placement: bottom\nsyntax:\n  url: ./hljs/\n",
    "/w/b/mdmark.config.yaml": "tooltips: bottom\n",
  };
  // 実行
  const map = await load(loadOptions(files, { cwd: "/w" }));
  const text = await load(loadOptions(files, { cwd: "/w/b" }));
  // 検証
  expect(map.config).toEqual({
    tooltips: { placement: "bottom" },
    syntax: { url: "/w/hljs" },
  });
  expect(text.config).not.toHaveProperty("tooltips");
  expect(text.problem?.settingKey).toBe("tooltips");
});
