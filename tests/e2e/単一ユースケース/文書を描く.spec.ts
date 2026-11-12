import { expect, test } from "@playwright/test";
import type { MdmarkAlias, MdmarkIndex } from "../../../src/index.ts";
import {
  buildDistRoot,
  destroyDocument,
  mountDocument,
  openPage,
  removeDistRoot,
  SAMPLE_MARKDOWN,
  updateDocument,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 要素と Markdown を指定すると、要素の中に本文を描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  for (const selector of [
    "h1",
    "p",
    "ul",
    "table",
    "pre > code",
    "a",
    "details",
  ]) {
    await expect(doc.locator(selector).first(), selector).toBeVisible();
  }
  await expect(doc.locator('a[href^="https"]').first()).toHaveAttribute(
    "href",
    "https://example.com/page",
  );
});

// 本文だけを差し替える（正常シナリオ（本文を差し替える））
test("test_normal_when_updated", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 実行
  await updateDocument(page, "# 新しい見出し");
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("h1")).toHaveText("新しい見出し");
  await expect(doc.locator("h1")).toHaveCount(1);
  await expect(
    doc.locator(".mdmark-content p, .mdmark-content table"),
  ).toHaveCount(0);
});

// 描いたものを片付け、片付けた後の差し替えは何も描かない（正常シナリオ（片付ける））
test("test_normal_when_destroyed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: SAMPLE_MARKDOWN });
  // 実行
  await destroyDocument(page);
  await updateDocument(page, "# 描かれない");
  // 検証
  await expect(page.locator("#doc")).toBeEmpty();
});

// 未知のマーカーを無視して、前後の段落を描く（正常シナリオ（未知のマーカーがある））
test("test_normal_when_unknown_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: '前の段落\n\n<!-- unknown: {"size": 1} -->\n\n後の段落\n',
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("p")).toHaveText(["前の段落", "後の段落"]);
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("unknown");
});

// 文書に記載したスクリプトを落とし、リンクを押しても実行されない（正常シナリオ（文書にスクリプトがある））
test("test_normal_when_script_in_markdown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    (window as unknown as { __ran: boolean }).__ran = false;
  });
  const markdown = [
    "<script>window.__ran = true</script>",
    "",
    '<a onclick="window.__ran = true" href="#top">押す</a> <a href="javascript:window.__ran = true">js</a>',
    "",
    "<details><summary>折り畳み</summary>中身</details>",
    "",
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown });
  const doc = page.locator("#doc");
  for (const link of await doc.locator("a").all()) {
    await link.click();
  }
  // 検証
  const html = await doc.innerHTML();
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onclick");
  expect(html).not.toContain("javascript:");
  expect(
    await page.evaluate(() => (window as unknown as { __ran: boolean }).__ran),
  ).toBe(false);
  await expect(doc.locator("details")).toBeVisible();
});

// 用語 `ワークスペース` を持ち、文書 `api`（タイトル `API`）の `related` が描く文書 `arch` を指す索引
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

// `api` の本文（`arch` を参照する側）
const DOCUMENTS = { "設計/arch.md": "", "api.md": "# API\n" };

// 索引・文書の id・参照を指定すると用語に下線を付けて被参照の一覧を付け、本文を差し替えても同じ索引で再描画する（正常シナリオ（索引を指定する））
test("test_normal_when_index", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: "ワークスペースを置く。\n",
    index: INDEX,
    docId: "arch",
    documents: DOCUMENTS,
  });
  const doc = page.locator("#doc");
  // 検証（描いた直後）
  await expect(doc.locator(".mdmark-term")).toHaveText(["ワークスペース"]);
  await expect(doc.locator("nav.mdmark-backlinks a")).toHaveText(["API"]);
  // 実行
  await updateDocument(page, "別の段落にもワークスペースを書く。\n");
  // 検証（差し替えた後）
  await expect(doc.locator("p:not(nav.mdmark-backlinks p)")).toContainText(
    "別の段落",
  );
  await expect(doc.locator(".mdmark-term")).toHaveText(["ワークスペース"]);
  await expect(doc.locator("nav.mdmark-backlinks a")).toHaveText(["API"]);
});

// 見出し・段落・表・コードブロックが元の行番号を持ち、外観は元の行番号が無いときと同じ（正常シナリオ（元の行番号を出す））
test("test_normal_when_source_lines", async ({ page }) => {
  // 準備
  const markdown = [
    "# 見出し",
    "",
    "段落",
    "",
    "| 列A | 列B |",
    "| --- | ---: |",
    "| 1 | 2 |",
    "",
    "```ts",
    "const a = 1;",
    "```",
    "",
  ].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  const doc = page.locator("#doc");
  const sourceLine = (selector: string) =>
    doc.locator(selector).first().getAttribute("data-source-line");
  expect(await sourceLine("h1")).toBe("0");
  expect(await sourceLine("p")).toBe("2");
  expect(await sourceLine(".mdmark-table")).toBe("4");
  expect(await sourceLine(".mdmark-code")).toBe("8");
  // 属性を取り除いても、要素の位置と色は変わらない
  const snapshot = () =>
    doc.evaluate((root) =>
      ["h1", "p", ".mdmark-table", ".mdmark-code"].map((selector) => {
        const element = root.querySelector(selector) as HTMLElement;
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          height: rect.height,
          color: getComputedStyle(element).color,
        };
      }),
    );
  const withAttributes = await snapshot();
  await doc.evaluate((root) => {
    for (const element of root.querySelectorAll("[data-source-line]")) {
      element.removeAttribute("data-source-line");
    }
  });
  expect(await snapshot()).toEqual(withAttributes);
});

