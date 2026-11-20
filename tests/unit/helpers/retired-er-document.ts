/**
 * シナリオ『バージョンを上げる』の「正常シナリオ（部品の定義で記載した ER 図を map へ書き換える）」の文書と、書き換えた後の期待値。
 * 種類 `master` のテーブル、種類 `transaction` で `color` と `folded` を持つテーブル、説明を持つテーブルと、1 対多の関係 2 本を持つ
 */

/** タイトル・範囲・更新日と、テーブル 3 つ・関係 2 本を持つ ER 図の部品の定義 */
export const RETIRED_ER_DEFINITION = {
  title: "注文のデータ",
  scope: "注文の DB",
  updated: "2026-11-10",
  width: 960,
  tables: [
    {
      id: "c",
      name: "customers",
      label: "顧客",
      kind: "master",
      desc: "注文する人",
      x: 24,
      y: 24,
      w: 230,
      columns: [
        { name: "id", type: "bigint", pk: true, nn: true },
        {
          name: "email",
          type: "varchar(255)",
          nn: true,
          desc: "ログインに使用する",
        },
      ],
    },
    {
      id: "o",
      name: "orders",
      label: "注文",
      kind: "transaction",
      color: "purple",
      folded: true,
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
        { name: "status", type: "varchar(20)" },
        { name: "note", type: "text" },
      ],
    },
    {
      id: "i",
      name: "order_items",
      label: "注文の明細",
      desc: "注文した商品と数量",
      x: 684,
      y: 24,
      w: 240,
      columns: [
        { name: "order_id", type: "bigint", pk: true, fk: true },
        { name: "quantity", type: "integer" },
      ],
    },
  ],
  relations: [
    {
      from: "c",
      fromColumn: "id",
      fromCard: "1",
      to: "o",
      toColumn: "customer_id",
      toCard: "0..n",
      label: "注文する",
    },
    {
      from: "o",
      fromColumn: "id",
      fromCard: "1",
      to: "i",
      toColumn: "order_id",
      toCard: "0..n",
      midX: 640,
      label: "含む",
    },
  ],
};

/** 範囲の前後の本文 */
const HEAD = ["# 注文の設計", "", "注文の記録の構造。", ""];
const TAIL = ["", "明細は注文と一緒に削除する。", ""];

/** 書き換える前の文書 */
export const RETIRED_ER_DOCUMENT = [
  ...HEAD,
  "<!-- er -->",
  "",
  "```json",
  JSON.stringify(RETIRED_ER_DEFINITION, null, 2),
  "```",
  "",
  "<!-- /er -->",
  ...TAIL,
].join("\n");

/** `<!-- er -->` の行の番号（1 から） */
export const RETIRED_ER_LINE = HEAD.length + 1;

/** 書き換えた後の文書 */
export const RETIRED_ER_DOCUMENT_CONVERTED = [
  ...HEAD,
  '<!-- map: {"title": "注文のデータ"} -->',
  "",
  "```mermaid",
  "erDiagram",
  "  customers {",
  "    bigint id PK",
  "    varchar(255) email",
  "  }",
  "  orders {",
  "    bigint id PK",
  "    bigint customer_id FK",
  "    varchar(20) status",
  "    text note",
  "  }",
  "  order_items {",
  "    bigint order_id PK, FK",
  "    integer quantity",
  "  }",
  '  customers ||--o{ orders : "注文する"',
  '  orders ||--o{ order_items : "含む"',
  "```",
  "",
  '<!-- map-data: {"version": 1, "notes": {"customers": {"text": "顧客\\n注文する人"}, "customers.email": {"text": "ログインに使用する"}, "orders": {"text": "注文"}, "orders.customer_id": {"text": "注文した顧客"}, "order_items": {"text": "注文の明細\\n注文した商品と数量"}}, "layout": {"orders": {"collapsed": true}}} -->',
  "",
  "<!-- /map -->",
  ...TAIL,
].join("\n");

/** 移行の報告に挙がる項目（範囲の行ごとに、この順） */
export const RETIRED_ER_REPORT_ITEMS = [
  "scope: 注文の DB",
  "updated: 2026-11-10",
  "customers.kind: master",
  "customers.id.nn: true",
  "customers.email.nn: true",
  "orders.kind: transaction",
  "orders.color: purple",
  "orders.id.nn: true",
  "orders.customer_id.nn: true",
];
