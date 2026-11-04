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
  await body.hover();
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await expectPanelShown(page, false);
});

/** 右端の線の上端の近くにポインターを置く（線は画面より高いため、locator の hover だとスクロールしてしまう） */
async function hoverRailTop(page: Page): Promise<void> {
  const box = await page.locator("#doc .mdmark-side-toc-rail").boundingBox();
  if (box === null) {
    throw new Error("右端の線が画面に無い");
  }
  await page.mouse.move(box.x + box.width / 2, Math.max(box.y, 0) + 8);
}

/** hover で開く目次の枠の上端に期待する位置: 画面の上端から --mdmark-sticky-top と --mdmark-space を足した位置（px） */
function expectedPanelTop(page: Page): Promise<number> {
  return page.locator("#doc").evaluate((doc) => {
    const probe = document.createElement("span");
    probe.style.marginTop =
      "calc(var(--mdmark-sticky-top, 0px) + var(--mdmark-space))";
    doc.append(probe);
    const top = Number.parseFloat(getComputedStyle(probe).marginTop);
    probe.remove();
    return top;
  });
}

/** 右側の目次の枠の上端（px） */
async function panelTop(page: Page): Promise<number> {
  const box = await sidePanel(page).boundingBox();
  if (box === null) {
    throw new Error("右側の目次の枠が無い");
  }
  return box.y;
}

