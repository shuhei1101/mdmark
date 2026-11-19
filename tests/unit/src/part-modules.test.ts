import { expect, test, vi } from "vitest";

/** 部品のモジュールを読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPartModules = () => import("../../../src/part-modules.ts");

/** 読み込んだ記録と読み込みの差し替えを空にした、部品のモジュールを読み込む処理を返却する */
async function freshPartModules() {
  const partModules = await loadPartModules();
  partModules.partModules.clear();
  partModules.partModuleLoaders.clear();
  return partModules;
}

/** ビューの部品のモジュールの構造 */
const VIEW_MODULE = { drawView: () => () => {}, attachView: () => () => {} };

// 隣の配布ファイルを読み込み、同じ名前は 1 回だけ読み込む（正常系）
test("test_load_part_module", async () => {
  // 準備
  const { loadPartModule } = await freshPartModules();
  const importModule = vi.fn(async (_url: string) => VIEW_MODULE);
  // 実行
  const first = await loadPartModule("view", importModule);
  const second = await loadPartModule("view", importModule);
  // 検証
  expect(importModule).toHaveBeenCalledTimes(1);
  expect(importModule.mock.calls[0]?.[0]).toMatch(/view\.js$/);
  expect(second).toBe(first);
  expect(first.module).toBe(VIEW_MODULE);
});

// 差し替えた関数で読み込み、URL を読み込まない（正常系）
test("test_load_part_module_when_loader", async () => {
  // 準備
  const { loadPartModule, setPartModuleLoader } = await freshPartModules();
  const importModule = vi.fn(async (_url: string) => VIEW_MODULE);
  setPartModuleLoader("view", async () => VIEW_MODULE);
  // 実行
  const loaded = await loadPartModule("view", importModule);
  // 検証
  expect(importModule).not.toHaveBeenCalled();
  expect(loaded.module).toBe(VIEW_MODULE);
  expect(loaded.url).toBe("view.js");
});

// 関数を export しないモジュールを拒む（異常系）
test("test_load_part_module_when_shape_mismatch", async () => {
  // 準備
  const { loadPartModule } = await freshPartModules();
  const importModule = vi.fn(async (_url: string) => ({}));
  // 実行
  const loading = loadPartModule("comments", importModule);
  // 検証
  const error: unknown = await loading.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("attachComments");
  expect((error as Error).cause).toBe(importModule.mock.calls[0]?.[0]);
});

// 読み込めないモジュールは元のエラーで reject し、次も再読み込みしない（異常系）
test("test_load_part_module_when_rejected", async () => {
  // 準備
  const { loadPartModule } = await freshPartModules();
  const failure = new Error("network");
  const importModule = vi.fn(async () => {
    throw failure;
  });
  // 実行・検証
  await expect(loadPartModule("view", importModule)).rejects.toBe(failure);
  await expect(loadPartModule("view", importModule)).rejects.toBe(failure);
  expect(importModule).toHaveBeenCalledTimes(1);
});

/** map の部品のモジュールの構造 */
const MAP_MODULE = { attachMap: () => () => {} };

// 隣の URL を作れないとき、同期で投げずに reject する（異常系）
test("test_load_part_module_when_url_unresolvable", async () => {
  // 準備
  const { loadPartModule } = await freshPartModules();
  const importModule = vi.fn(async (_url: string) => MAP_MODULE);
  // 実行
  let loading: Promise<unknown> | undefined;
  expect(() => {
    loading = loadPartModule("map", importModule, "blob:null/0");
  }).not.toThrow();
  // 検証
  const error: unknown = await (loading as Promise<unknown>).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(TypeError);
  expect((error as Error).cause).toBe("map.js");
  expect(importModule).not.toHaveBeenCalled();
});

