import * as v from "valibot";
import { afterEach, expect, test, vi } from "vitest";
import type { LibraryEntry } from "../../../src/config.ts";
import type { MdmarkExtension } from "../../../src/extensions.ts";
import type { ImportModule, LibraryModule } from "../../../src/libraries.ts";

/** 読み込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLibraries = () => import("../../../src/libraries.ts");

/** 読み込み中のブロックの処理を読み込む */
const loadEmbed = () => import("../../../src/parts/embed.ts");

/** 通知ブロックの処理を読み込む */
const loadNotice = () => import("../../../src/parts/notice.ts");

/** 拡張の処理を読み込む */
const loadExtensions = () => import("../../../src/extensions.ts");

const cleanups: Array<() => void> = [];

/** 登録表を空にしてから拡張を登録し、後始末のために空にする関数を記録する */
async function registerTracked(extension: MdmarkExtension): Promise<void> {
  const { registerExtension, resetExtensions } = await loadExtensions();
  resetExtensions();
  registerExtension(extension);
  cleanups.push(resetExtensions);
}

// 対応表の URL を解決した結果（ページの URL を基準にする）
const MODULE_URL = `${location.origin}/fixtures/test-lib.js`;

/** 図のマーカーの `test-lib` だけを持つ対応表 */
const TEST_LIB: Record<string, LibraryEntry> = {
  "test-lib": { url: "/fixtures/test-lib.js", figure: true },
};

/** HTML を中に持つ描く先の要素を作る */
function createRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

/** DOM が書き出す構造に統一した HTML にする */
function normalize(html: string): string {
  return createRoot(html).innerHTML;
}

/** マーカーの場所の要素を、文書の並びの順に返却する */
function findSlots(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-mdmark-slot]")];
}

/** console.error の出力を黙らせて見張る */
function spyConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

// マーカーの場所ごとに draw を呼び、描けた場所の読み込み中のマーカーを削除する（正常系）
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

// マーカーの場所が無ければ何も読み込まない（正常系）
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

// 対応表に無い名前のマーカーの場所を取り除き、何も読み込まない（正常系）
test("test_load_libraries_when_unknown_slot", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const root = createRoot(
    '<div class="mdmark-embed" data-mdmark-slot="zzz"></div><div class="mdmark-embed" data-mdmark-slot="constructor"></div>',
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

// 読み込めないマーカーの場所を通知ブロックに替え、エラーを出す（正常系）
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

// draw が例外を投げたマーカーの場所を通知ブロックに替える（正常系）
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

// draw を export しないモジュールのマーカーの場所を通知ブロックに替える（正常系）
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

// 再描画した後に読み込み終えた古いマーカーの場所には手を付けない（正常系）
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

// draw がマーカーの場所を取り除いてから例外を投げても、通知ブロックに替えず拒否しない（正常系）
test("test_load_libraries_when_draw_removes_slot", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const root = createRoot(renderEmbed({ name: "test-lib" }));
  const importModule = vi.fn<ImportModule>(async () => ({
    draw: (slot) => {
      slot.remove();
      throw new Error("描けない");
    },
  }));
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
  expect(root.querySelector(".mdmark-notice")).toBeNull();
  expect(errorSpy).toHaveBeenCalledTimes(1);
});

// 拡張のマーカーを load で読み込み、判別した引数で draw を呼ぶ（正常系）
test("test_load_libraries_when_extension", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const draw = vi.fn();
  const extensionLoad = vi.fn(async () => ({ draw }));
  await registerTracked({
    name: "greet",
    directive: "greet",
    load: extensionLoad,
  });
  const args = ["world", "lang=ja"];
  const root = createRoot(
    renderEmbed({ name: "greet", args }) + renderEmbed({ name: "greet", args }),
  );
  // 実行
  await load({ root, libraries: {}, isCurrent: () => true });
  // 検証
  expect(extensionLoad).toHaveBeenCalledTimes(1);
  expect(draw).toHaveBeenCalledTimes(2);
  for (const slot of findSlots(root)) {
    expect(draw).toHaveBeenCalledWith(slot, {
      args: ["world"],
      keys: { lang: "ja" },
    });
  }
});

