import { expect, test } from "vitest";
import { createEnv } from "../../../helpers/env.ts";

/** 解析器を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../../src/render/parser.ts");

/** フロントマターの表示の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFrontmatter = () =>
  import("../../../../../src/render/syntax/frontmatter.ts");

/** 機能を決めたフロントマターを持つ状態に、フロントマターの表示のコアルールだけを当てたトークンの並び */
async function insertWithFrontmatter(options: {
  content: string;
  frontmatter: boolean;
}) {
  const { createParser } = await loadParser();
  const { insertFrontmatter } = await loadFrontmatter();
  const parser = createParser();
  const env = createEnv({
    frontmatter: { content: options.content, endLine: 2 },
    features: { frontmatter: options.frontmatter },
  });
  const state = new parser.core.State("", parser, env);
  insertFrontmatter(state);
  return state.tokens;
}

// 機能がオンなら、折りたたみの開きと閉じの間に yaml の fence を入れる（正常系）
test("test_insert_frontmatter", async () => {
  // 実行
  const tokens = await insertWithFrontmatter({
    content: "title: a",
    frontmatter: true,
  });
  // 検証
  const [open, fence, close] = tokens;
  expect(open?.type).toBe("html_block");
  expect(open?.content).toContain("mdmark-frontmatter");
  expect(open?.content).toContain('data-mdmark-own="test-nonce"');
  expect(fence?.type).toBe("fence");
  expect(fence?.info).toBe("yaml");
  expect(fence?.content).toBe("title: a\n");
  expect(fence?.map).toEqual([1, 3]);
  expect(close?.type).toBe("html_block");
  expect(close?.content).toContain("</details>");
});

// 機能がオフなら何も入れない（正常系）
test("test_insert_frontmatter_when_off", async () => {
  // 実行
  const tokens = await insertWithFrontmatter({
    content: "title: a",
    frontmatter: false,
  });
  // 検証
  expect(tokens).toEqual([]);
});

// 中身が空白だけなら何も入れない（正常系）
test("test_insert_frontmatter_when_blank", async () => {
  // 実行
  const tokens = await insertWithFrontmatter({
    content: "  ",
    frontmatter: true,
  });
  // 検証
  expect(tokens).toEqual([]);
});
