import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { runCli, writeFiles } from "../cli.ts";
import { flowMarkdown } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { useVscodeE2E } from "../vscode.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 段落とリンクを持つ見本の Markdown（リンク 1 つだけの段落はカードにするため、文の中にリンクを配置する）
const MARKDOWN =
  "段落\n\n詳しくは [リンク](https://example.com/page) を見る。\n";

// デザイン方針の dev-swiss の値（明るい配色のリンクの色と、ダークの配色の地の色）
const LIGHT_LINK_COLOR = "rgb(15, 118, 110)";
const DARK_BACKGROUND = "rgb(19, 19, 22)";
const LIGHT_BACKGROUND = "rgb(255, 255, 255)";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 利用側が層の外に記載した CSS と変数の上書きが、mdmark の CSS に勝つ（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const hostCss =
    "a { text-decoration: none } .mdmark { --mdmark-color-link: rgb(255, 0, 0) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const link = page.locator("#doc a");
  await expect(link).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(link).toHaveCSS("text-decoration-line", "none");
});

// 何も上書きしなければ、既定の明るい配色で描く（正常シナリオ（上書きしない））
test("test_normal_when_not_overridden", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expect(page.locator("#doc a")).toHaveCSS("color", LIGHT_LINK_COLOR);
});

// OS の設定がダークのとき、ダークの配色で描く（正常シナリオ（ダークの配色））
test("test_normal_when_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    DARK_BACKGROUND,
  );
});

// 利用側が図の層の色の変数を上書きすると、その層のノードの縁・層の背景・凡例の色が変わる（正常シナリオ（図の色を変える））
test("test_normal_when_diagram", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  const hostCss = ".mdmark { --mdmark-color-diagram-llm: rgb(255, 0, 0) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, { markdown: await flowMarkdown() });
  // 検証: LLM の層のノードの縁が上書きした色になり、ほかの層は変わらない
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    "rgb(255, 0, 0)",
  );
  await expect(page.locator('#doc [data-node="mcp"]')).not.toHaveCSS(
    "border-top-color",
    "rgb(255, 0, 0)",
  );
  // LLM の層の背景は、上書きした色（赤）を薄く混ぜた色になる
  const background = await page
    .locator('#doc .mdmark-diagram-lane[data-kind="llm"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const [red = 0, green = 0, blue = 0] = (
    background.match(/[\d.]+/g) ?? []
  ).map(Number);
  expect(red).toBeGreaterThan(green);
  expect(red).toBeGreaterThan(blue);
});

// OS の配色がライトでも、祖先の `vscode-dark` でダークの配色で描き、class を削除すると戻す（正常シナリオ（親の class でダークにする））
test("test_normal_when_parent_class_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    document.body.className = "vscode-dark";
  });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc).toHaveCSS("background-color", DARK_BACKGROUND);
  await page.evaluate(() => {
    document.body.className = "vscode-light";
  });
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

// OS の配色がダークでも、祖先の `vscode-light` でライトの配色で描き、`mdmark-theme-light` は `vscode-dark` に勝つ（正常シナリオ（親の class でライトにする））
test("test_normal_when_parent_class_light", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    document.body.className = "vscode-light";
  });
  // 実行
  await mountDocument(page, { markdown: MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
  await page.evaluate(() => {
    document.body.className = "vscode-dark";
    document
      .getElementById("doc")
      ?.parentElement?.classList.add("mdmark-theme-light");
  });
  await expect(doc).toHaveCSS("background-color", LIGHT_BACKGROUND);
});

/** 3 列 60 行の表を、長い段落の間に配置した Markdown */
function layoutDocument(): string {
  const paragraph = `${"本文の長い段落です。".repeat(60)}\n`;
  const rows = Array.from(
    { length: 60 },
    (_, row) => `| 行${row + 1} | ${row + 1} | 値${row + 1} |`,
  );
  return [
    paragraph,
    "| 名前 | 数量 | 備考 |",
    "| --- | --- | --- |",
    ...rows,
    "",
    paragraph,
  ].join("\n");
}

// 利用側が見出し行を留める位置のずれと本文の幅を上書きすると、固定のヘッダーの下に見出し行が留まり、本文の幅が上限を超えない（正常シナリオ（見出し行の位置と本文の幅を変える））
test("test_normal_when_layout_overridden", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  const hostCss = [
    "body::before { content: ''; position: fixed; inset: 0 0 auto 0; height: 48px; background: rgb(200, 200, 200); z-index: 100 }",
    ".mdmark { --mdmark-sticky-top: 48px; --mdmark-content-width: 40rem }",
  ].join("\n");
  await openPage(page, builtRoot, { hostCss });
  await mountDocument(page, { markdown: layoutDocument() });
  // 検証: 本文の段落の幅が 40rem を超えない
  const paragraphWidth = (await page.locator("#doc > p").first().boundingBox())
    ?.width;
  expect(paragraphWidth).toBeLessThanOrEqual(640 + 0.5);
  expect(paragraphWidth).toBeGreaterThan(300);
  // 実行: 表の途中までページを縦にスクロールする
  const tableTop = await page
    .locator("#doc table")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await page.evaluate((top) => window.scrollTo(0, top), tableTop + 500);
  // 検証: 見出し行の上端が画面の上端から 48px の位置にあり、固定のヘッダーに隠れていない
  await expect
    .poll(async () =>
      page
        .locator("#doc thead th")
        .evaluateAll((cells) =>
          Math.max(
            ...cells.map((cell) =>
              Math.abs(cell.getBoundingClientRect().top - 48),
            ),
          ),
        ),
    )
    .toBeLessThanOrEqual(1);
});

