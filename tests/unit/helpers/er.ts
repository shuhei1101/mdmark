import type {
  MdmarkErDefinition,
  MdmarkErTable,
} from "../../../src/diagram/definition.ts";

/** モックの `shop-er` のテーブル（顧客・注文・注文の明細・商品。注文は列が多い） */
function shopTables(): MdmarkErTable[] {
  return [
    {
      id: "customers",
      name: "customers",
      kind: "master",
      label: "顧客",
      desc: "注文する人。メールアドレスで一意にする",
      x: 24,
      y: 24,
      w: 230,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        {
          name: "email",
          type: "varchar(255)",
          nn: true,
          desc: "ログインに使う。重複を許さない",
        },
        { name: "name", type: "varchar(100)", nn: true },
        { name: "created_at", type: "timestamp", nn: true },
      ],
    },
    {
      id: "orders",
      name: "orders",
      kind: "transaction",
      label: "注文",
      desc: "1 回の注文。明細を 1 つ以上持つ",
      x: 344,
      y: 24,
      w: 250,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        {
          name: "customer_id",
          type: "bigint",
          fk: true,
          nn: true,
          desc: "注文した顧客",
        },
        {
          name: "status",
          type: "varchar(20)",
          nn: true,
          desc: "received・paid・shipped・canceled のどれか",
        },
        { name: "ordered_at", type: "timestamp", nn: true },
        { name: "paid_at", type: "timestamp" },
        { name: "shipped_at", type: "timestamp" },
        {
          name: "total",
          type: "integer",
          nn: true,
          desc: "明細の小計の合計（税込み）",
        },
        { name: "note", type: "text" },
      ],
    },
    {
      id: "order_items",
      name: "order_items",
      kind: "transaction",
      label: "注文の明細",
      x: 684,
      y: 24,
      w: 240,
      columns: [
        { name: "order_id", type: "bigint", pk: true, fk: true, nn: true },
        { name: "product_id", type: "bigint", pk: true, fk: true, nn: true },
        { name: "quantity", type: "integer", nn: true },
        {
          name: "unit_price",
          type: "integer",
          nn: true,
          desc: "注文した時点の単価",
        },
      ],
    },
    {
      id: "products",
      name: "products",
      kind: "master",
      label: "商品",
      desc: "販売する商品",
      x: 684,
      y: 220,
      w: 240,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        { name: "name", type: "varchar(100)", nn: true },
        { name: "price", type: "integer", nn: true },
        { name: "discontinued", type: "boolean" },
      ],
    },
  ];
}

/** モックの `shop-er` の定義 */
export function shopEr(): MdmarkErDefinition {
  return {
    title: "注文のデータ",
    scope: "注文の DB",
    updated: "2026-10-31",
    width: 1000,
    tables: shopTables(),
    relations: [
      {
        from: "customers",
        fromColumn: "id",
        fromCard: "1",
        to: "orders",
        toColumn: "customer_id",
        toCard: "0..n",
        label: "注文する",
      },
      {
        from: "orders",
        fromColumn: "id",
        fromCard: "1",
        to: "order_items",
        toColumn: "order_id",
        toCard: "1..n",
        label: "含む",
      },
      {
        from: "products",
        fromColumn: "id",
        fromCard: "1",
        to: "order_items",
        toColumn: "product_id",
        toCard: "0..n",
        midX: 954,
        label: "注文される",
      },
    ],
  };
}

/** モックの `shop-er-colors` の定義（商品を緑、種類の無い注文の明細を紫） */
export function shopErColors(): MdmarkErDefinition {
  const base = shopEr();
  return {
    ...base,
    title: "注文のデータ（テーブルの色を指定）",
    tables: base.tables.map((t) => {
      if (t.id === "products") {
        return { ...t, color: "green" };
      }
      if (t.id === "order_items") {
        const { kind: _kind, ...rest } = t;
        return { ...rest, color: "purple" };
      }
      return t;
    }),
  };
}

/** モックの `shop-er-folded` の定義（注文のテーブルを畳む） */
export function shopErFolded(): MdmarkErDefinition {
  const base = shopEr();
  return {
    ...base,
    tables: base.tables.map((t) =>
      t.id === "orders" ? { ...t, folded: true } : t,
    ),
  };
}

/** 主キー 1 つ・ほかの列 10 個・12 番目に外部キーを持つ `orders` と、その外部キーへ関係を持つ `customers` の定義 */
export function foldEr(): MdmarkErDefinition {
  const others = Array.from({ length: 10 }, (_, i) => ({
    name: `c${i + 1}`,
    type: "text",
  }));
  return {
    title: "列の開閉",
    scope: "確かめ",
    updated: "2026-11-03",
    width: 640,
    tables: [
      {
        id: "customers",
        name: "customers",
        label: "顧客",
        kind: "master",
        x: 24,
        y: 24,
        w: 200,
        columns: [{ name: "id", type: "bigint", pk: true, nn: true }],
      },
      {
        id: "orders",
        name: "orders",
        label: "注文",
        kind: "transaction",
        x: 344,
        y: 24,
        w: 240,
        columns: [
          { name: "id", type: "bigint", pk: true, nn: true },
          ...others,
          { name: "customer_id", type: "bigint", fk: true, nn: true },
        ],
      },
    ],
    relations: [
      {
        from: "customers",
        fromColumn: "id",
        fromCard: "1",
        to: "orders",
        toColumn: "customer_id",
        toCard: "0..n",
        label: "注文する",
      },
    ],
  };
}

/** 定義の JSON */
export function erText(definition: MdmarkErDefinition): string {
  return JSON.stringify(definition, null, 2);
}
