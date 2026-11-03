import { wrapDirective } from "./diagram.ts";

/** E2E の ER 図の定義: テーブル 3 つ（物理名と論理名）・主キー・外部キー・NOT NULL の列・1 対多の関係 2 本。幅は表示する枠より広い */
export const ER_DEFINITION = {
  title: "注文のデータ",
  scope: "注文の DB",
  updated: "2026-11-03",
  width: 1100,
  tables: [
    {
      id: "customers",
      name: "customers",
      label: "顧客",
      kind: "master",
      desc: "注文する人",
      x: 24,
      y: 24,
      w: 240,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        {
          name: "email",
          type: "varchar(255)",
          nn: true,
          desc: "ログインに使う",
        },
        { name: "name", type: "varchar(100)", desc: "表示に使う名前" },
      ],
    },
    {
      id: "orders",
      name: "orders",
      label: "注文",
      kind: "transaction",
      x: 424,
      y: 24,
      w: 260,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        { name: "customer_id", type: "bigint", fk: true, nn: true },
        { name: "ordered_at", type: "timestamp", nn: true },
      ],
    },
    {
      id: "order_items",
      name: "order_items",
      label: "注文の明細",
      kind: "transaction",
      x: 824,
      y: 24,
      w: 250,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        { name: "order_id", type: "bigint", fk: true, nn: true },
        { name: "quantity", type: "integer", nn: true },
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
    {
      from: "orders",
      fromColumn: "id",
      fromCard: "1",
      to: "order_items",
      toColumn: "order_id",
      toCard: "1..n",
      label: "含む",
    },
  ],
};

/** 主キー 1 つ・ほかの列 10 個・12 番目に外部キーを持つ `orders` と、その外部キーへ関係を持つ `customers` の ER 図の定義 */
export const FOLD_DEFINITION = {
  title: "列の開閉",
  scope: "注文の DB",
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
        ...Array.from({ length: 10 }, (_, i) => ({
          name: `c${i + 1}`,
          type: "text",
        })),
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

/** 定義を `<!-- er -->` で囲んだ Markdown */
export function erMarkdown(definition: unknown = ER_DEFINITION): string {
  return wrapDirective("er", JSON.stringify(definition, null, 2));
}
