import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { renderedDoc } from "../../helpers/rendered.ts";

/** 書き出した HTML の起動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadViewer = () => import("../../../../src/viewer/index.ts");

/** 埋めたモジュールが無い書き出しの起動に指定する値 */
const EMBEDDED = { parts: {}, libraries: {}, extensions: [] };

afterEach(() => {
  document.body.innerHTML = "";
});

// document の中身を描く先の要素に描く（正常系）
test("test_start_viewer", async () => {
  // 準備
  const payload = {
    kind: "document",
    config: {},
    docs: [
      await renderedDoc({
        path: "a.md",
        title: "タイトル",
        markdown: "# タイトル\n",
      }),
    ],
    entry: "a.md",
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
  await startViewer(document, EMBEDDED);
  // 検証
  expect(article.querySelector("h1")?.textContent).toContain("タイトル");
});

// 埋めたエイリアスで下線を付ける（正常系）
test("test_start_viewer_when_aliases", async () => {
  // 準備
  const aliases = [
    {
      alias_type: "command" as const,
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      description: "ライブラリ本体の単体テストを実行する",
      command: "npm run test:unit",
    },
  ];
  const payload = {
    kind: "document",
    config: {},
    docs: [
      await renderedDoc({
        path: "a.md",
        title: "タイトル",
        markdown: "単体テストを実行する。\n",
        aliases,
      }),
    ],
    entry: "a.md",
    aliases,
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
  await startViewer(document, EMBEDDED);
  // 検証
  expect(article.querySelector(".mdmark-term")?.textContent).toBe("単体テスト");
  expect(article.querySelector(".mdmark-term-tip code")?.textContent).toBe(
    "npm run test:unit",
  );
});

// 埋めた描いた結果を描き、Markdown でコピーで埋めた純粋な Markdown を書き込む（正常系）
test("test_start_viewer_with_rendered", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const payload = {
    kind: "document",
    config: {},
    docs: [
      {
        ...(await renderedDoc({
          path: "a.md",
          title: "タイトル",
          markdown: "# タイトル\n\n## 節\n\n本文\n",
        })),
        pureMarkdown: "# タイトル",
      },
    ],
    entry: "a.md",
  };
  const script = document.createElement("script");
  script.type = "application/json";
  script.id = "mdmark-payload";
  script.textContent = JSON.stringify(payload);
  const article = document.createElement("article");
  article.className = "mdmark";
  document.body.append(script, article);
  try {
    // 実行
    const { startViewer } = await loadViewer();
    await startViewer(document, EMBEDDED);
    article
      .querySelector<HTMLButtonElement>('button[data-markdown="copy"]')
      ?.click();
    // 検証
    expect(article.querySelector("h1")?.textContent).toContain("タイトル");
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("# タイトル");
  } finally {
    restoreClipboard();
  }
});
