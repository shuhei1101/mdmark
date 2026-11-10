import { expect, test } from "@playwright/test";
import type {
  MdmarkAlias,
  MdmarkIndex,
  MdmarkReferences,
} from "../../../src/index.ts";
import {
  buildDistRoot,
  openPage,
  removeDistRoot,
  renderInNode,
  renderInPage,
  SAMPLE_MARKDOWN,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
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
  // 要素名の直後が空白か `>` の開始タグを探す（`p` が `pre` に該当しないように、属性の有無は問わない）
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

// 記法を持つ文書を、ページで描くのと同じ本文の HTML 文字列にし、マーカーの文字とスクリプトは含めない（正常シナリオ（記法を持つ文書））
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
  schema: 2,
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

// 索引・文書の id・参照を指定すると、用語の意味と被参照の一覧を持つ HTML 文字列を返却する（正常シナリオ（索引を指定する））
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

// 読み込んだエイリアスを指定すると、下線とツールチップ（説明・コマンド・コピーのボタン）を持つ HTML 文字列を返却する（正常シナリオ（エイリアスを指定する））
test("test_normal_when_aliases", async () => {
  // 準備
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "workspace",
      name: "ワークスペース",
      aliases: [],
      description: "話し合いの記録を置くフォルダ",
    },
    {
      alias_type: "command",
      id: "unit-test",
      name: "単体テスト",
      aliases: [],
      command: "npm run test:unit",
    },
  ];
  // 実行
  const html = await renderInNode(
    builtRoot,
    "ワークスペースと単体テストを置く。\n",
    {
      aliases,
    },
  );
  // 検証
  expect(html).toMatch(/<[^>]*class="mdmark-term"[^>]*>ワークスペース</);
  expect(html).toContain("話し合いの記録を置くフォルダ");
  expect(html).toMatch(/<[^>]*class="mdmark-term"[^>]*>単体テスト</);
  expect(html).toContain("<code>npm run test:unit</code>");
  expect(html).toContain("mdmark-term-tip-copy");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<!--");
});

// 脚注を持つ文書を、番号・ツールチップの中身・末尾の閉じた一覧を持つ HTML 文字列にする（正常シナリオ（脚注を持つ文書））
test("test_normal_when_footnotes", async () => {
  // 準備・実行
  const html = await renderInNode(
    builtRoot,
    "出典がある[^src] と行内^[行内の補足]。\n\n[^src]: 出典の説明\n",
  );
  // 検証
  expect(matchAll(html, /<sup class="mdmark-fn-ref">/g)).toHaveLength(2);
  expect(html).toMatch(
    /<span class="mdmark-visually-hidden">脚注 <\/span>1<\/a>/,
  );
  expect(html).toMatch(
    /<span class="mdmark-visually-hidden">脚注 <\/span>2<\/a>/,
  );
  expect(html).toMatch(/class="mdmark-fn-tip-body">出典の説明</);
  expect(html).toMatch(/class="mdmark-fn-tip-body">行内の補足</);
  expect(html.trimEnd()).toMatch(
    /<details class="mdmark-footnotes">[\s\S]*<\/details>$/,
  );
  expect(html).not.toContain("[^src]");
});

/** 正規表現（`g` 付き）に合う文字列を全て返却する */
function matchAll(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}

// 取り込む文書の表を指定すると、マーカーの場所に見出しの中を描く（正常シナリオ（取り込む文書を指定する））
test("test_normal_when_includes_given", async () => {
  // 準備
  const markdown = "# 案内\n\n<!-- include: 共通/手順.md#実行 -->\n";
  const includes = {
    "共通/手順.md": "## 準備\n\n準備の段落\n\n## 実行\n\n実行の段落\n",
  };
  // 実行
  const html = await renderInNode(builtRoot, markdown, { includes });
  const without = await renderInNode(builtRoot, markdown);
  // 検証
  expect(html).toMatch(/<div [^>]*class="mdmark-include"/);
  expect(html).toMatch(/<h2[^>]*>実行/);
  expect(html).toContain("実行の段落");
  expect(html).not.toContain("準備の段落");
  expect(without).toContain("mdmark-syntax-warning");
  expect(without).toContain("共通/手順.md");
});

// 先頭のフロントマターを HTML 文字列に出さない（正常シナリオ（フロントマターを持つ文書））
test("test_normal_when_frontmatter", async () => {
  // 準備
  const markdown = [
    "---",
    "title: テスト",
    "tags: [a, b]",
    "---",
    "",
    "# 見出し",
    "",
    "段落",
    "",
  ].join("\n");
  // 実行
  const html = await renderInNode(builtRoot, markdown);
  // 検証
  expect(html).not.toContain("title: テスト");
  expect(html).not.toContain("tags: [a, b]");
  expect(html).not.toMatch(/<h2[\s>]/);
  expect(html).toMatch(/<h1[^>]*>見出し/);
  expect(html).toMatch(/<p[^>]*>段落<\/p>/);
});
