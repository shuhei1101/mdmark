import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  BAR_TEXT,
  BUBBLE_CHART,
  COMBO_CHART,
  DONUT_CHART,
  manySeriesChart,
  PIE_TEXT,
  SCATTER_TEXT,
  twoSeriesChart,
} from "../chart.ts";
import {
  flowMarkdown,
  judgementMarkdown,
  sampleBlock,
  wrapDirective,
} from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeSyntax,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 読まないことを確かめるために待つ時間（ミリ秒）
const SETTLE_MS = 500;

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
  const syntaxRequests = await routeSyntax(page);
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
    "入力・処理・出力が出るノード",
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
  // 図の部品の定義の json のコードブロックは色分けの対象にならず、色分けのライブラリを読まない
  await page.waitForTimeout(SETTLE_MS);
  expect(syntaxRequests()).toEqual([]);
});

// 判定フローチャートの開始・質問・アクション・結果のノードを互いに異なる形・アイコン・種類の名前で描き、凡例の種類はその 4 つだけ（正常シナリオ（判定フローチャート））
test("test_normal_when_flowchart", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: await judgementMarkdown() });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="flow"]',
  );
  await expect(figure).toHaveCount(1);
  const nodes = await figure
    .locator(".mdmark-diagram-node")
    .evaluateAll((elements) =>
      elements.map((node) => {
        const box = node.getBoundingClientRect();
        const name = node
          .querySelector(".mdmark-diagram-node-name")
          ?.getBoundingClientRect();
        return {
          kind: node.getAttribute("data-kind") ?? "",
          // 形: 角の丸み・菱形の svg の有無
          shape: `${getComputedStyle(node).borderTopLeftRadius}|${node.querySelector(":scope > svg polygon") !== null}`,
          icon:
            node.querySelector(".mdmark-diagram-node-kind svg")?.innerHTML ??
            "",
          tag: (
            node.querySelector(".mdmark-diagram-node-kind")?.textContent ?? ""
          ).trim(),
          inside: name
            ? name.left >= box.left - 1 && name.right <= box.right + 1
            : false,
        };
      }),
    );
  const kinds = ["start", "question", "action", "result"];
  expect(
    kinds.map((kind) => nodes.filter((node) => node.kind === kind).length),
  ).toEqual([1, 2, 1, 2]);
  // 種類ごとに形・アイコン・種類の名前が 1 つに決まり、4 種類で互いに異なる
  for (const key of ["shape", "icon", "tag"] as const) {
    const values = kinds.map((kind) => {
      const set = new Set(
        nodes.filter((node) => node.kind === kind).map((node) => node[key]),
      );
      expect(set.size, `${kind} の ${key}`).toBe(1);
      return [...set][0];
    });
    expect(new Set(values).size, key).toBe(4);
  }
  expect(
    kinds.map((kind) => nodes.find((node) => node.kind === kind)?.tag),
  ).toEqual(["開始", "質問", "アクション", "結果"]);
  // ノードの名前はノードの中に収まる（Firefox は文字ごとに折り返す）
  expect(nodes.every((node) => node.inside)).toBe(true);
  // 全ての種類のノードを定義の x・y の位置に描く（質問・開始のノードも左上に重ならない）
  const definition = JSON.parse(
    /```json\n([\s\S]*?)\n```/.exec(await judgementMarkdown())?.[1] ?? "{}",
  ) as { nodes: Array<{ id: string; x: number; y: number }> };
  const placed = await figure
    .locator(".mdmark-diagram-node")
    .evaluateAll((elements) =>
      elements.map((node) => ({
        id: node.getAttribute("data-node") ?? "",
        left: (node as HTMLElement).style.left,
        top: (node as HTMLElement).style.top,
      })),
    );
  expect(placed).toEqual(
    definition.nodes.map((node) => ({
      id: node.id,
      left: `${node.x}px`,
      top: `${node.y}px`,
    })),
  );
  const labels = await figure.locator(".mdmark-diagram-label").allInnerTexts();
  expect([...new Set(labels)].sort()).toEqual(["NO", "YES"]);
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  expect(legend.map((text) => text.trim())).toEqual([
    "開始",
    "質問",
    "アクション",
    "結果",
    "処理の流れ",
  ]);
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

