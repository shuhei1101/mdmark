import { expect, test } from "vitest";
import type {
  MdmarkErRelation,
  MdmarkErTable,
} from "../../../../src/diagram/definition.ts";

/** ER 図の寸法と経路を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEr = () => import("../../../../src/diagram/er.ts");

/** 列の名前と、主キー・外部キーかを並べたテーブル */
function table(
  id: string,
  x: number,
  y: number,
  w: number,
  columns: Array<{ name: string; pk?: boolean; fk?: boolean }>,
): MdmarkErTable {
  return {
    id,
    name: id,
    label: id,
    x,
    y,
    w,
    columns: columns.map((c) => ({ type: "text", ...c })),
  };
}

/** 関係の元の列 `id` から先の列 `ref` への関係 */
function relation(extra: Partial<MdmarkErRelation> = {}): MdmarkErRelation {
  return {
    from: "a",
    fromColumn: "id",
    fromCard: "1",
    to: "b",
    toColumn: "ref",
    toCard: "0..n",
    ...extra,
  };
}

// 畳んだときは主キーと外部キーの列と非表示の行だけを数える（正常系）
test("test_er_table_height", async () => {
  // 準備
  const { erTableHeight } = await loadEr();
  const t = table("a", 0, 0, 200, [
    { name: "id", pk: true },
    { name: "ref", fk: true },
    { name: "c1" },
    { name: "c2" },
    { name: "c3" },
  ]);
  // 実行
  const open = erTableHeight({ table: t, folded: false });
  const folded = erTableHeight({ table: t, folded: true });
  // 検証
  expect(open).toBe(44 + 26 * 5 + 4);
  expect(folded).toBe(44 + 26 * 2 + 24 + 4);
});

// 右のテーブルへ横・縦・横で結ぶ（正常系）
test("test_er_relation_route", async () => {
  // 準備
  const { erRelationRoute } = await loadEr();
  const from = table("a", 40, 20, 200, [{ name: "id", pk: true }]);
  const to = table("b", 400, 100, 200, [
    { name: "id", pk: true },
    { name: "ref", fk: true },
  ]);
  const fromY = 20 + 44 + 26 * 0.5 + 2;
  const toY = 100 + 44 + 26 * 1.5 + 2;
  // 実行
  const route = erRelationRoute({
    relation: relation(),
    from,
    to,
    folded: () => false,
  });
  // 検証
  expect(route.d).toBe(`M240,${fromY} H320 V${toY} H400`);
  expect(route.start).toEqual({ x: 240, y: fromY, dir: 1 });
  expect(route.end).toEqual({ x: 400, y: toY, dir: -1 });
  expect(route.label).toEqual({ x: 320, y: (fromY + toY) / 2 });
});

// 同じ x のテーブルどうしは両方の右の辺から出す（正常系）
test("test_er_relation_route_when_stacked", async () => {
  // 準備
  const { erRelationRoute } = await loadEr();
  const from = table("a", 40, 20, 200, [{ name: "id", pk: true }]);
  const to = table("b", 40, 200, 200, [
    { name: "id", pk: true },
    { name: "ref", fk: true },
  ]);
  // 実行
  const route = erRelationRoute({
    relation: relation({ midX: 300 }),
    from,
    to,
    folded: () => false,
  });
  // 検証
  expect(route.d).toMatch(/^M240,[\d.]+ H300 V[\d.]+ H240$/);
  expect(route.start.dir).toBe(1);
  expect(route.end.dir).toBe(1);
  expect(route.start.x).toBe(240);
  expect(route.end.x).toBe(240);
});

// 畳んで見えない列へは見出しの中ほどに結ぶ（正常系）
test("test_er_relation_route_when_folded", async () => {
  // 準備
  const { erRelationRoute } = await loadEr();
  const from = table("a", 40, 20, 200, [{ name: "id", pk: true }]);
  const to = table("b", 400, 100, 200, [
    { name: "id", pk: true },
    { name: "c1" },
    { name: "ref" },
  ]);
  // 実行
  const route = erRelationRoute({
    relation: relation(),
    from,
    to,
    folded: (id) => id === "b",
  });
  // 検証
  expect(route.end.y).toBe(100 + 22);
});
