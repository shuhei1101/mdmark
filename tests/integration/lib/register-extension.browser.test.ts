import * as v from "valibot";
import { afterEach, expect, inject, test, vi } from "vitest";
import type {
  MdmarkExtension,
  MdmarkExtensionModule,
  MountHandle,
} from "../../../src/index.ts";

type Built = typeof import("../../../src/index.ts");

// 拡張のモジュールの代役と、404 を返すモジュールの URL（手元の開発サーバーが配る）
const GREET_PATH = "/fixtures/greet.js";
const MISSING_PATH = "/fixtures/missing.js";
// 拡張のモジュールの代役が `slot` に書く、引数の読み分けた値
const GREET_TEXT = '{"args":["world"],"keys":{"lang":"ja"}}';

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];
let stylesheetLoaded: Promise<void> | undefined;
let loadCount = 0;

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

/** ビルドした CSS を 1 度だけ読み込む */
function loadStylesheet(): Promise<void> {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  return stylesheetLoaded;
}

/** ビルドした JS を、テストごとに新しいモジュールとして読み込む（拡張の登録表をテストの間で持ち越さない） */
async function loadBuilt(): Promise<Built> {
  await loadStylesheet();
  loadCount += 1;
  return import(/* @vite-ignore */ `${distUrl("index.js")}?test=${loadCount}`);
}

/** 描く先の要素を作り、ページに置く */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を控える */
function mountTracked(
  built: Built,
  el: HTMLElement,
  markdown: string,
): MountHandle {
  const handle = built.mount(el, { markdown });
  handles.push(handle);
  return handle;
}

/** 要素の中を CSS セレクタで 1 つ引く（無ければ失敗する） */
function find<T extends Element>(el: Element, selector: string): T {
  const found = el.querySelector<T>(selector);
  if (!found) {
    throw new Error(`見つからない: ${selector}`);
  }
  return found;
}

/** 要素の直下の段落の文字を並べて返す */
function paragraphTexts(el: Element): string[] {
  return [...el.querySelectorAll(":scope > p")].map((p) => p.textContent ?? "");
}

/** 拡張の代役のモジュールを読む（URL は開発サーバーが配るため、Vite に解決させない） */
function importFixture(path: string): Promise<MdmarkExtensionModule> {
  return import(/* @vite-ignore */ path);
}

/** 呼ばれた回数を数える `load` を持つ、`greet` の拡張を作る */
function createGreet(overrides: Partial<MdmarkExtension> = {}): {
  extension: MdmarkExtension;
  load: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn(() => importFixture(GREET_PATH));
  return {
    extension: { name: "greet", directive: "greet", load, ...overrides },
    load,
  };
}

/** `console.error` を黙らせて、呼ばれた引数を控える */
function spyConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

const MARK_MARKDOWN =
  "前の段落\n\n<!-- greet: world lang=ja -->\n\n中の段落\n\n<!-- greet: world lang=ja -->\n\n後の段落\n";

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  vi.restoreAllMocks();
});

// 拡張を登録し、文書の拡張の印の場所にモジュールで描かせる（正常系）
test("test_normal", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet();
  // 実行
  const returned = built.registerExtension(extension);
  mountTracked(built, el, MARK_MARKDOWN);
  // 検証
  expect(returned).toBeUndefined();
  await vi.waitFor(() => {
    const slots = [...el.querySelectorAll("[data-mdmark-slot]")];
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.textContent)).toEqual([
      GREET_TEXT,
      GREET_TEXT,
    ]);
  });
  expect(load).toHaveBeenCalledTimes(1);
  expect(paragraphTexts(el)).toEqual(["前の段落", "中の段落", "後の段落"]);
});

// 拡張の印が無い文書では拡張のモジュールを読まない（正常系）
test("test_normal_when_no_mark", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet();
  built.registerExtension(extension);
  // 実行
  mountTracked(built, el, "段落\n");
  await new Promise((resolve) => setTimeout(resolve, 200));
  // 検証
  expect(load).not.toHaveBeenCalled();
  expect(paragraphTexts(el)).toEqual(["段落"]);
});

