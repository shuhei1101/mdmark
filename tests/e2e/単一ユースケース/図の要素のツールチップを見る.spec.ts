import { expect, type Page, test } from "@playwright/test";
import { hintFlowMarkdown, NODE_HINT, wrapHtml } from "../chart.ts";
import { flowMarkdown, TERM_INDEX } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// ツールチップを離れたポインターが、ツールチップの上へ移る間に閉じるのを待つ時間（ミリ秒）より長く待つ
const CLOSE_WAIT_MS = 500;

// `data-hint` の文
const BLOCK_HINT = "返信の種類を 1 つ選ぶ";

// 先に Tab を押す回数の上限
const MAX_TABS = 10;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 図を描いたページを開く。`withTerm` なら、索引を渡し、図の外の段落にも用語を書く */
async function openFlow(page: Page, withTerm = false): Promise<void> {
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: withTerm
      ? `${await flowMarkdown()}\n図の外の意思決定モデル。\n`
      : await flowMarkdown(),
    ...(withTerm ? { index: TERM_INDEX } : {}),
  });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

// 矢印のラベルにポインターを乗せると入力の詳細が出て、ツールチップの上へ動かしても消えず、箱の上で入力・処理・出力が出る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openFlow(page);
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  // 実行: 矢印にポインターを乗せる
  await label.hover();
  // 検証: 入力の詳細を書いたツールチップが出る
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送り主のアドレス",
  });
  await expect(wireTip).toBeVisible();
  // 実行・検証: ツールチップの上へポインターを動かしても消えない
  await wireTip.hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  await expect(wireTip).toBeVisible();
  // 実行: LLM の箱の印の外（箱の名前）にポインターを乗せる
  const ioTip = page.locator('[role="tooltip"]', { hasText: "入力" }).filter({
    hasText: "保存のツールを呼ぶ",
  });
  await page.locator('[data-node="draft"] .mdmark-diagram-node-name').hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ず、ポインターの形は変わらない
  await expect(ioTip).toBeHidden();
  expect(
    await page
      .locator('[data-node="draft"]')
      .evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 実行: LLM の箱の右上の印にポインターを乗せる
  await page.locator('[data-node="draft"] .mdmark-diagram-info').hover();
  // 検証: 入力・処理・出力のツールチップが出る
  await expect(ioTip).toBeVisible();
  await expect(ioTip.locator("dt")).toHaveText(["入力", "処理", "出力"]);
  // ツールチップを持つ箱には印があり、持たない箱には無い
  await expect(
    page.locator('[data-node="draft"] .mdmark-diagram-info'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-info'),
  ).toHaveCount(0);
});

// Tab で矢印のラベルにフォーカスするとツールチップが出て、Esc で消えてフォーカスはラベルに残る（正常シナリオ（キーボード））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openFlow(page);
  await page.locator("#doc").evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  // 実行: Tab でツールチップを持つ矢印のラベルにフォーカスする
  for (let count = 0; count < 40; count += 1) {
    await page.keyboard.press("Tab");
    const reached = await page.evaluate(
      () =>
        document.activeElement?.classList.contains("mdmark-diagram-label") ??
        false,
    );
    if (reached) {
      break;
    }
  }
  const label = page.locator(".mdmark-diagram-label.has-tip:focus");
  await expect(label).toHaveCount(1);
  // 検証: ツールチップが出て、ラベルの aria-describedby がそれを指す
  const tipId = await label.getAttribute("aria-describedby");
  expect(tipId).toBeTruthy();
  const tip = page.locator(`[role="tooltip"][id="${tipId}"]`);
  await expect(tip).toBeVisible();
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証: ツールチップが消え、フォーカスはラベルに残る
  await expect(tip).toBeHidden();
  await expect(label).toBeFocused();
});