// 何も上書きしないと、本文の幅に既定の上限が無く、画面を広げるとその幅を使用する（正常シナリオ（既定の本文の幅））
test("test_normal_when_content_width_default", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `${"本文の長い段落です。".repeat(400)}\n`,
  });
  /** 描く先の要素の中身の幅と、段落の幅 */
  const widths = async () =>
    await page.locator("#doc").evaluate((doc) => {
      const style = getComputedStyle(doc);
      return {
        content:
          doc.clientWidth -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight),
        paragraph: (doc.querySelector("p") as Element).getBoundingClientRect()
          .width,
      };
    });
  // 検証: 1280px のとき
  const narrow = await widths();
  expect(Math.abs(narrow.paragraph - narrow.content)).toBeLessThanOrEqual(1);
  // 実行: 画面の幅を 1920px に広げる
  await page.setViewportSize({ width: 1920, height: 800 });
  // 検証: 1920px のとき
  await expect
    .poll(async () => {
      const wide = await widths();
      return Math.abs(wide.paragraph - wide.content);
    })
    .toBeLessThanOrEqual(1);
  expect((await widths()).paragraph).toBeGreaterThan(narrow.paragraph);
});

// 選んだテーマの上から、利用側の CSS の上書きが勝ち、上書きしていない地の色は選んだテーマのまま（正常シナリオ（選んだテーマの上から上書きする））
test("test_normal_when_theme_selected", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  const hostCss = ".mdmark { --mdmark-color-link: rgb(255, 0, 0) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, {
    markdown: MARKDOWN,
    config: { colorTheme: "theme-slate" },
  });
  // 検証
  await expect(page.locator("#doc a")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    "rgb(248, 250, 252)",
  );
});

// 利用側が層の外で上書きした色のプリセットの CSS 変数で、バッジと本文の文字の色を描く（正常シナリオ（色のプリセットを上書きする））
test("test_normal_when_color_preset_overridden", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  const hostCss =
    ".mdmark { --mdmark-color-accent-blue-text: rgb(0, 0, 128); --mdmark-color-accent-blue-bg: rgb(230, 240, 255) }";
  await openPage(page, builtRoot, { hostCss });
  // 実行
  await mountDocument(page, {
    markdown: "`badge:blue:参考` と [決め手の 1 文]{color=blue}\n",
  });
  // 検証
  const badge = page.locator("#doc .mdmark-badge[data-color]");
  await expect(badge).toHaveText("参考");
  await expect(badge).toHaveCSS("color", "rgb(0, 0, 128)");
  await expect(badge).toHaveCSS("background-color", "rgb(230, 240, 255)");
  const text = page.locator("#doc .mdmark-color[data-color]");
  await expect(text).toHaveText("決め手の 1 文");
  await expect(text).toHaveCSS("color", "rgb(0, 0, 128)");
});

// 地を透明にし `--mdmark-color-bg-opaque` に周りの面の色を指定すると、本文の地は透け、表の端・図のツールチップ・全画面の図はその色で描く（正常シナリオ（地を透明にして周りの面の色を指定する））
test("test_normal_when_bg_transparent_with_opaque_color", async ({ page }) => {
  // 準備
  const surrounding = "rgb(240, 240, 240)";
  await page.emulateMedia({ colorScheme: "light" });
  const hostCss = `body { background: ${surrounding} } .mdmark { --mdmark-color-bg: transparent; --mdmark-color-bg-opaque: ${surrounding} }`;
  await openPage(page, builtRoot, { hostCss });
  const table =
    "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n| 7 | 8 | 9 |\n";
  // 実行
  await mountDocument(page, {
    markdown: `${table}\n${await flowMarkdown()}`,
  });
  // 検証: 本文の地は透ける
  await expect(page.locator("#doc")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  // 検証: 表の本文の行の高さの真ん中で、左右の枠の内側の画素が周りの面の色
  const tableBox = await page.locator("#doc table").boundingBox();
  const rowBox = await page.locator("#doc tbody tr").first().boundingBox();
  if (!tableBox || !rowBox) {
    throw new Error("表が描かれていない");
  }
  const y = rowBox.y + rowBox.height / 2;
  const pixels = await page.screenshot({
    clip: { x: tableBox.x, y: y - 1, width: tableBox.width, height: 2 },
    scale: "css",
  });
  const colors = await page.evaluate(
    async ({ data, right }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      return [2, right].map((x) => {
        const d = context?.getImageData(x, 0, 1, 1).data;
        return `rgb(${d?.[0]}, ${d?.[1]}, ${d?.[2]})`;
      });
    },
    {
      data: pixels.toString("base64"),
      right: Math.floor(tableBox.width) - 3,
    },
  );
  expect(colors).toEqual([surrounding, surrounding]);
  // 実行・検証: 図のツールチップ
  const label = page.locator("#doc .mdmark-diagram-label.has-tip").first();
  await label.hover();
  const tipId = await label.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${tipId}"]`)).toHaveCSS(
    "background-color",
    surrounding,
  );
  // 実行・検証: 全画面の図
  await page.mouse.move(0, 0);
  await page.locator('#doc button[aria-label="全画面で開く"]').first().click();
  await expect(page.locator("#doc dialog[open]")).toHaveCSS(
    "background-color",
    surrounding,
  );
});

