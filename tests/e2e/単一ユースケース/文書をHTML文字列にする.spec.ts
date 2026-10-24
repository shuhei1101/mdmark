import { expect, test } from "@playwright/test";
import type { MdmarkIndex, MdmarkReferences } from "../../../src/index.ts";
import {
  buildDistRoot,
  openPage,
  removeDistRoot,
  renderInNode,
  renderInPage,
  SAMPLE_MARKDOWN,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// DOM を持たない Node の処理が、Markdown を HTML 文字列にする（正常シナリオ）
test("test_normal", async () => {
  // 準備・実行
  const html = await renderInNode(builtRoot, SAMPLE_MARKDOWN);
  // 検証
  // 要素名の直後が空白か `>` の開始タグを探す（`p` が `pre` に当たらないように、属性の有無は問わない）
  for (const element of [
    "h1",
    "p",
    "ul",
    "table",
    "pre",
    "code",
    "a",
    "details",
  ]) {
    expect(html, element).toMatch(new RegExp(`<${element}[\\s>]`));
  }
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

// ブラウザで返った HTML 文字列が Node の文字列と一致し、ページには描かない（正常シナリオ（ブラウザで呼ぶ））
test("test_normal_when_in_browser", async ({ page }) => {
  // 準備
  const nodeHtml = await renderInNode(builtRoot, SAMPLE_MARKDOWN);
  await openPage(page, builtRoot);
  const before = await page.locator("#doc").innerHTML();
  // 実行
  const browserHtml = await renderInPage(page, SAMPLE_MARKDOWN);
  // 検証
  expect(browserHtml).toBe(nodeHtml);
  expect(await page.locator("#doc").innerHTML()).toBe(before);
});

// 記法を持つ文書を、ページで描くのと同じ本文の HTML 文字列にし、印の文字とスクリプトは含めない（正常シナリオ（記法を持つ文書））
test("test_normal_when_syntax", async () => {
  // 準備
  const markdown = [
    "## Hello, World!",
    "",
    "<!-- table: data -->",
    "",
    "| 名前 | 数 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "macOS の中身",
    "",
    "### Windows",
    "",
    "Windows の中身",
    "",
    "<!-- /tabs -->",
    "",
    "> [!WARNING]",
    "> 注意の本文",
    "",
    "## 補足",
    "<!-- section: closed -->",
    "",
    "閉じた節の中身",
    "",
    "<!-- fig: arch -->",
    "![構成](https://img.example.test/arch.svg)",
    "",
    "本文の [図](#fig-arch) を見る。",
    "",
    "<script>window.__ran = true</script>",
    "",
  ].join("\n");
  // 実行
  const html = await renderInNode(builtRoot, markdown);
  // 検証
  expect(html).toContain("macOS の中身");
  expect(html).toContain("Windows の中身");
  expect(html).toContain("閉じた節の中身");
  expect(html).toContain("markdown-alert markdown-alert-warning");
  expect(html).toContain('id="hello-world"');
  expect(html).toContain("図 1");
  expect(html).toContain('<a href="#fig-arch">図 1</a>');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

// 用語と被参照を持つ索引
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API", related: ["arch"] },
  ],
  terms: [
    {
      id: "workspace",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

// `api` が `arch` を参照している参照の表
const REFERENCES: MdmarkReferences = {
  backlinks: { arch: ["api"], api: [] },
  glossary: [],
};

// 索引・文書の id・参照を渡すと、用語の意味と被参照の一覧を持つ HTML 文字列を返す（正常シナリオ（索引を渡す））
test("test_normal_when_index", async () => {
  // 準備・実行
  const html = await renderInNode(builtRoot, "ワークスペースを置く。\n", {
    index: INDEX,
    docId: "arch",
    references: REFERENCES,
  });
  // 検証
  expect(html).toContain('class="mdmark-term"');
  expect(html).toContain("話し合いの記録を置くフォルダ");
  expect(html).toContain('<a href="../api.md">API</a>');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});