// 知らない名前と関数でない loader を拒む（異常系）
test("test_set_part_module_loader_when_args_invalid", async () => {
  // 準備
  const { setPartModuleLoader, partModuleLoaders } = await freshPartModules();
  const set = setPartModuleLoader as (name: unknown, loader: unknown) => void;
  // 実行・検証
  expect(() => set("chart", async () => MAP_MODULE)).toThrow(TypeError);
  expect(() => set("chart", async () => MAP_MODULE)).toThrow(/name/);
  expect(() => set("map", "map.js")).toThrow(TypeError);
  expect(() => set("map", "map.js")).toThrow(/loader/);
  expect(partModuleLoaders.size).toBe(0);
});

// 同じ名前の 2 回目は後の関数で置き換える（正常系）
test("test_set_part_module_loader_when_replaced", async () => {
  // 準備
  const { loadPartModule, setPartModuleLoader } = await freshPartModules();
  const first = vi.fn(async () => MAP_MODULE);
  const second = vi.fn(async () => MAP_MODULE);
  setPartModuleLoader("map", first);
  setPartModuleLoader("map", second);
  // 実行
  await loadPartModule("map");
  // 検証
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
});

/** 読み込んだ記録・読み込みの差し替え・関数で読み込んだ mermaid の記録を空にした、部品のモジュールを読み込む処理を返却する */
async function freshMermaidLoader() {
  const partModules = await freshPartModules();
  partModules.mermaidByLoader.clear();
  return partModules;
}

/** mermaid の `loader` が返却するモジュール */
const MERMAID_MODULE = { default: {} };

// `mermaid` の名前を受け付ける（正常系）
test("test_set_part_module_loader_when_mermaid", async () => {
  // 準備
  const { setPartModuleLoader, partModuleLoaders } = await freshMermaidLoader();
  const loader = async () => MERMAID_MODULE;
  // 実行・検証
  expect(() => setPartModuleLoader("mermaid", loader)).not.toThrow();
  expect(partModuleLoaders.get("mermaid")).toBe(loader);
});

// 指定した関数を 1 回だけ呼ぶ（正常系）
test("test_load_mermaid_by_loader", async () => {
  // 準備
  const { loadMermaidByLoader, setPartModuleLoader } =
    await freshMermaidLoader();
  const loader = vi.fn(async () => MERMAID_MODULE);
  setPartModuleLoader("mermaid", loader);
  // 実行
  const first = loadMermaidByLoader();
  const second = loadMermaidByLoader();
  // 検証
  expect(loader).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
  await expect(first).resolves.toBe(MERMAID_MODULE);
});

// 指定が無ければ undefined を返却する（正常系）
test("test_load_mermaid_by_loader_when_not_set", async () => {
  // 準備
  const { loadMermaidByLoader, setPartModuleLoader } =
    await freshMermaidLoader();
  // 実行: 指定せずに呼ぶ
  const before = loadMermaidByLoader();
  // 実行: 指定してから呼ぶ
  setPartModuleLoader("mermaid", async () => MERMAID_MODULE);
  const after = loadMermaidByLoader();
  // 検証
  expect(before).toBeUndefined();
  expect(after).toBeInstanceOf(Promise);
  await expect(after).resolves.toBe(MERMAID_MODULE);
});

// 拒否した関数は元のエラーで reject し、呼び直さない（異常系）
test("test_load_mermaid_by_loader_when_rejected", async () => {
  const error = new Error("missing");
  const rejecting = vi.fn(async (): Promise<Record<string, unknown>> => {
    throw error;
  });
  const throwing = vi.fn((): Promise<Record<string, unknown>> => {
    throw error;
  });
  for (const loader of [rejecting, throwing]) {
    // 準備
    const { loadMermaidByLoader, setPartModuleLoader } =
      await freshMermaidLoader();
    setPartModuleLoader("mermaid", loader);
    // 実行
    let first: Promise<Record<string, unknown>> | undefined;
    let second: Promise<Record<string, unknown>> | undefined;
    expect(() => {
      first = loadMermaidByLoader();
      second = loadMermaidByLoader();
    }).not.toThrow();
    // 検証
    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(1);
  }
});
