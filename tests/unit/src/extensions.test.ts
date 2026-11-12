import * as v from "valibot";
import { beforeEach, expect, test } from "vitest";
import type {
  MdmarkExtension,
  MdmarkMarkArgs,
} from "../../../src/extensions.ts";
import type { StandardSchemaV1 } from "../../../src/standard-schema.ts";

/** 拡張の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadExtensions = () => import("../../../src/extensions.ts");

/** 英小文字の `target` と、数の `count` を許す schema */
const GREET_SCHEMA = v.object({
  options: v.object({
    target: v.pipe(v.string(), v.regex(/^[a-z]+$/)),
    count: v.optional(v.number()),
  }),
});

/** 構造の合う拡張を作る */
function createExtension(
  overrides: Partial<MdmarkExtension> = {},
): MdmarkExtension {
  return {
    name: "greet",
    directive: "greet",
    load: async () => ({ draw: () => {} }),
    ...overrides,
  };
}

beforeEach(async () => {
  const { resetExtensions } = await loadExtensions();
  resetExtensions();
});

// 登録した拡張を extensionFor で参照できる（正常系）
test("test_register_extension", async () => {
  // 準備
  const { registerExtension, extensionFor } = await loadExtensions();
  const extension = createExtension();
  // 実行
  registerExtension(extension);
  // 検証
  expect(extensionFor("greet")).toBe(extension);
});

// 構造の合わない拡張は TypeError で登録しない（異常系）
test("test_register_extension_when_invalid", async () => {
  // 準備
  const { registerExtension, extensionFor } = await loadExtensions();
  const invalids: Array<[unknown, string]> = [
    [createExtension({ directive: "Greet!" }), "directive"],
    [
      createExtension({ load: "x" as unknown as MdmarkExtension["load"] }),
      "load",
    ],
    [
      createExtension({ schema: {} as unknown as MdmarkExtension["schema"] }),
      "schema",
    ],
  ];
  // 実行・検証
  for (const [extension, word] of invalids) {
    expect(() => registerExtension(extension as MdmarkExtension)).toThrow(
      TypeError,
    );
    expect(() => registerExtension(extension as MdmarkExtension)).toThrow(word);
  }
  expect(extensionFor("greet")).toBeUndefined();
  expect(extensionFor("Greet!")).toBeUndefined();
});

// 記法のマーカーと登録済みの名前は Error で登録しない（異常系）
test("test_register_extension_when_directive_taken", async () => {
  // 準備
  const { registerExtension, extensionFor } = await loadExtensions();
  const first = createExtension();
  registerExtension(first);
  // 実行
  const reserved = catchError(() =>
    registerExtension(createExtension({ name: "表", directive: "table" })),
  );
  const reservedGlossary = catchError(() =>
    registerExtension(
      createExtension({ name: "用語集", directive: "glossary" }),
    ),
  );
  const duplicated = catchError(() =>
    registerExtension(createExtension({ name: "別の挨拶" })),
  );
  // 検証
  for (const [error, word] of [
    [reserved, "table"],
    [reservedGlossary, "glossary"],
    [duplicated, "greet"],
  ] as const) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TypeError);
    expect(error?.message).toContain(word);
  }
  expect(extensionFor("greet")).toBe(first);
  expect(extensionFor("table")).toBeUndefined();
  expect(extensionFor("glossary")).toBeUndefined();
});

/** 関数が投げた例外を返却する（投げなければ undefined） */
function catchError(fn: () => void): Error | undefined {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  return undefined;
}

// 合う値は空を返却する（正常系）
test("test_validate_mark_args", async () => {
  // 準備
  const { validateMarkArgs } = await loadExtensions();
  const value: MdmarkMarkArgs = { options: { target: "world" } };
  // 実行
  const items = await validateMarkArgs(GREET_SCHEMA, value);
  // 検証
  expect(items).toEqual([]);
});

// 合わない値は issue ごとの項目を返却する（正常系）
test("test_validate_mark_args_when_invalid", async () => {
  // 準備
  const { validateMarkArgs } = await loadExtensions();
  const value: MdmarkMarkArgs = { options: { target: "World", count: "2" } };
  // 実行
  const items = await validateMarkArgs(GREET_SCHEMA, value);
  // 検証
  expect(items.map((item) => item.label)).toEqual(["target", "count"]);
});

// validate の拒否を投げる（異常系）
test("test_validate_mark_args_when_rejected", async () => {
  // 準備
  const { validateMarkArgs } = await loadExtensions();
  const schema: StandardSchemaV1<MdmarkMarkArgs> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: () => Promise.reject(new Error("boom")),
    },
  };
  // 実行・検証
  await expect(validateMarkArgs(schema, { options: {} })).rejects.toThrow(
    "boom",
  );
});

// options の中まで届く path をキーのパスのラベルにする（正常系）
test("test_format_issue", async () => {
  // 準備
  const { formatIssue } = await loadExtensions();
  const issue = {
    message: "合わない",
    path: [{ key: "options" }, { key: "items" }, { key: 1 }, "name"],
  };
  const value: MdmarkMarkArgs = {
    options: { items: [{ name: "a" }, { name: 2 }] },
  };
  // 実行
  const item = formatIssue(issue, value);
  // 検証
  expect(item).toEqual({ label: "items[1].name", message: "合わない" });
});

// definition の中まで届く path を `definition.{パス}` にする（正常系）
test("test_format_issue_when_definition", async () => {
  // 準備
  const { formatIssue } = await loadExtensions();
  const value: MdmarkMarkArgs = { options: {}, definition: { title: 1 } };
  // 実行
  const item = formatIssue(
    { message: "合わない", path: ["definition", "title"] },
    value,
  );
  // 検証
  expect(item.label).toBe("definition.title");
  expect(item.message).toBe("合わない");
});

// キーまで届かない issue はラベル無し（正常系）
test("test_format_issue_when_no_position", async () => {
  // 準備
  const { formatIssue } = await loadExtensions();
  const value: MdmarkMarkArgs = { options: { target: "World" } };
  // 実行
  const onlyOptions = formatIssue(
    { message: "合わない", path: ["options"] },
    value,
  );
  const noPath = formatIssue({ message: "合わない" }, value);
  // 検証
  expect(onlyOptions).toEqual({ label: "", message: "合わない" });
  expect(noPath).toEqual({ label: "", message: "合わない" });
});
