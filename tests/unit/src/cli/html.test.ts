import { expect, test } from "vitest";
import { type PayloadView, readPayload } from "../../helpers/cli.ts";

/** HTML の組み立てを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtml = () => import("../../../../src/cli/html.ts");

// 起動の処理は `</script` を含まない
const VIEWER = "console.log(1);";

/** 書き出しの中身を作る */
function createPayload(
  kind: "document" | "bundle",
  markdown: string,
): PayloadView {
  return {
    kind,
    config: {},
    docs: [{ path: "a.md", title: "題", markdown }],
    entry: "a.md",
    modules: {},
    extensions: [],
  };
}

// 配布物の CSS が使う側の CSS より前にあり、中身を JSON.parse すると元に戻る（正常系）
test("test_assemble_html", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const payload = createPayload("document", "# 題\n");
  // 実行
  const html = assembleHtml({
    payload,
    distCss: "/* dist-css-marker */",
    themeCss: "/* theme-css-marker */",
    viewer: VIEWER,
  });
  // 検証
  expect(html.indexOf("dist-css-marker")).toBeGreaterThanOrEqual(0);
  expect(html.indexOf("dist-css-marker")).toBeLessThan(
    html.indexOf("theme-css-marker"),
  );
  expect(readPayload(html)).toEqual(payload);
});

// 文書の `</script>` で要素が閉じない（正常系）
test("test_assemble_html_when_script_in_markdown", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const markdown = "</script><script>alert(1)</script>";
  const payload = createPayload("document", markdown);
  // 実行
  const html = assembleHtml({ payload, distCss: "", viewer: VIEWER });
  // 検証
  expect(html.match(/<\/script>/gi)).toHaveLength(2);
  expect(readPayload(html).docs[0]?.markdown).toBe(markdown);
});

// bundle は画面の骨組みを置く（正常系）
test("test_assemble_html_when_bundle", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const payload = createPayload("bundle", "# 題\n");
  // 実行
  const html = assembleHtml({ payload, distCss: "", viewer: VIEWER });
  // 検証
  const hasClass = (name: string) =>
    new RegExp(`class="[^"]*(?<![\\w-])${name}(?![\\w-])[^"]*"`).test(html);
  expect(hasClass("mdmark-bundle")).toBe(true);
  expect(hasClass("mdmark-bundle-side")).toBe(true);
  expect(html).toMatch(
    /<dialog[^>]*class="[^"]*(?<![\w-])mdmark-bundle-panel(?![\w-])/,
  );
});
