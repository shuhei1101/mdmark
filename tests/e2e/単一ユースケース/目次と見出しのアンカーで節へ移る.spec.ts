import { expect, type Locator, type Page, test } from "@playwright/test";
import type { MdmarkConfig } from "../../../src/index.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 画面より長い文書（目次の印と 3 つの見出し）
const LONG_MARKDOWN = [
  "<!-- toc -->",
  "",
  "## 導入",
  "",
  "導入の段落",
  "",
  "余白\n\n".repeat(30),
  "### 前提",
  "",
  "前提の段落",
  "",
  "余白\n\n".repeat(30),
  "## 使い方",
  "",
  "使い方の段落",
  "",
  "余白\n\n".repeat(30),
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 見出しに ID とリンクを付け、目次を置き、目次を押すと節へ移る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 400 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: LONG_MARKDOWN });
  // 検証: 目次
  const toc = page.locator("#doc nav.mdmark-toc");
  await expect(toc.locator("a")).toHaveText(["導入", "前提", "使い方"]);
  expect(
    await toc
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(["#導入", "#前提", "#使い方"]);
  await expect(toc.locator("li li a")).toHaveText("前提");
  // 検証: 見出しのリンク
  for (const [id, label] of [
    ["導入", "導入"],
    ["前提", "前提"],
    ["使い方", "使い方"],
  ]) {
    const heading = page.locator(`#doc [id="${id}"]`);
    await expect(heading).toHaveText(label);
    await expect(heading.locator("a.mdmark-anchor")).toHaveAttribute(
      "href",
      `#${id}`,
    );
  }
  // 実行: 目次の「使い方」を押す
  await toc.locator("a", { hasText: "使い方" }).click();
  // 検証
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#使い方");
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
});

// 見出しの ID を、記号を除き小文字にして、同じ文字には通し番号を付ける GitHub と同じ規則で付ける（正常シナリオ（GitHub と同じ規則の ID））
test("test_normal_when_github_ids", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "## Hello, World!\n\n## 使い方\n\n## 使い方\n",
  });
  // 検証
  const ids = await page
    .locator("#doc h2")
    .evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(ids).toEqual(["hello-world", "使い方", "使い方-1"]);
});

// URL に節の ID を付けて開くと、描いた後にその見出しへ移る（正常シナリオ（URL に節の ID を付けて開く））
test("test_normal_when_opened_with_fragment", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 400 });
  await openPage(page, builtRoot, { hash: "#使い方" });
  // 実行
  await mountDocument(page, { markdown: LONG_MARKDOWN });
  // 検証
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
});

/** 長い段落の後に、閉じた節の中の 2 つのタブが、それぞれ見出しを持つ Markdown */
const FRAGMENT_TAB_MARKDOWN = [
  ...Array.from({ length: 30 }, (_, i) => `前の段落 ${i + 1}\n`),
  "## 導入",
  "<!-- section: closed -->",
  "",
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "#### macOS の注意",
  "",
  "macOS の段落",
  "",
  "### Windows",
  "",
  "#### Windows の注意",
  "",
  "Windows の段落",
  "",
  "<!-- /tabs -->",
  "",
  ...Array.from({ length: 30 }, (_, i) => `後の段落 ${i + 1}\n`),
].join("\n");

// URL の ID が選ばれていないタブの中の見出しを指すと、外側の節を開き、そのタブを選んでから見出しへ移り、`#ID` を変えるとタブも切り替わる（正常シナリオ（タブの中の見出しへ移る））
test("test_normal_when_fragment_in_tab", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 400 });
  await openPage(page, builtRoot, { hash: "#windows-の注意" });
  // 実行
  await mountDocument(page, { markdown: FRAGMENT_TAB_MARKDOWN });
  // 検証: 節が開き、Windows のタブを選んで、見出しが画面に入っている
  const section = page.locator('#doc button[aria-controls="section-導入"]');
  const mac = page.getByRole("tab", { name: "macOS" });
  const windows = page.getByRole("tab", { name: "Windows" });
  await expect(section).toHaveAttribute("aria-expanded", "true");
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('#doc [id="windows-の注意"]')).toBeInViewport();
  await expect(page.getByText("Windows の段落")).toBeVisible();
  await expect(page.getByText("macOS の段落")).toBeHidden();
  // 実行: URL の #ID を変える
  await page.evaluate(() => {
    location.hash = "#macos-の注意";
  });
  // 検証: macOS のタブを選んで、見出しが画面に入っている
  await expect(mac).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('#doc [id="macos-の注意"]')).toBeInViewport();
  await expect(page.getByText("macOS の段落")).toBeVisible();
  await expect(page.getByText("Windows の段落")).toBeHidden();
});

/** 画面より長くなる余白の段落 */
const FILLER = "余白\n\n".repeat(30);

/** 見出しを持つ画面より長い Markdown: `# 手引き`・`## 導入`・`### 前提`・`## 使い方` と、それぞれの段落（`<!-- toc -->` は書かない） */
const SIDE_TOC_MARKDOWN = [
  "# 手引き",
  "",
  "手引きの段落",
  "",
  FILLER,
  "## 導入",
  "",
  "導入の段落",
  "",
  FILLER,
  "### 前提",
  "",
  "前提の段落",
  "",
  FILLER,
  "## 使い方",
  "",
  "使い方の段落",
  "",
  FILLER,
].join("\n");

