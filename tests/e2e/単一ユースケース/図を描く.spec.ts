import { expect, type Locator, test } from "@playwright/test";
import { flowMarkdown, sampleBlock, wrapDirective } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 動くと `window.__mdmarkScriptRan` を `true` にする、文書に書いた script 要素
const SCRIPT = "<script>window.__mdmarkScriptRan = true</script>\n";

// シーケンス図の定義: 相手 3 つ・メッセージ 4 つ・ループの戻り 1 本
const SEQUENCE = JSON.stringify({
  title: "保存の呼び出し",
  scope: "依頼から応答まで",
  updated: "2026-10-18",
  participants: [
    { id: "caller", kind: "external", name: "呼び出し元" },
    { id: "intake", kind: "script", name: "受け付け" },
    { id: "store", kind: "mcp", name: "保存先" },
  ],
  steps: [
    { from: "caller", to: "intake", label: "依頼" },
    { from: "intake", to: "store", label: "保存する" },
    { from: "store", to: "intake", label: "結果", reply: true },
    { from: "intake", to: "caller", label: "応答", reply: true },
  ],
  loop: { label: "1 へ戻る（次の依頼）" },
});

// グラフの定義: 系列 2 つ・点 5 つずつ
const CHART = JSON.stringify({
  title: "返信までの時間",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "曜日", ticks: ["月", "火", "水", "木", "金"] },
  y: { label: "分", min: 0, max: 60, step: 15 },
  series: [
    { name: "自動返信", points: [12, 9, 14, 8, 10] },
    { name: "担当者", points: [42, 38, 51, 35, 44] },
  ],
});

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 要素の見える範囲（無ければ例外） */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("要素の範囲を取れない");
  }
  return box;
}

/** 線の種類ごとに、見える線の色・破線の間隔・太さを `色|間隔|太さ` にして返す（最初の 1 本） */
async function wireStyles(figure: Locator): Promise<Record<string, string>> {
  return figure
    .locator(".mdmark-diagram-wires > path.mdmark-diagram-wire")
    .evaluateAll((paths) => {
      const styles: Record<string, string> = {};
      for (const path of paths) {
        const line = path.getAttribute("data-line") ?? "";
        const style = getComputedStyle(path);
        styles[line] ??=
          `${style.stroke}|${style.strokeDasharray}|${style.strokeWidth}`;
      }
      return styles;
    });
}

// フロー図の部品の定義から、枠・3 層・題と凡例・線の種類・交差・ループの戻りを持つ図を描き、文書に書いたスクリプトは動かさない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${await flowMarkdown()}\n${SCRIPT}`,
  });
  // 検証
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="flow"]',
  );
  await expect(figure).toHaveCount(1);
  // システムの枠の中に 3 つの層が LLM・処理・データの順に並び、層ごとに色の背景が敷かれている
  const lanes = figure.locator(".mdmark-diagram-lane");
  await expect(lanes).toHaveCount(3);
  const kinds = await lanes.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-kind")),
  );
  expect(kinds).toEqual(["llm", "mcp", "data"]);
  const tops = [];
  for (let index = 0; index < 3; index += 1) {
    const lane = lanes.nth(index);
    tops.push((await boxOf(lane)).y);
    await expect(lane).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  const frame = await boxOf(figure.locator(".mdmark-diagram-frame"));
  const firstLane = await boxOf(lanes.first());
  expect(firstLane.x).toBeGreaterThanOrEqual(frame.x);
  expect(firstLane.x + firstLane.width).toBeLessThanOrEqual(
    frame.x + frame.width + 1,
  );
  // 外部のシステムの箱が枠の外にある
  const mail = await boxOf(figure.locator('[data-node="mail"]'));
  expect(mail.x + mail.width).toBeLessThanOrEqual(frame.x + 1);
  // 題名・範囲・更新日と、定義に出る色・形・線・矢じりを全て載せた凡例がある
  const head = figure.locator(".mdmark-diagram-head");
  await expect(head).toContainText("問い合わせへの自動返信の構成");
  await expect(head).toContainText("範囲: メールを受け取ってから返信するまで");
  await expect(head.locator("time")).toHaveText("2026-10-17");
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  for (const label of [
    "LLM",
    "意思決定モデル",
    "スクリプト",
    "MCP",
    "データ",
    "外部のシステム（枠の外）",
    "システムの枠",
    "処理の流れ",
    "読む",
    "書く",
    "戻る（ループ）",
    "線の交差",
    "入力・処理・出力が出る箱",
  ]) {
    expect(
      legend.some((text) => text.includes(label)),
      label,
    ).toBe(true);
  }
  // 線の種類が、色と模様（破線の間隔・太さ）の組で分かれている
  const styles = await wireStyles(figure);
  expect(Object.keys(styles).sort()).toEqual(["flow", "loop", "read", "write"]);
  expect(new Set(Object.values(styles)).size).toBe(4);
  // 残った交差は、横の線が縦の線を飛び越える弧（line jump）で描かれている
  const arcs = await figure
    .locator('.mdmark-diagram-wires > path[data-line="flow"]')
    .evaluateAll(
      (paths) =>
        paths.filter((path) => (path.getAttribute("d") ?? "").includes(" A"))
          .length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  // ループの戻りの線が破線で、戻り先のラベルを持つ
  await expect(
    figure.locator('.mdmark-diagram-wires > path[data-line="loop"]'),
  ).toHaveAttribute("stroke-dasharray", /\d/);
  await expect(
    figure.locator('.mdmark-diagram-label[data-line="loop"]'),
  ).toContainText("受け取りへ戻る");
  // 文書に書いたスクリプトが動いていない
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
});