/** svg の文字（`innerText` を持たない）を、現れた順に返す */
function svgTexts(figure: Locator, selector: string): Promise<string[]> {
  return figure
    .locator(selector)
    .evaluateAll((texts) => texts.map((text) => text.textContent ?? ""));
}

/** 数だけの文字を数にして返す */
function numbersOf(texts: string[]): number[] {
  return texts.filter((text) => /^-?\d+$/.test(text)).map(Number);
}

/** チャートの定義を `<!-- chart -->` で描いたページの、チャートの図 */
async function drawChart(
  page: Page,
  definition: string,
): Promise<{ figure: Locator }> {
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: wrapDirective("chart", definition) });
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="chart"]',
  );
  await expect(figure).toHaveCount(1);
  return { figure };
}

// 棒のグラフを、系列ごとに違う塗りの模様で項目の数だけ描き、縦の軸をデータから 1・2・5×10 のべき乗の刻みで切る（正常シナリオ（棒のグラフ））
test("test_normal_when_bar", async ({ page }) => {
  // 準備・実行
  const { figure } = await drawChart(page, BAR_TEXT);
  // 検証: 系列 2 つ × 項目 4 つの棒が、系列ごとに違う塗りで描かれている
  const bars = figure.locator("svg[role=img] .mdmark-diagram-bar");
  await expect(bars).toHaveCount(8);
  const fills = await figure
    .locator("svg[role=img] g[data-series] > .mdmark-diagram-bar")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("fill")),
    );
  expect(new Set(fills).size).toBe(2);
  await expect(figure.locator("svg[role=img] pattern").first()).toBeAttached();
  // 縦の軸の目盛りが、データの最小と最大を含み、刻みが 1・2・5×10 のべき乗
  const ticks = numbersOf(
    await svgTexts(figure, 'svg[role=img] text[text-anchor="end"]'),
  );
  expect(ticks.length).toBeGreaterThan(2);
  expect(Math.min(...ticks)).toBeLessThanOrEqual(12);
  expect(Math.max(...ticks)).toBeGreaterThanOrEqual(124);
  const step = (ticks[1] ?? 0) - (ticks[0] ?? 0);
  expect(step).toBeGreaterThan(0);
  expect(
    ticks.every((tick, index) => tick === (ticks[0] ?? 0) + step * index),
  ).toBe(true);
  expect(/^[125]0*$/.test(String(step))).toBe(true);
  // 題名と、系列の名前を載せた凡例がある
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    "窓口ごとの問い合わせの件数",
  );
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  for (const name of ["自動返信", "担当者"]) {
    expect(
      legend.some((text) => text.includes(name)),
      name,
    ).toBe(true);
  }
  // グラフは role="img" と、題名と系列の値を書いた読み上げの名前を持つ
  const label = await figure
    .locator("svg[role=img]")
    .getAttribute("aria-label");
  expect(label).toContain("窓口ごとの問い合わせの件数");
  expect(label).toContain("124");
  expect(label).toContain("95");
});

// 円のグラフを、項目の値の割合の扇形で、色と模様の組で分けて描き、凡例に項目の名前を並べる（正常シナリオ（円のグラフ））
test("test_normal_when_pie", async ({ page }) => {
  // 準備・実行
  const { figure } = await drawChart(page, PIE_TEXT);
  // 検証: 扇形 3 つが、割合の整数の文字と、分けた塗りで描かれている
  const slices = figure.locator("svg[role=img] .mdmark-diagram-slice");
  await expect(slices).toHaveCount(3);
  expect(
    await svgTexts(figure, "svg[role=img] .mdmark-diagram-value-text"),
  ).toEqual(["62%", "31%", "7%"]);
  const fills = await slices.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("fill")),
  );
  expect(new Set(fills).size).toBe(3);
  // 凡例に項目の名前が並ぶ
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  for (const name of [
    "よくある質問で答えた",
    "担当者へ回した",
    "返信しなかった",
  ]) {
    expect(
      legend.some((text) => text.includes(name)),
      name,
    ).toBe(true);
  }
});

