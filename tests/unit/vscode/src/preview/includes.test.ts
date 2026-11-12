import { expect, test } from "vitest";

/** 取り込む文書を読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIncludes = () =>
  import("../../../../../vscode/src/preview/includes.ts");

// 根の中の読み込めるファイルだけを読み込む（正常系）
test("test_read_includes", async () => {
  // 準備
  const { readIncludes } = await loadIncludes();
  const files: Record<string, string> = {
    "/ws/root/docs/共通/手順.md": "## 準備\n\nA\n\n## 実行\n\nB\n",
    "/ws/outside.md": "外\n",
  };
  const read: string[] = [];
  const readFile = async (path: string): Promise<string | undefined> => {
    read.push(path);
    return files[path];
  };
  const markdown = [
    '<!-- include: {"path": "共通/手順.md", "heading": "実行"} -->',
    "",
    '<!-- include: {"path": "missing.md"} -->',
    "",
    '<!-- include: {"path": "../../outside.md"} -->',
    "",
  ].join("\n");
  // 実行
  const result = await readIncludes({
    markdownPath: "/ws/root/docs/guide.md",
    markdown,
    root: "/ws/root",
    readFile,
  });
  // 検証
  expect(Object.keys(result.includes)).toEqual(["共通/手順.md"]);
  expect(result.paths).toEqual(["/ws/root/docs/共通/手順.md"]);
  expect(read).not.toContain("/ws/outside.md");
});
