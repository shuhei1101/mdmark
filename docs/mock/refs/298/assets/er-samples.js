// #298 で追加する ER 図の部品の定義の見本（文書に記載する部品の定義に当たる）。
// refs/42/assets/samples.js の後、diagram.js の前に読み、同じ見本の表へ追加する

// 他の見本のスクリプトと同じ大域に読むため、宣言をブロックに閉じる
{
// ER 図: 顧客・注文・注文の明細・商品の 4 テーブル。注文は列が多い
const erTables = () => [
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
      { name: "email", type: "varchar(255)", nn: true, desc: "ログインに使う。重複を許さない" },
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
      { name: "customer_id", type: "bigint", fk: true, nn: true, desc: "注文した顧客" },
      { name: "status", type: "varchar(20)", nn: true, desc: "received・paid・shipped・canceled のどれか" },
      { name: "ordered_at", type: "timestamp", nn: true },
      { name: "paid_at", type: "timestamp" },
      { name: "shipped_at", type: "timestamp" },
      { name: "total", type: "integer", nn: true, desc: "明細の小計の合計（税込み）" },
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
      { name: "unit_price", type: "integer", nn: true, desc: "注文した時点の単価" },
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

const erRelations = [
  { from: "customers", fromColumn: "id", fromCard: "1", to: "orders", toColumn: "customer_id", toCard: "0..n", label: "注文する" },
  { from: "orders", fromColumn: "id", fromCard: "1", to: "order_items", toColumn: "order_id", toCard: "1..n", label: "含む" },
  { from: "products", fromColumn: "id", fromCard: "1", to: "order_items", toColumn: "product_id", toCard: "0..n", midX: 954, label: "注文される" },
];

window.mdmarkMockDiagrams["shop-er"] = {
  kind: "er",
  title: "注文のデータ",
  scope: "注文の DB",
  updated: "2026-10-31",
  width: 1000,
  tables: erTables(),
  relations: erRelations,
};

// テーブルに色を指定した ER 図: 種類の既定の色を color で上書きし、種類の無いテーブルにも色を付ける
window.mdmarkMockDiagrams["shop-er-colors"] = {
  ...window.mdmarkMockDiagrams["shop-er"],
  title: "注文のデータ（テーブルの色を指定）",
  tables: erTables().map((t) => {
    if (t.id === "products") return { ...t, color: "green" };
    if (t.id === "order_items") return { ...t, kind: undefined, color: "purple" };
    return t;
  }),
};

// 注文のテーブルを畳んだ ER 図: 主キーと外部キーの列だけを出し、残りの列の数を出す
window.mdmarkMockDiagrams["shop-er-folded"] = {
  ...window.mdmarkMockDiagrams["shop-er"],
  tables: erTables().map((t) => (t.id === "orders" ? { ...t, folded: true } : t)),
};
}
