import { expect, type Locator, type Page, test } from "@playwright/test";
import type { MdmarkIndex } from "../../../src/index.ts";
import {
  ABC_PIE_CHART,
  ADDED_CHARTS,
  hintFlowMarkdown,
  monthlyChart,
  NODE_HINT,
  SCATTER_TEXT,
  wrapHtml,
} from "../chart.ts";
import {
  FRAME_HINT,
  flowMarkdown,
  groupFlowText,
  LANE_HINT,
  linkedFlowText,
  routeLinkTargets,
  TERM_INDEX,
  wrapDirective,
} from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { ER_DEFINITION, erMarkdown } from "../er.ts";
import {
  expectAbove,
  expectBelow,
  expectInViewport,
  ROOM_CSS,
  scrollToBottom,
  TALL_CSS,
} from "../tooltip.ts";

// ビルドした配布物を配置した作業ツリー
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

/** 入力・処理・出力を記載した LLM のノードのツールチップ */
function ioTipOf(page: Page) {
  return page.locator('[role="tooltip"]', { hasText: "入力" }).filter({
    hasText: "保存のツールを呼ぶ",
  });
}

/** 図を描いたページを開く。図はシステムの枠と LLM の層に `hint` を持つ。`withTerm` なら、索引を指定し、図の外の段落にも用語を記載する。`hostCss` は利用側の CSS */
async function openFlow(
  page: Page,
  withTerm = false,
  hostCss = "",
): Promise<void> {
  await openPage(page, builtRoot, { hostCss });
  const flow = wrapDirective("flow", await groupFlowText());
  await mountDocument(page, {
    markdown: withTerm ? `${flow}\n図の外の意思決定モデル。\n` : flow,
    ...(withTerm ? { index: TERM_INDEX } : {}),
  });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

// 矢印のラベルにポインターを乗せると入力の詳細が出て、ツールチップの上へ動かしても消えず、ノードとシステムの枠のタイトルのマーカーで入力・処理・出力と hint が下に出る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備: ツールチップが下に収まるよう、図の下に余白を取る
  await openFlow(page, false, ROOM_CSS);
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  // 実行: 矢印にポインターを乗せる
  await label.hover();
  // 検証: 入力の詳細を記載したツールチップが出る
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送信者のアドレス",
  });
  await expect(wireTip).toBeVisible();
  // 検証: 矢印のラベルの下に出る（tooltips.diagramPlacement の既定の bottom）
  await expectBelow({ tip: wireTip, owner: label });
  // 実行・検証: ツールチップの上へポインターを動かしても消えない
  await wireTip.hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  await expect(wireTip).toBeVisible();
  // 実行: LLM のノードのマーカーの外（ノードの名前）にポインターを乗せる
  const ioTip = ioTipOf(page);
  await page.locator('[data-node="draft"] .mdmark-diagram-node-name').hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ず、ポインターの形状は変わらない
  await expect(ioTip).toBeHidden();
  expect(
    await page
      .locator('[data-node="draft"]')
      .evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 実行: LLM のノードの右上のマーカーにポインターを乗せる
  await page.locator('[data-node="draft"] .mdmark-diagram-info').hover();
  // 検証: 入力・処理・出力のツールチップが出る
  await expect(ioTip).toBeVisible();
  await expect(ioTip.locator("dt")).toHaveText(["入力", "処理", "出力"]);
  // 検証: LLM のノードの下に出る
  await expectBelow({ tip: ioTip, owner: page.locator('[data-node="draft"]') });
  // ツールチップを持つノードにはマーカーがあり、持たないノードには無い
  await expect(
    page.locator('[data-node="draft"] .mdmark-diagram-info'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-info'),
  ).toHaveCount(0);
  // 検証: hint を持つシステムの枠と LLM の層のタイトルの右にマーカーがあり、hint を持たない層のタイトルには無い
  await expect(
    page.locator("#doc .mdmark-diagram-frame-title .mdmark-diagram-group-info"),
  ).toHaveCount(1);
  await expect(
    page.locator("#doc .mdmark-diagram-lane-label .mdmark-diagram-group-info"),
  ).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-diagram-lane-label")).toHaveCount(3);
  // 実行: システムの枠のタイトルのマーカーにポインターを乗せる
  const frameInfo = page.locator(
    "#doc .mdmark-diagram-frame-title .mdmark-diagram-group-info",
  );
  await frameInfo.hover();
  // 検証: 枠の hint の文のツールチップがマーカーの下に出る
  const frameTip = page.locator('[role="tooltip"]', { hasText: FRAME_HINT });
  await expect(frameTip).toBeVisible();
  await expect(frameTip).toHaveText(FRAME_HINT);
  await expectBelow({ tip: frameTip, owner: frameInfo });
  await expect(
    page.locator('[role="tooltip"]', { hasText: LANE_HINT }),
  ).toBeHidden();
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

// ノードの中の用語に本文と同じ破線の下線が付き、ポインターで用語集の意味が本文の用語と同じ外観で出る（正常シナリオ（ノードの中の用語））
test("test_normal_when_term", async ({ page }) => {
  // 準備
  await openFlow(page, true);
  const inBox = page.locator("#doc .mdmark-diagram-node .mdmark-term").first();
  const outside = page.locator("#doc > p .mdmark-term");
  // 検証: 下線
  await expect(inBox).toHaveText("意思決定モデル");
  await expect(inBox).toHaveCSS("text-decoration-style", "dashed");
  await expect(outside).toHaveCSS("text-decoration-style", "dashed");
  // 実行: ノードの中の用語にポインターを乗せる
  await inBox.hover();
  // 検証: 用語集の意味のツールチップが出る
  const tipId = await inBox.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("選択肢から選ぶだけの、速く安い判断用の AI");
  // 本文の用語のツールチップと同じ外観（文字の大きさ・角丸）
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

// `data-hint` のノードの右上のマーカーにポインターを乗せるかフォーカスすると文のツールチップが出て、マーカーの外では出ず、Esc で消えてフォーカスはマーカーに残る（正常シナリオ（埋め込んだ HTML の data-hint））
test("test_normal_when_data_hint", async ({ page }) => {
  // 準備: ツールチップが下に収まるよう、HTML の下に余白を取る
  await openPage(page, builtRoot, { hostCss: ROOM_CSS });
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
  // 検証: ヒントを持つノードにはマーカーがあり、持たないノードには無い
  await expect(block).toHaveCount(1);
  await expect(mark).toHaveCount(1);
  await expect(
    page
      .locator("#doc .mdmark-html div", { hasText: "ヒントの無い箱" })
      .locator(".mdmark-hint-mark"),
  ).toHaveCount(0);
  // 実行: マーカーの外にポインターを乗せる
  await block.hover({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ず、ポインターの形状は変わらない
  await expect(tip).toBeHidden();
  expect(
    await block.evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 実行: マーカーにポインターを乗せる
  await mark.hover();
  // 検証: 図のツールチップと同じ class の、文を記載したツールチップが出る
  await expect(tip).toBeVisible();
  await expect(tip).toHaveClass(/mdmark-diagram-tip/);
  await expect(tip).toHaveText(BLOCK_HINT);
  // 検証: マーカーの下に出る（tooltips.diagramPlacement の既定の bottom）
  await expectBelow({ tip, owner: mark });
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  // 実行: Tab でマーカーにフォーカスする
  for (let count = 0; count < MAX_TABS; count += 1) {
    await page.keyboard.press("Tab");
    if (await mark.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  // 検証: マーカーの aria-describedby がツールチップを指す
  await expect(mark).toBeFocused();
  await expect(tip).toBeVisible();
  await expect(mark).toHaveAttribute("aria-describedby", /.+/);
  const tipId = await tip.getAttribute("id");
  await expect(mark).toHaveAttribute("aria-describedby", tipId ?? "");
  // 実行: Esc を押す
  await page.keyboard.press("Escape");
  // 検証: ツールチップが消え、フォーカスはマーカーに残る
  await expect(tip).toBeHidden();
  await expect(mark).toBeFocused();
});

// io を持たず hint だけを持つノードの右上のマーカーにポインターを乗せると、見出しの無い hint の文が出る（正常シナリオ（ノードの hint））
test("test_normal_when_node_hint", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: await hintFlowMarkdown() });
  const info = page.getByRole("button", { name: "「窓口の MCP」の説明" });
  const tip = page.locator('[role="tooltip"]', { hasText: NODE_HINT });
  // 検証: hint を持つノードには、ツールチップを持つノードのマーカーがある
  await expect(info).toHaveCount(1);
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-info'),
  ).toHaveCount(1);
  // 実行: ノードの名前（マーカーの外）にポインターを乗せる
  await page.locator('[data-node="mcp"] .mdmark-diagram-node-name').hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップは出ない
  await expect(tip).toBeHidden();
  // 実行: 右上のマーカーにポインターを乗せる
  await info.hover();
  // 検証: hint の文だけのツールチップが出る
  await expect(tip).toBeVisible();
  await expect(tip.locator("dt")).toHaveCount(0);
  await expect(tip).toHaveText(NODE_HINT);
});

// features.hints を false にすると、矢印・ノード・hint のノード・data-hint のノード・システムの枠と層のタイトルのどれに乗せてもツールチップが出ず、マーカーも無いが、文字は描かれる（正常シナリオ（ヒントを削除する））
test("test_normal_when_hints_off", async ({ page }) => {
  // 準備: ノードの hint に加え、システムの枠と LLM の層に hint を持つ図
  await openPage(page, builtRoot);
  const definition = JSON.parse(await groupFlowText()) as {
    nodes: Array<Record<string, unknown>>;
  };
  definition.nodes = definition.nodes.map((node) =>
    node.id === "mcp" ? { ...node, hint: NODE_HINT } : node,
  );
  const markdown = [
    wrapDirective("flow", JSON.stringify(definition, null, 2)),
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
  await page.locator("#doc .mdmark-diagram-frame-title").hover();
  await page.locator("#doc .mdmark-diagram-lane-label").first().hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証: ツールチップが出ず、マーカーも無い
  await expect(page.locator('#doc [role="tooltip"]:visible')).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-diagram-info")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-diagram-group-info")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-hint-mark")).toHaveCount(0);
  // 矢印のラベル・ノードの名前・data-hint のノードの文字は描かれている
  await expect(label.first()).toBeVisible();
  await expect(
    page.locator('[data-node="mcp"] .mdmark-diagram-node-name'),
  ).toHaveText("窓口の MCP");
  await expect(page.locator("#doc .mdmark-html div")).toHaveText(
    "ヒントのある箱",
  );
});

// LLM のノードの下端が画面の下端に一致すると、ノードの下にツールチップの高さが残らないため、ノードの上に出して画面に収める（正常シナリオ（下に収まらないノード））
test("test_normal_when_no_room_below", async ({ page }) => {
  // 準備: 図の下に高い本文を続け、LLM のノードの下端が画面の下端に一致するまでスクロールする
  await openFlow(page, false, TALL_CSS);
  const draft = page.locator('[data-node="draft"]');
  await scrollToBottom(draft);
  // 実行: LLM のノードのマーカーにポインターを乗せる
  await draft.locator(".mdmark-diagram-info").hover();
  // 検証
  const ioTip = ioTipOf(page);
  await expect(ioTip).toBeVisible();
  await expectAbove({ tip: ioTip, owner: draft });
  await expectInViewport({ page, tip: ioTip });
});

// 設定の tooltips.diagramPlacement を top、tooltips.placement を bottom にすると、矢印のラベルと data-hint のノードのマーカーの上に出し、段落の用語は単語の下に出す（正常シナリオ（設定で上に出す））
test("test_normal_when_diagram_placement_top", async ({ page }) => {
  // 準備: ツールチップが上下に収まるよう、図と HTML の上下に余白を取る
  await openPage(page, builtRoot, { hostCss: ROOM_CSS });
  await mountDocument(page, {
    markdown: [
      await flowMarkdown(),
      wrapHtml(
        `<div data-hint="${BLOCK_HINT}" style="padding: 1rem 2rem">ヒントのある箱</div>`,
      ),
      "図の外の意思決定モデル。",
      "",
    ].join("\n"),
    index: TERM_INDEX,
    config: { tooltips: { diagramPlacement: "top", placement: "bottom" } },
  });
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  const mark = page.locator("#doc .mdmark-hint-block .mdmark-hint-mark");
  // 実行: 矢印にポインターを乗せる
  await label.hover();
  // 検証: 入力の詳細のツールチップがラベルの上に出る
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送信者のアドレス",
  });
  await expect(wireTip).toBeVisible();
  await expectAbove({ tip: wireTip, owner: label });
  // 実行: data-hint のノードのマーカーにポインターを乗せる
  await mark.hover();
  // 検証: data-hint の文のツールチップがマーカーの上に出る
  const hintTip = page.locator('[role="tooltip"]', { hasText: BLOCK_HINT });
  await expect(hintTip).toBeVisible();
  await expectAbove({ tip: hintTip, owner: mark });
  // 実行: 段落の用語にポインターを乗せる
  const term = page.locator("#doc > p .mdmark-term");
  await term.hover();
  // 検証: 用語のツールチップは tooltips.placement の bottom のとおり単語の下に出る
  const termTip = page.locator("#doc > p .mdmark-term-tip");
  await expect(termTip).toBeVisible();
  await expectBelow({ tip: termTip, owner: term });
});

// ノードの中の `{{単語}}` が、全角と半角・大文字と小文字だけが違う索引の用語に該当し、本文の用語と同じ破線の下線とツールチップを出す（正常シナリオ（ノードの中の表記の違う用語））
test("test_normal_when_term_width_and_case_differ", async ({ page }) => {
  // 準備
  const index: MdmarkIndex = {
    schema: 2,
    docs: [],
    terms: [{ id: "mcp", term: "MCP", meaning: "Model Context Protocol" }],
  };
  const flow = [
    "{",
    '  "title": "受け取り",',
    '  "scope": "範囲",',
    '  "updated": "2026-10-23",',
    '  "width": 520,',
    '  "height": 160,',
    '  "nodes": [',
    '    { "id": "recv", "kind": "script", "x": 20, "y": 48, "w": 140, "h": 64, "name": "{{ｍｃｐ}}", "sub": "" }',
    "  ],",
    '  "wires": []',
    "}",
  ].join("\n");
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: wrapDirective("flow", flow), index });
  // 実行
  const inBox = page.locator("#doc .mdmark-diagram-node .mdmark-term");
  await inBox.hover();
  // 検証
  // 文字はノードに記載した表記のまま、本文の用語と同じ破線の下線
  await expect(inBox).toHaveText("ｍｃｐ");
  await expect(inBox).toHaveCSS("text-decoration-style", "dashed");
  const tipId = await inBox.getAttribute("aria-describedby");
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Model Context Protocol");
});

test.describe("タッチの端末", () => {
  test.use({ hasTouch: true });

  // タップで出し、同じ持ち主のもう一度のタップと、ツールチップと持ち主の外のタップで消え、ツールチップの中のタップでは消えない（正常シナリオ（タッチ））
  test("test_normal_when_touch", async ({ page }) => {
    // 準備
    await openFlow(page, false, ROOM_CSS);
    const info = page.locator('[data-node="draft"] .mdmark-diagram-info');
    const ioTip = ioTipOf(page);
    // 実行・検証: LLM のノードのマーカーのタップで、入力・処理・出力が出る
    await info.tap();
    await expect(ioTip).toBeVisible();
    await expect(ioTip.locator("dt")).toHaveText(["入力", "処理", "出力"]);
    // 実行・検証: 同じマーカーをもう一度タップすると消える
    await info.tap();
    await expect(ioTip).toBeHidden();
    // 実行・検証: 矢印のラベルのタップで、入力の詳細が出る
    const label = page.locator(".mdmark-diagram-label.has-tip", {
      hasText: "メール",
    });
    const wireTip = page.locator('[role="tooltip"]', {
      hasText: "件名・本文・送信者のアドレス",
    });
    await label.tap();
    await expect(wireTip).toBeVisible();
    // 実行・検証: ツールチップの中のタップでは消えない
    await wireTip.tap();
    await page.waitForTimeout(CLOSE_WAIT_MS);
    await expect(wireTip).toBeVisible();
    // 実行・検証: ツールチップと持ち主の外（ページの左上の端）のタップで消える
    await page.touchscreen.tap(1, 1);
    await expect(wireTip).toBeHidden();
  });
});

// ER 図のテーブルの説明のボタンで、概要と列の説明をテーブルの下に出し、上に乗っても消えず Esc で消え、キーボードでも出る（正常シナリオ（ER 図のテーブル））
test("test_normal_when_er_table", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: ROOM_CSS });
  await mountDocument(page, {
    markdown: erMarkdown({
      ...ER_DEFINITION,
      tables: ER_DEFINITION.tables.map((table) => ({ ...table, y: 160 })),
    }),
  });
  const table = page.locator(
    '#doc .mdmark-diagram-er-table[data-node="customers"]',
  );
  const info = page.getByRole("button", { name: "「顧客」の説明" });
  const tipId = await info.getAttribute("aria-describedby");
  const tip = page.locator(`[role="tooltip"][id="${tipId}"]`);
  // テーブルの下にツールチップが収まるよう、テーブルの上端を画面の上から 100px の位置までスクロールする
  await table.evaluate((element) => {
    window.scrollBy(0, element.getBoundingClientRect().top - 100);
  });
  // 実行
  await info.hover();
  // 検証
  await expect(tip).toBeVisible();
  for (const text of [
    "注文する人",
    "email",
    "ログインに使う",
    "name",
    "表示に使う名前",
  ]) {
    await expect(tip).toContainText(text);
  }
  await expectBelow({ tip, owner: table });
  // 実行: ツールチップの上へ動かす
  await tip.hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  // 検証
  await expect(tip).toBeVisible();
  // 実行
  await page.keyboard.press("Escape");
  // 検証
  await expect(tip).toBeHidden();
  // 実行: キーボードで説明のボタンにフォーカスする
  await page.mouse.move(0, 0);
  await page.locator("#doc").evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  for (let count = 0; count < 40; count += 1) {
    await page.keyboard.press("Tab");
    if (await info.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  // 検証
  await expect(info).toBeFocused();
  await expect(tip).toBeVisible();
});

