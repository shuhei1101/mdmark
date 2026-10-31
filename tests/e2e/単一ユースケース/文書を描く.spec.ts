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

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 要素と Markdown を渡すと、要素の中に本文を描く（正常シナリオ）
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

// 未知の印を無視して、前後の段落を描く（正常シナリオ（未知の印がある））
test("test_normal_when_unknown_mark", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "前の段落\n\n<!-- unknown: 1 -->\n\n後の段落\n",
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator("p")).toHaveText(["前の段落", "後の段落"]);
  const html = await doc.innerHTML();
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("unknown");
});

// 文書に書いたスクリプトを落とし、リンクを押しても実行されない（正常シナリオ（文書にスクリプトがある））
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

// 用語 `ワークスペース` を持ち、文書 `api`（題 `API`）の `related` が描く文書 `arch` を指す索引
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

// `api` の本文（`arch` を参照する側）
const DOCUMENTS = { "設計/arch.md": "", "api.md": "# API\n" };

// 索引・文書の id・参照を渡すと用語に下線を引いて被参照の一覧を付け、本文を差し替えても同じ索引で描き直す（正常シナリオ（索引を渡す））
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

// 見出し・段落・表・コードブロックが元の行番号を持ち、見た目は元の行番号が無いときと同じ（正常シナリオ（元の行番号を出す））
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

// 読み込んだエイリアスを渡して描くと下線とツールチップが付き、本文を差し替えた後も同じエイリアスで描き直す（正常シナリオ（エイリアスを渡す））
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
