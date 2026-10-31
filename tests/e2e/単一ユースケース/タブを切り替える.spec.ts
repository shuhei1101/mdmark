import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 2 つの見出しを持つタブの範囲
const TABS_MARKDOWN = [
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "macOS の段落",
  "",
  "### Windows",
  "",
  "Windows の段落",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 見出しの文字をタブ名にしたタブを描き、押したタブの中身だけを出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TABS_MARKDOWN });
  const mac = page.getByRole("tab", { name: "macOS" });
  const windows = page.getByRole("tab", { name: "Windows" });
  // 検証: 描いた直後
  await expect(mac).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("macOS の段落")).toBeVisible();
  await expect(page.getByText("Windows の段落")).toBeHidden();
  // 実行
  await windows.click();
  // 検証
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Windows の段落")).toBeVisible();
  await expect(page.getByText("macOS の段落")).toBeHidden();
  await expect(page.locator("#doc h3")).toHaveCount(0);
});

// 右矢印キーで次のタブを選び、フォーカスも移る（正常シナリオ（キーボードで切り替える））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TABS_MARKDOWN });
  await page.getByRole("tab", { name: "macOS" }).focus();
  // 実行
  await page.keyboard.press("ArrowRight");
  // 検証
  const windows = page.getByRole("tab", { name: "Windows" });
  await expect(windows).toBeFocused();
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Windows の段落")).toBeVisible();
  await expect(page.getByText("macOS の段落")).toBeHidden();
});

// 見出しの無い範囲は、中身をそのまま描き、書き方の警告を出す（異常シナリオ（見出しの無い範囲））
test("test_error_when_no_heading", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "<!-- tabs -->\n\n見出しの無い段落\n\n<!-- /tabs -->\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "見出し",
  );
  await expect(page.getByText("見出しの無い段落")).toBeVisible();
  await expect(page.locator("#doc [role=tablist]")).toHaveCount(0);
});

/** `<!-- tabs -->`（`options` があれば `<!-- tabs: {options} -->`）で、名前のタブを段落つきで囲んだ範囲 */
function tabsRange(titles: string[], options?: string): string {
  return [
    options === undefined ? "<!-- tabs -->" : `<!-- tabs: ${options} -->`,
    "",
    ...titles.flatMap((title) => [`### ${title}`, "", `${title} の段落`, ""]),
    "<!-- /tabs -->",
    "",
  ].join("\n");
}

/** 描いた文書の `index` 番目のタブ群 */
function tabGroup(page: Page, index: number): Locator {
  return page.locator("#doc .mdmark-tabs").nth(index);
}

/** タブ群が名前のタブを選び、その段落だけを表示している */
async function expectSelected(
  group: Locator,
  name: string,
  others: string[],
): Promise<void> {
  await expect(group.getByRole("tab", { name })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(group.getByText(`${name} の段落`)).toBeVisible();
  for (const other of others) {
    await expect(group.getByText(`${other} の段落`)).toBeHidden();
  }
}

/** `before` の要素が文書の中で `after` の要素より前にある */
async function expectBefore(before: Locator, after: Locator): Promise<void> {
  const handle = await after.elementHandle();
  const result = await before.evaluate(
    (a, b) =>
      Boolean(
        a.compareDocumentPosition(b as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    handle,
  );
  expect(result).toBe(true);
}

// 同じ組のタブの選択を揃える（正常シナリオ（同じ組のタブの選択を揃える））
test("test_normal_when_same_group", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      tabsRange(["macOS", "Windows"], "group=os"),
      tabsRange(["macOS", "Windows"], "group=os"),
      tabsRange(["macOS", "Linux"], "group=os"),
      tabsRange(["macOS", "Windows"]),
    ].join("\n"),
  });
  for (const index of [0, 1, 2, 3]) {
    await expect(
      tabGroup(page, index).getByRole("tab", { name: "macOS" }),
    ).toHaveAttribute("aria-selected", "true");
  }
  // 実行
  const windows = tabGroup(page, 0).getByRole("tab", { name: "Windows" });
  await windows.click();
  // 検証
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 1), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 2), "macOS", ["Linux"]);
  await expectSelected(tabGroup(page, 3), "macOS", ["Windows"]);
  await expect(windows).toBeFocused();
});

// 読み直したとき、選んだタブで開き、URL の ID を付けて読み直すと、覚えたタブより URL の ID のタブを優先する（正常シナリオ（読み直して選んだタブで開く））
test("test_normal_when_reloaded", async ({ page }) => {
  // 準備
  const markdown = [
    [
      "<!-- tabs: group=os -->",
      "",
      "### macOS",
      "",
      "#### macOS の注意",
      "",
      "macOS の段落",
      "",
      "### Windows",
      "",
      "Windows の段落",
      "",
      "<!-- /tabs -->",
      "",
    ].join("\n"),
    tabsRange(["macOS", "Windows"]),
  ].join("\n");
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown });
  await tabGroup(page, 0).getByRole("tab", { name: "Windows" }).click();
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  // 実行: ページを読み直し、同じ Markdown を描かせる
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mountDocument(page, { markdown });
  // 検証
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 1), "macOS", ["Windows"]);
  // 実行: URL の末尾に #macos-の注意 を付けて読み直し、同じ Markdown を描かせる
  await page.evaluate(() => {
    location.hash = "#macos-の注意";
  });
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mountDocument(page, { markdown });
  // 検証: 覚えた Windows より URL の ID を優先し、macOS の見出しが画面に入っている
  await expectSelected(tabGroup(page, 0), "macOS", ["Windows"]);
  await expect(page.locator('#doc [id="macos-の注意"]')).toBeInViewport();
});

