import { afterEach, expect, test, vi } from "vitest";
import type { LibraryEntry } from "../../../src/config.ts";
import type { ImportModule, LibraryModule } from "../../../src/libraries.ts";

/** 読み込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLibraries = () => import("../../../src/libraries.ts");

/** 読み込み中の枠の処理を読み込む */
const loadEmbed = () => import("../../../src/parts/embed.ts");

/** 知らせの枠の処理を読み込む */
const loadNotice = () => import("../../../src/parts/notice.ts");

// 対応表の URL を解決した結果（ページの URL を基準にする）
const MODULE_URL = `${location.origin}/fixtures/test-lib.js`;

/** 図の印の `test-lib` だけを持つ対応表 */
const TEST_LIB: Record<string, LibraryEntry> = {
  "test-lib": { url: "/fixtures/test-lib.js", figure: true },
};

/** HTML を中に持つ描く先の要素を作る */
function createRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

/** DOM が書き出す形に揃えた HTML にする */
function normalize(html: string): string {
  return createRoot(html).innerHTML;
}

/** 印の場所の要素を、文書の並びの順に返す */
function findSlots(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-mdmark-slot]")];
}

/** console.error の出力を黙らせて見張る */
function spyConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

// 印の場所ごとに draw を呼び、描けた場所の読み込み中の印を外す（正常系）
test("test_load_libraries", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const root = createRoot(
    renderEmbed({ name: "test-lib", args: ["a", "b"] }) +
      renderEmbed({ name: "test-lib" }),
  );
  const draw = vi.fn();
  const importModule = vi.fn<ImportModule>(async () => ({ draw }));
  // 実行
  await load({
    root,
    libraries: TEST_LIB,
    isCurrent: () => true,
    importModule,
  });
  // 検証
  const [first, second] = findSlots(root);
  expect(importModule).toHaveBeenCalledTimes(1);
  expect(importModule).toHaveBeenCalledWith(MODULE_URL);
  expect(draw).toHaveBeenCalledWith(first, ["a", "b"]);
  expect(draw).toHaveBeenCalledWith(second, []);
  for (const slot of [first, second]) {
    expect(slot.hasAttribute("role")).toBe(false);
    expect(slot.hasAttribute("data-mdmark-drawn")).toBe(true);
  }
});

// 印の場所が無ければ何も読まない（正常系）
test("test_load_libraries_when_no_slot", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const root = createRoot("<p>段落</p>");
  const importModule = vi.fn<ImportModule>();
  // 実行
  await load({
    root,
    libraries: TEST_LIB,
    isCurrent: () => true,
    importModule,
  });
  // 検証
  expect(importModule).not.toHaveBeenCalled();
});

// 対応表に無い名前の印の場所を取り除き、何も読まない（正常系）
test("test_load_libraries_when_unknown_slot", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const root = createRoot(
    '<div class="mdmark-embed" data-mdmark-slot="zzz"></div>',
  );
  const importModule = vi.fn<ImportModule>();
  const errorSpy = spyConsoleError();
  // 実行
  const loaded = load({
    root,
    libraries: {},
    isCurrent: () => true,
    importModule,
  });
  // 検証
  await expect(loaded).resolves.toBeUndefined();
  expect(findSlots(root)).toHaveLength(0);
  expect(importModule).not.toHaveBeenCalled();
  expect(errorSpy).not.toHaveBeenCalled();
});

// 読めない印の場所を知らせの枠に替え、エラーを出す（正常系）
test("test_load_libraries_when_import_fails", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const { renderNotice } = await loadNotice();
  const root = createRoot(renderEmbed({ name: "test-lib" }));
  const error = new Error("404");
  const importModule = vi.fn<ImportModule>().mockRejectedValue(error);
  const errorSpy = spyConsoleError();
  // 実行
  const loaded = load({
    root,
    libraries: TEST_LIB,
    isCurrent: () => true,
    importModule,
  });
  // 検証
  await expect(loaded).resolves.toBeUndefined();
  expect(root.innerHTML).toBe(
    normalize(renderNotice({ name: "test-lib", figure: true })),
  );
  expect(errorSpy).toHaveBeenCalledTimes(1);
  const args = errorSpy.mock.calls[0];
  expect(args).toContain("test-lib");
  expect(args).toContain(MODULE_URL);
  expect(args).toContain(error);
});

// draw が例外を投げた印の場所を知らせの枠に替える（正常系）
test("test_load_libraries_when_draw_throws", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const { renderNotice } = await loadNotice();
  const root = createRoot(renderEmbed({ name: "test-lib" }));
  const importModule = vi.fn<ImportModule>(async () => ({
    draw: () => {
      throw new Error("描けない");
    },
  }));
  spyConsoleError();
  // 実行
  await load({
    root,
    libraries: { "test-lib": { url: "/fixtures/test-lib.js", figure: false } },
    isCurrent: () => true,
    importModule,
  });
  // 検証
  expect(root.innerHTML).toBe(
    normalize(renderNotice({ name: "test-lib", figure: false })),
  );
});

// draw を export しないモジュールの印の場所を知らせの枠に替える（正常系）
test("test_load_libraries_when_draw_missing", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const { renderNotice } = await loadNotice();
  const root = createRoot(renderEmbed({ name: "test-lib" }));
  const importModule = vi.fn<ImportModule>(async () => ({}) as LibraryModule);
  const errorSpy = spyConsoleError();
  // 実行
  await load({
    root,
    libraries: TEST_LIB,
    isCurrent: () => true,
    importModule,
  });
  // 検証
  expect(root.innerHTML).toBe(
    normalize(renderNotice({ name: "test-lib", figure: true })),
  );
  expect(errorSpy).toHaveBeenCalledTimes(1);
});

// 描き直した後に読み終えた古い印の場所には手を付けない（正常系）
test("test_load_libraries_when_stale", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const root = createRoot(renderEmbed({ name: "test-lib" }));
  const importModule = vi
    .fn<ImportModule>()
    .mockRejectedValue(new Error("404"));
  const errorSpy = spyConsoleError();
  // 実行
  await load({
    root,
    libraries: TEST_LIB,
    isCurrent: () => false,
    importModule,
  });
  // 検証
  expect(root.innerHTML).toBe(normalize(renderEmbed({ name: "test-lib" })));
  expect(errorSpy).not.toHaveBeenCalled();
});
