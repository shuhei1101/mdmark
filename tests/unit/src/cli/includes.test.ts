import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 取り込む文書を集める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIncludes = () => import("../../../../src/cli/includes.ts");

const createTempDir = useTempDirs();

// 入れ子の取り込みもたどって表を作る（正常系）
test("test_collect_includes", async () => {
  // 準備
  const { collectIncludes } = await loadIncludes();
  const root = await createTempDir();
  const markdown =
    '# 案内\n\n<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->\n';
  await writeFiles(root, {
    "mdmark.config.yaml": "",
    "docs/guide.md": markdown,
    "docs/共通/手順.md":
      '## 準備\n\nA\n\n## 実行\n\n<!-- include: {"path": "../../src/app.ts", "heading": "L1"} -->\n',
    "src/app.ts": "export const a = 1;\n",
  });
  // 実行
  const result = await collectIncludes({
    docPath: join(root, "docs/guide.md"),
    markdown,
    root,
  });
  // 検証
  expect(Object.keys(result.includes).sort()).toEqual(
    ["../src/app.ts", "共通/手順.md"].sort(),
  );
  expect(result.includes["../src/app.ts"]).toBe("export const a = 1;\n");
  expect(result.problems).toEqual([]);
});

// 取り込めないものを種類ごとの問題にする（異常系）
test("test_collect_includes_when_problems", async () => {
  // 準備
  const { collectIncludes } = await loadIncludes();
  const parent = await createTempDir();
  const root = join(parent, "root");
  const markdown = [
    '<!-- include: {"path": "missing.md"} -->',
    "",
    '<!-- include: {"path": "共通/手順.md", "heading": "無い見出し"} -->',
    "",
    '<!-- include: {"path": "src/app.ts", "lines": {"from": 8, "to": 10}} -->',
    "",
    '<!-- include: {"path": "../../outside.md"} -->',
    "",
    '<!-- include: {"path": "a.md"} -->',
    "",
  ].join("\n");
  await writeFiles(parent, {
    "outside.md": "外\n",
    "root/docs/guide.md": markdown,
    "root/docs/共通/手順.md": "## 準備\n\nA\n",
    "root/docs/src/app.ts": "1\n2\n3\n4\n5\n",
    "root/docs/a.md": '<!-- include: {"path": "b.md"} -->\n',
    "root/docs/b.md": '<!-- include: {"path": "a.md"} -->\n',
  });
  // 実行
  const result = await collectIncludes({
    docPath: join(root, "docs/guide.md"),
    markdown,
    root,
  });
  // 検証
  const kinds = result.problems.map((problem) => problem.kind).sort();
  expect(kinds).toEqual(
    ["circular", "heading", "lines", "missing", "outside"].sort(),
  );
  const lines = result.problems.find((problem) => problem.kind === "lines");
  expect(lines?.lineCount).toBe(5);
  const circular = result.problems.find(
    (problem) => problem.kind === "circular",
  );
  expect(circular?.chain).toEqual(["a.md", "b.md", "a.md"]);
  expect(Object.values(result.includes)).not.toContain("外\n");
});