// localStorage が使えなくても、同じ組のタブを揃えて切り替える（異常シナリオ（選んだタブを覚えられない））
test("test_error_when_storage_unavailable", async ({ page }) => {
  // 準備: ページを開く前に、localStorage を読むと例外を投げるようにする
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      tabsRange(["macOS", "Windows"], "group=os"),
      tabsRange(["macOS", "Windows"], "group=os"),
    ].join("\n"),
  });
  // 検証: 描いた直後
  await expectSelected(tabGroup(page, 0), "macOS", ["Windows"]);
  await expectSelected(tabGroup(page, 1), "macOS", ["Windows"]);
  // 実行
  await tabGroup(page, 0).getByRole("tab", { name: "Windows" }).click();
  // 検証
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 1), "Windows", ["macOS"]);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 値の無い group は、書き方の警告を出して組を持たないタブにする（異常シナリオ（値の無い group））
test("test_error_when_empty_group", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      tabsRange(["macOS", "Windows"], "group="),
      tabsRange(["macOS", "Windows"]),
    ].join("\n"),
  });
  await tabGroup(page, 0).getByRole("tab", { name: "Windows" }).click();
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("group=");
  await expect(warning).toContainText("組の名前がありません");
  await expectBefore(warning, tabGroup(page, 0));
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 1), "macOS", ["Windows"]);
});

// 知らないキーと指定は、書き方の警告を出して読めた指定だけで描く（異常シナリオ（知らないタブの指定））
test("test_error_when_unknown_option", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      tabsRange(["macOS", "Windows"], "grop=os"),
      tabsRange(["macOS", "Windows"], "group=os fold"),
    ].join("\n"),
  });
  await tabGroup(page, 0).getByRole("tab", { name: "Windows" }).click();
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(2);
  await expect(warnings.nth(0)).toContainText("grop=");
  await expect(warnings.nth(0)).toContainText("使えないキーです");
  await expect(warnings.nth(1)).toContainText("fold");
  await expect(warnings.nth(1)).toContainText("使えない指定です");
  await expectBefore(warnings.nth(0), tabGroup(page, 0));
  await expectBefore(tabGroup(page, 0), warnings.nth(1));
  await expectBefore(warnings.nth(1), tabGroup(page, 1));
  await expect(page.locator("#doc [role=tablist]")).toHaveCount(2);
  await expectSelected(tabGroup(page, 0), "Windows", ["macOS"]);
  await expectSelected(tabGroup(page, 1), "macOS", ["Windows"]);
});

// `closed`・`open`・`title=` のタブ群を、見出し付きの折り畳みに入れ、閉じたタブ群は見出しを押すと開き、開いたタブも切り替えられる（正常シナリオ（折りたたみに入れたタブ））
test("test_normal_when_folded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      tabsRange(["uv", "pip"], "closed"),
      tabsRange(["macOS", "Windows"], "open title=入れ方"),
    ].join("\n"),
  });
  const folds = page.locator("#doc details.mdmark-collapsible");
  // 検証: 描いた直後
  await expect(folds.nth(0).locator("summary")).toHaveText("タブ（uv・pip）");
  await expect(folds.nth(0).locator("[role=tablist]")).toBeHidden();
  await expect(folds.nth(0).getByText("uv の段落")).toBeHidden();
  await expect(folds.nth(1).locator("summary")).toHaveText("入れ方");
  await expectSelected(tabGroup(page, 1), "macOS", ["Windows"]);
  // 実行: 1 つ目の見出しを押し、pip のタブを押す
  await folds.nth(0).locator("summary").click();
  // 検証
  await expectSelected(tabGroup(page, 0), "uv", ["pip"]);
  // 実行
  await tabGroup(page, 0).getByRole("tab", { name: "pip" }).click();
  // 検証
  await expectSelected(tabGroup(page, 0), "pip", ["uv"]);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// closed と open を両方書くと、書き方の警告を出し、closed を当てた閉じた折り畳みにする（異常シナリオ（closed と open を両方書いたタブ））
test("test_error_when_closed_and_open", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: tabsRange(["macOS", "Windows"], "closed open"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("closed");
  await expect(warning).toContainText("open");
  const fold = page.locator("#doc details.mdmark-collapsible");
  await expect(fold).not.toHaveAttribute("open", "");
  await expect(fold.locator("summary")).toHaveText("タブ（macOS・Windows）");
  await expect(fold.locator("[role=tablist]")).toBeHidden();
});