// 読み込んだエイリアスを指定して描くと下線とツールチップが付き、本文を差し替えた後も同じエイリアスで再描画する（正常シナリオ（エイリアスを指定する））
test("test_normal_when_aliases", async ({ page }) => {
  // 準備
  const aliases: MdmarkAlias[] = [
    {
      alias_type: "term",
      id: "workspace",
      name: "ワークスペース",
      aliases: [],
      description: "話し合いの記録を置くフォルダ",
    },
  ];
  await openPage(page, builtRoot);
  // 実行（描く）
  await mountDocument(page, { markdown: "ワークスペースを置く。\n", aliases });
  // 検証（描いた直後）
  const doc = page.locator("#doc");
  const term = doc.locator(".mdmark-term");
  await expect(term).toHaveText(["ワークスペース"]);
  await term.hover();
  await expect(doc.locator(".mdmark-term-tip")).toContainText(
    "話し合いの記録を置くフォルダ",
  );
  // 実行（本文を差し替える）
  await updateDocument(page, "別の段落にもワークスペースを書く。\n");
  // 検証（差し替えた後）
  await expect(doc.locator("p")).toContainText("別の段落");
  await expect(doc.locator(".mdmark-term")).toHaveText(["ワークスペース"]);
});

// テーマを選ぶ設定で描くと選んだテーマの配色になり、本文を差し替えても保たれ、片付けるとテーマが残らない（正常シナリオ（テーマを選ぶ））
test("test_normal_when_theme_selected", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  const doc = page.locator("#doc");
  // 実行・検証: 描いた直後
  await mountDocument(page, {
    markdown: SAMPLE_MARKDOWN,
    config: { colorTheme: "theme-paper" },
  });
  await expect(doc).toHaveCSS("background-color", "rgb(251, 248, 241)");
  // 実行・検証: 本文を差し替えた後も同じ
  await updateDocument(page, "# 新しい見出し");
  await expect(doc.locator("h1")).toHaveText("新しい見出し");
  await expect(doc).toHaveCSS("background-color", "rgb(251, 248, 241)");
  // 実行・検証: 片付けた後は、テーマを示す属性や class が要素にもページにも残らない
  await destroyDocument(page);
  const leftovers = await page.evaluate(() => {
    const el = document.querySelector("#doc");
    const root = document.documentElement;
    return {
      elementAttributes: el?.getAttributeNames().filter((n) => /theme/.test(n)),
      elementClass: el?.className ?? "",
      rootAttributes: root.getAttributeNames().filter((n) => /theme/.test(n)),
      rootClass: root.className,
      background: getComputedStyle(root)
        .getPropertyValue("--mdmark-color-bg")
        .trim(),
    };
  });
  expect(leftovers.elementAttributes).toEqual([]);
  expect(leftovers.elementClass).not.toMatch(/theme/);
  expect(leftovers.rootAttributes).toEqual([]);
  expect(leftovers.rootClass).not.toMatch(/theme/);
  expect(leftovers.background).toBe("#ffffff");
});

/** 1〜4 行目にフロントマター、6 行目に見出し、8 行目に段落を持つ文書 */
const FRONTMATTER_MARKDOWN = [
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

// 先頭のフロントマターを本文・見出し・右側の目次に出さず、元の行番号は元の Markdown のままにする（正常シナリオ（フロントマターを持つ文書））
test("test_normal_when_frontmatter", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: FRONTMATTER_MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-content h1")).toHaveText("見出し");
  await expect(doc).not.toContainText("title: テスト");
  await expect(doc).not.toContainText("tags: [a, b]");
  await expect(doc.locator(".mdmark-content :is(h1, h2, h3)")).toHaveCount(1);
  await expect(doc.locator(".mdmark-content h2")).toHaveCount(0);
  await expect(
    doc.locator("aside.mdmark-side-toc a[data-heading-id]", {
      hasText: "title",
    }),
  ).toHaveCount(0);
  await expect(doc.locator(".mdmark-content h1")).toHaveAttribute(
    "data-source-line",
    "5",
  );
  await expect(doc.locator(".mdmark-content p").first()).toHaveAttribute(
    "data-source-line",
    "7",
  );
});

