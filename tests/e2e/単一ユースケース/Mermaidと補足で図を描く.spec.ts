import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  routeLucide,
} from "../dist-page.ts";
import {
  centerOf,
  clickWire,
  dragBy,
  FLOW_RANGE,
  isDimmed,
  isSelected,
  LONG_LABEL,
  MAP_CONFIG,
  MAP_DATA_VALUE,
  MAP_FLOW,
  MAP_TERM_INDEX,
  MAP_WAIT_MS,
  mapFigure,
  mapNode,
  mapRange,
  mapTool,
  mapWire,
  mapWireHit,
  NODE_NOTE,
  nodeLayout,
  openMap,
  overlaps,
  packetOwners,
  pointOnPath,
  reloadMap,
  resolveColor,
  viewState,
  WIRE_NOTE,
} from "../map.ts";
import { MERMAID_ENTRY, routeMermaid } from "../mermaid.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// 図を描くページの画面の大きさ（図が図の枠より広い）
const VIEWPORT = { width: 1280, height: 900 };

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
});

/** 正常シナリオの文書: 構成図の範囲・文書の中の <script>・後の段落 */
const NORMAL_MARKDOWN = `前の段落\n\n${FLOW_RANGE}\n<script>window.__mdmarkScriptRan = true;</script>\n\n後の段落\n`;

/** 補足を差し替えた構成図の範囲 */
function flowWith(
  data: Record<string, unknown>,
  args = '{"title": "全体の構成"}',
) {
  return mapRange({ args, mermaid: MAP_FLOW, data: JSON.stringify(data) });
}

/** 図のノードの矩形（ページの座標） */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("要素の矩形が無い");
  return box;
}

/** mermaid の本体への要求の件数 */
const entryCount = (requests: string[]) =>
  requests.filter((file) => file === MERMAID_ENTRY).length;

/** 図の中の全てのノードの矩形 */
function nodeBoxes(figure: Locator) {
  return figure
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          id:
            node.getAttribute("data-node") ??
            node.getAttribute("data-group") ??
            "",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
}