// 文書の途中でも先頭でも、hover で開く目次を画面の上端寄りの同じ位置に出し、上端にはタイトルを置かず 3 つのボタンを並べる（正常シナリオ（文書の途中で右側の目次をホバーで出す））
test("test_normal_when_side_toc_hovered_after_scroll", async ({ page }) => {
  // 準備
  await mountSideToc(page);
  const expectedTop = await expectedPanelTop(page);
  // 実行: 「使い方」の節までスクロールし、右端にポインターを置く
  await page.locator('#doc [id="使い方"]').scrollIntoViewIfNeeded();
  await hoverRailTop(page);
  // 検証: 上端の構成
  await expectPanelShown(page, true);
  const head = sidePanel(page).locator(".mdmark-side-toc-head");
  await expect(head.locator("button")).toHaveCount(3);
  await expect(head.locator('[data-fold-all="open"]')).toHaveAttribute(
    "aria-label",
    "すべて展開",
  );
  await expect(head.locator('[data-fold-all="close"]')).toHaveAttribute(
    "aria-label",
    "すべて折りたたむ",
  );
  await expect(head.locator(".mdmark-side-toc-pin")).toHaveAttribute(
    "aria-label",
    "目次をピン止め",
  );
  await expect(head).not.toContainText("目次");
  // 検証: 文書の途中で開いた枠の上端
  expect(await panelTop(page)).toBeCloseTo(expectedTop, 0);
  // 実行: ポインターを本文へ動かし、文書の先頭まで戻って右端にポインターを置く
  await page.mouse.move(10, 400);
  await expectPanelShown(page, false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await hoverRailTop(page);
  // 検証: スクロールしたときと同じ位置
  await expectPanelShown(page, true);
  expect(await panelTop(page)).toBeCloseTo(expectedTop, 0);
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

// 表と重なる位置で右側の目次を出す文書: `## 導入` と `## 使い方` の間に、集計の行とピン止めした列を持つ 10 列 30 行の表
const SIDE_TOC_TABLE_MARKDOWN = [
  "## 導入",
  "",
  "導入の段落",
  "",
  FILLER,
  "<!-- table: data +total total=数量:sum pin=名前 -->",
  "",
  `| 名前 | 数量 | ${Array.from({ length: 8 }, (_, i) => `説明の長い列 ${i + 1}`).join(" | ")} |`,
  `|${" --- |".repeat(10)}`,
  ...Array.from(
    { length: 30 },
    (_, row) =>
      `| 品目 ${row + 1} | ${row + 1} | ${Array.from(
        { length: 8 },
        (_, col) => `折り返さない長さの値 ${row + 1}-${col + 1}`,
      ).join(" | ")} |`,
  ),
  "",
  "<!-- /table -->",
  "",
  "## 使い方",
  "",
  "使い方の段落",
  "",
  FILLER,
].join("\n");

// 表の見出し行を画面の上端に留めた位置で右端にポインターを置くと、右側の目次が表より手前に出て、項目で見出しへ移る（正常シナリオ（表と重なる位置で右側の目次をホバーで出す））
test("test_normal_when_side_toc_over_table", async ({ page }) => {
  // 準備
  await mountSideToc(page, { markdown: SIDE_TOC_TABLE_MARKDOWN });
  // 実行: 表の見出し行が画面の上端に留まるまでスクロールし、右端にポインターを置く
  await page
    .locator("#doc .mdmark-table table")
    .evaluate((table) =>
      window.scrollTo(
        0,
        table.getBoundingClientRect().top + window.scrollY + 300,
      ),
    );
  await hoverRailTop(page);
  // 検証: 枠の中のどの位置でも、最も手前の要素が右側の目次の中にある
  await expectPanelShown(page, true);
  const outside = await sidePanel(page).evaluate((panel) => {
    const aside = panel.closest("aside") as HTMLElement;
    const box = panel.getBoundingClientRect();
    const hits: string[] = [];
    for (let y = box.top + 4; y < box.bottom - 4; y += 16) {
      for (let x = box.left + 4; x < box.right - 4; x += 24) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !aside.contains(hit)) {
          hits.push(
            `${hit?.tagName ?? "null"}@${Math.round(x)},${Math.round(y)}`,
          );
        }
      }
    }
    return hits;
  });
  expect(outside).toEqual([]);
  // 検証: 右側の目次の z-index が、表の見出し行・集計の行・ピン止めした列のセルのどれより大きい
  const zIndexes = await page.locator("#doc").evaluate((doc) => {
    const z = (element: Element) => {
      const value = getComputedStyle(element).zIndex;
      return value === "auto" ? 0 : Number(value);
    };
    const cells = [
      ...doc.querySelectorAll(
        ".mdmark-table thead th, .mdmark-table tfoot td, .mdmark-table .is-pinned-col",
      ),
    ];
    return {
      aside: z(doc.querySelector("aside.mdmark-side-toc") as Element),
      cells: cells.length,
      cellMax: Math.max(...cells.map(z)),
    };
  });
  expect(zIndexes.cells).toBeGreaterThan(0);
  expect(zIndexes.aside).toBeGreaterThan(zIndexes.cellMax);
  // 実行・検証: 「使い方」を押す
  await sideLink(page, "使い方").click();
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#使い方");
});

// 文書の途中と末尾のどちらまでスクロールしても、右端の線と hover で開いた目次の上端が見えている枠の上端に留まる（正常シナリオ（文書の末尾までスクロールしても右側の目次の上端が見切れない））
test("test_normal_when_side_toc_scrolled_to_end", async ({ page }) => {
  for (const height of [800, 500]) {
    for (const where of ["box", "page"] as const) {
      // 準備: 画面の高さの 75% のスクロールする要素の中か、ページ全体のスクロールで描く
      await page.setViewportSize({ width: 1280, height });
      await openPage(page, builtRoot, {
        hostCss: "#doc { --mdmark-sticky-top: 48px; }",
      });
      if (where === "box") {
        await page.evaluate((boxHeight) => {
          const box = document.createElement("div");
          box.id = "box";
          box.style.cssText = `height: ${boxHeight}px; overflow-y: auto;`;
          document.body.append(box);
          box.append(document.getElementById("doc") as HTMLElement);
        }, height * 0.75);
      }
      await mountDocument(page, { markdown: SIDE_TOC_MARKDOWN });
      const expectedTop = await expectedPanelTop(page);
      const frame = () =>
        page.evaluate(() => {
          const box = document.getElementById("box");
          return box
            ? {
                top: box.getBoundingClientRect().top,
                bottom: box.getBoundingClientRect().bottom,
              }
            : { top: 0, bottom: document.documentElement.clientHeight };
        });
      const scrollTo = (ratio: number) =>
        page.evaluate((ratio) => {
          const scroller =
            document.getElementById("box") ?? document.documentElement;
          scroller.scrollTop =
            (scroller.scrollHeight - scroller.clientHeight) * ratio;
        }, ratio);
      const rail = page.locator("#doc .mdmark-side-toc-rail");
      for (const ratio of [0.5, 1]) {
        // 実行: 文書の途中・末尾までスクロールする
        await scrollTo(ratio);
        // 検証: 右端の線の上端が見えている枠の上端から --mdmark-sticky-top と --mdmark-space 下にあり、下端が枠に収まる
        const { top, bottom } = await frame();
        await expect
          .poll(async () => (await rail.boundingBox())?.y)
          .toBeCloseTo(top + expectedTop, 0);
        const box = await rail.boundingBox();
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(bottom);
      }
      // 実行・検証: 末尾で右端にポインターを置く
      await hoverRailTop(page);
      await expectPanelShown(page, true);
      expect(await panelTop(page)).toBeCloseTo(
        (await frame()).top + expectedTop,
        0,
      );
      await page.mouse.move(10, 10);
    }
  }
});
