import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Linter, type SourceCode } from "eslint";
import { afterEach, expect, test } from "vitest";

/** 対応ブラウザの下限を確かめるスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBaseline = () => import("../../../scripts/baseline.ts");

// 位置を確かめる API の名前
const API = "Intl.Segmenter";

const createdRoots: string[] = [];

/** 与えたコードを ESLint で解析し、その `SourceCode` を返す */
function createSourceCode(code: string): SourceCode {
  const linter = new Linter({ configType: "flat" });
  linter.verify(
    code,
    [{ languageOptions: { ecmaVersion: "latest", sourceType: "module" } }],
    "input.js",
  );
  return linter.getSourceCode();
}

/** コードの中の `needle` の `occurrence` 番目（1 始まり）の先頭の位置を、行と列（どちらも 1 始まり）で返す */
function positionOf(
  code: string,
  needle: string,
  occurrence = 1,
): { line: number; column: number } {
  let index = -1;
  for (let count = 0; count < occurrence; count += 1) {
    index = code.indexOf(needle, index + 1);
  }
  const before = code.slice(0, index).split("\n");
  return { line: before.length, column: (before.at(-1) ?? "").length + 1 };
}

/** 一時フォルダに `files` を置き、作業ツリーの node_modules へのリンクを張って、そのパスを返す */
async function createRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-baseline-"));
  createdRoots.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await symlink(
    join(process.cwd(), "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

// 名前と版の間に空白を入れる（正常系）
test("test_to_browserslist", async () => {
  // 準備
  const { toBrowserslist } = await loadBaseline();
  // 実行
  const queries = toBrowserslist(["chrome99", "firefox98", "safari16.4"]);
  // 検証
  expect(queries).toEqual(["chrome 99", "firefox 98", "safari 16.4"]);
});

// 版の無い target を拒む（異常系）
test("test_to_browserslist_when_format_invalid", async () => {
  // 準備
  const { toBrowserslist } = await loadBaseline();
  // 実行・検証
  expect(() => toBrowserslist(["chrome"])).toThrow(/chrome/);
});

// 同じ API の typeof の if のブロックの中は真（正常系）
test("test_is_guarded_by_typeof", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = [
    'if (typeof Intl.Segmenter !== "undefined") {',
    '  new Intl.Segmenter("ja");',
    "}",
    "",
  ].join("\n");
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(true);
});

// else のブロックの中も真（正常系）
test("test_is_guarded_by_typeof_when_else_block", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = [
    'if (typeof Intl.Segmenter === "undefined") {',
    "  f();",
    "} else {",
    '  new Intl.Segmenter("ja");',
    "}",
    "",
  ].join("\n");
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(true);
});

// 条件の typeof の式の中の参照も真（正常系）
test("test_is_guarded_by_typeof_when_in_test", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = 'if (typeof Intl.Segmenter !== "undefined") {}\n';
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, API),
    api: API,
  });
  // 検証
  expect(guarded).toBe(true);
});

// 確かめの if の直前の位置は偽。列を 0 始まりに直さず引くと 1 つ右の if の i を指して真になる（正常系）
test("test_is_guarded_by_typeof_when_just_before_if", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = 'Intl.Segmenter;if (typeof Intl.Segmenter !== "undefined") {}\n';
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, ";"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(false);
});

// 無関係な条件の if の中は偽（正常系）
test("test_is_guarded_by_typeof_when_unrelated_if", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = ["if (x > 1) {", '  new Intl.Segmenter("ja");', "}", ""].join(
    "\n",
  );
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(false);
});

// 別の API の typeof の if の中は偽（正常系）
test("test_is_guarded_by_typeof_when_other_api", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = [
    'if (typeof Highlight !== "undefined") {',
    '  new Intl.Segmenter("ja");',
    "}",
    "",
  ].join("\n");
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(false);
});

// 早期 return の後ろは偽（正常系）
test("test_is_guarded_by_typeof_when_early_return", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code = [
    "function f() {",
    '  if (typeof Intl.Segmenter === "undefined") {',
    "    return;",
    "  }",
    '  return new Intl.Segmenter("ja");',
    "}",
    "",
  ].join("\n");
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(false);
});

// 三項演算子は偽（正常系）
test("test_is_guarded_by_typeof_when_ternary", async () => {
  // 準備
  const { isGuardedByTypeof } = await loadBaseline();
  const code =
    'typeof Intl.Segmenter === "undefined" ? undefined : new Intl.Segmenter("ja");\n';
  // 実行
  const guarded = isGuardedByTypeof({
    sourceCode: createSourceCode(code),
    ...positionOf(code, "new"),
    api: API,
  });
  // 検証
  expect(guarded).toBe(false);
});

// 下限に無い API を使わなければ空を返す（正常系）
test("test_find_baseline_violations", async () => {
  // 準備
  const { findBaselineViolations } = await loadBaseline();
  const root = await createRoot({ "src/index.ts": "export const a = 1;\n" });
  // 実行
  const violations = await findBaselineViolations({ root, version: "v0.0.0" });
  // 検証
  expect(violations).toEqual([]);
});

// 確かめずに使う下限に無い API を返す（正常系）
test("test_find_baseline_violations_when_api_unguarded", async () => {
  // 準備
  const { findBaselineViolations } = await loadBaseline();
  const root = await createRoot({
    "src/index.ts": 'new Intl.Segmenter("ja");\nexport const a = 1;\n',
  });
  // 実行
  const violations = await findBaselineViolations({ root, version: "v0.0.0" });
  // 検証
  expect(violations).toHaveLength(1);
  expect(violations[0]?.file).toBe("dist/index.js");
  expect(violations[0]?.api).toBe(API);
  expect(violations[0]?.message).toContain("Firefox 98");
});

// 同じ API の typeof の if の中で使えば返さない（正常系）
test("test_find_baseline_violations_when_api_guarded", async () => {
  // 準備
  const { findBaselineViolations } = await loadBaseline();
  const root = await createRoot({
    "src/index.ts": [
      'if (typeof Intl.Segmenter !== "undefined") {',
      '  new Intl.Segmenter("ja");',
      "}",
      "export const a = 1;",
      "",
    ].join("\n"),
  });
  // 実行
  const violations = await findBaselineViolations({ root, version: "v0.0.0" });
  // 検証
  expect(violations).toEqual([]);
});

// 無関係な条件の if の中の使用も返す（正常系）
test("test_find_baseline_violations_when_unrelated_if", async () => {
  // 準備
  const { findBaselineViolations } = await loadBaseline();
  const root = await createRoot({
    "src/index.ts": [
      "export function f(x: number) {",
      "  if (x > 1) {",
      '    return new Intl.Segmenter("ja");',
      "  }",
      "}",
      "",
    ].join("\n"),
  });
  // 実行
  const violations = await findBaselineViolations({ root, version: "v0.0.0" });
  // 検証
  expect(violations).toHaveLength(1);
  expect(violations[0]?.api).toBe(API);
});

// 作業ツリーに無い入口は飛ばす（正常系）
test("test_find_baseline_violations_when_entry_missing", async () => {
  // 準備
  const { findBaselineViolations } = await loadBaseline();
  const root = await createRoot({ "src/index.ts": "export const a = 1;\n" });
  // 実行・検証
  await expect(
    findBaselineViolations({ root, version: "v0.0.0" }),
  ).resolves.toEqual([]);
});
