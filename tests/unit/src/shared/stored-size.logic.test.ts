import { expect, test } from "vitest";
import { memoryStorage, throwingStorage } from "../../helpers/storage.ts";

/** 大きさの保持の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadStoredSize = () =>
  import("../../../../src/shared/stored-size.logic.ts");

/** 大きさを保つキー */
const KEY = "p:/a.html#0:clip.mp4";

// 正の整数だけを読み込む（正常系）
test("test_read_stored_size", async () => {
  // 準備
  const { readStoredSize } = await loadStoredSize();
  // 実行・検証
  expect(readStoredSize(memoryStorage({ [KEY]: "420" }), KEY)).toBe(420);
  expect(readStoredSize(memoryStorage({ [KEY]: "abc" }), KEY)).toBeNull();
  expect(readStoredSize(memoryStorage({ [KEY]: "0" }), KEY)).toBeNull();
  expect(readStoredSize(memoryStorage(), KEY)).toBeNull();
  expect(readStoredSize(null, KEY)).toBeNull();
});

// 保つ先の例外を外へ出さない（異常系）
test("test_read_stored_size_when_storage_throws", async () => {
  // 準備
  const { readStoredSize } = await loadStoredSize();
  // 実行・検証
  expect(readStoredSize(throwingStorage(), KEY)).toBeNull();
});

// 記載し、null で削除する（正常系）
test("test_write_stored_size", async () => {
  // 準備
  const { writeStoredSize } = await loadStoredSize();
  const storage = memoryStorage();
  // 実行
  writeStoredSize(storage, KEY, 468);
  // 検証
  expect(storage.getItem(KEY)).toBe("468");
  // 実行
  writeStoredSize(storage, KEY, null);
  // 検証
  expect(storage.getItem(KEY)).toBeNull();
});

// 保つ先の例外を外へ出さない（異常系）
test("test_write_stored_size_when_storage_throws", async () => {
  // 準備
  const { writeStoredSize } = await loadStoredSize();
  const storage = throwingStorage();
  // 実行・検証
  expect(() => writeStoredSize(storage, KEY, 468)).not.toThrow();
  expect(() => writeStoredSize(storage, KEY, null)).not.toThrow();
});

// 頭・ページ・順・名前でキーを作る（正常系）
test("test_stored_size_key", async () => {
  // 準備
  const { storedSizeKey } = await loadStoredSize();
  // 実行
  const key = storedSizeKey({
    prefix: "p:",
    pathname: "/docs/a.html",
    index: 1,
    name: "clip.mp4",
  });
  // 検証
  expect(key).toBe("p:/docs/a.html#1:clip.mp4");
});