// map の範囲の Mermaid と補足を、入れ子のグループを自動配置した構成図にして描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const requests = await routeMermaid(page);
  // 実行
  await openMap(page, builtRoot, {
    markdown: NORMAL_MARKDOWN,
    index: MAP_TERM_INDEX,
  });
  const figure = mapFigure(page);
  // 検証: 図の枠とタイトル。Mermaid と補足の文字は出ない
  const doc = page.locator("#doc");
  await expect(figure.locator(".mdmark-diagram-stage")).toBeVisible();
  await expect(doc).not.toContainText("flowchart LR");
  await expect(doc).not.toContainText('"walkthroughs"');
  await expect(figure.locator(".mdmark-diagram-title")).toHaveText(
    "全体の構成",
  );
  await expect(figure.locator(".mdmark-diagram-meta")).toHaveCount(0);
  // 検証: ポインターの形状
  const cursorOf = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).cursor);
  expect(
    await cursorOf(
      mapNode(figure, "mount").locator(".mdmark-diagram-node-kind"),
    ),
  ).toBe("grab");
  expect(
    await cursorOf(
      mapNode(figure, "mount").locator(".mdmark-diagram-node-name"),
    ),
  ).toBe("text");
  // 検証: 入れ子と並びの向き
  const lib = await boxOf(figure.locator('.map-group[data-group="lib"]'));
  const read = await boxOf(figure.locator('.map-group[data-group="read"]'));
  expect(read.x).toBeGreaterThanOrEqual(lib.x);
  expect(read.x + read.width).toBeLessThanOrEqual(lib.x + lib.width);
  expect(read.y + read.height).toBeLessThanOrEqual(lib.y + lib.height);
  const mount = await boxOf(mapNode(figure, "mount"));
  expect(mount.x + mount.width).toBeLessThan(read.x);
  const marker = await boxOf(mapNode(figure, "marker"));
  const mermaid = await boxOf(mapNode(figure, "mermaid"));
  expect(marker.y + marker.height).toBeLessThan(mermaid.y);
  // 検証: ノードとグループが重ならない
  const nodes = await nodeBoxes(figure);
  expect(nodes.length).toBe(10);
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
    }
  }
  const place = await boxOf(figure.locator('.map-group[data-group="place"]'));
  const store = await boxOf(figure.locator('.map-group[data-group="store"]'));
  expect(overlaps(read, place)).toBe(false);
  expect(overlaps(lib, store)).toBe(false);
  // 検証: 長いラベルはノードの幅の上限で折り返し、ノードの中に収まる
  const long = mapNode(figure, "layout");
  await expect(long.locator(".mdmark-diagram-node-name")).toHaveText(
    LONG_LABEL,
  );
  const fit = await long.evaluate((element) => {
    const name = element.querySelector<HTMLElement>(
      ".mdmark-diagram-node-name",
    );
    const line = Number.parseFloat(
      getComputedStyle(name ?? element).lineHeight,
    );
    return {
      width: element.getBoundingClientRect().width,
      lines: Math.round((name?.getBoundingClientRect().height ?? 0) / line),
      inside: element.scrollHeight <= element.clientHeight + 1,
    };
  });
  expect(fit.width).toBeLessThanOrEqual(220);
  expect(fit.lines).toBeGreaterThanOrEqual(2);
  expect(fit.inside).toBe(true);
  // 検証: 種類の行が左上にあり、種類を書かないノードは種類の文字を出さない
  for (const id of ["user", "mount", "layout", "index", "frame"]) {
    const kind = await boxOf(
      mapNode(figure, id).locator(".mdmark-diagram-node-kind"),
    );
    const name = await boxOf(
      mapNode(figure, id).locator(".mdmark-diagram-node-name"),
    );
    expect(kind.y, id).toBeLessThan(name.y);
  }
  await expect(
    mapNode(figure, "frame").locator(".mdmark-diagram-node-kind"),
  ).toHaveText("");
  // 検証: 設定の種類の名前・アイコン・形・色。凡例は無い
  const index = mapNode(figure, "index");
  await expect(index).toHaveAttribute("data-shape", "rect");
  await expect(index.locator(".mdmark-diagram-node-kind")).toHaveText("保存先");
  await expect(index.locator(".mdmark-diagram-node-kind svg")).toHaveCount(1);
  await expect(mapNode(figure, "user")).toHaveAttribute("data-shape", "pill");
  await expect(figure.locator(".mdmark-diagram-legend li")).toHaveCount(0);
  // 検証: 矢じりは線と同じ色
  const head = await mapWire(figure, "mount->marker").evaluate((path) => {
    const id = /url\(#(.+)\)/.exec(path.getAttribute("marker-end") ?? "")?.[1];
    const marker = id ? document.getElementById(id) : null;
    const shape = marker?.querySelector("path");
    return {
      line: getComputedStyle(path).stroke,
      head: shape
        ? getComputedStyle(shape).fill === "none"
          ? getComputedStyle(shape).stroke
          : getComputedStyle(shape).fill
        : "",
    };
  });
  expect(head.head).toBe(head.line);
  // 検証: 交差する線は飛び越えの弧で描く
  const arcs = await figure
    .locator("path.mdmark-diagram-wire")
    .evaluateAll(
      (paths) =>
        paths.filter((path) =>
          / A[\d.]+,[\d.]+ /.test(path.getAttribute("d") ?? ""),
        ).length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  // 検証: 線のラベルはノードに重ならない
  const labels = await figure
    .locator(".mdmark-diagram-label")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return {
          id: "",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
  for (const label of labels) {
    for (const node of nodes) {
      expect(overlaps(label, node), node.id).toBe(false);
    }
  }
  // 検証: notes を持つノードのマーカーにフォーカスすると説明が出る
  await long.locator(".mdmark-diagram-info").focus();
  await expect(
    page.locator('[role="tooltip"]', { hasText: NODE_NOTE }),
  ).toBeVisible();
  await long.locator(".mdmark-diagram-info").blur();
  // 検証: 線にポインターを当てると、ほかが薄くなり印が流れ、説明が出る。ポインターの形状は変わらない
  const [wx, wy] = await pointOnPath(mapWireHit(figure, "mount->marker"));
  await page.mouse.move(wx, wy);
  await expect.poll(() => packetOwners(figure)).toEqual(["mount->marker"]);
  expect(await isDimmed(mapNode(figure, "mount"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "marker"))).toBe(false);
  expect(await isDimmed(mapWire(figure, "mount->marker"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "index"))).toBe(true);
  expect(await isDimmed(mapWire(figure, "doc->marker"))).toBe(true);
  await expect(
    page.locator('[role="tooltip"]', { hasText: WIRE_NOTE }),
  ).toBeVisible();
  expect(
    await figure
      .locator(".mdmark-diagram-viewport")
      .evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("pointer");
  await page.mouse.move(5, 5);
  await expect(figure.locator(".map-packet")).toHaveCount(0);
  // 検証: 図の枠は置き場所の幅いっぱいで、リサイズハンドルがあり、本文の幅との切り替えが無い。等倍のまま横にスクロールする
  const docBox = await boxOf(doc);
  const frame = await boxOf(figure);
  expect(frame.width).toBeGreaterThanOrEqual(docBox.width - 2);
  await expect(figure.locator(".mdmark-diagram-resize")).toBeVisible();
  await expect(figure.locator('button[aria-label*="本文の幅"]')).toHaveCount(0);
  const view = await figure
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(view.scroll).toBeGreaterThan(view.client);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(
    (await viewState(figure)).transform,
  );
  // 検証: 用語集の用語に下線
  await expect(mapNode(figure, "data").locator(".mdmark-term")).toHaveCount(1);
  // 検証: mermaid のライブラリを読み込まず、文書の <script> を動かさない
  expect(entryCount(requests())).toBe(0);
  expect(
    await page.evaluate(
      () => (window as { __mdmarkScriptRan?: boolean }).__mdmarkScriptRan,
    ),
  ).not.toBe(true);
  await expect(doc.locator(":scope > p").last()).toHaveText("後の段落");
});

// 補足の layout で、揃える・並び順・座標・幅・色・出る辺を上書きする（正常シナリオ（配置と見た目を上書きする））
test("test_normal_when_layout_overridden", async ({ page }) => {
  // 準備
  const overrides = (x: number) => ({
    ...MAP_DATA_VALUE,
    layout: {
      ...MAP_DATA_VALUE.layout,
      index: { align: "doc" },
      mermaid: { align: "data", order: 1 },
      data: { order: 0 },
      frame: { pos: { x, y: 40 } },
      route: { width: 200, color: "red" },
      read: { color: "blue" },
      "layout->route": { color: "red" },
      "data->frame": { ends: { from: { side: "bottom" } } },
    },
  });
  // 実行
  await openMap(page, builtRoot, { markdown: flowWith(overrides(40)) });
  const figure = mapFigure(page);
  // 検証: 揃える指定の 2 つは同じ段、並び順は指定どおり
  const box = (id: string) => boxOf(mapNode(figure, id));
  const index = await box("index");
  const doc = await box("doc");
  expect(Math.abs(index.y - doc.y)).toBeLessThanOrEqual(1);
  const data = await box("data");
  const mermaid = await box("mermaid");
  expect(Math.abs(data.y - mermaid.y)).toBeLessThanOrEqual(1);
  expect(data.x).toBeLessThan(mermaid.x);
  // 検証: 幅と色
  const route = await box("route");
  expect(Math.round(route.width)).toBe(200);
  const red = await resolveColor(page, "var(--mdmark-color-accent-red-text)");
  const routeColors = await mapNode(figure, "route").evaluate((node) => [
    getComputedStyle(node).borderTopColor,
    getComputedStyle(node.querySelector(".mdmark-diagram-node-name") ?? node)
      .color,
  ]);
  expect(routeColors).toContain(red);
  const blueBg = await resolveColor(page, "var(--mdmark-color-accent-blue-bg)");
  const blue = await resolveColor(page, "var(--mdmark-color-accent-blue-text)");
  const group = await figure
    .locator('.map-group[data-group="read"]')
    .evaluate((element) => ({
      fill: getComputedStyle(element).backgroundColor,
      title: getComputedStyle(
        element.querySelector(".map-group-title") ?? element,
      ).color,
    }));
  expect(group).toEqual({ fill: blueBg, title: blue });
  expect(
    await mapWire(figure, "layout->route").evaluate(
      (path) => getComputedStyle(path).stroke,
    ),
  ).toBe(red);
  // 検証: 出る辺を指定した線は、元のノードの下の辺から出る
  const [, startY] = await pointOnPath(mapWire(figure, "data->frame"), 0);
  expect(Math.abs(startY - (data.y + data.height))).toBeLessThanOrEqual(2);
  // 検証: 重ならない
  const nodes = await nodeBoxes(figure);
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) {
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
    }
  }
  // 実行・検証: 座標を固定したノードは、指定の位置へ動く
  const before = (await nodeLayout(figure)).frame;
  await openMap(page, builtRoot, { markdown: flowWith(overrides(80)) });
  const after = (await nodeLayout(mapFigure(page))).frame;
  expect((after?.[0] ?? 0) - (before?.[0] ?? 0)).toBe(40);
  expect(after?.[1]).toBe(before?.[1]);
});