// 利用側の pre への汎用の CSS があっても、マーカーの無いコードブロックとファイルツリーは折り返さず、wrap のブロックだけを折り返す（正常シナリオ（利用側の pre への汎用の CSS））
test("test_normal_when_host_pre_wraps", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  const markdown = [
    "```json",
    "{",
    '  "nodes": [{ "id": "a-very-long-identifier-for-the-node", "name": "とても長い名前の項目" }]',
    "}",
    "```",
    "",
    "```tree",
    "very-long-folder-name-for-the-generated-design-documents/",
    "└── a-file-name-that-is-much-longer-than-the-box-width-on-phones.config.ts",
    "```",
    "",
    '<!-- code: {"wrap": true} -->',
    "",
    "```ts",
    'const url = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js"; // 長い行',
    "```",
    "",
  ].join("\n");
  /** json の行の左端・ツリーの入れ子の線の左端と、はみ出しと white-space */
  const measure = () =>
    page.locator("#doc").evaluate((doc) => {
      const [json, ts] = [
        ...doc.querySelectorAll<HTMLElement>(".mdmark-code pre"),
      ];
      const list = doc.querySelector<HTMLElement>(".mdmark-tree-list");
      const nested = list?.querySelector("ul ul");
      return {
        jsonWhiteSpace: json ? getComputedStyle(json).whiteSpace : "",
        jsonOverflows: json ? json.scrollWidth > json.clientWidth : false,
        jsonLefts: [...(json?.querySelectorAll(".mdmark-code-text") ?? [])].map(
          (text) => Math.round(text.getBoundingClientRect().left),
        ),
        treeOverflows: list ? list.scrollWidth > list.clientWidth : false,
        nestedLeft:
          nested && list
            ? Math.round(
                nested.getBoundingClientRect().left -
                  list.getBoundingClientRect().left,
              )
            : -1,
        tsFits: ts ? ts.scrollWidth <= ts.clientWidth : false,
      };
    });
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown });
  const withoutHost = await measure();
  // 実行
  await openPage(page, builtRoot, {
    hostCss: "pre { white-space: pre-wrap; overflow-wrap: anywhere; }",
  });
  await mountDocument(page, { markdown });
  // 検証
  const withHost = await measure();
  expect(withHost.jsonWhiteSpace).toBe("pre");
  expect(withHost.jsonOverflows).toBe(true);
  expect(withHost.treeOverflows).toBe(true);
  expect(withHost.jsonLefts).toEqual(withoutHost.jsonLefts);
  expect(withHost.nestedLeft).toBe(withoutHost.nestedLeft);
  expect(withHost.tsFits).toBe(true);
});

test.describe("VS Code のプレビュー", () => {
  const e2e = useVscodeE2E();

  // theme の CSS で上書きしたリンクの色が、VS Code のプレビューと mdmark export の HTML の両方に該当する（正常シナリオ（VS Code のプレビューで上書きする））
  test("test_normal_when_vscode_preview", async ({ browser }) => {
    // 準備
    const files = {
      "mdmark.config.yaml": "theme: theme.css\n",
      "theme.css": ".mdmark { --mdmark-color-link: rgb(255, 0, 0) }\n",
      "guide.md": MARKDOWN,
    };
    const session = await e2e.launch({ files });
    await session.openFile("guide.md");
    // 実行
    await session.openPreviewWithShortcut();
    // 検証
    const frame = await session.frameWith(".mdmark a");
    await expect(frame.locator(".mdmark a").first()).toHaveCSS(
      "color",
      "rgb(255, 0, 0)",
    );
    const dir = join(session.workspaceDir, "..", "cli");
    await writeFiles(dir, files);
    expect((await runCli(builtRoot, ["export", "guide.md"], dir)).code).toBe(0);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(join(dir, "guide.html")).href);
    await expect(page.locator("article.mdmark a").first()).toHaveCSS(
      "color",
      "rgb(255, 0, 0)",
    );
    await page.close();
  });
});
