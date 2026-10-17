import { expect, test } from "vitest";

/** 文書の一覧の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDocList = () => import("../../../../src/parts/doc-list.ts");

/** フォルダの見出し（`mdmark-doc-list-folder`）の文字を、出た順に返す */
function folderHeadings(html: string): string[] {
  return [
    ...html.matchAll(
      /<p[^>]*class="[^"]*mdmark-doc-list-folder[^"]*"[^>]*>([^<]*)<\/p>/g,
    ),
  ].map((match) => match[1] ?? "");
}

/** `data-doc-path` が path のリンクの開きタグを返す */
function linkTag(html: string, path: string): string {
  const match = new RegExp(`<a [^>]*data-doc-path="${path}"[^>]*>`).exec(html);
  if (!match) {
    throw new Error(`リンクが無い: ${path}`);
  }
  return match[0];
}

// フォルダの無い文書を先に、フォルダごとに最初に出た順でまとめる（正常系）
test("test_render_doc_list", async () => {
  // 準備
  const { renderDocList } = await loadDocList();
  const docs = [
    { path: "a/x.md", title: "X" },
    { path: "README.md", title: "入口" },
    { path: "b/y.md", title: "Y" },
    { path: "a/z.md", title: "Z" },
  ];
  // 実行
  const html = renderDocList({ docs, current: "b/y.md" });
  // 検証
  expect(html.startsWith('<nav class="mdmark-doc-list"')).toBe(true);
  expect(html).toContain('aria-label="文書の一覧"');
  expect(folderHeadings(html)).toEqual(["a", "b"]);
  const order = ["README.md", "a/x.md", "a/z.md", "b/y.md"].map((path) =>
    html.indexOf(`href="#/${path}"`),
  );
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((left, right) => left - right));
  expect(html.indexOf('href="#/README.md"')).toBeLessThan(
    html.indexOf("mdmark-doc-list-folder"),
  );
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(linkTag(html, "b/y.md")).toContain('aria-current="page"');
});

// 題とパスの HTML の特殊文字を替える（正常系）
test("test_render_doc_list_when_escaped", async () => {
  // 準備
  const { renderDocList } = await loadDocList();
  // 実行
  const html = renderDocList({ docs: [{ path: "x.md", title: "<b>&" }] });
  // 検証
  expect(html).toContain("&lt;b&gt;&amp;");
  expect(html).not.toContain("<b>");
});