// システムのグループの中に、名前を付けた 3 つの層のグループを上から並べる（正常シナリオ（構成図の層を指定する））
test("test_normal_when_layers", async ({ page }) => {
  // 準備
  const mermaid = `flowchart LR
  ext(["決済の外部サービス"]):::outside
  subgraph sys [注文のシステム]
    direction TB
    subgraph ui [画面]
      cart["カート"]:::step
    end
    subgraph logic [処理]
      order["注文の受付"]:::step
    end
    subgraph db [データ]
      orders[("注文")]:::store
    end
  end
  cart --> order
  order --> orders
  order --> ext
`;
  const data = JSON.stringify({
    version: 1,
    layout: { ui: { color: "blue" } },
  });
  // 実行
  await openMap(page, builtRoot, { markdown: mapRange({ mermaid, data }) });
  const figure = mapFigure(page);
  // 検証
  const group = (id: string) =>
    boxOf(figure.locator(`.map-group[data-group="${id}"]`));
  const [ui, logic, db, sys] = await Promise.all([
    group("ui"),
    group("logic"),
    group("db"),
    group("sys"),
  ]);
  expect(ui.y + ui.height).toBeLessThanOrEqual(logic.y);
  expect(logic.y + logic.height).toBeLessThanOrEqual(db.y);
  for (const [id, title] of [
    ["ui", "画面"],
    ["logic", "処理"],
    ["db", "データ"],
  ]) {
    await expect(
      figure.locator(`.map-group[data-group="${id}"] .map-group-title`),
    ).toHaveText(title);
  }
  const fills = await figure
    .locator(".map-group")
    .evaluateAll((groups) =>
      Object.fromEntries(
        groups.map((element) => [
          element.getAttribute("data-group"),
          getComputedStyle(element).backgroundColor,
        ]),
      ),
    );
  expect(fills.ui).toBe(
    await resolveColor(page, "var(--mdmark-color-accent-blue-bg)"),
  );
  expect(fills.logic).not.toBe(fills.ui);
  expect(fills.db).not.toBe(fills.ui);
  const ext = await boxOf(mapNode(figure, "ext"));
  expect(overlaps({ ...ext }, { ...sys })).toBe(false);
  await expect(figure.locator(".mdmark-diagram-legend li")).toHaveCount(0);
});

