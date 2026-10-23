import { expect, test, vi } from "vitest";

/** 部品のモジュールを読む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPartModules = () => import("../../../src/part-modules.ts");

/** 読んだ控えと URL の差し替えを空にした、部品のモジュールを読む処理を返す */
async function freshPartModules() {
  const partModules = await loadPartModules();
  partModules.partModules.clear();
  partModules.partModuleUrls.clear();
  return partModules;
}

/** ビューの部品のモジュールの形 */
const VIEW_MODULE = { drawView: () => () => {}, attachView: () => () => {} };

// 隣の配布ファイルを読み、同じ名前は 1 回だけ読む（正常系）
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

// 差し替えた URL から読む（正常系）
test("test_load_part_module_when_url_replaced", async () => {
  // 準備
  const { loadPartModule, setPartModuleUrl } = await freshPartModules();
  const importModule = vi.fn(async () => ({
    attachComments: async () => () => {},
  }));
  setPartModuleUrl("comments", "blob:x");
  // 実行
  const loaded = await loadPartModule("comments", importModule);
  // 検証
  expect(importModule).toHaveBeenCalledWith("blob:x");
  expect(loaded.url).toBe("blob:x");
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

// 読めないモジュールは元のエラーで reject し、次も読み直さない（異常系）
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
