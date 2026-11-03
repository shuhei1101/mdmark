import { afterEach, expect, test, vi } from "vitest";

/** 埋めたモジュールを用意する処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModules = () => import("../../../../src/viewer/modules.ts");

/** 色分けのモジュールの控えを持つ処理を読み込む */
const loadHighlight = () => import("../../../../src/highlight.ts");

/** 外部ライブラリのモジュールの控えを持つ処理を読み込む */
const loadLibraries = () => import("../../../../src/libraries.ts");

/** 部品のモジュールを読む処理を読み込む */
const loadPartModules = () => import("../../../../src/part-modules.ts");

const GREET = { name: "greet", directive: "greet", load: async () => ({}) };

/** ビューの部品のモジュールの形 */
const VIEW_MODULE = { drawView: () => () => {}, attachView: () => () => {} };

afterEach(async () => {
  vi.restoreAllMocks();
  const { setEmbeddedSyntax } = await loadHighlight();
  const { setEmbeddedLibraries } = await loadLibraries();
  const { partModules, partModuleLoaders } = await loadPartModules();
  setEmbeddedSyntax(undefined);
  setEmbeddedLibraries(undefined);
  partModules.clear();
  partModuleLoaders.clear();
});

// 埋めたモジュールを読み込みに渡し、拡張を登録する（正常系）
test("test_prepare_modules", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  const libraries = await loadLibraries();
  const { loadPartModule, partModules } = await loadPartModules();
  partModules.clear();
  const chart = async () => ({ draw: () => {} });
  const register = vi.fn();
  const embeddedLibraries = { chart };
  // 実行
  await prepareModules(
    {
      parts: { view: VIEW_MODULE },
      libraries: embeddedLibraries,
      extensions: [async () => ({ default: GREET })],
    },
    { register },
  );
  // 検証
  const view = await loadPartModule("view");
  expect(view.module).toBe(VIEW_MODULE);
  await expect(loadPartModule("comments")).rejects.toBeInstanceOf(Error);
  expect(libraries.embeddedLibraries).toBe(embeddedLibraries);
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith(GREET);
});

// 読み込みで例外を投げる拡張を飛ばして続ける（正常系）
test("test_prepare_modules_when_extension_fails", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const register = vi.fn();
  // 実行
  const prepared = prepareModules(
    {
      parts: {},
      libraries: {},
      extensions: [
        async () => {
          throw new Error("モジュールの最上位の例外");
        },
        async () => ({ default: GREET }),
      ],
    },
    { register },
  );
  // 検証
  await expect(prepared).resolves.toBeUndefined();
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith(GREET);
  expect(consoleError).toHaveBeenCalledTimes(1);
});

// 埋めた色分けのモジュールを入れ、無ければ本体を持たない値を入れる（正常系）
test("test_prepare_modules_when_syntax", async () => {
  // 準備
  const { prepareModules } = await loadModules();
  const highlight = await loadHighlight();
  const syntax = {
    core: { default: {} },
    languages: { typescript: { default: {} } },
  };
  const deps = { register: vi.fn() };
  // 実行
  await prepareModules(
    { parts: {}, syntax, libraries: {}, extensions: [] },
    deps,
  );
  const embedded = highlight.embeddedSyntax;
  await prepareModules({ parts: {}, libraries: {}, extensions: [] }, deps);
  const missing = highlight.embeddedSyntax;
  // 検証
  expect(embedded).toBe(syntax);
  expect(missing?.core).toBeUndefined();
  expect(missing?.languages).toEqual({});
});