// シーケンス図の相手とメッセージを、定義の順に左から右・上から下へ並べ、ループの戻りと凡例を持つ（正常シナリオ（シーケンス図））
test("test_normal_when_sequence", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: wrapDirective("sequence", SEQUENCE) });
  // 検証
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="sequence"]',
  );
  await expect(figure).toHaveCount(1);
  const heads = figure.locator(
    ".mdmark-diagram-seq-heads .mdmark-diagram-node",
  );
  await expect(heads).toHaveText([/呼び出し元/, /受け付け/, /保存先/]);
  const lefts = [];
  for (let index = 0; index < 3; index += 1) {
    lefts.push((await boxOf(heads.nth(index))).x);
  }
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  const steps = figure.locator('.mdmark-diagram-label:not([data-line="loop"])');
  await expect(steps).toHaveText(["1 依頼", "2 保存する", "3 結果", "4 応答"]);
  const tops = [];
  for (let index = 0; index < 4; index += 1) {
    tops.push((await boxOf(steps.nth(index))).y);
  }
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  // ループの戻りが破線と戻り先のラベルで描かれている
  await expect(
    figure.locator('.mdmark-diagram-wires > path[data-line="loop"]'),
  ).toHaveAttribute("stroke-dasharray", /\d/);
  await expect(
    figure.locator('.mdmark-diagram-label[data-line="loop"]'),
  ).toContainText("1 へ戻る");
  // 題名・範囲・更新日と凡例がある
  await expect(figure.locator(".mdmark-diagram-head")).toContainText(
    "保存の呼び出し",
  );
  await expect(figure.locator(".mdmark-diagram-head time")).toHaveText(
    "2026-10-18",
  );
  await expect(
    figure.locator('ul[aria-label="凡例"] li').first(),
  ).toBeVisible();
});

// グラフの 2 つの系列を、色と線の模様の組で分けて描き、題と系列の名前を載せた凡例を持つ（正常シナリオ（グラフ））
test("test_normal_when_graph", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: wrapDirective("chart", CHART) });
  // 検証
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="chart"]',
  );
  await expect(figure).toHaveCount(1);
  const series = figure.locator("svg[role=img] path.mdmark-diagram-series");
  await expect(series).toHaveCount(2);
  const signatures = await series.evaluateAll((paths) =>
    paths.map((path) => {
      const style = getComputedStyle(path);
      return `${style.stroke}|${style.strokeDasharray}`;
    }),
  );
  expect(new Set(signatures).size).toBe(2);
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    "返信までの時間",
  );
  await expect(figure.locator('ul[aria-label="凡例"] li')).toHaveText([
    /自動返信/,
    /担当者/,
  ]);
});

// 読めない定義の場所だけを書き方の警告にし、正しい定義の図と段落は描く（異常シナリオ（定義を読めない））
test("test_error_when_definition_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const valid = await sampleBlock("inquiry");
  const broken = valid.slice(0, valid.lastIndexOf("}"));
  // 実行
  await mountDocument(page, {
    markdown: [
      wrapDirective("flow", broken),
      wrapDirective("flow", valid),
      "後ろの段落",
      "",
    ].join("\n"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText(
    "フロー図の部品の定義を JSON として読めません",
  );
  await expect(warning).toContainText("行目");
  await expect(warning).toContainText("}");
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
  await expect(page.locator("#doc > p")).toHaveText("後ろの段落");
});
