import { expect, test } from "vitest";

/** フロントマターの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFrontmatter = () => import("../../../../src/render/frontmatter.ts");

/** 改行以外の文字を空白に置き換えた文字列 */
const blank = (text: string) => text.replace(/[^\r\n]/g, " ");

// 先頭のフロントマターを空白にし、中身を返却する（正常系）
test("test_split_frontmatter", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const head = "---\ntitle: a\ntags: [b]\n---";
  const markdown = `${head}\n\n# 見出し`;
  // 実行
  const { body, content, endLine } = splitFrontmatter(markdown);
  // 検証
  expect(content).toBe("title: a\ntags: [b]");
  expect(endLine).toBe(3);
  expect(body).toBe(`${blank(head)}\n\n# 見出し`);
  expect(body.length).toBe(markdown.length);
  expect(body.split("\n")[5]).toBe("# 見出し");
});

// `...` の行でも閉じる（正常系）
test("test_split_frontmatter_when_dots_close", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const markdown = "---\ntitle: a\n...\n本文";
  // 実行
  const { body, content, endLine } = splitFrontmatter(markdown);
  // 検証
  expect(content).toBe("title: a");
  expect(endLine).toBe(2);
  expect(body.split("\n")[3]).toBe("本文");
});

// CRLF と先頭の BOM と行末の空白を許す（正常系）
test("test_split_frontmatter_when_crlf_and_bom", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const markdown = "﻿---  \r\ntitle: a\r\n--- \r\n本文";
  // 実行
  const { body, content } = splitFrontmatter(markdown);
  // 検証
  expect(content).toBe("title: a");
  expect(body.length).toBe(markdown.length);
  expect(body.indexOf("本文")).toBe(markdown.indexOf("本文"));
  expect(body.slice(0, body.indexOf("本文")).trim()).toBe("");
});

// 閉じる行が無ければフロントマターとしない（正常系）
test("test_split_frontmatter_when_unclosed", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const markdown = "---\n段落\n\n## 見出し";
  // 実行
  const { body, content, endLine } = splitFrontmatter(markdown);
  // 検証
  expect(content).toBeUndefined();
  expect(endLine).toBeUndefined();
  expect(body).toBe(markdown);
});

// 1 行目が `---` でなければフロントマターとしない（正常系）
test("test_split_frontmatter_when_not_first_line", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const markdown = "\n---\ntitle: a\n---";
  // 実行
  const { body, content } = splitFrontmatter(markdown);
  // 検証
  expect(content).toBeUndefined();
  expect(body).toBe(markdown);
});

// 中身が空の行だけのフロントマターも除外し、中身は空白だけにする（正常系）
test("test_split_frontmatter_when_empty", async () => {
  // 準備
  const { splitFrontmatter } = await loadFrontmatter();
  const markdown = "---\n\n---\n本文";
  // 実行
  const { body, content } = splitFrontmatter(markdown);
  // 検証
  expect(content?.trim()).toBe("");
  const lines = body.split("\n");
  expect(lines.slice(0, 3).every((line) => line.trim() === "")).toBe(true);
  expect(lines[3]).toBe("本文");
});
