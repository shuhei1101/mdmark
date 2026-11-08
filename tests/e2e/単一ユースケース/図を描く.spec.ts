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
  groupFlowText,
  JUDGEMENT_AUTO_TEXT,
  judgementMarkdown,
  linkedFlowText,
  routeLinkTargets,
  sampleBlock,
  wrapDirective,
} from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  PAGE_URL,
  removeDistRoot,
  routeSyntax,
} from "../dist-page.ts";
import { ER_DEFINITION, erMarkdown } from "../er.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 読み込まないことを確認するために待つ時間（ミリ秒）
const SETTLE_MS = 500;

// 動くと `window.__mdmarkScriptRan` を `true` にする、文書に記載した script 要素
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

/** 線の種類ごとに、見える線の色・破線の間隔・太さを `色|間隔|太さ` にして返却する（最初の 1 本） */
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

// フロー図の部品の定義から、枠・3 層・タイトルと凡例・線の種類・交差・ループの戻りを持つ図を描き、文書に記載したスクリプトは動かさない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備: システムの枠と LLM の層に hint を持つ見本のフロー図
  const syntaxRequests = await routeSyntax(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${wrapDirective("flow", await groupFlowText())}\n${SCRIPT}`,
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
  // 外部のシステムのノードが枠の外にある
  const mail = await boxOf(figure.locator('[data-node="mail"]'));
  expect(mail.x + mail.width).toBeLessThanOrEqual(frame.x + 1);
  // 題名・範囲・更新日と凡例があり、凡例には図に 2 種類以上あるノードの種類と線の種類だけが載る
  const head = figure.locator(".mdmark-diagram-head");
  await expect(head).toContainText("問い合わせへの自動返信の構成");
  await expect(head).toContainText("範囲: メールを受け取ってから返信するまで");
  await expect(head.locator("time")).toHaveText("2026-10-17");
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  const kindsAndLines = [
    "LLM",
    "意思決定モデル",
    "スクリプト",
    "MCP",
    "データ",
    "外部のシステム（枠の外）",
    "処理の流れ",
    "読み込む",
    "書き込む",
    "戻る（ループ）",
  ];
  for (const label of kindsAndLines) {
    expect(
      legend.some((text) => text.includes(label)),
      label,
    ).toBe(true);
  }
  expect(legend).toHaveLength(kindsAndLines.length);
  // 凡例に、システムの枠・層の背景・線の交差・ツールチップのマーカー・用語の下線の項目が無い
  for (const word of ["システムの枠", "層", "交差", "出る", "下線"]) {
    expect(
      legend.some((text) => text.includes(word)),
      word,
    ).toBe(false);
  }
  // システムの枠と LLM の層のタイトルの右にツールチップのマーカーがあり、hint を持たない層のタイトルには無い
  await expect(
    figure.locator(".mdmark-diagram-frame-title .mdmark-diagram-group-info"),
  ).toHaveCount(1);
  const laneMarks = await figure
    .locator(".mdmark-diagram-lane-label")
    .evaluateAll((labels) =>
      labels.map(
        (label) => label.querySelector(".mdmark-diagram-group-info") !== null,
      ),
    );
  expect(laneMarks).toEqual([true, false, false]);
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
  // 文書に記載したスクリプトが動いていない
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
  // 図の部品の定義の json のコードブロックは色分けの対象にならず、色分けのライブラリを読み込まない
  await page.waitForTimeout(SETTLE_MS);
  expect(syntaxRequests()).toEqual([]);
});

// 判定フローチャートの開始・質問・アクション・結果のノードを互いに異なる構造・アイコン・種類の名前で描き、凡例の種類はその 4 つだけ（正常シナリオ（判定フローチャート））
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
          // 構造: 角の丸み・菱形の svg の有無
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
  // 種類ごとに構造・アイコン・種類の名前が 1 つに決まり、4 種類で互いに異なる
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
  // 題名・範囲・更新日と凡例があり、凡例には図に 2 種類以上ある相手の種類（外部・スクリプト・MCP）と線の種類（処理の流れ・戻り・ループ）だけが載る
  await expect(figure.locator(".mdmark-diagram-head")).toContainText(
    "保存の呼び出し",
  );
  await expect(figure.locator(".mdmark-diagram-head time")).toHaveText(
    "2026-10-18",
  );
  const legend = figure.locator('ul[aria-label="凡例"] li');
  await expect(legend.first()).toBeVisible();
  await expect(legend).toHaveCount(6);
  const legendTexts = await legend.allInnerTexts();
  for (const word of ["交差", "出る", "下線"]) {
    expect(
      legendTexts.some((text) => text.includes(word)),
      word,
    ).toBe(false);
  }
});

// ノードも線も 1 種類ずつのフロー図は、凡例の項目を持たずに描く（正常シナリオ（種類が 1 つずつの図））
test("test_normal_when_single_kinds", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const definition = {
    title: "下書きを確認する順番",
    scope: "送信の前",
    updated: "2026-11-04",
    width: 640,
    height: 120,
    nodes: ["宛先", "本文", "添付"].map((name, index) => ({
      id: `s-${index + 1}`,
      kind: "script",
      x: 24 + index * 216,
      y: 28,
      w: 160,
      h: 64,
      name: `${name}を確認する`,
    })),
    wires: [1, 2].map((index) => ({
      id: `s-w${index}`,
      from: `s-${index}`,
      to: `s-${index + 1}`,
      line: "flow",
      points: [
        [24 + (index - 1) * 216 + 160, 60],
        [24 + index * 216, 60],
      ],
    })),
  };
  // 実行
  await mountDocument(page, {
    markdown: wrapDirective("flow", JSON.stringify(definition)),
  });
  // 検証: ノード 3 つと線 2 本のフロー図と題名
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="flow"]',
  );
  await expect(figure).toHaveCount(1);
  await expect(figure.locator(".mdmark-diagram-node")).toHaveCount(3);
  await expect(
    figure.locator(".mdmark-diagram-wires > path.mdmark-diagram-wire"),
  ).toHaveCount(2);
  await expect(figure.locator(".mdmark-diagram-head")).toContainText(
    "下書きを確認する順番",
  );
  // 検証: 凡例にノードの種類と線の種類の項目が無い
  await expect(figure.locator('ul[aria-label="凡例"] li')).toHaveCount(0);
  await expect(figure.locator('ul[aria-label="凡例"]')).toBeHidden();
});

// グラフの 2 つの系列を、色と線の模様の組で分けて描き、タイトルと系列の名前を記載した凡例を持つ（正常シナリオ（グラフ））
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

// 読み込めない定義の場所だけを記載の警告にし、正しい定義の図と段落は描く（異常シナリオ（定義を読み込めない））
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
    "フロー図の部品の定義を JSON として読み込めません",
  );
  await expect(warning).toContainText("行目");
  await expect(warning).toContainText("}");
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
  await expect(page.locator("#doc > p")).toHaveText("後ろの段落");
});

/** svg の文字（`innerText` を持たない）を、現れた順に返却する */
function svgTexts(figure: Locator, selector: string): Promise<string[]> {
  return figure
    .locator(selector)
    .evaluateAll((texts) => texts.map((text) => text.textContent ?? ""));
}

/** 数だけの文字を数にして返却する */
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
  // 題名と、系列の名前を記載した凡例がある
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
  // グラフは role="img" と、題名と系列の値を記載したスクリーンリーダー向けの名前を持つ
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

// 散布図を、横と縦の両方の軸に数値の目盛りを切り、点を値の位置に系列の点のマーカーで配置する（正常シナリオ（散布図））
test("test_normal_when_scatter", async ({ page }) => {
  // 準備・実行
  const { figure } = await drawChart(page, SCATTER_TEXT);
  // 検証: 点 6 つが配置されている
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

// 追加した 8 つの種類のグラフを、タイトルと凡例つきで図の枠に描き、積み上げは同じ項目の値を加算した高さにする（正常シナリオ（追加したグラフの種類））
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
  // 検証: 8 つの図に、タイトルと系列の名前を記載した凡例がある
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

/** グラフの系列ごとの、線の色・線の模様・点のマーカーの構造・塗りの組 */
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

// ER 図の部品の定義から、テーブル・列のマーカー・関係の線と多重度・ラベルを図の枠に描く（正常シナリオ（ER 図））
test("test_normal_when_er_diagram", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: erMarkdown() });
  // 検証
  const figure = page.locator('#doc figure.mdmark-diagram[data-diagram="er"]');
  await expect(figure).toHaveCount(1);
  const tables = figure.locator(".mdmark-diagram-er-table");
  await expect(tables).toHaveCount(3);
  for (const table of ER_DEFINITION.tables) {
    const node = figure.locator(
      `.mdmark-diagram-er-table[data-node="${table.id}"]`,
    );
    await expect(node.locator(".mdmark-diagram-er-physical")).toHaveText(
      table.name,
    );
    await expect(node.locator(".mdmark-diagram-er-logical")).toHaveText(
      table.label,
    );
    await expect(node.locator(".mdmark-diagram-er-name")).toHaveText(
      table.columns.map((column) => column.name),
    );
    await expect(node.locator(".mdmark-diagram-er-type")).toHaveText(
      table.columns.map((column) => column.type),
    );
  }
  const orders = figure.locator('.mdmark-diagram-er-table[data-node="orders"]');
  await expect(
    orders.locator('[data-column="id"] abbr[title="主キー"]'),
  ).toHaveText("PK");
  await expect(
    orders.locator('[data-column="customer_id"] abbr[title="外部キー"]'),
  ).toHaveText("FK");
  await expect(
    orders.locator('[data-column="ordered_at"] abbr[title="NOT NULL"]'),
  ).toHaveText("NN");
  const relations = figure.locator("g[data-er-relation]");
  await expect(relations).toHaveCount(2);
  for (const relation of ER_DEFINITION.relations) {
    const group = figure.locator(
      `g[data-er-from="${relation.from}"][data-er-to="${relation.to}"]`,
    );
    await expect(group.locator('path[data-line="er"]')).toHaveCount(1);
    await expect(group.locator(".mdmark-diagram-er-end")).not.toHaveCount(0);
    await expect(
      figure.locator(".mdmark-diagram-label", { hasText: relation.label }),
    ).toBeVisible();
  }
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    ER_DEFINITION.title,
  );
  await expect(figure.locator('ul[aria-label="凡例"] li')).toHaveText([
    /マスター/,
    /トランザクション/,
    /主キー/,
    /外部キー/,
    /NOT NULL/,
    /1 つ$/,
    /1 つ以上/,
    /0 以上/,
  ]);
});

// 読み込めない ER 図の定義の場所だけを記載の警告にし、正しい定義の ER 図と段落は描く（異常シナリオ（ER 図の定義を読み込めない））
test("test_error_when_er_definition_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const broken = {
    ...ER_DEFINITION,
    relations: ER_DEFINITION.relations.map((relation) =>
      relation.label === "注文する"
        ? { ...relation, to: "payments" }
        : relation,
    ),
  };
  // 実行
  await mountDocument(page, {
    markdown: [erMarkdown(broken), erMarkdown(), "後ろの段落", ""].join("\n"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("ER 図の部品の定義を読めません");
  await expect(warning).toContainText("payments");
  await expect(
    page.locator('#doc figure.mdmark-diagram[data-diagram="er"]'),
  ).toHaveCount(1);
  await expect(page.locator("#doc > p")).toHaveText("後ろの段落");
});

// 座標を省いた判定フローチャートを、開始から上から下へ質問を並べ、YES・NO の先へアクションと結果を配置して描く（正常シナリオ（座標を省いた判定フローチャート））
test("test_normal_when_flowchart_auto_layout", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: wrapDirective("flow", JUDGEMENT_AUTO_TEXT),
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  const figure = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="flow"]',
  );
  await expect(figure.locator(".mdmark-diagram-node")).toHaveCount(6);
  await expect(figure.locator("path.mdmark-diagram-wire")).toHaveCount(6);
  // 定義の座標で比べる（倍率に左右されない）
  const layout = await figure.evaluate((element) => {
    const nodes = [
      ...element.querySelectorAll<HTMLElement>(".mdmark-diagram-node"),
    ].map((node) => ({
      id: node.getAttribute("data-node") ?? "",
      x: Number.parseFloat(node.style.left),
      y: Number.parseFloat(node.style.top),
      w: Number.parseFloat(node.style.width),
      h: Number.parseFloat(node.style.height),
    }));
    const wires = [...element.querySelectorAll("path.mdmark-diagram-wire")].map(
      (path) =>
        [
          ...(path.getAttribute("d") ?? "").matchAll(
            /[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g,
          ),
        ].map(([, x = "0", y = "0"]) => [Number(x), Number(y)]),
    );
    const stage = element.querySelector<HTMLElement>(".mdmark-diagram-stage");
    return {
      nodes,
      wires,
      width: Number.parseFloat(stage?.style.width ?? "0"),
      height: Number.parseFloat(stage?.style.height ?? "0"),
    };
  });
  const box = (id: string) => {
    const found = layout.nodes.find((node) => node.id === id);
    if (found === undefined) {
      throw new Error(`ノードが無い: ${id}`);
    }
    return found;
  };
  expect(Math.min(...layout.nodes.map((node) => node.y))).toBe(box("start").y);
  expect(box("q1").y).toBeGreaterThan(box("start").y);
  expect(box("q2").y).toBeGreaterThan(box("q1").y);
  expect(box("a1").x).toBeGreaterThan(box("q1").x + box("q1").w);
  expect(box("r1").x).toBeGreaterThan(box("q2").x + box("q2").w);
  expect(box("r2").y).toBeGreaterThan(box("q2").y + box("q2").h);
  for (const node of layout.nodes) {
    expect(node.x + node.w, node.id).toBeLessThanOrEqual(layout.width);
    expect(node.y + node.h, node.id).toBeLessThanOrEqual(layout.height);
    for (const other of layout.nodes) {
      if (other.id === node.id) {
        continue;
      }
      const overlaps =
        node.x < other.x + other.w &&
        other.x < node.x + node.w &&
        node.y < other.y + other.h &&
        other.y < node.y + node.h;
      expect(overlaps, `${node.id} と ${other.id}`).toBe(false);
    }
  }
  for (const points of layout.wires) {
    for (const [index, [x = 0, y = 0]] of points.slice(1).entries()) {
      const [px = 0, py = 0] = points[index] ?? [];
      expect(px === x || py === y).toBe(true);
    }
  }
  const labels = await figure.locator(".mdmark-diagram-label").allInnerTexts();
  expect(labels.map((text) => text.trim()).sort()).toEqual([
    "NO",
    "NO",
    "YES",
    "YES",
  ]);
});

/** リンク先を持つノードの図を描いたページを開く */
async function openLinkedFlow(page: Page): Promise<void> {
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapDirective(
      "flow",
      linkedFlowText({ hrefs: ["https://example.com/spec", "./other.md"] }),
    ),
  });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

// リンク先を持つノードをリンクにし、押すかフォーカスして Enter でリンク先を開く（正常シナリオ（リンク先を持つノード））
test("test_normal_when_node_link", async ({ page }) => {
  // 準備
  const opened = await routeLinkTargets(page, [
    "https://example.com/spec",
    new URL("other.md", PAGE_URL).href,
  ]);
  await openLinkedFlow(page);
  const linkOf = (id: string) =>
    page.locator(`#doc [data-node="${id}"] a.mdmark-diagram-node-link`);
  // 検証: 2 つのノードがリンクで、名前の上も押せる構造のカーソル。リンク先を持たないノードはリンクでない
  await expect(linkOf("a")).toHaveCount(1);
  await expect(linkOf("b")).toHaveCount(1);
  await expect(linkOf("c")).toHaveCount(0);
  await expect(
    page.locator('#doc [data-node="a"] .mdmark-diagram-node-name'),
  ).toHaveCSS("cursor", "pointer");
  // 実行・検証: https のノードを押すと、そのリンク先が開く
  await linkOf("a").click();
  await page.waitForURL("https://example.com/spec");
  // 実行・検証: 相対パスのノードを押すと、ページの URL を基準にした other.md が開く
  await openLinkedFlow(page);
  await linkOf("b").click();
  await page.waitForURL(new URL("other.md", PAGE_URL).href);
  // 実行・検証: キーボードでフォーカスすると枠が見え、Enter で同じリンク先が開く
  await openLinkedFlow(page);
  await linkOf("a").focus();
  await expect(linkOf("a")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await page.waitForURL("https://example.com/spec");
  expect(opened()).toEqual([
    "https://example.com/spec",
    new URL("other.md", PAGE_URL).href,
    "https://example.com/spec",
  ]);
});

// 許可しないリンク先のノードはリンクにせず、ノードの id とリンク先を記載した記載の警告を配置する（異常シナリオ（ノードのリンク先を許可しない））
test("test_error_when_node_link_not_allowed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  // 実行
  await mountDocument(page, {
    markdown: `${wrapDirective(
      "flow",
      linkedFlowText({ hrefs: ["javascript:alert(1)", "id:spec#items"] }),
    )}\n後の段落\n`,
  });
  // 検証
  await expect(page.locator("#doc a.mdmark-diagram-node-link")).toHaveCount(0);
  await expect(
    page.locator('#doc [data-node="a"] .mdmark-diagram-node-name'),
  ).toHaveText("ノード a");
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  for (const word of ["a", "javascript:alert(1)", "b", "id:spec#items"]) {
    await expect(warning).toContainText(word);
  }
  await page.locator('#doc [data-node="a"]').click();
  await page.waitForTimeout(SETTLE_MS);
  expect(dialogs).toEqual([]);
  expect(page.url()).toBe(PAGE_URL);
  await expect(page.locator("#doc p", { hasText: "後の段落" })).toHaveCount(1);
});