/** 右側の目次のパネルを引く */
function sidePanel(page: Page): Locator {
  return page.locator("#doc aside.mdmark-side-toc .mdmark-side-toc-panel");
}

/** パネルが出ているか（hover の出し方は透明にして隠すため、不透明度で見る） */
async function expectPanelShown(page: Page, shown: boolean): Promise<void> {
  await expect(sidePanel(page)).toHaveCSS("opacity", shown ? "1" : "0");
}

/** 右側の目次の項目を、見出しの ID で引く */
function sideLink(page: Page, id: string): Locator {
  return sidePanel(page).locator(`a[data-heading-id="${id}"]`);
}

/** 広い画面で右側の目次を持つ文書を描く */
async function mountSideToc(
  page: Page,
  options: { config?: MdmarkConfig; markdown?: string; width?: number } = {},
): Promise<void> {
  await page.setViewportSize({ width: options.width ?? 1280, height: 800 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: options.markdown ?? SIDE_TOC_MARKDOWN,
    config: options.config,
  });
}

// 見出しの無い文書には右側の目次も目次を出すボタンも置かない（正常シナリオ（見出しの無い文書））
test("test_normal_when_no_headings", async ({ page }) => {
  // 準備・実行
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: "段落だけの文書\n" });
  // 検証
  await expect(page.locator("#doc .mdmark-side-toc")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-side-toc-toggle")).toHaveCount(0);
  await expect(page.locator("#doc p")).toHaveText("段落だけの文書");
});

// 右端にポインターを置くと右側の目次が出て、項目で見出しへ移り、ポインターを本文へ動かすと隠れる（正常シナリオ（右側の目次をホバーで出す））
test("test_normal_when_side_toc_hovered", async ({ page }) => {
  // 準備
  await mountSideToc(page);
  // 検証: 描いた直後
  await expectPanelShown(page, false);
  await expect(page.locator("#doc nav.mdmark-toc")).toHaveCount(0);
  // 実行: 右端にポインターを置く
  await page.locator("#doc .mdmark-side-toc-rail").hover();
  // 検証
  await expectPanelShown(page, true);
  await expect(sidePanel(page).locator(".mdmark-side-toc-list a")).toHaveText([
    "手引き",
    "導入",
    "前提",
    "使い方",
  ]);
  expect(
    await sidePanel(page)
      .locator(".mdmark-side-toc-list a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(["#手引き", "#導入", "#前提", "#使い方"]);
  await expect(sideLink(page, "手引き").locator("xpath=../ul/li/a")).toHaveText(
    ["導入", "使い方"],
  );
  await expect(sideLink(page, "導入").locator("xpath=../ul/li/a")).toHaveText(
    "前提",
  );
  // 実行: 「使い方」を押し、ポインターを本文へ動かす
  await sideLink(page, "使い方").click();
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#使い方");
  await page.locator("#doc .mdmark-content p").first().hover();
  // 検証
  await expectPanelShown(page, false);
});

// ピン止めすると、ポインターを本文へ動かしても右側の目次が出続け、外すと隠れる（正常シナリオ（右側の目次をピン止めする））
test("test_normal_when_side_toc_pinned", async ({ page }) => {
  // 準備
  await mountSideToc(page);
  const pin = page.locator("#doc .mdmark-side-toc-pin");
  const body = page.locator("#doc .mdmark-content p").first();
  await page.locator("#doc .mdmark-side-toc-rail").hover();
  await expectPanelShown(page, true);
  // 実行・検証: ピン止めして、ポインターを本文へ動かす
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await body.hover();
  await expectPanelShown(page, true);
  // 実行・検証: もう一度押して、ポインターを本文へ動かす
  await pin.hover();
  await pin.click();
  // ピン止めのボタンにフォーカスが残るとパネルが出続けるため、フォーカスを外してからポインターを動かす
  await pin.evaluate((button) => button.blur());
  await body.hover();
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await expectPanelShown(page, false);
});

// fixed は目次を出すボタンで開閉し、右端にポインターを置いても出ない（正常シナリオ（右側の目次をサイドバーで出す））
test("test_normal_when_side_toc_fixed", async ({ page }) => {
  // 準備
  await mountSideToc(page, { config: { "side-toc": { mode: "fixed" } } });
  const toggle = page.locator("#doc .mdmark-side-toc-toggle");
  const body = page.locator("#doc .mdmark-content p").first();
  // 検証: 描いた直後
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel(page)).toBeHidden();
  // 実行・検証: 右端にポインターを置く
  await page.locator("#doc .mdmark-side-toc").hover();
  await expect(sidePanel(page)).toBeHidden();
  // 実行・検証: 目次を出すボタンを押す
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel(page)).toBeVisible();
  await body.hover();
  await expect(sidePanel(page)).toBeVisible();
  // 実行・検証: もう一度押す
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel(page)).toBeHidden();
});