// 散布図を、横と縦の両方の軸に数値の目盛りを切り、点を値の位置に系列の点の印で置く（正常シナリオ（散布図））
test("test_normal_when_scatter", async ({ page }) => {
  // 準備・実行
  const { figure } = await drawChart(page, SCATTER_TEXT);
  // 検証: 点 6 つが置かれている
  const points = figure.locator(
    "svg[role=img] g[data-series] .mdmark-diagram-point",
  );
  await expect(points).toHaveCount(6);
  // 横の値が大きい点ほど右に、縦の値が最大の点が一番上にある
  const positions = await points.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );
  const xs = positions.map((position) => position.x);
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  const ys = positions.map((position) => position.y);
  expect(ys.indexOf(Math.min(...ys))).toBe(5);
  // 横と縦の両方の軸に、数値の目盛りがある
  expect(
    numbersOf(
      await svgTexts(figure, 'svg[role=img] text[text-anchor="middle"]'),
    ).length,
  ).toBeGreaterThan(2);
  expect(
    numbersOf(await svgTexts(figure, 'svg[role=img] text[text-anchor="end"]'))
      .length,
  ).toBeGreaterThan(2);
});

/** 定義を `<!-- chart -->` の範囲にする */
function chartRange(definition: Record<string, unknown>): string {
  return wrapDirective("chart", JSON.stringify(definition, null, 2));
}

/** 図の中の棒の `rect` の位置と大きさ */
async function barBoxes(figure: Locator) {
  return figure
    .locator("svg[role=img] g[data-series] > .mdmark-diagram-bar")
    .evaluateAll((rects) =>
      rects.map((rect) => ({
        series: rect.parentElement?.getAttribute("data-series"),
        x: Number(rect.getAttribute("x")),
        y: Number(rect.getAttribute("y")),
        width: Number(rect.getAttribute("width")),
        height: Number(rect.getAttribute("height")),
      })),
    );
}

// 追加した 8 つの種類のグラフを、タイトルと凡例つきで図の枠に描き、積み上げは同じ項目の値を積んだ高さにする（正常シナリオ（追加したグラフの種類））
test("test_normal_when_more_chart_types", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const definitions = [
    twoSeriesChart("area"),
    twoSeriesChart("stacked-bar"),
    twoSeriesChart("stacked-area"),
    twoSeriesChart("horizontal-bar"),
    DONUT_CHART,
    twoSeriesChart("radar"),
    BUBBLE_CHART,
    COMBO_CHART,
  ];
  // 実行
  await mountDocument(page, {
    markdown: definitions.map(chartRange).join("\n"),
  });
  // 検証: 8 つの図に、タイトルと系列の名前を載せた凡例がある
  const figures = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="chart"]',
  );
  await expect(figures).toHaveCount(8);
  for (const [index, definition] of definitions.entries()) {
    const figure = figures.nth(index);
    await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
      String(definition.title),
    );
    const names = (
      (definition.series ?? definition.items) as { name: string }[]
    ).map(({ name }) => name);
    const legend = await figure
      .locator('ul[aria-label="凡例"] li')
      .allInnerTexts();
    for (const name of names) {
      expect(
        legend.some((text) => text.includes(name)),
        `${String(definition.type)} の ${name}`,
      ).toBe(true);
    }
    await expect(figure.locator("svg[role=img]")).toBeVisible();
  }
  // 検証: 積み上げの棒は、同じ項目の 2 つ目の系列が 1 つ目の上に載り、高さの和が値の和に比例する
  const stacked = await barBoxes(figures.nth(1));
  const first = stacked.filter((bar) => bar.series === "1");
  const second = stacked.filter((bar) => bar.series === "2");
  expect(first).toHaveLength(3);
  expect(second).toHaveLength(3);
  const unit = (first[0]?.height ?? 0) / 3;
  for (const [index, total] of [7, 6, 8].entries()) {
    const lower = first[index];
    const upper = second[index];
    expect(upper?.x).toBe(lower?.x);
    expect((upper?.y ?? 0) + (upper?.height ?? 0)).toBeCloseTo(
      lower?.y ?? 0,
      1,
    );
    expect((lower?.height ?? 0) + (upper?.height ?? 0)).toBeCloseTo(
      unit * total,
      1,
    );
  }
  // 検証: 積み上げの面は、上の系列の面の下端が下の系列の面の上端を通る
  const areas = figures
    .nth(2)
    .locator("svg[role=img] .mdmark-diagram-stacked-area");
  const shapes = await areas.evaluateAll((paths) =>
    paths.map((path) => path.getAttribute("d") ?? ""),
  );
  expect(shapes.length).toBeGreaterThanOrEqual(2);
  const top = (d: string) => d.split(" L").slice(0, 3).join(" L").slice(1);
  const bottomReversed = (d: string) =>
    d.replace(/ Z$/, "").split(" L").slice(3).reverse().join(" L");
  expect(bottomReversed(shapes[1] ?? "")).toBe(top(shapes[0] ?? ""));
  // 検証: 組み合わせは、1 つ目の系列を棒、2 つ目の系列を折れ線で同じ軸に描く
  const combo = figures.nth(7);
  await expect(
    combo.locator('svg[role=img] g[data-series="1"] > .mdmark-diagram-bar'),
  ).toHaveCount(3);
  await expect(
    combo.locator('svg[role=img] path.mdmark-diagram-series[data-series="2"]'),
  ).toHaveCount(1);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

