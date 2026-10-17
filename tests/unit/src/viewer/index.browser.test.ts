import { afterEach, expect, test } from "vitest";

/** 書き出した HTML の起動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadViewer = () => import("../../../../src/viewer/index.ts");

afterEach(() => {
  document.body.innerHTML = "";
});

// document の中身を描く先の要素に描く（正常系）
test("test_start_viewer", async () => {
  // 準備
  const payload = {
    kind: "document",
    config: {},
    docs: [{ path: "a.md", title: "題", markdown: "# 題\n" }],
    entry: "a.md",
    modules: {},
    extensions: [],
  };
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = "mdmark-payload";
  script.textContent = JSON.stringify(payload);
  const article = document.createElement("article");
  article.className = "mdmark";
  document.body.append(script, article);
  // 実行
  const { startViewer } = await loadViewer();
  await startViewer(document);
  // 検証
  expect(article.querySelector("h1")?.textContent).toContain("題");
});