// 箱の中の用語に本文と同じ破線の下線が引かれ、ポインターで用語集の意味が本文の用語と同じ見た目で出る（正常シナリオ（箱の中の用語））
test("test_normal_when_term", async ({ page }) => {
  // 準備
  await openFlow(page, true);
  const inBox = page.locator("#doc .mdmark-diagram-node .mdmark-term").first();
  const outside = page.locator("#doc > p .mdmark-term");
  // 検証: 下線
  await expect(inBox).toHaveText("意思決定モデル");
  await expect(inBox).toHaveCSS("text-decoration-style", "dashed");
  await expect(outside).toHaveCSS("text-decoration-style", "dashed");
  // 実行: 箱の中の用語にポインターを乗せる
  await inBox.hover();
  // 検証: 用語集の意味のツールチップが出る
  const tipId = await inBox.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("選択肢から選ぶだけの、速く安い判断用の AI");
  // 本文の用語のツールチップと同じ見た目（文字の大きさ・角丸）
  await outside.hover();
  const outsideTip = page.locator("#doc > p .mdmark-term-tip").first();
  await expect(outsideTip).toBeVisible();
  const looks = (locator: typeof tip) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.fontSize}|${style.borderTopLeftRadius}`;
    });
  expect(await looks(tip)).toBe(await looks(outsideTip));
});

// `data-hint` の箱の右上の印にポインターを乗せるかフォーカスすると文のツールチップが出て、印の外では出ず、Esc で消えてフォーカスは印に残る（正常シナリオ（埋め込んだ HTML の data-hint））
test("test_normal_when_data_hint", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapHtml(
      [
        `<div data-hint="${BLOCK_HINT}" style="padding: 1rem 2rem">ヒントのある箱</div>`,
        '<div style="padding: 1rem 2rem">ヒントの無い箱</div>',
      ].join("\n"),
    ),
  });
  const block = page.locator("#doc .mdmark-hint-block");
  const mark = block.locator(".mdmark-hint-mark");
  const tip = page.locator('[role="tooltip"]', { hasText: BLOCK_HINT });
  // 検証: ヒントを持つ箱には印があり、持たない箱には無い
  await expect(block).toHaveCount(1);
  await expect(mark).toHaveCount(1);
  await expect(
    page
      .locator("#doc .mdmark-html div", { hasText: "ヒントの無い箱" })
      .locator(".mdmark-hint-mark"),
  ).toHaveCount(0);
  // 実行: 印の外にポインターを乗せる
  await block.hover({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ず、ポインターの形は変わらない
  await expect(tip).toBeHidden();
  expect(
    await block.evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 実行: 印にポインターを乗せる
  await mark.hover();
  // 検証: 図のツールチップと同じ class の、文を書いたツールチップが出る
  await expect(tip).toBeVisible();
  await expect(tip).toHaveClass(/mdmark-diagram-tip/);
  await expect(tip).toHaveText(BLOCK_HINT);
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  // 実行: Tab で印にフォーカスする
  for (let count = 0; count < MAX_TABS; count += 1) {
    await page.keyboard.press("Tab");
    if (await mark.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  // 検証: 印の aria-describedby がツールチップを指す
  await expect(mark).toBeFocused();
  await expect(tip).toBeVisible();
  await expect(mark).toHaveAttribute("aria-describedby", /.+/);
  const tipId = await tip.getAttribute("id");
  await expect(mark).toHaveAttribute("aria-describedby", tipId ?? "");
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証: ツールチップが消え、フォーカスは印に残る
  await expect(tip).toBeHidden();
  await expect(mark).toBeFocused();
});

// io を持たず hint だけを持つ箱の右上の印にポインターを乗せると、見出しの無い hint の文が出る（正常シナリオ（箱の hint））
test("test_normal_when_node_hint", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: await hintFlowMarkdown() });
  const info = page.getByRole("button", { name: "「窓口の MCP」の説明" });
  const tip = page.locator('[role="tooltip"]', { hasText: NODE_HINT });
  // 検証: hint を持つ箱には、ツールチップを持つ箱の印がある
  await expect(info).toHaveCount(1);
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-info'),
  ).toHaveCount(1);
  // 実行: 箱の名前（印の外）にポインターを乗せる
  await page.locator('[data-node="mcp"] .mdmark-diagram-node-name').hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ない
  await expect(tip).toBeHidden();
  // 実行: 右上の印にポインターを乗せる
  await info.hover();
  // 検証: hint の文だけのツールチップが出る
  await expect(tip).toBeVisible();
  await expect(tip.locator("dt")).toHaveCount(0);
  await expect(tip).toHaveText(NODE_HINT);
});

// features.hints を false にすると、矢印・箱・hint の箱・data-hint の箱のどれに乗せてもツールチップが出ず、印も無いが、文字は描かれる（正常シナリオ（ヒントを外す））
test("test_normal_when_hints_off", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const markdown = [
    await hintFlowMarkdown(),
    wrapHtml(
      `<div data-hint="${BLOCK_HINT}" style="padding: 1rem 2rem">ヒントのある箱</div>`,
    ),
  ].join("\n");
  // 実行
  await mountDocument(page, {
    markdown,
    config: { features: { hints: false } },
  });
  const label = page.locator(".mdmark-diagram-label", { hasText: "メール" });
  await label.first().hover();
  await page.locator('[data-node="draft"]').hover();
  await page.locator('[data-node="mcp"]').hover();
  await page.locator("#doc .mdmark-html div").hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップが出ず、印も無い
  await expect(page.locator('#doc [role="tooltip"]:visible')).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-diagram-info")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-hint-mark")).toHaveCount(0);
  // 矢印のラベル・箱の名前・data-hint の箱の文字は描かれている
  await expect(label.first()).toBeVisible();
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-node-name'),
  ).toHaveText("窓口の MCP");
  await expect(page.locator("#doc .mdmark-html div")).toHaveText(
    "ヒントのある箱",
  );
});
