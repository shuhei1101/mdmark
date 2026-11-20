import { expect, test } from "vitest";

/** 埋めた描いた結果から mount の引数を作る処理を読み込む（ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む。実装が無い間は各テストが個別に失敗する） */
const loadRendered = (): Promise<
  typeof import("../../../../src/viewer/rendered.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/viewer/rendered.ts",
      import.meta.url,
    ).href
  );

// 描いた結果の画像のキーを data: URL に替え、純粋な Markdown とパスをそのまま渡す（正常系）
test("test_rendered_options", async () => {
  // 準備
  const { renderedOptions } = await loadRendered();
  const doc = {
    path: "guide/a.md",
    title: "A",
    rendered: {
      html: '<p><img src="mdmark-asset:a" alt="図"></p>',
      features: {},
      page: {},
      paramDefinitions: [],
      extensionDefinitions: [],
    },
    pureMarkdown: "![図](a.png)\n",
  };
  const payload = {
    kind: "bundle" as const,
    config: {},
    docs: [doc],
    entry: "guide/a.md",
    assets: { a: "data:image/png;base64,AA==" },
  };
  // 実行
  const options = renderedOptions({ payload, doc });
  // 検証
  expect(options.rendered.html).toBe(
    '<p><img src="data:image/png;base64,AA==" alt="図"></p>',
  );
  expect(options.pureMarkdown).toBe("![図](a.png)\n");
  expect(options.path).toBe("guide/a.md");
});