/** 正常シナリオ（シーケンス図）のシーケンス図: 相手 3 つ（1 つは名前が 3 行）・メッセージ 6 つ */
const RICH_SEQUENCE = `sequenceDiagram
  autonumber
  participant user as 利用側のページの描画の処理を受け持つモジュール
  participant mount as mount
  participant marker as 読み取り
  loop 範囲ごと
    user->>+mount: 設定と Markdown
    alt ブロックがある
      mount->>marker: map の範囲
      marker-->>mount: 読み取った図
    else ブロックが無い
      marker--xmount: 書き方の警告
    end
    mount-)marker: 後片付け
  end
  Note over user,mount: 全て描いてから返す
  mount-->>-user: 描いた文書
`;

// sequenceDiagram の記法を、ブロック・注記・活性化・矢じり・番号つきのシーケンス図に描く（正常シナリオ（シーケンス図））
test("test_normal_when_sequence", async ({ page }) => {
  // 準備
  const requests = await routeMermaid(page);
  // 実行
  await openMap(page, builtRoot, {
    markdown: mapRange({ mermaid: RICH_SEQUENCE }),
  });
  const figure = mapFigure(page);
  // 検証: 相手は左から、メッセージは上から記載の順
  const heads = figure.locator(".map-participant");
  await expect(heads).toHaveCount(3);
  const xs = await heads.evaluateAll((items) =>
    items.map((item) => ({
      id: item.getAttribute("data-participant"),
      x: item.getBoundingClientRect().x,
    })),
  );
  expect([...xs].sort((a, b) => a.x - b.x).map((item) => item.id)).toEqual([
    "user",
    "mount",
    "marker",
  ]);
  const labels = figure.locator(".mdmark-diagram-label[data-message]");
  await expect(labels).toHaveCount(6);
  const tops = await labels.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().y),
  );
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  // 検証: 3 行の参加者の箱の下から始まり、ほかの要素と重ならない
  const tall = await heads.first().evaluate((head) => {
    const name = head.querySelector<HTMLElement>(".mdmark-diagram-node-name");
    return Math.round(
      (name?.getBoundingClientRect().height ?? 0) /
        Number.parseFloat(getComputedStyle(name ?? head).lineHeight),
    );
  });
  expect(tall).toBeGreaterThanOrEqual(3);
  const bottom = Math.max(
    ...(await heads.evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().bottom),
    )),
  );
  const first = await boxOf(
    figure.locator('path.mdmark-diagram-wire[data-message="0"]'),
  );
  expect(first.y).toBeGreaterThan(bottom);
  const boxesOf = (selector: string) =>
    figure.locator(selector).evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
  const headBoxes = await boxesOf(".map-participant");
  const others = [
    ...(await boxesOf(".mdmark-diagram-label[data-message]")),
    ...(await boxesOf(".map-seq-fragment-tab")),
    ...(await boxesOf(".map-seq-note")),
  ];
  for (const head of headBoxes) {
    for (const other of others) expect(overlaps(head, other)).toBe(false);
  }
  // 検証: loop と alt / else の枠・区間・見出し
  const tabs = figure.locator(".map-seq-fragment-tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute("data-kind", "loop");
  await expect(tabs.nth(1)).toHaveAttribute("data-kind", "alt");
  await expect(tabs.nth(1)).toContainText("ブロックがある");
  await expect(figure.locator(".map-seq-section-label")).toHaveText(
    "[ブロックが無い]",
  );
  expect(
    await figure
      .locator(".map-seq-section")
      .evaluate((line) => getComputedStyle(line).strokeDasharray),
  ).not.toBe("none");
  const sectionLabel = await boxOf(figure.locator(".map-seq-section-label"));
  for (const label of await boxesOf(".mdmark-diagram-label[data-message]")) {
    expect(overlaps(sectionLabel, label)).toBe(false);
  }
  // 検証: 注記は 2 人をまたぎ、メッセージと重ならない
  const note = await boxOf(figure.locator(".map-seq-note"));
  const [userX] = await centerOf(heads.nth(0));
  const [mountX] = await centerOf(heads.nth(1));
  expect(note.x).toBeLessThanOrEqual(userX);
  expect(note.x + note.width).toBeGreaterThanOrEqual(mountX);
  for (const label of await boxesOf(".mdmark-diagram-label[data-message]")) {
    expect(overlaps(note, label)).toBe(false);
  }
  // 検証: 活性化の帯・点線・× ・開いた矢じり・番号
  await expect(figure.locator(".map-seq-activation")).toHaveCount(1);
  const wire = (n: number) =>
    figure.locator(`path.mdmark-diagram-wire[data-message="${n}"]`);
  await expect(wire(2)).toHaveAttribute("stroke-dasharray", /.+/);
  await expect(wire(3)).toHaveAttribute("marker-end", /head-cross/);
  await expect(wire(4)).toHaveAttribute("marker-end", /head-async/);
  await expect(labels.first()).toHaveText("1 設定と Markdown");
  expect(entryCount(requests())).toBe(0);
});

