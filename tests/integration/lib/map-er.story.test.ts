import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// ER 図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 1100 };

/** map の ER 図のストーリーを開く */
function openEr(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-maper--${id}`, viewport);
}

type Box = { left: number; top: number; right: number; bottom: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
const overlaps = (a: Box, b: Box) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

/** セレクターの要素ごとの ID と矩形（ページの座標） */
function boxesOf(page: Page, selector: string, attribute: string) {
  return page.locator(selector).evaluateAll(
    (elements, name) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          id: element.getAttribute(name as string) ?? "",
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        };
      }),
    attribute,
  );
}

/** テーブル・関連の線・多重度とラベルの文字の、薄くしたか */
function dimsOf(page: Page) {
  return page
    .locator(
      ".mdmark-diagram-stage :is(.mdmark-diagram-node[data-node], path.mdmark-diagram-wire[data-wire], [data-wire-mark])",
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-wire") ??
          element.getAttribute("data-wire-mark") ??
          "",
        mark: element.hasAttribute("data-wire-mark"),
        dim: element.classList.contains("map-dim"),
        opacity: Number(getComputedStyle(element).opacity),
      })),
    );
}

/** 関連の線の端の点（ページの座標） */
function wireEnds(page: Page, wire: string) {
  return page
    .locator(`path.mdmark-diagram-wire[data-wire="${wire}"]`)
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const svg = path.ownerSVGElement;
      const box = svg?.getBoundingClientRect();
      const scale = box && svg ? box.width / svg.width.baseVal.value : 1;
      const at = (length: number) => {
        const point = path.getPointAtLength(length);
        return {
          x: (box?.left ?? 0) + point.x * scale,
          y: (box?.top ?? 0) + point.y * scale,
        };
      };
      return { start: at(0), end: at(path.getTotalLength()) };
    });
}

/** テーブルのノードの中の列の行の矩形 */
async function rowBox(page: Page, table: string, column: string) {
  const [box] = await boxesOf(
    page,
    `.mdmark-diagram-node[data-node="${table}"] .map-er-column[data-column="${column}"]`,
    "data-column",
  );
  if (!box) throw new Error(`${table}.${column} の行が無い`);
  return box;
}

// テーブル 5 つ・分類「記録」・関連 5 本。列の行・関連の端・両端の多重度・ラベルを描き、ノード・ラベル・多重度が重ならない（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openEr("default");
  // 検証: テーブルと分類
  const tables = await boxesOf(
    page,
    ".mdmark-diagram-stage > .mdmark-diagram-node[data-node]",
    "data-node",
  );
  expect(tables.map((table) => table.id).sort()).toEqual(
    ["支払い", "明細", "注文", "商品", "顧客"].sort(),
  );
  for (const [i, a] of tables.entries())
    for (const b of tables.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
  const [group] = await boxesOf(page, ".map-group[data-group]", "data-group");
  expect(group?.id).toBe("記録");
  for (const table of tables) {
    const inside =
      group !== undefined &&
      table.left >= group.left &&
      table.right <= group.right &&
      table.top >= group.top &&
      table.bottom <= group.bottom;
    expect(inside, table.id).toBe(
      ["注文", "明細", "支払い"].includes(table.id),
    );
  }
  // 検証: 列の行（キー・名前・型・説明のボタン）。行はノードの中に収まる
  const order = page.locator('.mdmark-diagram-node[data-node="注文"]');
  await expect(order.locator(".map-er-column").count()).resolves.toBe(8);
  await expect(
    order.locator('[data-column="顧客ID"] .map-er-key').innerText(),
  ).resolves.toBe("FK");
  await expect(
    order.locator('[data-column="注文日"] .map-er-type').innerText(),
  ).resolves.toBe("date");
  await expect(
    order.locator('[data-column="状態"] button.map-er-note').count(),
  ).resolves.toBe(1);
  const orderBox = (await boxesOf(
    page,
    '.mdmark-diagram-node[data-node="注文"]',
    "data-node",
  )) as Box[];
  const last = await rowBox(page, "注文", "更新日時");
  expect(last.bottom).toBeLessThanOrEqual((orderBox[0]?.bottom ?? 0) + 1);
  // 検証: 「顧客」→「注文」の線の「注文」の側の端が、列 顧客ID の行の高さの左右の辺にある
  const row = await rowBox(page, "注文", "顧客ID");
  const { end } = await wireEnds(page, "r1");
  expect(end.y).toBeGreaterThanOrEqual(row.top);
  expect(end.y).toBeLessThanOrEqual(row.bottom);
  expect(
    Math.min(
      Math.abs(end.x - (orderBox[0]?.left ?? 0)),
      Math.abs(end.x - (orderBox[0]?.right ?? 0)),
    ),
  ).toBeLessThanOrEqual(1);
  // 検証: 矢じりを持たず、.. の関連は破線
  const heads = await page
    .locator("path.mdmark-diagram-wire[data-wire]")
    .evaluateAll((paths) =>
      paths.map((path) => ({
        id: path.getAttribute("data-wire"),
        head: path.getAttribute("marker-end"),
        dash: path.getAttribute("stroke-dasharray"),
      })),
    );
  for (const head of heads) expect(head.head, head.id ?? "").toBeFalsy();
  expect(heads.find((head) => head.id === "r4")?.dash).toBeTruthy();
  expect(heads.find((head) => head.id === "r1")?.dash).toBeFalsy();
  // 検証: 両端の多重度とラベル
  const texts = await page.locator("[data-wire-mark]").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        wire: element.getAttribute("data-wire-mark"),
        kind: element.classList.contains("map-er-label")
          ? "label"
          : "cardinality",
        text: element.textContent,
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      };
    }),
  );
  const cardinalities = (wire: string) =>
    texts
      .filter((text) => text.wire === wire && text.kind === "cardinality")
      .map((text) => text.text)
      .sort();
  expect(cardinalities("r1")).toEqual(["0..n", "1"]);
  expect(cardinalities("r2")).toEqual(["1", "1..n"]);
  expect(cardinalities("r5")).toEqual(["0..1", "1"]);
  expect(
    texts
      .filter((text) => text.kind === "label")
      .map((text) => text.text)
      .sort(),
  ).toEqual(["含む", "指す", "支払う", "最後に見た", "注文する"].sort());
  for (const [i, a] of texts.entries())
    for (const b of texts.slice(i + 1))
      expect(
        overlaps(a, b),
        `${a.text}(${a.wire}) と ${b.text}(${b.wire})`,
      ).toBe(false);
  // 検証: 同じ辺から出る線どうしの間隔（含む と 支払う。押せる帯の 2 つ目の点の x が、辺から出た縦の区間の x）
  const r2 = await wireEnds(page, "r2");
  const r4 = await wireEnds(page, "r4");
  expect(Math.abs(r2.start.x - r4.start.x)).toBeLessThan(1);
  const stubs = await page
    .locator('path.map-wire-hit:is([data-wire="r2"], [data-wire="r4"])')
    .evaluateAll((paths) =>
      paths.map((path) => {
        const numbers = (path.getAttribute("d") ?? "")
          .match(/-?\d+(\.\d+)?/g)
          ?.map(Number);
        return numbers?.[2] ?? 0;
      }),
    );
  expect(Math.abs((stubs[0] ?? 0) - (stubs[1] ?? 0))).toBeGreaterThanOrEqual(
    12,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 「注文」の列を閉じると、テーブル名と「列 8」のボタンの 1 行になり、関連はノードの辺の中ほどにつながる（ColumnsCollapsed）
test("test_columns_collapsed", async () => {
  // 準備・実行
  const page = await openEr("columns-collapsed");
  // 検証
  const order = page.locator('.mdmark-diagram-node[data-node="注文"]');
  await expect(order.locator(".map-er-column").count()).resolves.toBe(0);
  const toggle = order.locator("button.map-er-toggle");
  await expect(toggle.innerText()).resolves.toBe("列 8");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "注文の列を開く",
  );
  const [box] = await boxesOf(
    page,
    '.mdmark-diagram-node[data-node="注文"]',
    "data-node",
  );
  const { end } = await wireEnds(page, "r1");
  expect(
    Math.abs(end.y - ((box?.top ?? 0) + (box?.bottom ?? 0)) / 2),
  ).toBeLessThanOrEqual(1);
  await expect(
    page
      .locator('.mdmark-diagram-node[data-node="明細"] button.map-er-toggle')
      .getAttribute("aria-label"),
  ).resolves.toBe("明細の列を閉じる");
});

// 分類「記録」を閉じると、「テーブル 3 件」を持つ 1 つのノードになり、中への関連が相手ごとに 1 本にまとまる（GroupCollapsed）
test("test_group_collapsed", async () => {
  // 準備・実行
  const page = await openEr("group-collapsed");
  // 検証
  const closed = page.locator('.map-closed-group[data-group="記録"]');
  await expect(closed.innerText()).resolves.toContain("テーブル 3 件");
  const wires = await page
    .locator("path.mdmark-diagram-wire[data-wire]")
    .evaluateAll((paths) =>
      paths.map((path) => path.getAttribute("data-wire") ?? ""),
    );
  const into = wires.filter((id) => id.includes("記録"));
  expect(into.sort()).toEqual(["記録->商品", "顧客->記録"].sort());
});

// 分類「記録」の中へ入ると、外のテーブルが薄い（Entered）
test("test_entered", async () => {
  // 準備・実行
  const page = await openEr("entered");
  // 検証
  const faded = await page
    .locator(".mdmark-diagram-stage > .mdmark-diagram-node[data-node]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        id: element.getAttribute("data-node"),
        faded: element.classList.contains("map-faded"),
      })),
    );
  for (const node of faded)
    expect(node.faded, node.id ?? "").toBe(
      !["注文", "明細", "支払い"].includes(node.id ?? ""),
    );
  await expect(
    page.locator(".map-group-title.is-current").innerText(),
  ).resolves.toBe("記録");
});

// 「明細」を選ぶと、その関連と相手のテーブルのほかが薄い（TableSelected）
test("test_table_selected", async () => {
  // 準備・実行
  const page = await openEr("table-selected");
  // 検証
  const marks = await dimsOf(page);
  const kept = new Set(["明細", "注文", "商品", "r2", "r3"]);
  for (const mark of marks) {
    expect(mark.dim, mark.id).toBe(!kept.has(mark.id));
    if (mark.dim && !mark.mark)
      expect(mark.opacity, mark.id).toBeCloseTo(0.25, 2);
  }
});

// 「顧客」と「明細」を選ぶと、最短の経路 2 本のテーブルと関連が残り、行が増える関連 3 本にマーカーがある。マーカーはノード・ラベル・多重度と重ならない（PathSelected）
test("test_path_selected", async () => {
  // 準備・実行
  const page = await openEr("path-selected");
  // 検証
  const marks = await dimsOf(page);
  const kept = new Set([
    "顧客",
    "注文",
    "明細",
    "商品",
    "r1",
    "r2",
    "r3",
    "r5",
  ]);
  for (const mark of marks) expect(mark.dim, mark.id).toBe(!kept.has(mark.id));
  const fanouts = await boxesOf(page, "button.map-er-fanout", "aria-label");
  expect(fanouts.map((fanout) => fanout.id).sort()).toEqual(
    [
      "顧客 から 注文 で行が増える",
      "注文 から 明細 で行が増える",
      "商品 から 明細 で行が増える",
    ].sort(),
  );
  const nodes = await boxesOf(
    page,
    ".mdmark-diagram-stage > .mdmark-diagram-node[data-node]",
    "data-node",
  );
  const texts = await boxesOf(page, "[data-wire-mark]", "data-wire-mark");
  for (const fanout of fanouts) {
    for (const node of nodes)
      expect(overlaps(fanout, node), `${fanout.id} と ${node.id}`).toBe(false);
    for (const text of texts)
      expect(overlaps(fanout, text), `${fanout.id} と ${text.id}`).toBe(false);
  }
  await expect(
    page.locator("button.map-er-fanout").first().innerText(),
  ).resolves.toBe("×n");
});

// 行が増える関連のマーカーにフォーカスすると、図のツールチップに行が増える旨が出る（FanoutTip）
test("test_fanout_tip", async () => {
  // 準備（ストーリーが図の操作を付ける）
  const page = await openEr("fanout-tip");
  const marker = page.locator(
    'button.map-er-fanout[aria-label="顧客 から 注文 で行が増える"]',
  );
  /** マーカーの aria-describedby が指すツールチップの、開いているかと文字 */
  const tipOf = () =>
    marker.evaluate((element) => {
      const tip = document.getElementById(
        element.getAttribute("aria-describedby") ?? "",
      );
      return {
        role: tip?.getAttribute("role"),
        open: tip !== null && !tip.hidden,
        text: tip?.textContent ?? "",
      };
    });
  // 実行（操作を付け終えるまで、フォーカスを外してからフォーカスし直す。既にフォーカスを持つ要素の focus() は focus を発火しない）
  await expect
    .poll(
      async () => {
        await marker.evaluate((element) => (element as HTMLElement).blur());
        await marker.focus();
        return (await tipOf()).open;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  // 検証
  const tip = await tipOf();
  expect(tip.role).toBe("tooltip");
  expect(tip.text).toContain(
    "顧客 から 注文 へたどると、顧客 の 1 行に 注文 の行が複数つながり",
  );
});

// 幅 390px の置き場所では、倍率 1 のまま表示する枠の中で横にスクロールし、ページははみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openEr("narrow", { width: 390, height: 844 });
  // 検証
  const viewport = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
  expect(viewport.scroll).toBeGreaterThan(viewport.client);
  const transform = await page
    .locator(".mdmark-diagram-stage")
    .evaluate((stage) => getComputedStyle(stage).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 列の開閉と説明のボタン、テーブルのノードは、スクリーンリーダー向けの名前を持ち、列の名前の文字を選べる（Default）
test("test_accessibility", async () => {
  // 準備・実行
  const page = await openEr("default");
  // 検証
  const order = page.locator('.mdmark-diagram-node[data-node="注文"]');
  await expect(order.getAttribute("tabindex")).resolves.toBe("0");
  await expect(order.getAttribute("aria-label")).resolves.toBe("注文");
  const toggle = order.locator("button.map-er-toggle");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("true");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "注文の列を閉じる",
  );
  const note = order.locator('[data-column="状態"] button.map-er-note');
  await expect(note.getAttribute("aria-label")).resolves.toBe("状態の説明");
  await expect(note.getAttribute("aria-describedby")).resolves.toBeTruthy();
  const select = await order
    .locator('[data-column="状態"] .map-er-name')
    .evaluate((name) => getComputedStyle(name).userSelect);
  expect(select).toBe("text");
});