// 引数が schema に合わない場所は記載の警告にし、load しない（異常系）
test("test_load_libraries_when_extension_args_invalid", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const extensionLoad = vi.fn(async () => ({ draw: () => {} }));
  await registerTracked({
    name: "greet",
    directive: "greet",
    load: extensionLoad,
    schema: v.object({
      args: v.strictTuple([v.pipe(v.string(), v.regex(/^[a-z]+$/))]),
      keys: v.record(v.string(), v.string()),
    }),
  });
  const root = createRoot(renderEmbed({ name: "greet", args: ["World", "2"] }));
  // 実行
  await load({ root, libraries: {}, isCurrent: () => true });
  // 検証
  expect(root.querySelector(".mdmark-syntax-warning")).not.toBeNull();
  expect(extensionLoad).not.toHaveBeenCalled();
});

// load の拒否と validate の拒否は拡張の通知ブロックにする（異常系）
test("test_load_libraries_when_extension_fails", async () => {
  // 準備
  const { loadLibraries: load } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const loadError = new Error("load failed");
  const validateError = new Error("validate failed");
  await registerTracked({
    name: "greet",
    directive: "greet",
    load: async () => {
      throw loadError;
    },
  });
  const { registerExtension } = await loadExtensions();
  registerExtension({
    name: "checked",
    directive: "checked",
    load: async () => ({ draw: () => {} }),
    schema: {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => Promise.reject(validateError),
      },
    },
  });
  const root = createRoot(
    renderEmbed({ name: "greet" }) + renderEmbed({ name: "checked" }),
  );
  const errorSpy = spyConsoleError();
  // 実行
  await load({ root, libraries: {}, isCurrent: () => true });
  // 検証
  const notices = [...root.querySelectorAll(".mdmark-notice")];
  expect(notices).toHaveLength(2);
  for (const notice of notices) {
    expect(notice.querySelector("p")?.textContent).toMatch(
      /^表示に使用する拡張（/,
    );
  }
  const calls = errorSpy.mock.calls;
  expect(
    calls.some((args) => args.includes("greet") && args.includes(loadError)),
  ).toBe(true);
  expect(
    calls.some(
      (args) => args.includes("checked") && args.includes(validateError),
    ),
  ).toBe(true);
});

// 埋めた外部ライブラリは URL を読み込まずに表の関数で読み込み、表に無い名前は通知ブロックにする（正常系）
test("test_load_libraries_when_embedded", async () => {
  // 準備
  const { loadLibraries: load, setEmbeddedLibraries } = await loadLibraries();
  const { renderEmbed } = await loadEmbed();
  const { renderNotice } = await loadNotice();
  const root = createRoot(
    renderEmbed({ name: "test-lib" }) + renderEmbed({ name: "other" }),
  );
  const draw = vi.fn();
  const importModule = vi.fn<ImportModule>();
  spyConsoleError();
  setEmbeddedLibraries({
    "test-lib": async (): Promise<LibraryModule> => ({ draw }),
  });
  try {
    // 実行
    await load({
      root,
      libraries: {
        ...TEST_LIB,
        other: { url: "/fixtures/other.js", figure: true },
      },
      isCurrent: () => true,
      importModule,
    });
  } finally {
    setEmbeddedLibraries(undefined);
  }
  // 検証
  expect(importModule).not.toHaveBeenCalled();
  const drawn = root.querySelector('[data-mdmark-slot="test-lib"]');
  expect(drawn?.hasAttribute("data-mdmark-drawn")).toBe(true);
  expect(draw).toHaveBeenCalledWith(drawn, []);
  expect(root.querySelector('[data-mdmark-slot="other"]')).toBeNull();
  expect(root.innerHTML).toContain(
    normalize(renderNotice({ name: "other", figure: true })),
  );
});