// 読めない行と補足の知らないキーを書き方の警告にし、読めた部分を描く（正常シナリオ（読めない行と知らないキーがある））
test("test_normal_when_unreadable", async ({ page }) => {
  // 準備
  const markdown = `${mapRange({
    args: '{"title": "全体の構成", "mdoe": 1}',
    mermaid: `${MAP_FLOW}  mount -> frame\n`,
    data: JSON.stringify({ ...MAP_DATA_VALUE, layuot: {} }),
  })}\n後の段落\n`;
  // 実行
  await openMap(page, builtRoot, { markdown });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("mount -> frame");
  await expect(warning).toContainText("layuot");
  await expect(warning).not.toContainText("mdoe");
  const before = await warning.evaluate((element) => {
    const figure = document.querySelector('figure[data-diagram="map"]');
    return figure
      ? (element.compareDocumentPosition(figure) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
      : false;
  });
  expect(before).toBe(true);
  const figure = mapFigure(page);
  await expect(mapNode(figure, "mount")).toBeVisible();
  await expect(mapWire(figure, "mount->marker")).toHaveCount(1);
  await expect(page.locator("#doc p").last()).toHaveText("後の段落");
});

// 描かない種類と mermaid のブロックが無い範囲を、書き方の警告にする（正常シナリオ（描かない図の種類））
test("test_normal_when_unsupported_kind", async ({ page }) => {
  // 準備
  const markdown = [
    mapRange({
      mermaid: "stateDiagram-v2\n  [*] --> 下書き\n",
      data: '{"version": 1}',
    }),
    mapRange({ data: '{"version": 1, "notes": {}}' }),
    "後の段落",
    "",
  ].join("\n");
  // 実行
  await openMapWithoutFigure(page, markdown);
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(2, { timeout: MAP_WAIT_MS });
  await expect(warnings.nth(0)).toContainText("stateDiagram-v2");
  await expect(warnings.nth(1)).toContainText("mermaid");
  await expect(page.locator('#doc figure[data-diagram="map"]')).toHaveCount(0);
  await expect(page.locator("#doc")).toContainText("[*] --> 下書き");
  await expect(page.locator("#doc")).not.toContainText('"version"');
});

/** 図を描かない文書を描く（図の出現を待たない） */
async function openMapWithoutFigure(page: Page, markdown: string) {
  await routeLucide(page);
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown, config: { map: MAP_CONFIG } as never });
}

