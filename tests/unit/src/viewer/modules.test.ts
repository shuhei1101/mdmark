import { afterEach, expect, test, vi } from "vitest";

/** 埋めたモジュールを用意する処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModules = () => import("../../../../src/viewer/modules.ts");

/** 色分けのモジュールの URL の控えを持つ処理を読み込む */
const loadHighlight = () => import("../../../../src/highlight.ts");

const GREET = { name: "greet", directive: "greet", load: async () => ({}) };

afterEach(() => {
  vi.restoreAllMocks();
});

// モジュールを URL に替え、拡張を登録する（正常系）
test("test_prepare_modules", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  const createUrl = vi.fn((code: string) => `blob:test/${code}`);
  const importModule = vi.fn(async () => ({ default: GREET }));
  const register = vi.fn();
  // 実行
  const config = await prepareModules(
    {
      config: {},
      modules: { chart: "chart-code" },
      extensions: ["greet-code"],
    },
    { createUrl, importModule, register },
  );
  // 検証
  expect(config.libraries?.chart).toBe("blob:test/chart-code");
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith(GREET);
});

// 読めない拡張を飛ばして続ける（正常系）
test("test_prepare_modules_when_extension_fails", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const createUrl = (code: string) => `blob:test/${code}`;
  const importModule = vi.fn(async (url: string) => {
    if (url === "blob:test/bad-code") {
      throw new Error("読めない");
    }
    return { default: GREET };
  });
  const register = vi.fn();
  // 実行
  await prepareModules(
    {
      config: {},
      modules: {},
      extensions: ["bad-code", "good-code"],
    },
    { createUrl, importModule, register },
  );
  // 検証
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith(GREET);
});

// 埋めた色分けのモジュールを URL に替えて入れ、無ければ読むと例外を投げる URL を入れる（正常系）
test("test_prepare_modules_when_syntax", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  const highlight = await loadHighlight();
  let count = 0;
  const createUrl = vi.fn(() => `blob:test/${++count}`);
  const deps = { createUrl, importModule: vi.fn(), register: vi.fn() };
  try {
    // 実行
    await prepareModules(
      {
        config: {},
        modules: {},
        extensions: [],
        syntax: { core: "c", languages: { typescript: "t" } },
      },
      deps,
    );
    const embedded = highlight.syntaxModuleUrls;
    await prepareModules({ config: {}, modules: {}, extensions: [] }, deps);
    const missing = highlight.syntaxModuleUrls;
    // 検証
    expect(embedded?.core).toMatch(/^blob:test\/\d+$/);
    expect(embedded?.languages.typescript).toMatch(/^blob:test\/\d+$/);
    expect(embedded?.core).not.toBe(embedded?.languages.typescript);
    expect(missing?.core.startsWith("data:")).toBe(true);
    expect(missing?.languages).toEqual({});
  } finally {
    highlight.setSyntaxModuleUrls(undefined);
  }
});
