import * as v from "valibot";
import { afterEach, expect, inject, test, vi } from "vitest";
import type {
  MdmarkExtension,
  MdmarkExtensionModule,
  MountHandle,
} from "../../../src/index.ts";

type Built = typeof import("../../../src/index.ts");

// 拡張のモジュールの代役と、404 を返却するモジュールの URL（手元の開発サーバーが配る）
const GREET_PATH = "/fixtures/greet.js";
const DEFINITION_PATH = "/fixtures/definition.js";
const MISSING_PATH = "/fixtures/missing.js";
// 拡張のモジュールの代役が `slot` に記載する、引数の判別した値
const GREET_TEXT = '{"options":{"target":"world","lang":"ja"}}';

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

/** 描く先の要素を作り、ページに配置する */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

/** 要素に文書を描き、後始末のために戻り値を記録する */
function mountTracked(
  built: Built,
  el: HTMLElement,
  markdown: string,
): MountHandle {
  const handle = built.mount(el, { markdown });
  handles.push(handle);
  return handle;
}

/** 要素の中を CSS セレクタで 1 つ参照する（無ければ失敗する） */
function find<T extends Element>(el: Element, selector: string): T {
  const found = el.querySelector<T>(selector);
  if (!found) {
    throw new Error(`見つからない: ${selector}`);
  }
  return found;
}

/** 要素の直下の段落の文字を並べて返却する */
function paragraphTexts(el: Element): string[] {
  return [...el.querySelectorAll(":scope > p")].map((p) => p.textContent ?? "");
}

/** 拡張の代役のモジュールを読み込む（URL は開発サーバーが配るため、Vite に解決させない） */
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

/** `console.error` を黙らせて、呼ばれた引数を記録する */
function spyConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

// options.target を英小文字の文字列だけで、options.count を数だけで許す schema
const INVALID_ARGS_SCHEMA = v.object({
  options: v.object({
    target: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
    count: v.optional(v.number()),
  }),
});

const MARK_MARKDOWN =
  '前の段落\n\n<!-- greet: {"target": "world", "lang": "ja"} -->\n\n中の段落\n\n<!-- greet: {"target": "world", "lang": "ja"} -->\n\n後の段落\n';

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  vi.restoreAllMocks();
});

// 拡張を登録し、文書の拡張のマーカーの場所にモジュールで描かせる（正常系）
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

// 拡張のマーカーが無い文書では拡張のモジュールを読み込まない（正常系）
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

// 引数が schema に合わないマーカーの場所だけを記載の警告にし、モジュールを読み込まない（異常系）
test("test_error_when_args_invalid", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet({
    schema: INVALID_ARGS_SCHEMA,
  });
  built.registerExtension(extension);
  // 実行
  expect(() =>
    mountTracked(
      built,
      el,
      '前の段落\n\n<!-- greet: {"target": "World", "count": "2"} -->\n\n後の段落\n',
    ),
  ).not.toThrow();
  // 検証
  const warning = await vi.waitFor(() =>
    find<HTMLElement>(el, ".mdmark-syntax-warning"),
  );
  expect(find(warning, ".mdmark-syntax-warning-title").textContent).toBe(
    "記載の警告",
  );
  expect(warning.textContent).toContain(
    '<!-- greet: {"target":"World","count":"2"} -->',
  );
  expect(warning.textContent).toContain("greet");
  const items = [...warning.querySelectorAll("li")].map(
    (item) => item.textContent ?? "",
  );
  expect(items).toHaveLength(2);
  expect(items[0]?.startsWith("target:")).toBe(true);
  expect(items[1]?.startsWith("count:")).toBe(true);
  expect(load).not.toHaveBeenCalled();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 引数が JSON のオブジェクトでない拡張のマーカーの場所を、移行を案内する記載の警告にし、検査もモジュールの読み込みもしない（異常系）
test("test_error_when_legacy_args", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const validate = vi.fn(INVALID_ARGS_SCHEMA["~standard"].validate);
  const { extension, load } = createGreet({
    schema: {
      "~standard": { ...INVALID_ARGS_SCHEMA["~standard"], validate },
    } as unknown as MdmarkExtension["schema"],
  });
  built.registerExtension(extension);
  // 実行
  expect(() =>
    mountTracked(
      built,
      el,
      "前の段落\n\n<!-- greet: world lang=ja -->\n\n後の段落\n",
    ),
  ).not.toThrow();
  // 検証
  const warning = await vi.waitFor(() =>
    find<HTMLElement>(el, ".mdmark-syntax-warning"),
  );
  const text = warning.textContent ?? "";
  expect(text).toContain("greet");
  expect(text).toContain("JSON のオブジェクト");
  expect(text).toContain("mdmark upgrade");
  expect(text).toContain("移行の報告");
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(validate).not.toHaveBeenCalled();
  expect(load).not.toHaveBeenCalled();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 拡張のモジュールを読み込めないマーカーの場所だけを通知ブロックにし、ほかは描く（異常系）
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
    mountTracked(
      built,
      el,
      '前の段落\n\n<!-- greet: {"target": "world"} -->\n\n後の段落\n',
    ),
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
    "表示に使用する拡張（greet）を読み込めませんでした。ネットワークにつながっているかを確認して、ページを再読み込みしてください。",
  );
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
  expect(errorSpy).toHaveBeenCalled();
  const args = errorSpy.mock.calls.flat();
  expect(args).toContain("greet");
  expect(args.some((arg) => arg instanceof Error)).toBe(true);
});