// 引数が schema に合わない印の場所だけを書き方の警告にし、モジュールを読まない（異常系）
test("test_error_when_args_invalid", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet({
    schema: v.object({
      args: v.strictTuple([v.pipe(v.string(), v.regex(/^[a-z]+$/))]),
      keys: v.record(v.string(), v.string()),
    }),
  });
  built.registerExtension(extension);
  // 実行
  expect(() =>
    mountTracked(
      built,
      el,
      "前の段落\n\n<!-- greet: World 2 -->\n\n後の段落\n",
    ),
  ).not.toThrow();
  // 検証
  const warning = await vi.waitFor(() =>
    find<HTMLElement>(el, ".mdmark-syntax-warning"),
  );
  expect(find(warning, ".mdmark-syntax-warning-title").textContent).toBe(
    "書き方の警告",
  );
  expect(warning.textContent).toContain("<!-- greet: World 2 -->");
  expect(warning.textContent).toContain("greet");
  const items = [...warning.querySelectorAll("li")].map(
    (item) => item.textContent ?? "",
  );
  expect(items).toHaveLength(2);
  expect(items[0]?.startsWith("1 つ目の World:")).toBe(true);
  expect(items[1]?.startsWith("2 つ目の 2:")).toBe(true);
  expect(load).not.toHaveBeenCalled();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 拡張のモジュールを読めない印の場所だけを知らせの枠にし、ほかは描く（異常系）
test("test_error_when_module_not_found", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const errorSpy = spyConsoleError();
  built.registerExtension({
    name: "greet",
    directive: "greet",
    load: () => importFixture(MISSING_PATH),
  });
  // 実行
  expect(() =>
    mountTracked(built, el, "前の段落\n\n<!-- greet: world -->\n\n後の段落\n"),
  ).not.toThrow();
  // 検証
  const notice = await vi.waitFor(() =>
    find<HTMLElement>(el, ".mdmark-notice"),
  );
  expect(notice.getAttribute("role")).toBe("status");
  expect(find(notice, ".mdmark-notice-title").textContent).toBe(
    "この図を表示できません",
  );
  expect(find(notice, "p").textContent).toBe(
    "表示に使う拡張（greet）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。",
  );
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
  expect(errorSpy).toHaveBeenCalled();
  const args = errorSpy.mock.calls.flat();
  expect(args).toContain("greet");
  expect(args.some((arg) => arg instanceof Error)).toBe(true);
});

// schema の validate が拒否される印の場所を知らせの枠にし、モジュールを読まない（異常系）
test("test_error_when_validate_fails", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const errorSpy = spyConsoleError();
  const boom = new Error("boom");
  const { extension, load } = createGreet({
    schema: {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: () => Promise.reject(boom),
      },
    },
  });
  built.registerExtension(extension);
  // 実行
  expect(() =>
    mountTracked(built, el, "前の段落\n\n<!-- greet: world -->\n\n後の段落\n"),
  ).not.toThrow();
  // 検証
  const notice = await vi.waitFor(() =>
    find<HTMLElement>(el, ".mdmark-notice"),
  );
  expect(notice.getAttribute("role")).toBe("status");
  expect(notice.textContent).toContain("greet");
  expect(load).not.toHaveBeenCalled();
  const args = errorSpy.mock.calls.flat();
  expect(args).toContain("greet");
  expect(args).toContain(boom);
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 書式に合わない拡張は登録せずに TypeError を投げる（異常系）
test("test_error_when_extension_invalid", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension } = createGreet();
  // 実行・検証
  const badDirective = () =>
    built.registerExtension({ ...extension, directive: "Greet!" });
  const badSchema = () =>
    built.registerExtension({
      ...extension,
      schema: {} as unknown as MdmarkExtension["schema"],
    });
  expect(badDirective).toThrow(TypeError);
  expect(badDirective).toThrow("directive");
  expect(badSchema).toThrow(TypeError);
  expect(badSchema).toThrow("schema");
  mountTracked(built, el, "前の段落\n\n<!-- greet: world -->\n\n後の段落\n");
  expect(el.querySelector("[data-mdmark-slot]")).toBeNull();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 記法の印や登録済みの拡張と同じ directive は登録せずに Error を投げる（異常系）
test("test_error_when_directive_taken", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet();
  built.registerExtension(extension);
  const second = createGreet();
  // 実行・検証
  const reserved = () =>
    built.registerExtension({ ...second.extension, directive: "table" });
  const duplicated = () => built.registerExtension(second.extension);
  expect(reserved).toThrow(Error);
  expect(reserved).toThrow("table");
  expect(duplicated).toThrow(Error);
  expect(duplicated).toThrow("greet");
  mountTracked(built, el, "<!-- greet: world -->\n");
  await vi.waitFor(() => {
    expect(load).toHaveBeenCalledTimes(1);
  });
  expect(second.load).not.toHaveBeenCalled();
});