// 閉じる行が無い先頭の区切り線は、フロントマターにせず区切り線として描く（正常シナリオ（閉じる行の無い先頭の区切り線））
test("test_normal_when_frontmatter_unclosed", async ({ page }) => {
  // 準備
  const markdown = ["---", "", "段落", "", "## 見出し", ""].join("\n");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  const content = page.locator("#doc .mdmark-content");
  await expect(content.locator("hr")).toHaveCount(1);
  await expect(content.locator("p", { hasText: "段落" })).toHaveCount(1);
  await expect(content.locator("h2")).toHaveText("見出し");
});

/** 名前・数量の 2 列 3 行の表の行（閉じのマーカーまで） */
const QUANTITY_TABLE = [
  "",
  "| 名前 | 数量 |",
  "| --- | --- |",
  "| a | 1 |",
  "| b | 2 |",
  "| c | 3 |",
  "",
  "<!-- /table -->",
  "",
];

/** 2 つの文書を別々に描き、描くたびに振る表の id と元の行番号を除いた、描く先の要素の HTML を返却する */
async function renderTwo(
  page: import("@playwright/test").Page,
  first: string,
  second: string,
): Promise<[string, string]> {
  const html = async (markdown: string): Promise<string> => {
    await mountDocument(page, { markdown });
    return (await page.locator("#doc").innerHTML())
      .replace(/mdmark-table-\d+/g, "mdmark-table")
      .replace(/ data-source-line="\d+"/g, "");
  };
  return [await html(first), await html(second)];
}

// 今の書き方のマーカーを、同じ設定の JSON の記載と同じに描き、記載の警告を出さない（正常シナリオ（今の書き方のマーカー））
test("test_normal_when_legacy_mark_args", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const body = (table: string, details: string): string =>
    [
      table,
      ...QUANTITY_TABLE,
      details,
      "",
      "実行の段落",
      "",
      "<!-- /details -->",
      "",
    ].join("\n");
  // 実行
  const [legacy, json] = await renderTwo(
    page,
    body(
      "<!-- table: data +total total=数量:sum -->",
      "<!-- details: 実行の例 open -->",
    ),
    body(
      '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}} -->',
      '<!-- details: {"title": "実行の例", "open": true} -->',
    ),
  );
  // 検証
  expect(legacy).toBe(json);
  expect(legacy).toContain("mdmark-table-total");
  expect(legacy).not.toContain("mdmark-syntax-warning");
  const details = page.locator("#doc details", { hasText: "実行の段落" });
  await expect(details.locator("summary")).toHaveText("実行の例");
  await expect(details).toHaveAttribute("open", "");
});

// 複数行に分けた JSON のマーカーを、1 行で記載したマーカーと同じに描く（正常シナリオ（複数行にまたがる JSON のマーカー））
test("test_normal_when_multiline_mark_args", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  const [multiline, oneLine] = await renderTwo(
    page,
    [
      "<!-- table: {",
      '"kind": "data",',
      '"columns": {"数量": {"total": [{"calc": "sum"}]}},',
      '"collapse": {"open": false, "title": "明細"}',
      "} -->",
      ...QUANTITY_TABLE,
    ].join("\n"),
    [
      '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}, "collapse": {"open": false, "title": "明細"}} -->',
      ...QUANTITY_TABLE,
    ].join("\n"),
  );
  // 検証
  expect(multiline).toBe(oneLine);
  const doc = page.locator("#doc");
  const fold = doc.locator("details", { has: page.locator("table") });
  await expect(fold.locator("summary").first()).toHaveText("明細");
  await expect(fold).not.toHaveAttribute("open", "");
  await fold.locator("summary").first().click();
  await expect(doc.locator(".mdmark-table-total")).toBeVisible();
  await expect(doc.locator(".mdmark-syntax-warning")).toHaveCount(0);
  const text = await doc.innerText();
  for (const absent of ["<!--", '"kind"', "} -->"]) {
    expect(text).not.toContain(absent);
  }
});

// JSON として読めない引数と型の合わない引数に記載の警告を出し、既定の設定で描く（異常シナリオ（JSON として読めないマーカーの引数））
test("test_error_when_mark_args_not_json", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- details: {"title": 補足} -->',
      "",
      "範囲の段落",
      "",
      "<!-- /details -->",
      "",
      '<!-- fig: {"id": 1} -->',
      "",
      '![構成](data:image/gif;base64,R0lGODlhAQABAAAAACw= "全体の構成")',
      "",
    ].join("\n"),
  });
  // 検証
  const doc = page.locator("#doc");
  const warnings = doc.locator(".mdmark-syntax-warning");
  await expect(warnings).toHaveCount(2);
  await expect(warnings.nth(0)).toContainText("JSON として読めません");
  await expect(warnings.nth(0)).toContainText("文字目");
  await expect(warnings.nth(1)).toContainText("id");
  await expect(warnings.nth(1)).toContainText("文字");
  const details = doc.locator("details", { hasText: "範囲の段落" });
  await expect(details.locator("summary")).toHaveText("詳細");
  await expect(details).not.toHaveAttribute("open", "");
  await expect(doc.locator("img[alt='構成']")).toHaveCount(1);
  await expect(doc).not.toContainText("図 1");
});