// schema の validate が拒否されるマーカーの場所を通知ブロックにし、モジュールを読み込まない（異常系）
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
    mountTracked(
      built,
      el,
      '前の段落\n\n<!-- greet: {"target": "world"} -->\n\n後の段落\n',
    ),
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
  mountTracked(
    built,
    el,
    '前の段落\n\n<!-- greet: {"target": "world"} -->\n\n後の段落\n',
  );
  expect(el.querySelector("[data-mdmark-slot]")).toBeNull();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// 記法のマーカーや登録済みの拡張と同じ directive は登録せずに Error を投げる（異常系）
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
  mountTracked(built, el, '<!-- greet: {"target": "world"} -->\n');
  await vi.waitFor(() => {
    expect(load).toHaveBeenCalledTimes(1);
  });
  expect(second.load).not.toHaveBeenCalled();
});

/** 範囲で記載した拡張のマーカーの Markdown: `json` のコードブロックを `blocks` の数だけ配置する */
function rangeMarkdown(blocks: string[]): string {
  const fences = blocks.flatMap((json) => ["```json", json, "```", ""]);
  return [
    "前の段落",
    "",
    "<!-- greet -->",
    "",
    ...fences,
    "<!-- /greet -->",
    "",
    "後の段落",
    "",
  ].join("\n");
}

// 範囲で記載した拡張のマーカーの json を、definition として schema と draw へ指定する（正常系）
test("test_normal_when_definition", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const load = vi.fn(() => importFixture(DEFINITION_PATH));
  const schema = v.object({
    options: v.record(v.string(), v.unknown()),
    definition: v.object({ title: v.string(), items: v.array(v.string()) }),
  });
  built.registerExtension({
    name: "greet",
    directive: "greet",
    load,
    schema: schema as unknown as MdmarkExtension["schema"],
  });
  // 実行
  mountTracked(
    built,
    el,
    rangeMarkdown(['{"title": "段取り", "items": ["a", "b", "c"]}']),
  );
  // 検証
  await vi.waitFor(() => {
    expect(el.textContent).toContain("段取り 3");
  });
  expect(el.innerHTML).not.toContain('"items"');
  expect(load).toHaveBeenCalledTimes(1);
});

// JSON として読み込めない定義のマーカーの場所を記載の警告にし、モジュールを読み込まない（異常系）
test("test_error_when_definition_invalid", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet();
  built.registerExtension(extension);
  // 実行
  mountTracked(built, el, rangeMarkdown(['{"title": "段取り",']));
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-syntax-warning")).not.toBeNull();
  });
  const warning = find(el, ".mdmark-syntax-warning").textContent ?? "";
  expect(warning).toContain("greet");
  expect(warning).toContain("行目");
  expect(load).not.toHaveBeenCalled();
  expect(paragraphTexts(el)).toEqual(["前の段落", "後の段落"]);
});

// json のコードブロックが 2 つあると、モジュールを読み込まずに記載の警告にする（異常系）
test("test_error_when_definition_two_blocks", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension, load } = createGreet();
  built.registerExtension(extension);
  // 実行
  mountTracked(built, el, rangeMarkdown(['{"title": "a"}', '{"title": "b"}']));
  // 検証
  await vi.waitFor(() => {
    expect(el.querySelector(".mdmark-syntax-warning")).not.toBeNull();
  });
  expect(find(el, ".mdmark-syntax-warning").textContent).toContain(
    "json のコードブロックが 2 つあります",
  );
  expect(load).not.toHaveBeenCalled();
});

// 図の部品のマーカーと同じ directive の拡張を登録でき、そのマーカーを拡張に描かせる（正常系）
test("test_normal_when_directive_is_diagram_name", async () => {
  // 準備
  const built = await loadBuilt();
  const el = createElement();
  const { extension } = createGreet({ directive: "chart" });
  // 実行・検証
  expect(() => built.registerExtension(extension)).not.toThrow();
  mountTracked(
    built,
    el,
    '前の段落\n\n<!-- chart: {"target": "world"} -->\n\n後の段落\n',
  );
  await vi.waitFor(() => {
    expect(find(el, "[data-mdmark-slot]").textContent).toBe(
      '{"options":{"target":"world"}}',
    );
  });
  expect(el.querySelector("figure.mdmark-diagram")).toBeNull();
});