/** グラフの系列ごとの、線の色・線の模様・点のマーカーの形・塗りの組 */
async function seriesSignatures(figure: Locator): Promise<string[]> {
  return figure.locator("svg[role=img] g[data-series]").evaluateAll((groups) =>
    groups.map((group) => {
      const n = group.getAttribute("data-series");
      const path = group
        .closest("svg")
        ?.querySelector(`path.mdmark-diagram-series[data-series="${n}"]`);
      const style = path ? getComputedStyle(path) : undefined;
      const point = group.querySelector(".mdmark-diagram-point");
      const bar = group.querySelector(".mdmark-diagram-bar");
      return [
        style?.stroke,
        style?.strokeDasharray,
        point?.tagName,
        point?.getAttribute("d")?.match(/[ML]/g)?.length,
        bar?.getAttribute("fill"),
      ].join("|");
    }),
  );
}

/** 系列の色と背景の色の、相対輝度のコントラスト比の最小 */
async function minSeriesContrast(figure: Locator): Promise<number> {
  return figure.evaluate((element) => {
    const toRgb = (color: string): number[] => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) return [0, 0, 0];
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const luminance = (rgb: number[]): number => {
      const [r = 0, g = 0, b = 0] = rgb.map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    let background = "";
    for (
      let node: Element | null = element;
      node && (background === "" || background === "rgba(0, 0, 0, 0)");
      node = node.parentElement
    ) {
      background = getComputedStyle(node).backgroundColor;
    }
    const base = luminance(toRgb(background));
    const ratios = [
      ...element.querySelectorAll("svg[role=img] path.mdmark-diagram-series"),
    ].map((path) => {
      const value = luminance(toRgb(getComputedStyle(path).stroke));
      const [light, dark] = value > base ? [value, base] : [base, value];
      return (light + 0.05) / (dark + 0.05);
    });
    return Math.min(...ratios);
  });
}

// 6 つの系列を、色・点のマーカー・塗りの模様の組を変えて描き、ライトとダークのどちらでも背景と見分けられる（正常シナリオ（5 つ以上の系列））
test("test_normal_when_many_series", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      chartRange(manySeriesChart("line", 6)),
      chartRange(manySeriesChart("bar", 6)),
    ].join("\n"),
  });
  // 検証: 6 つの系列と凡例の 6 つの名前
  const figures = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="chart"]',
  );
  await expect(figures).toHaveCount(2);
  const names = Array.from({ length: 6 }, (_, index) => `窓口${index + 1}`);
  for (const figure of [figures.nth(0), figures.nth(1)]) {
    const legend = await figure
      .locator('ul[aria-label="凡例"] li')
      .allInnerTexts();
    expect(legend.map((text) => text.trim())).toEqual(names);
  }
  // 検証: 系列ごとの色・点のマーカー・塗りの模様の組が互いに異なる
  const line = figures.nth(0);
  await expect(
    line.locator("svg[role=img] path.mdmark-diagram-series"),
  ).toHaveCount(6);
  expect(new Set(await seriesSignatures(line)).size).toBe(6);
  const bar = figures.nth(1);
  await expect(
    bar.locator("svg[role=img] g[data-series] > .mdmark-diagram-bar"),
  ).toHaveCount(30);
  expect(new Set(await seriesSignatures(bar)).size).toBe(6);
  // 検証: ライトとダークのどちらでも、系列の色が背景と見分けられる
  expect(await minSeriesContrast(line)).toBeGreaterThanOrEqual(3);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await minSeriesContrast(line)).toBeGreaterThanOrEqual(3);
});