// 入力・処理・出力とリンク先を持つノードで、マーカーはツールチップを出してリンク先を開かず、マーカーの外を押すとリンク先を開く（正常シナリオ（リンク先を持つノードのツールチップ））
test("test_normal_when_linked_node_has_tip", async ({ page }) => {
  // 準備
  const opened = await routeLinkTargets(page, ["https://example.com/spec"]);
  await openPage(page, builtRoot, { hostCss: ROOM_CSS });
  await mountDocument(page, {
    markdown: wrapDirective(
      "flow",
      linkedFlowText({
        hrefs: ["https://example.com/spec", "./other.md"],
        io: true,
      }),
    ),
  });
  const node = page.locator('#doc [data-node="a"]');
  const info = node.locator(".mdmark-diagram-info");
  const link = node.locator("a.mdmark-diagram-node-link");
  const tip = page.locator('[role="tooltip"]', { hasText: "種類を 1 つ選ぶ" });
  // 実行・検証: マーカーの上で、入力・処理・出力のツールチップが出る
  await info.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator("dt")).toHaveText(["入力", "処理", "出力"]);
  // 実行・検証: マーカーを押してもリンク先は開かない
  await info.click();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  expect(opened()).toEqual([]);
  expect(page.url()).not.toBe("https://example.com/spec");
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  // 実行・検証: Tab でリンクとマーカーに別々にフォーカスし、マーカーのときだけツールチップが出る
  await link.focus();
  await expect(link).toBeFocused();
  await expect(tip).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(info).toBeFocused();
  await expect(tip).toBeVisible();
  // 実行・検証: マーカーの外のノードを押すと、リンク先が開く
  const box = await node.boundingBox();
  if (!box) {
    throw new Error("ノードの範囲を取れない");
  }
  await page.mouse.click(box.x + 20, box.y + box.height - 10);
  await page.waitForURL("https://example.com/spec");
  expect(opened()).toEqual(["https://example.com/spec"]);
});

