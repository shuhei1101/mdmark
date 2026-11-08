import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, linesOf, runCli, test, writeFiles } from "../cli.ts";
import {
  CARD_MARKDOWN,
  CARD_SOURCE,
  FRAME_HINT,
  groupFlowText,
  HOST_CSS,
  placeDeclarations,
  registerCard,
  routeCard,
  runTsc,
  sampleBlock,
  stubClipboard,
  TERM_INDEX,
  tabToViewport,
  wrapDirective,
  writtenTexts,
  zoomPercent,
} from "../diagram.ts";
import { mountDocument, openPage } from "../dist-page.ts";
import { expectBelow } from "../tooltip.ts";

// 固有の部品の文字の色と、フロー図の LLM の色（固有の CSS が変える）
const HOST_CARD_COLOR = "rgb(0, 0, 255)";
const HOST_LLM_COLOR = "rgb(255, 0, 0)";

/** 雛形（JavaScript）を配置し、配布物の型定義を配置したフォルダを作る */
async function prepare(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init", "--js"], dir);
  expect(init.code).toBe(0);
  await placeDeclarations(builtRoot, dir);
  return dir;
}

// 雛形に固有の部品と CSS を追加して型で点検し、共通の図の部品と固有の部品で文書を描き、読者が図のツールチップと拡大・縮小・移動で確認する（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備: 雛形を配置し、固有の部品を追記して型で点検する
  const dir = await prepare(builtRoot, tempDir);
  await writeFiles(dir, { "extensions/card.js": CARD_SOURCE });
  const tsc = await runTsc(dir);
  expect(tsc.stdout).toBe("");
  expect(tsc.code).toBe(0);
  const theme = await readFile(join(dir, "theme.css"), "utf8");
  // 準備: hint を持つシステムの枠と 3 層の見本の図の文書を記載し、索引に記載し、設定の extensions に固有の部品を記載する
  const sample = `${CARD_MARKDOWN}\n${wrapDirective("flow", await groupFlowText())}\n図の外の意思決定モデル。\n`;
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  await writeFiles(dir, {
    "mdmark.config.yaml": `${config}\nextensions: [extensions/card.js]\n`,
    "docs/sample.md": sample,
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: sample",
      "    path: docs/sample.md",
      "    title: 見本の図",
      "terms:",
      "  - id: dm",
      "    term: 意思決定モデル",
      "    meaning: 選択肢から選ぶだけの、速く安い判断用の AI",
      "",
    ].join("\n"),
  });
  // 実行・検証: 図の定義のずれを含めて、ずれ 0 件で終わる
  const check = await runCli(builtRoot, ["check"], dir);
  expect(linesOf(check.stdout)).toEqual(["ずれ 0 件"]);
  expect(check.code).toBe(0);
  // 実行: 固有の部品と CSS を読み込むページで、見本の図の文書を描く
  await openPage(page, builtRoot, { hostCss: `${theme}\n${HOST_CSS}` });
  await routeCard(
    page,
    await readFile(join(dir, "extensions/card.js"), "utf8"),
  );
  await registerCard(page);
  await mountDocument(page, { markdown: sample, index: TERM_INDEX });
  // 検証: フロー図が枠・3 層・タイトルと凡例つきで描かれ、残った交差は line jump になる
  const figure = page.locator("#doc figure.mdmark-diagram");
  await expect(figure).toHaveCount(1);
  await expect(figure.locator(".mdmark-diagram-lane")).toHaveCount(3);
  await expect(figure.locator(".mdmark-diagram-frame")).toHaveCount(1);
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    "問い合わせへの自動返信の構成",
  );
  await expect(
    figure.locator('ul[aria-label="凡例"] li').first(),
  ).toBeVisible();
  // 凡例には、図に 2 種類以上あるノードの種類と線の種類だけが載る
  const legend = await figure
    .locator('ul[aria-label="凡例"] li')
    .allInnerTexts();
  for (const word of ["システムの枠", "層", "交差", "出る", "下線"]) {
    expect(
      legend.some((text) => text.includes(word)),
      word,
    ).toBe(false);
  }
  const arcs = await figure
    .locator('.mdmark-diagram-wires > path[data-line="flow"]')
    .evaluateAll(
      (paths) =>
        paths.filter((path) => (path.getAttribute("d") ?? "").includes(" A"))
          .length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  // 固有の部品が、固有の CSS の外観で描かれる
  const card = page.locator("#doc .host-card");
  await expect(card).toHaveText("固有の題");
  await expect(card).toHaveCSS("color", HOST_CARD_COLOR);
  await expect(page.locator('#doc [data-node="draft"]')).toHaveCSS(
    "border-top-color",
    HOST_LLM_COLOR,
  );
  // 矢印のラベル・ノードのマーカー・ノードの中の用語にフォーカスかポインターでツールチップが出て、Esc で消える
  const label = page.locator(".mdmark-diagram-label.has-tip", {
    hasText: "メール",
  });
  await label.focus();
  const wireTip = page.locator('[role="tooltip"]', {
    hasText: "件名・本文・送信者のアドレス",
  });
  await expect(wireTip).toBeVisible();
  await expectBelow({ tip: wireTip, owner: label });
  await page.keyboard.press("Escape");
  await expect(wireTip).toBeHidden();
  const info = page.getByRole("button", { name: "「分類」の入力・処理・出力" });
  await info.focus();
  const ioTip = page
    .locator('[role="tooltip"]')
    .filter({ hasText: "返信の種類" });
  await expect(ioTip.first()).toBeVisible();
  await expectBelow({
    tip: ioTip.first(),
    owner: page.locator('#doc [data-node="classify"]'),
  });
  await page.keyboard.press("Escape");
  await expect(ioTip.first()).toBeHidden();
  // システムの枠のタイトルのマーカーにフォーカスすると、枠の hint がマーカーの下に出て、Esc で消える
  const frameInfo = figure.locator(
    ".mdmark-diagram-frame-title .mdmark-diagram-group-info",
  );
  await frameInfo.focus();
  const frameTip = page.locator('[role="tooltip"]', { hasText: FRAME_HINT });
  await expect(frameTip).toBeVisible();
  await expectBelow({ tip: frameTip, owner: frameInfo });
  await page.keyboard.press("Escape");
  await expect(frameTip).toBeHidden();
  const term = page.locator("#doc .mdmark-diagram-node .mdmark-term").first();
  await term.hover();
  await expect(
    page.locator(`[id="${await term.getAttribute("aria-describedby")}"]`),
  ).toContainText("選択肢から選ぶだけの");
  await page.mouse.move(0, 0);
  // 図は全体が収まる倍率で開き、右上のボタンとキーの + - 0 で拡大・縮小でき、ドラッグと矢印キーで動かせる
  const fit = await zoomPercent(page);
  expect(fit).toBe(100);
  await page.getByRole("button", { name: "拡大" }).click();
  expect(await zoomPercent(page)).toBeGreaterThan(fit);
  await tabToViewport(page);
  await page.keyboard.press("-");
  expect(await zoomPercent(page)).toBe(fit);
  await page.keyboard.press("+");
  await page.getByRole("button", { name: "拡大" }).click();
  const viewport = page.locator(
    '#doc [role="group"][aria-roledescription="図"]',
  );
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(80);
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  const start = await viewport.evaluate((element) => element.scrollLeft);
  await page.mouse.move(box.x + box.width / 2, box.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 50, box.y + 4, { steps: 5 });
  await page.mouse.up();
  expect(
    await viewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(start);
  // 拡大して下へ動かしても、表示する枠に見えているシステムの枠のタイトルが上端に留まる
  await viewport.evaluate((element) => {
    element.scrollTop = Math.min(
      element.scrollHeight - element.clientHeight,
      element.clientHeight / 2,
    );
  });
  const frameTitle = figure.locator(".mdmark-diagram-frame-title");
  const viewportTop = (await viewport.boundingBox())?.y ?? 0;
  await expect(frameTitle).toHaveClass(/\bis-stuck\b/);
  expect((await frameTitle.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(
    viewportTop - 1,
  );
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
  // 右下のリサイズハンドルを下へドラッグすると、表示する枠が高くなる
  const handle = figure.getByRole("separator");
  const handleBox = await handle.boundingBox();
  const before = (await viewport.boundingBox())?.height ?? 0;
  if (!handleBox) {
    throw new Error("リサイズハンドルの範囲を取れない");
  }
  // 高くできる分（図の全体が収まる高さまで）を作るため、先に ↑ で低くする
  await handle.focus();
  for (let count = 0; count < 3; count += 1) {
    await page.keyboard.press("ArrowUp");
  }
  const lowered = (await viewport.boundingBox())?.height ?? 0;
  expect(lowered).toBeLessThan(before);
  const grip = await handle.boundingBox();
  if (!grip) {
    throw new Error("リサイズハンドルの範囲を取れない");
  }
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2,
    grip.y + grip.height / 2 + 40,
    {
      steps: 5,
    },
  );
  await page.mouse.up();
  expect((await viewport.boundingBox())?.height ?? 0).toBeGreaterThan(lowered);
});

// 雛形に追加した操作できる部品の文書を描き、スライダーでグラフが再描画され、今の値を写す（正常シナリオ（操作できる部品を配置する））
test("test_normal_when_interactive", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: wrapDirective("param", await sampleBlock("strength")),
  });
  // 検証: スライダー・グラフ・今の値を写すボタンが描かれる
  const param = page.locator("#doc .mdmark-param");
  const slider = param.getByRole("slider", { name: "反応の強さ" });
  await expect(slider).toBeVisible();
  await expect(param.locator("svg[role=img]")).toHaveCount(1);
  await expect(
    param.getByRole("button", { name: "今の値を写す" }),
  ).toBeVisible();
  // スライダーを動かすと、グラフが新しい値で再描画される
  await slider.fill("8");
  await expect(param.locator("svg[role=img]")).toHaveAttribute(
    "aria-label",
    /今の値（8）/,
  );
  // 今の値を写すと、スライダーの今の値を JSON にした文字列がクリップボードに入る
  await param.getByRole("button", { name: "今の値を写す" }).click();
  await expect.poll(async () => (await writtenTexts(page)).length).toBe(1);
  expect(JSON.parse((await writtenTexts(page))[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
});

// 型を誤った固有の部品は 1 回目の点検でファイルと行を出して落ち、手で修正すると 2 回目の点検が通り、その後の文書に固有の部品が描かれる（異常シナリオ（追加した JavaScript の型が合わない））
test("test_error_when_type_mismatch", async ({ builtRoot, tempDir, page }) => {
  // 準備: 雛形を配置し、型を誤った固有の部品を追記する
  const dir = await prepare(builtRoot, tempDir);
  const file = join(dir, "extensions", "card.js");
  const broken = CARD_SOURCE.replace(
    "slot.textContent = definition.title;",
    "slot.textContent = definition.title.length;",
  );
  expect(broken).not.toBe(CARD_SOURCE);
  await writeFile(file, broken);
  // 実行・検証: 1 回目の点検は、誤りのファイルと行を出して終了コードが 0 以外
  const first = await runTsc(dir);
  expect(first.code).not.toBe(0);
  const line =
    broken
      .split("\n")
      .findIndex((text) => text.includes("definition.title.length")) + 1;
  expect(first.stdout).toContain(`extensions/card.js(${line},`);
  // 実行・検証: 手で修正した後の 2 回目の点検は、誤り 0 件で終了コードが 0
  await writeFile(file, CARD_SOURCE);
  const second = await runTsc(dir);
  expect(second.stdout).toBe("");
  expect(second.code).toBe(0);
  // 検証: その後に描いた文書に、固有の部品が描かれる
  await openPage(page, builtRoot, { hostCss: HOST_CSS });
  await routeCard(page, await readFile(file, "utf8"));
  await registerCard(page);
  await mountDocument(page, { markdown: `${CARD_MARKDOWN}\n本文の段落\n` });
  await expect(page.locator("#doc .host-card")).toHaveText("固有の題");
  await expect(page.locator("#doc > p")).toHaveText("本文の段落");
});

/** 2 つのノードが重なる座標と、ノードの幅に収まらない長さの名前を持つ（`broken` が true）か、修正した後のフロー図の文書 */
function driftFlowMarkdown(broken: boolean): string {
  return wrapDirective(
    "flow",
    JSON.stringify(
      {
        title: "受け付けの流れ",
        scope: "点検",
        updated: "2026-11-03",
        width: 480,
        height: 200,
        nodes: [
          {
            id: "intake",
            kind: "script",
            x: 20,
            y: 40,
            w: 120,
            h: 60,
            name: "受け付け",
          },
          {
            id: "store",
            kind: "data",
            x: broken ? 80 : 300,
            y: 40,
            w: 120,
            h: 60,
            name: broken
              ? "問い合わせの本文と添付を保存する先".repeat(3)
              : "保存先",
          },
        ],
        wires: [],
      },
      null,
      2,
    ),
  );
}

// 図の定義のずれを 1 回目の点検で見つけ、修正した後の 2 回目の点検に合格し、ノードが重ならず名前が収まる図を描く（異常シナリオ（図の定義にずれがある））
test("test_error_when_diagram_drift", async ({ builtRoot, tempDir, page }) => {
  // 準備: 雛形を配置し、ずれを持つ図の文書を記載して索引に記載する
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  const file = join(dir, "docs", "flow.md");
  const broken = `# 流れ\n\n${driftFlowMarkdown(true)}`;
  await writeFiles(dir, {
    "docs/flow.md": broken,
    "index.yaml": [
      "schema: 2",
      "docs:",
      "  - id: flow",
      "    path: docs/flow.md",
      "    title: 流れ",
      "",
    ].join("\n"),
  });
  const flowLine = broken.split("\n").indexOf("<!-- flow -->") + 1;
  // 実行・検証: 1 回目の点検は、ノードの重なりとラベルの長さのずれを出して終了コードが 0 以外
  const first = await runCli(builtRoot, ["check"], dir);
  expect(first.code).not.toBe(0);
  const lines = linesOf(first.stdout);
  const overlap = lines.find((line) =>
    line.startsWith(`docs/flow.md:${flowLine}: diagram_node_overlap:`),
  );
  expect(overlap).toContain("intake");
  expect(overlap).toContain("store");
  const label = lines.find((line) =>
    line.startsWith(`docs/flow.md:${flowLine}: diagram_label_too_long:`),
  );
  expect(label).toContain("store");
  // 検証: 点検は文書を書き換えない
  expect(await readFile(file, "utf8")).toBe(broken);
  // 実行・検証: 修正した後の 2 回目の点検は、ずれ 0 件で終了コードが 0
  const fixed = `# 流れ\n\n${driftFlowMarkdown(false)}`;
  await writeFile(file, fixed);
  const second = await runCli(builtRoot, ["check"], dir);
  expect(linesOf(second.stdout)).toEqual(["ずれ 0 件"]);
  expect(second.code).toBe(0);
  // 実行: 修正した文書を描く
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: fixed });
  // 検証: ノードが重ならず、名前がノードの中に収まる
  const nodes = page.locator("#doc .mdmark-diagram-node");
  await expect(nodes).toHaveCount(2);
  const [a, b] = await Promise.all([
    nodes.nth(0).boundingBox(),
    nodes.nth(1).boundingBox(),
  ]);
  expect((a?.x ?? 0) + (a?.width ?? 0)).toBeLessThanOrEqual(b?.x ?? 0);
  for (const index of [0, 1]) {
    const fits = await nodes
      .nth(index)
      .evaluate(
        (node) =>
          node.scrollWidth <= node.clientWidth &&
          node.scrollHeight <= node.clientHeight,
      );
    expect(fits).toBe(true);
  }
});
