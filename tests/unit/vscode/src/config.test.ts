import { expect, test, vi } from "vitest";

/** 設定ファイルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../vscode/src/config.ts");

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

// features・libraries・side-toc だけを取り出す（正常系）
test("test_parse_config", async () => {
  // 準備
  const { parseConfig } = await loadModule();
  const text = [
    "features: { callout: false }",
    "libraries: { chart: ./chart.js }",
    "side-toc: { mode: fixed }",
    "theme: x",
    "build: {}",
  ].join("\n");
  // 実行
  const result = parseConfig(text);
  // 検証
  expect(result).toEqual({
    kind: "ok",
    config: {
      features: { callout: false },
      libraries: { chart: "./chart.js" },
      "side-toc": { mode: "fixed" },
    },
  });
});

// 最上位がマップでない・空・キーの値がマップでないときは渡さない（正常系）
test("test_parse_config_when_not_map", async () => {
  // 準備
  const { parseConfig } = await loadModule();
  const texts = ["", "- a", "features: [a]"];
  // 実行
  const results = texts.map((text) => parseConfig(text));
  // 検証
  for (const result of results) {
    expect(result).toEqual({ kind: "ok", config: {} });
  }
});

// YAML として読めなければ読めない行を返す（正常系）
test("test_parse_config_when_invalid_yaml", async () => {
  // 準備
  const { parseConfig } = await loadModule();
  const text = ["a: 1", "b: 2", "c: 3", "features: {callout: false"].join("\n");
  // 実行
  const result = parseConfig(text);
  // 検証
  expect(result.kind).toBe("error");
  if (result.kind === "error") {
    expect(result.line).toBe(4);
    expect(result.message).not.toBe("");
  }
});

// ファイルが無ければ missing（正常系）
test("test_load_config_when_missing", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const readFile = vi.fn(async () => {
    throw Object.assign(new Error("no such file"), { code: "ENOENT" });
  });
  // 実行
  const result = await load({ path: "/ws/mdmark.config.yaml", readFile });
  // 検証
  expect(result).toEqual({ kind: "missing" });
});

// 読んだ中身から取り出す（正常系）
test("test_load_config", async () => {
  // 準備
  const { loadConfig: load } = await loadModule();
  const readFile = vi.fn(async () => "features: { callout: false }");
  // 実行
  const result = await load({ path: "/ws/mdmark.config.yaml", readFile });
  // 検証
  expect(result).toEqual({
    kind: "ok",
    config: { features: { callout: false } },
  });
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
  expect(origins).toEqual(["https://cdn.example.com"]);
});
