import { expect, test } from "vitest";
import type { MdmarkErTable } from "../../../../src/diagram/definition.ts";
import { shopEr, shopErFolded } from "../../helpers/er.ts";
import { findTag, findTags, matches, plainText } from "../../helpers/html.ts";

/** ER 図のテーブルと記号を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEr = () => import("../../../../src/parts/er.ts");

/** 定義の中のテーブル */
function tableOf(tables: MdmarkErTable[], id: string): MdmarkErTable {
  const found = tables.find((t) => t.id === id);
  if (found === undefined) {
    throw new Error(`テーブルが無い: ${id}`);
  }
  return found;
}

// 見出しと列の行を出す（正常系）
test("test_render_er_table", async () => {
  // 準備
  const { renderErTable } = await loadEr();
  const orders = tableOf(shopEr().tables, "orders");
  // 実行
  const html = renderErTable({ table: orders, tipId: "d1-tip-1" });
  // 検証
  const root = findTag(html, "mdmark-diagram-er-table");
  expect(root).toContain('data-color="orange"');
  expect(root).toContain('data-node="orders"');
  const text = plainText(html);
  expect(text).toContain("orders");
  expect(text).toContain("注文");
  expect(text).toContain("トランザクション");
  const rows = matches(html, /data-column="([^"]+)"/g).map((m) =>
    m.replace(/^data-column="|"$/g, ""),
  );
  expect(rows).toEqual(orders.columns.map((c) => c.name));
  expect(html).toMatch(/<abbr[^>]*title="主キー"[^>]*>PK<\/abbr>/);
  expect(html).toContain('aria-label="「注文」の説明"');
  expect(html).toContain('aria-describedby="d1-tip-1"');
});

// 畳んだテーブルは主キーと外部キー以外の列の行を隠す（正常系）
test("test_render_er_table_when_folded", async () => {
  // 準備
  const { renderErTable } = await loadEr();
  const orders = tableOf(shopErFolded().tables, "orders");
  const hiddenCount = orders.columns.filter((c) => !c.pk && !c.fk).length;
  // 実行
  const html = renderErTable({ table: orders, tipId: undefined });
  // 検証
  const rows = findTags(html, "data-column=");
  for (const column of orders.columns) {
    const row = rows.find((r) => r.includes(`data-column="${column.name}"`));
    expect(row, column.name).toBeDefined();
    expect(/\bhidden\b/.test(row ?? ""), column.name).toBe(
      !column.pk && !column.fk,
    );
  }
  expect(plainText(html)).toContain(`非表示 ${hiddenCount} 列`);
  const fold = findTag(html, "mdmark-diagram-er-fold");
  expect(fold).toContain('aria-expanded="false"');
  expect(fold).toContain('aria-label="「注文」の主キーと外部キー以外の列"');
});

// 種類と色の無いテーブルは札と data-color を持たない（正常系）
test("test_render_er_table_when_no_kind", async () => {
  // 準備
  const { renderErTable } = await loadEr();
  const table: MdmarkErTable = {
    id: "links",
    name: "links",
    label: "つなぎ",
    x: 0,
    y: 0,
    w: 200,
    columns: [
      { name: "a_id", type: "bigint", pk: true, fk: true },
      { name: "b_id", type: "bigint", pk: true, fk: true },
    ],
  };
  // 実行
  const html = renderErTable({ table, tipId: undefined });
  // 検証
  expect(html).not.toContain("mdmark-diagram-er-kind");
  expect(html).not.toContain("data-color");
  expect(html).not.toContain("mdmark-diagram-er-fold");
});

// 多重度ごとの記号を出す（正常系）
test("test_er_end_svg", async () => {
  // 準備
  const { erEndSvg } = await loadEr();
  const draw = (card: "1" | "0..1" | "1..n" | "0..n") =>
    erEndSvg({ x: 100, y: 50, dir: 1, card });
  // 実行
  const one = draw("1");
  const zeroOne = draw("0..1");
  const oneMany = draw("1..n");
  const zeroMany = draw("0..n");
  // 検証
  expect(matches(one, /<line/g)).toHaveLength(2);
  expect(one).not.toContain("<circle");
  expect(matches(zeroOne, /<line/g)).toHaveLength(1);
  expect(zeroOne).toMatch(/<circle[^>]*data-ring/);
  expect(matches(oneMany, /<path/g)).toHaveLength(1);
  expect(matches(oneMany, /<line/g)).toHaveLength(1);
  expect(matches(zeroMany, /<path/g)).toHaveLength(1);
  expect(zeroMany).toMatch(/<circle[^>]*data-ring/);
});