// Tab でフォーカスを右側の目次へ移すと出て、Enter で見出しへ移り、フォーカスが外へ出ると隠れる（正常シナリオ（キーボードで右側の目次を出す））
test("test_normal_when_side_toc_focused", async ({ page }) => {
  // 準備
  await mountSideToc(page);
  const aside = page.locator("#doc aside.mdmark-side-toc");
  const inAside = () =>
    page.evaluate(() =>
      document
        .querySelector("#doc aside.mdmark-side-toc")
        ?.contains(document.activeElement),
    );
  // 実行・検証: Tab でフォーカスを右側の目次の項目へ移す
  for (let i = 0; i < 60 && !(await inAside()); i += 1) {
    await page.keyboard.press("Tab");
  }
  expect(await inAside()).toBe(true);
  await expectPanelShown(page, true);
  // 実行・検証: 「使い方」へ Tab で移り、Enter で押す
  for (let i = 0; i < 20; i += 1) {
    const id = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-heading-id"),
    );
    if (id === "使い方") {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#使い方");
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
  // 実行・検証: フォーカスを右側の目次の外へ移す
  await aside.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expectPanelShown(page, false);
});

// スクロールの位置で、今いる節の項目だけをハイライトする（正常シナリオ（今いる節をハイライトする））
test("test_normal_when_current_section_highlighted", async ({ page }) => {
  // 準備
  await mountSideToc(page, { config: { "side-toc": { mode: "fixed" } } });
  await page.locator("#doc .mdmark-side-toc-toggle").click();
  const current = sidePanel(page).locator('a[aria-current="location"]');
  const scrollTo = (id: string) =>
    page.evaluate((target) => {
      document.getElementById(target)?.scrollIntoView();
    }, id);
  // 検証: 描いた直後
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("data-heading-id", "手引き");
  // 実行・検証: 「使い方」の節までスクロールする
  await scrollTo("使い方");
  await expect(current).toHaveAttribute("data-heading-id", "使い方");
  await expect(current).toHaveCount(1);
  // 実行・検証: 「前提」の節まで戻る
  await scrollTo("前提");
  await expect(current).toHaveAttribute("data-heading-id", "前提");
  await expect(current).toHaveCount(1);
});

// 閉じた節の中の見出しの項目を押すと、節を開いてから見出しへ移る（正常シナリオ（右側の目次から閉じた節の中へ移る））
test("test_normal_when_side_toc_into_closed_section", async ({ page }) => {
  // 準備
  await mountSideToc(page, {
    markdown: [
      FILLER,
      "## 補足",
      "<!-- section: closed -->",
      "",
      "### 注意",
      "",
      "注意の段落",
      "",
      FILLER,
    ].join("\n"),
  });
  await expect(sideLink(page, "注意")).toHaveCount(1);
  await page.locator("#doc .mdmark-side-toc-rail").hover();
  // 実行
  await sideLink(page, "注意").click();
  // 検証
  await expect(
    page.locator('#doc button[aria-controls="section-補足"]'),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('#doc [id="注意"]')).toBeInViewport();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#注意");
});

// 知らない出し方は hover として描き、右端にポインターを置くと出る（異常シナリオ（知らない出し方））
test("test_error_when_unknown_side_toc_mode", async ({ page }) => {
  // 準備・実行
  await mountSideToc(page, { config: { "side-toc": { mode: "left" } } });
  // 検証
  await expect(page.locator("#doc .mdmark-side-toc")).toHaveCount(1);
  await expectPanelShown(page, false);
  await expect(page.locator("#doc .mdmark-side-toc-toggle")).toBeHidden();
  await page.locator("#doc .mdmark-side-toc-rail").hover();
  await expectPanelShown(page, true);
  await expect(page.locator("#doc h1")).toContainText("手引き");
});

// 狭い幅では、本文の上端の帯の目次を出すボタンから右側の目次を開き、項目を押すと閉じる（正常シナリオ（狭い幅で右側の目次を出す））
test("test_normal_when_side_toc_in_narrow_width", async ({ page }) => {
  // 準備
  await mountSideToc(page, { width: 390 });
  const toggle = page.locator("#doc .mdmark-side-toc-toggle");
  // 検証: 描いた直後
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const firstParagraph = page.locator("#doc .mdmark-content p").first();
  const covered = () =>
    firstParagraph.evaluate((p) => {
      const box = p.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + 4, box.top + 4);
      return top !== null && !p.contains(top);
    });
  expect(await covered()).toBe(false);
  // 実行・検証: 目次を出すボタンを押す
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel(page)).toBeVisible();
  const box = await sidePanel(page).boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  // 実行・検証: 「使い方」を押す
  await sideLink(page, "使い方").click();
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
  // 検証: 目次が閉じ、本文が覆われていない
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel(page)).toBeHidden();
  const usage = page.locator("#doc p", { hasText: "使い方の段落" });
  expect(
    await usage.evaluate((p) => {
      const box = p.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + 4, box.top + 4);
      return top !== null && !p.contains(top);
    }),
  ).toBe(false);
});