/** グラフの図の中のツールチップの持ち主（点のクリックを受ける円・棒・扇形・バブル）を返却する */
function itemOwnersOf(figure: Locator): Locator {
  return figure.locator('[data-tip-owner^="item:"]');
}

// グラフの点・棒・扇形・散布図の点と追加した種類の項目に、名前と値のツールチップを項目の下に出し、Esc で削除する（正常シナリオ（グラフの項目））
test("test_normal_when_chart_items", async ({ page }) => {
  // 準備: ツールチップが下に収まるよう、グラフの下に余白を取る
  await openPage(page, builtRoot, { hostCss: ROOM_CSS });
  await mountDocument(page, {
    markdown: [
      monthlyChart("line"),
      monthlyChart("bar"),
      ABC_PIE_CHART,
      JSON.parse(SCATTER_TEXT) as Record<string, unknown>,
      ...ADDED_CHARTS,
    ]
      .map((definition) => wrapDirective("chart", JSON.stringify(definition)))
      .join("\n"),
  });
  const figures = page.locator("#doc figure.mdmark-diagram");
  await expect(figures).toHaveCount(12);
  const tipOf = async (owner: Locator) =>
    page.locator(`[id="${await owner.getAttribute("aria-describedby")}"]`);
  // 実行・検証: 折れ線の 2 つ目の点で、系列の名前・横の目盛り・値を項目の下に出す
  const point = itemOwnersOf(figures.nth(0)).nth(1);
  await point.hover();
  const pointTip = await tipOf(point);
  await expect(pointTip).toBeVisible();
  await expect(pointTip).toHaveAttribute("role", "tooltip");
  await expect(pointTip).toContainText("自動返信");
  await expect(pointTip).toContainText("2月: 38");
  await expectBelow({ tip: pointTip, owner: point });
  // 実行・検証: 外観の点の外で、点の周りのクリックを受ける範囲の内側でも同じツールチップが出る
  await page.mouse.move(0, 0);
  await expect(pointTip).toBeHidden();
  const box = await point.boundingBox();
  if (!box) {
    throw new Error("点の当たりの範囲を取れない");
  }
  await point.hover({ position: { x: box.width * 0.85, y: box.height / 2 } });
  await expect(pointTip).toBeVisible();
  // 実行・検証: 棒・円の A の扇形・散布図の点
  const cases: Array<[Locator, string[]]> = [
    [itemOwnersOf(figures.nth(1)).first(), ["自動返信", "1月: 12"]],
    [itemOwnersOf(figures.nth(2)).first(), ["A", "50", "50%"]],
    [itemOwnersOf(figures.nth(3)).first(), ["自動返信", "120", "6"]],
  ];
  for (const [owner, words] of cases) {
    await owner.hover();
    const tip = await tipOf(owner);
    await expect(tip).toBeVisible();
    for (const word of words) {
      await expect(tip).toContainText(word);
    }
  }
  // 実行・検証: 追加した 8 つの種類のグラフの項目（ドーナツの扇形は矩形の中心が穴のため、フォーカスで開く）
  await page.mouse.move(0, 0);
  for (const [index, definition] of ADDED_CHARTS.entries()) {
    const owner = itemOwnersOf(figures.nth(4 + index)).first();
    await owner.focus();
    const tip = await tipOf(owner);
    await expect(tip).toBeVisible();
    const names = [
      ...((definition.series as Array<{ name: string }> | undefined) ?? []),
      ...((definition.items as Array<{ name: string }> | undefined) ?? []),
    ].map((entry) => entry.name);
    const text = (await tip.textContent()) ?? "";
    expect(
      names.some((name) => text.includes(name)),
      String(index),
    ).toBe(true);
    expect(text, String(index)).toMatch(/\d/);
  }
  // 実行・検証: Tab で折れ線の点にフォーカスし、Esc でツールチップを削除してフォーカスを点に残す
  // 折れ線の図の表示する枠から Tab を始める（Firefox は blur の後も最後にフォーカスした要素から Tab を進め、文書の末尾から先頭へ戻らない）
  await figures.nth(0).locator('[aria-roledescription="図"]').focus();
  for (let count = 0; count < 40; count += 1) {
    await page.keyboard.press("Tab");
    if (
      await itemOwnersOf(figures.nth(0))
        .first()
        .evaluate((element) => element === document.activeElement)
    ) {
      break;
    }
  }
  const first = itemOwnersOf(figures.nth(0)).first();
  await expect(first).toBeFocused();
  const firstTip = await tipOf(first);
  await expect(firstTip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(firstTip).toBeHidden();
  await expect(first).toBeFocused();
});
