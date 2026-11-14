import { expect, test } from "vitest";
import { type PayloadView, readPayload } from "../../helpers/cli.ts";

/** HTML の組み立てを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtml = () => import("../../../../src/cli/html.ts");

// まとめたスクリプトは `</script` を含まない
const SCRIPT = "console.log(1);";

/** 書き出しの中身を作る */
function createPayload(
  kind: "document" | "bundle",
  markdown: string,
): PayloadView {
  return {
    kind,
    config: {},
    docs: [{ path: "a.md", title: "タイトル", markdown }],
    entry: "a.md",
  };
}

// 配布物の CSS が利用側の CSS より前にあり、中身を JSON.parse すると元に戻る（正常系）
test("test_assemble_html", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const payload = createPayload("document", "# タイトル\n");
  // 実行
  const html = assembleHtml({
    payload,
    distCss: "/* dist-css-marker */",
    themeCss: "/* theme-css-marker */",
    script: SCRIPT,
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
  const html = assembleHtml({ payload, distCss: "", script: SCRIPT });
  // 検証
  expect(html.match(/<\/script>/gi)).toHaveLength(2);
  expect(readPayload(html).docs[0]?.markdown).toBe(markdown);
});

// bundle は画面の骨組みを配置する（正常系）
test("test_assemble_html_when_bundle", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const payload = createPayload("bundle", "# タイトル\n");
  // 実行
  const html = assembleHtml({ payload, distCss: "", script: SCRIPT });
  // 検証
  const hasClass = (name: string) =>
    new RegExp(`class="[^"]*(?<![\\w-])${name}(?![\\w-])[^"]*"`).test(html);
  expect(hasClass("mdmark-bundle")).toBe(true);
  expect(hasClass("mdmark-bundle-side")).toBe(true);
  expect(html).toMatch(
    /<dialog[^>]*class="[^"]*(?<![\w-])mdmark-bundle-panel(?![\w-])/,
  );
});

// 隠すときは名前・バージョン・コメントを残さず、タイトルを残す（正常系）
test("test_assemble_html_when_traces_hidden", async () => {
  // 準備
  const { assembleHtml } = await loadHtml();
  const payload: PayloadView = {
    kind: "bundle",
    config: {},
    docs: [
      { path: "mdmark-intro.md", title: "mdmark の紹介", markdown: "# A\n" },
    ],
    entry: "mdmark-intro.md",
    icons: {
      bird: [["path", { d: "M0 0" }]],
    } as unknown as PayloadView["icons"],
  };
  // 実行
  const html = assembleHtml({
    payload,
    distCss: ':root{--mdmark-version:"v0.12.0"}\n.mdmark{color:red}',
    script: SCRIPT,
    hideTraces: true,
  });
  // 検証
  expect(html).toContain("<title>mdmark の紹介</title>");
  const outside = html
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(
      /(<script type="application\/json"[^>]*>)[\s\S]*?(<\/script>)/,
      "$1$2",
    );
  expect(outside).not.toMatch(/mdmark/i);
  expect(outside).not.toContain("v0.12.0");
  expect(outside).not.toContain("<!--");
  expect(html).toContain('id="zq-payload"');
  expect(html).toContain('class="zq-bundle"');
  expect(html).toMatch(/<script type="module">\/\*! lucide /);
});