// 印の collapse で、閉じた折りたたみに入れて描く（正常シナリオ（印の引数で図を閉じておく））
test("test_normal_when_closed", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const expected = await nodeLayout(mapFigure(page));
  const markdown = mapRange({
    args: '{"title": "全体の構成", "collapse": {"open": false}}',
    mermaid: MAP_FLOW,
    data: JSON.stringify(MAP_DATA_VALUE),
  });
  // 実行
  await openMapWithoutFigure(page, markdown);
  const details = page.locator("#doc details.map-collapse");
  await expect(details).toHaveCount(1, { timeout: MAP_WAIT_MS });
  // 検証: 閉じていて、見出しが印の title
  expect(
    await details.evaluate((element) => (element as HTMLDetailsElement).open),
  ).toBe(false);
  await expect(details.locator("summary")).toHaveText("全体の構成");
  // 実行・検証: 開くと正常シナリオと同じ配置
  await details.locator("summary").click();
  await expect(mapFigure(page).locator(".mdmark-diagram-stage")).toBeVisible();
  expect(await nodeLayout(mapFigure(page))).toEqual(expected);
});

// ノードを選ぶと、そのノードとその線のほかを薄くし、線を押すと両端を選ぶ（正常シナリオ（ノードを選んで強調する））
test("test_normal_when_node_selected", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const figure = mapFigure(page);
  const kind = (id: string) =>
    mapNode(figure, id).locator(".mdmark-diagram-node-kind");
  const reset = mapTool(figure, "reset");
  await expect(reset).toBeDisabled();
  // 実行: 線を 2 本持つ mount を押す
  await kind("mount").click();
  // 検証
  expect(await isSelected(mapNode(figure, "mount"))).toBe(true);
  for (const id of ["user->mount", "mount->marker"]) {
    expect(await isDimmed(mapWire(figure, id)), id).toBe(false);
  }
  expect(
    await isDimmed(
      figure.locator('.mdmark-diagram-label[data-wire="user->mount"]'),
    ),
  ).toBe(false);
  expect(await isDimmed(mapNode(figure, "marker"))).toBe(true);
  expect(await isDimmed(mapNode(figure, "user"))).toBe(true);
  expect(await isDimmed(mapWire(figure, "doc->marker"))).toBe(true);
  expect((await packetOwners(figure)).sort()).toEqual([
    "mount->marker",
    "user->mount",
  ]);
  await expect(reset).toBeEnabled();
  // 実行・検証: 2 つ選ぶと、その間の線だけが残る
  await kind("marker").click();
  expect(await isDimmed(mapWire(figure, "mount->marker"))).toBe(false);
  expect(await isDimmed(mapWire(figure, "user->mount"))).toBe(true);
  // 実行・検証: 両端が選ばれた線を押すと両方が解け、片方だけのときは両方が選ばれる
  await clickWire(page, figure, "mount->marker");
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await kind("mount").click();
  await clickWire(page, figure, "mount->marker");
  expect(await isSelected(mapNode(figure, "mount"))).toBe(true);
  expect(await isSelected(mapNode(figure, "marker"))).toBe(true);
  // 実行・検証: Esc で全ての選択が解け、薄くした表示と印が消える
  await figure.locator(".mdmark-diagram-viewport").focus();
  await page.keyboard.press("Escape");
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await expect(figure.locator(".map-dim")).toHaveCount(0);
  await expect(figure.locator(".map-packet")).toHaveCount(0);
  await expect(reset).toBeDisabled();
  // 実行・検証: ノードの中の i と、閉じたグループの開くボタンでは選択が変わらない
  await mapNode(figure, "layout").locator(".mdmark-diagram-info").click();
  await figure.locator('button[aria-label="データを閉じる"]').click();
  await figure.locator('button[aria-label="データを開く"]').click();
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  // 実行・検証: 案内の途中で選ぶと、選んだノードの強調が優先される
  await figure.locator('.map-band [data-band="next"]').click();
  await kind("index").click();
  expect(await isDimmed(mapNode(figure, "index"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "mount"))).toBe(true);
  // 実行・検証: 「配置と選択を元に戻す」で選択が解ける
  await reset.click();
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
});

