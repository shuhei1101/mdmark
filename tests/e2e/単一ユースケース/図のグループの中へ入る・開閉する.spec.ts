import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Locator } from "@playwright/test";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  bandCount,
  FLOW_RANGE,
  MAP_BLOCK_SEQUENCE,
  MAP_CONFIG,
  MAP_CONFIG_YAML,
  MAP_DATA_VALUE,
  MAP_FLOW,
  mapFigure,
  mapNode,
  mapRange,
  mapTool,
  mapWire,
  nodeLayout,
  openMap,
  overlaps,
  pointOnPath,
  reloadMap,
  searchParam,
  viewState,
} from "../map.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** 図の中の、今入っているグループのタイトル */
const current = (figure: Locator) =>
  figure.locator(".map-group-title.is-current");

/** 構成図の範囲（補足を差し替えられる） */
function flowWith(data: Record<string, unknown>, args?: string): string {
  return mapRange({
    ...(args === undefined ? {} : { args }),
    mermaid: MAP_FLOW,
    data: JSON.stringify(data),
  });
}

// グループのタイトルで中へ入り、戻るボタンと Esc で 1 つ外の段へ戻る（正常シナリオ）
test("test_normal", async ({ builtRoot, page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const figure = mapFigure(page);
  const whole = await nodeLayout(figure);
  const start = await viewState(figure);
  // 検証: 右上のツールの並びと、全体の図では戻るが押せない
  const tools = figure.locator(
    '.mdmark-diagram-tools-group[data-group="map"] [data-tool]',
  );
  await expect(tools).toHaveCount(4);
  expect(
    await tools.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-tool")),
    ),
  ).toEqual(["back", "expandAll", "collapseAll", "reset"]);
  await expect(mapTool(figure, "back")).toBeDisabled();
  await expect(
    figure.locator('.mdmark-diagram-tools-group[data-group="pan"]'),
  ).toHaveCount(0);
  // 実行: 外のグループのタイトルを押す
  await figure.locator('[data-group-enter="lib"]').click();
  // 検証: 中だけを配置し直し、外は薄く残す
  await expect(current(figure)).toHaveText("mdmark");
  await expect(mapTool(figure, "back")).toBeEnabled();
  await expect(mapNode(figure, "user")).toHaveClass(/map-faded/);
  await expect(mapNode(figure, "mount")).not.toHaveClass(/map-faded/);
  const inner = await figure
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node:not(.map-faded)")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
  for (const [i, a] of inner.entries()) {
    for (const b of inner.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  }
  // 検証: 外から中のノードへの線が、薄く描かれた外のノードから引かれる
  const user = await mapNode(figure, "user").boundingBox();
  const [sx, sy] = await pointOnPath(mapWire(figure, "user->mount"), 0);
  expect(
    sx >= (user?.x ?? 0) - 2 &&
      sx <= (user?.x ?? 0) + (user?.width ?? 0) + 2 &&
      sy >= (user?.y ?? 0) - 2 &&
      sy <= (user?.y ?? 0) + (user?.height ?? 0) + 2,
  ).toBe(true);
  // 検証: 入ったグループのタイトルは押せない
  await expect(figure.locator('[data-group-enter="lib"]')).toHaveCount(0);
  // 検証: 残る要素は位置を動かして見せる
  expect(
    await mapNode(figure, "mount").evaluate(
      (node) => getComputedStyle(node).transitionProperty,
    ),
  ).not.toBe("none");
  // 実行: 中のグループのタイトルにフォーカスして Enter
  await figure.locator('[data-group-enter="read"]').focus();
  await page.keyboard.press("Enter");
  await expect(current(figure)).toHaveText("記法の読み取り");
  // 実行・検証: 戻るボタンで 1 つ外へ
  await mapTool(figure, "back").click();
  await expect(current(figure)).toHaveText("mdmark");
  // 実行・検証: Esc で全体の図へ戻る
  await figure.locator(".mdmark-diagram-viewport").focus();
  await page.keyboard.press("Escape");
  await expect(current(figure)).toHaveCount(0);
  await expect(mapTool(figure, "back")).toBeDisabled();
  // 検証: 入る前と同じ配置で、倍率・表示する枠の高さ・スクロールが変わらない
  await expect.poll(() => nodeLayout(figure)).toEqual(whole);
  const end = await viewState(figure);
  expect(end.transform).toBe(start.transform);
  expect(end.height).toBeCloseTo(start.height, 0);
  expect(end.scroll).toEqual(start.scroll);
  expect(end.page).toEqual(start.page);
});

// グループを 1 つのノードに閉じ、同じ相手への線をまとめ、読み込み直しても閉じたまま描く（正常シナリオ（グループを閉じる））
test("test_normal_when_collapsed", async ({ builtRoot, page, context }) => {
  // 準備: 閉じる「記法の読み取り」の mermaid と data から、外の layout へ 2 本の線がある。data->layout に説明を持つ
  const note = "上書きを自動配置に当てる";
  const markdown = flowWith({
    ...MAP_DATA_VALUE,
    notes: { ...MAP_DATA_VALUE.notes, "data->layout": { text: note } },
  });
  await openMap(page, builtRoot, { markdown });
  const figure = mapFigure(page);
  const whole = await nodeLayout(figure);
  const toggle = figure.locator('[data-group-toggle="read"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-label", "記法の読み取りを閉じる");
  const groupBox = await figure
    .locator('.map-group[data-group="read"]')
    .boundingBox();
  // 実行: 開閉のボタンを押す
  await toggle.click();
  // 検証: グループの名前と中のノードの数の 1 つのノードになる
  const closed = figure.locator('.map-closed-group[data-group="read"]');
  await expect(closed).toContainText("記法の読み取り");
  await expect(closed).toContainText("3");
  const open = closed.locator('[data-group-toggle="read"]');
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(open).toHaveAttribute("aria-label", "記法の読み取りを開く");
  const closedBox = await closed.boundingBox();
  const openBox = await open.boundingBox();
  expect((openBox?.x ?? 0) - (closedBox?.x ?? 0)).toBeLessThanOrEqual(12);
  expect((openBox?.y ?? 0) - (closedBox?.y ?? 0)).toBeLessThanOrEqual(16);
  expect(closedBox?.height ?? 0).toBeLessThan(groupBox?.height ?? 0);
  // 検証: 外の layout への 2 本の線が 1 本にまとまり、ラベルを出さない
  await expect(mapWire(figure, "read->layout")).toHaveCount(1);
  await expect(
    figure.locator('.mdmark-diagram-label[data-wire="read->layout"]'),
  ).toHaveCount(0);
  // 実行・検証: まとめた線にポインターを当てると、ほかを薄くし、説明を持つ元の線を出す
  const [x, y] = await pointOnPath(
    figure.locator('.map-wire-hit[data-wire="read->layout"]'),
  );
  await page.mouse.move(x, y);
  const tip = page.locator('[role="tooltip"]', { hasText: note });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("補足の検査");
  await expect(mapNode(figure, "user")).toHaveClass(/map-dim/);
  await page.mouse.move(5, 5);
  // 実行・検証: 同じタブで読み込み直しても閉じたまま
  await reloadMap(page, { markdown });
  await expect(
    mapFigure(page).locator('.map-closed-group[data-group="read"]'),
  ).toHaveCount(1);
  // 実行・検証: 開くと閉じる前と同じ配置に戻る
  await mapFigure(page).locator('[data-group-toggle="read"]').click();
  await expect.poll(() => nodeLayout(mapFigure(page))).toEqual(whole);
  // 実行・検証: 中へ入るとクエリ文字列に map-1 が入り、履歴は増えない
  const length = await page.evaluate(() => history.length);
  await mapFigure(page).locator('[data-group-enter="lib"]').click();
  await mapFigure(page).locator('[data-group-enter="read"]').click();
  expect(await searchParam(page, "map-1")).toBe("read");
  const other = await context.newPage();
  await other.setViewportSize({ width: 1280, height: 900 });
  await openMap(other, builtRoot, { markdown, search: "?map-1=read" });
  await expect(current(mapFigure(other))).toHaveText("記法の読み取り");
  await other.close();
  await mapTool(mapFigure(page), "back").click();
  expect(await searchParam(page, "map-1")).toBe("lib");
  await mapTool(mapFigure(page), "back").click();
  expect(await searchParam(page, "map-1")).toBeNull();
  expect(await page.evaluate(() => history.length)).toBe(length);
});

// 補足で最初に閉じた中のグループを、Shift の開閉と全て開く・全て閉じるで開閉する（正常シナリオ（中のグループごと開閉する））
test("test_normal_when_nested_toggle", async ({ builtRoot, page }) => {
  // 準備・実行
  await openMap(page, builtRoot, {
    markdown: flowWith({
      ...MAP_DATA_VALUE,
      layout: {
        ...MAP_DATA_VALUE.layout,
        read: { color: "blue", collapsed: true },
      },
    }),
  });
  const figure = mapFigure(page);
  const closedIds = () =>
    figure
      .locator(".map-closed-group")
      .evaluateAll((groups) =>
        groups.map((group) => group.getAttribute("data-group")).sort(),
      );
  // 検証: 指定した中のグループだけが閉じている
  expect(await closedIds()).toEqual(["read"]);
  // 実行・検証: Shift を押しながら外のグループを閉じると、中のグループも閉じ、外を開いても中は閉じたまま
  await figure
    .locator('[data-group-toggle="lib"]')
    .click({ modifiers: ["Shift"] });
  expect(await closedIds()).toEqual(["lib"]);
  await figure.locator('[data-group-toggle="lib"]').click();
  expect(await closedIds()).toEqual(["place", "read"]);
  // 実行・検証: 全て開く・全て閉じる
  await mapTool(figure, "expandAll").click();
  expect(await closedIds()).toEqual([]);
  await mapTool(figure, "collapseAll").click();
  expect((await closedIds()).length).toBeGreaterThan(0);
  await expect(figure.locator(".map-group")).toHaveCount(0);
});

// 印の focus で、指定のグループの中から描く（正常シナリオ（印の引数で最初に入る））
test("test_normal_when_initial_focus", async ({ builtRoot, page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const whole = await nodeLayout(mapFigure(page));
  const markdown = flowWith(
    MAP_DATA_VALUE,
    '{"title": "全体の構成", "focus": "lib"}',
  );
  // 実行
  await openMap(page, builtRoot, { markdown });
  const figure = mapFigure(page);
  // 検証
  await expect(current(figure)).toHaveText("mdmark");
  await expect(mapTool(figure, "back")).toBeEnabled();
  // 実行・検証: 戻ると正常シナリオの全体の図と同じ配置
  await mapTool(figure, "back").click();
  await expect.poll(() => nodeLayout(figure)).toEqual(whole);
  // 実行・検証: 別のグループに入ってから再読み込みすると、保った状態から描く
  await figure.locator('[data-group-enter="store"]').click();
  await reloadMap(page, { markdown });
  await expect(current(mapFigure(page))).toHaveText("データ");
});

// url_state が false ならクエリ文字列に保たず、まとめた HTML で文書を切り替えると map-1 を消す（正常シナリオ（クエリ文字列に保たない設定と、まとめた HTML の文書の切り替え））
test("test_normal_when_url_state_disabled_or_document_switched", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備・実行: url_state が false のページ
  const config = { map: { ...MAP_CONFIG, url_state: false } };
  await openMap(page, builtRoot, {
    markdown: FLOW_RANGE,
    config: config as never,
  });
  await mapFigure(page).locator('[data-group-enter="place"]').click();
  // 検証: クエリ文字列が変わらない
  expect(await page.evaluate(() => location.search)).toBe("");
  // 実行・検証: 読み込み直すと sessionStorage の状態のまま
  await reloadMap(page, { markdown: FLOW_RANGE, config: config as never });
  await expect(current(mapFigure(page))).toHaveText("配置");
  // 実行・検証: map-1 を付けた URL を開いても全体の図から描く
  await openMap(page, builtRoot, {
    markdown: FLOW_RANGE,
    config: config as never,
    search: "?map-1=read",
  });
  await expect(current(mapFigure(page))).toHaveCount(0);
  // 準備: map の構成図を 1 つずつ持つ文書 A・B をまとめる
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      ...MAP_CONFIG_YAML,
      "build:",
      '  include: ["A.md", "B.md"]',
      "  entry: A.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "A.md": `# 文書A\n\n${FLOW_RANGE}`,
    "B.md": `# 文書B\n\n${FLOW_RANGE}`,
  });
  const result = await runCli(builtRoot, ["build"], dir);
  expect(result.code).toBe(0);
  // 実行: 文書 A でグループの中へ入る
  await page.goto(pathToFileURL(join(dir, "dist", "docs.html")).href);
  const figureIn = page.locator(
    'article figure.mdmark-diagram[data-diagram="map"]',
  );
  await expect(figureIn).toBeVisible({ timeout: 10_000 });
  await figureIn.locator('[data-group-enter="place"]').click();
  expect(await searchParam(page, "map-1")).toBe("place");
  // 実行: 文書の一覧から文書 B へ切り替える
  await page.locator('.mdmark-bundle-side a[data-doc-path="B.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("文書B");
  // 検証: map-1 が消え、文書 B は全体の図から描く
  expect(await searchParam(page, "map-1")).toBeNull();
  await expect(figureIn).toBeVisible();
  await expect(figureIn.locator(".map-group-title.is-current")).toHaveCount(0);
});

// シーケンス図のブロックを山形で開閉し、タブの名前で中だけを描く（正常シナリオ（シーケンス図のブロックを開閉し、中だけを見る））
test("test_normal_when_sequence_blocks", async ({ builtRoot, page }) => {
  // 準備
  const markdown = mapRange({
    args: '{"title": "描くまでの流れ"}',
    mermaid: MAP_BLOCK_SEQUENCE,
  });
  await openMap(page, builtRoot, { markdown });
  const figure = mapFigure(page);
  const tab = (n: number) =>
    figure.locator(`.map-seq-fragment-tab[data-fragment="${n}"]`);
  // 検証: %% block の名前がタブに出て、戻るは押せない
  await expect(tab(0)).toContainText("描く前の準備");
  await expect(mapTool(figure, "back")).toBeDisabled();
  await expect(bandCount(figure)).toHaveText("–/7");
  // 実行: alt の山形を押す
  await figure.locator('[data-fragment-toggle="2"]').click();
  // 検証: 名前とメッセージの数の 1 行になり、帯の数が減る
  await expect(tab(2)).toContainText("alt");
  await expect(tab(2)).toContainText("mermaid のブロックがある");
  await expect(tab(2).locator(".map-seq-fragment-count")).toHaveText(
    "メッセージ 4 件",
  );
  await expect(
    figure.locator(".mdmark-diagram-label[data-message]"),
  ).toHaveCount(3);
  await expect(bandCount(figure)).toHaveText("–/3");
  await mapTool(figure, "expandAll").click();
  // 実行: loop のタブの名前を押す
  await figure.locator('[data-fragment-enter="1"]').click();
  // 検証: loop の枠とタブを残し、関わる参加者だけを並べる
  await expect(
    tab(1).locator(".map-seq-fragment-title.is-current"),
  ).toHaveCount(1);
  await expect(tab(1).locator("button")).toHaveCount(0);
  expect(
    await figure
      .locator(".map-participant")
      .evaluateAll((heads) =>
        heads.map((head) => head.getAttribute("data-participant")),
      ),
  ).toEqual(["mount", "marker", "mermaid", "layout"]);
  expect(await searchParam(page, "map-1")).toBe("1");
  await expect(mapTool(figure, "back")).toBeEnabled();
  // 実行・検証: その URL を開くと同じブロックの中から描く
  await openMap(page, builtRoot, { markdown, search: "?map-1=1" });
  const reopened = mapFigure(page);
  await expect(
    reopened.locator('.map-seq-fragment-tab[data-fragment="1"] .is-current'),
  ).toHaveCount(1);
  // 実行・検証: 戻るで全体の図に戻る
  await mapTool(reopened, "back").click();
  await expect(reopened.locator(".map-participant")).toHaveCount(5);
  await expect(mapTool(reopened, "back")).toBeDisabled();
  // 実行・検証: Shift を押しながら山形を押すと、中のブロックも開閉する
  await reopened
    .locator('[data-fragment-toggle="1"]')
    .click({ modifiers: ["Shift"] });
  await reopened.locator('[data-fragment-toggle="1"]').click();
  await expect(reopened.locator('[data-fragment-toggle="2"]')).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await mapTool(reopened, "expandAll").click();
  // 実行・検証: 全てのブロックを閉じると、閉じた行から活性化の帯を描く
  await mapTool(reopened, "collapseAll").click();
  const row = await reopened
    .locator("rect.map-seq-fragment.is-collapsed")
    .first()
    .boundingBox();
  const bar = await reopened.locator(".map-seq-activation").boundingBox();
  const last = await reopened
    .locator('path.mdmark-diagram-wire[data-message="6"]')
    .boundingBox();
  expect(bar).not.toBeNull();
  expect(bar?.y ?? 0).toBeLessThanOrEqual(
    (row?.y ?? 0) + (row?.height ?? 0) + 2,
  );
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeGreaterThanOrEqual(
    (last?.y ?? 0) - 2,
  );
});