// ノード・グループ・線の区間をドラッグで動かし、再読み込みしても保つ（正常シナリオ（ノードと線を動かす））
test("test_normal_when_moved", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const figure = mapFigure(page);
  const box = (id: string) => boxOf(mapNode(figure, id));
  const group = (id: string) =>
    boxOf(figure.locator(`.map-group[data-group="${id}"]`));
  const kind = (id: string) =>
    mapNode(figure, id).locator(".mdmark-diagram-node-kind");
  const route = await box("route");
  const user = await box("user");
  const place = await group("place");
  // 実行: グループの中の route を、グループの下端を越える位置まで下へ動かす
  await dragBy(page, kind("route"), 0, place.height);
  // 検証: route だけが動き、グループが広がる
  const moved = await box("route");
  expect(Math.abs(moved.y - route.y - place.height)).toBeLessThanOrEqual(2);
  expect(Math.abs(moved.x - route.x)).toBeLessThanOrEqual(2);
  const userNow = await box("user");
  expect(Math.abs(userNow.x - user.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(userNow.y - user.y)).toBeLessThanOrEqual(1);
  const grown = await group("place");
  expect(grown.y + grown.height).toBeGreaterThanOrEqual(moved.y + moved.height);
  await expect(mapTool(figure, "reset")).toBeEnabled();
  // 実行・検証: グループの左端より外へは動かない
  await dragBy(page, kind("route"), -400, 0);
  expect((await box("route")).x).toBeGreaterThanOrEqual(grown.x);
  // 実行・検証: ほかのノードと 16px より近づかない
  const layout = await box("layout");
  const now = await box("route");
  await dragBy(page, kind("route"), layout.x - now.x, layout.y - now.y);
  const near = await box("route");
  const gap = Math.max(
    near.y - (layout.y + layout.height),
    layout.y - (near.y + near.height),
    near.x - (layout.x + layout.width),
    layout.x - (near.x + near.width),
  );
  expect(gap).toBeGreaterThanOrEqual(15);
  // 実行・検証: 4px 未満の動きは押した扱いで選ぶ
  await dragBy(page, kind("route"), 0, 3);
  expect(await isSelected(mapNode(figure, "route"))).toBe(true);
  await page.keyboard.press("Escape");
  // 実行・検証: グループのタイトルの行をドラッグすると、中身ごと動く
  const placeBefore = await group("place");
  const layoutBefore = await box("layout");
  await dragBy(
    page,
    figure.locator('.map-group[data-group="place"] .map-group-bar'),
    0,
    60,
  );
  expect(
    Math.abs((await group("place")).y - placeBefore.y - 60),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs((await box("layout")).y - layoutBefore.y - 60),
  ).toBeLessThanOrEqual(2);
  // 実行・検証: グループの面のドラッグは図の枠の中をスクロールする
  const readBefore = await group("read");
  const scrollBefore = (await viewState(figure)).scroll[0];
  const face = await group("read");
  await page.mouse.move(face.x + face.width / 2, face.y + face.height - 6);
  await page.mouse.down();
  await page.mouse.move(
    face.x + face.width / 2 - 120,
    face.y + face.height - 6,
    {
      steps: 6,
    },
  );
  await page.mouse.up();
  expect((await viewState(figure)).scroll[0]).toBeGreaterThan(scrollBefore);
  const readAfter = await group("read");
  expect(Math.abs(readAfter.width - readBefore.width)).toBeLessThanOrEqual(1);
  // 実行・検証: 線の区間をドラッグすると、その向きへ動く
  const bent = await figure
    .locator(".map-wire-hit[data-wire]")
    .evaluateAll((hits) =>
      hits
        .map((hit) => ({
          id: hit.getAttribute("data-wire") ?? "",
          points: [
            ...(hit.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+) ([\d.]+)/g),
          ].map((match) => [Number(match[1]), Number(match[2])]),
        }))
        .find((hit) => hit.points.length >= 4),
    );
  expect(bent).toBeDefined();
  const points = bent?.points ?? [];
  const middle = Math.floor((points.length - 2) / 2);
  const a = points[middle] ?? [0, 0];
  const b = points[middle + 1] ?? [0, 0];
  const horizontal = a[1] === b[1];
  const origin = await boxOf(figure.locator(".mdmark-diagram-stage"));
  const at: [number, number] = [
    origin.x + ((a[0] ?? 0) + (b[0] ?? 0)) / 2,
    origin.y + ((a[1] ?? 0) + (b[1] ?? 0)) / 2,
  ];
  await page.mouse.move(at[0], at[1]);
  expect(
    await mapWireHit(figure, bent?.id ?? "").evaluate(
      (hit) => getComputedStyle(hit).cursor,
    ),
  ).toBe(horizontal ? "ns-resize" : "ew-resize");
  await page.mouse.down();
  await page.mouse.move(
    at[0] + (horizontal ? 0 : 12),
    at[1] + (horizontal ? 12 : 0),
    {
      steps: 4,
    },
  );
  await page.mouse.up();
  const after = await mapWireHit(figure, bent?.id ?? "").evaluate((hit) =>
    [...(hit.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(
      (match) => [Number(match[1]), Number(match[2])],
    ),
  );
  const axis = horizontal ? 1 : 0;
  expect(((after[middle] ?? [])[axis] ?? 0) - (a[axis] ?? 0)).toBeCloseTo(
    12,
    0,
  );
  // 検証: 名前の文字の上は選びもドラッグもせず、文字を選べる。種類を書かないノードも種類の行で選べる
  await mapNode(figure, "user").locator(".mdmark-diagram-node-name").click();
  expect(await isSelected(mapNode(figure, "user"))).toBe(false);
  expect(
    await mapNode(figure, "user")
      .locator(".mdmark-diagram-node-name")
      .evaluate((name) => getComputedStyle(name).userSelect),
  ).not.toBe("none");
  const frameKind = await boxOf(kind("frame"));
  expect(Math.round(frameKind.height)).toBeGreaterThanOrEqual(24);
  await kind("frame").click();
  expect(await isSelected(mapNode(figure, "frame"))).toBe(true);
  await page.keyboard.press("Escape");
  // 実行・検証: 再読み込みしても動かした位置のまま
  const kept = await nodeLayout(figure);
  await reloadMap(page, { markdown: FLOW_RANGE });
  expect((await nodeLayout(mapFigure(page))).route).toEqual(kept.route);
  // 実行・検証: 「配置と選択を元に戻す」で自動配置に戻る
  await mapTool(mapFigure(page), "reset").click();
  const reverted = await boxOf(mapNode(mapFigure(page), "route"));
  expect(Math.abs(reverted.y - route.y)).toBeLessThanOrEqual(2);
});

// リサイズハンドルのドラッグで表示する枠を高くし、ダブルクリックで図の高さに合わせる（正常シナリオ（表示する枠の高さを変える））
test("test_normal_when_frame_resized", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: FLOW_RANGE });
  const figure = mapFigure(page);
  const handle = figure.locator(".mdmark-diagram-resize");
  const viewport = figure.locator(".mdmark-diagram-viewport");
  const stageHeight = await figure
    .locator(".mdmark-diagram-stage")
    .evaluate((stage) => stage.getBoundingClientRect().height);
  const before = (await boxOf(viewport)).height;
  const transform = (await viewState(figure)).transform;
  // 実行: 図の高さを越えるまで下へドラッグする
  const drag = stageHeight - before + 200;
  await dragBy(page, handle, 0, drag);
  // 検証: ドラッグした分だけ高くなる
  expect(
    Math.abs((await boxOf(viewport)).height - before - drag),
  ).toBeLessThanOrEqual(4);
  // 実行: ダブルクリックする
  await handle.dblclick();
  // 検証: 図の高さに合い、倍率は変わらない
  const fitted = await viewport.evaluate((element) => ({
    client: element.clientHeight,
    content: element.scrollHeight,
  }));
  expect(Math.abs(fitted.client - fitted.content)).toBeLessThanOrEqual(2);
  expect((await viewState(figure)).transform).toBe(transform);
  // 検証: リサイズハンドルが横のスクロールバーと重ならない
  const area = await boxOf(viewport);
  const grip = await boxOf(handle);
  expect(grip.y).toBeGreaterThanOrEqual(area.y + area.height - 1);
});
