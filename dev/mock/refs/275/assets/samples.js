// #275 で追加するグラフの種類と ER 図の部品の定義の見本（文書に記載する部品の定義に当たる）。
// refs/42/assets/samples.js・refs/45/assets/samples.js の後、diagram.js の前に読み、同じ見本の表へ追加する

// 他の見本のスクリプトと同じ大域に読むため、宣言をブロックに閉じる
{
const weeks = ["第 1 週", "第 2 週", "第 3 週", "第 4 週", "第 5 週"];

// 系列 6 つの折れ線: 6 つ目までの色・線の模様・点のマーカーの組を全て見せる
window.mdmarkMockDiagrams["reply-time-6"] = {
  kind: "chart",
  type: "line",
  title: "窓口ごとの返信までの時間",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "週", ticks: weeks },
  y: { label: "分" },
  series: [
    { name: "メール", points: [42, 38, 35, 31, 29] },
    { name: "フォーム", points: [55, 51, 47, 46, 40] },
    { name: "チャット", points: [12, 11, 9, 10, 8] },
    { name: "電話", points: [5, 6, 4, 5, 4] },
    { name: "SNS", points: [68, 62, 60, 52, 49] },
    { name: "店頭", points: [22, 25, 21, 19, 18] },
  ],
};

// 面: 系列 2 つ。線の下を系列の色の薄い面で塗る
window.mdmarkMockDiagrams["visits-area"] = {
  kind: "chart",
  type: "area",
  title: "文書の閲覧数",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "週", ticks: weeks },
  y: { label: "回" },
  series: [
    { name: "使い方", points: [320, 410, 380, 460, 520] },
    { name: "リファレンス", points: [180, 210, 260, 240, 300] },
  ],
};

// 積み上げの面: 系列 3 つ。面を系列の塗りの模様で分ける
window.mdmarkMockDiagrams["visits-stacked-area"] = {
  kind: "chart",
  type: "stacked-area",
  title: "文書の閲覧数（種類ごとの積み上げ）",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "週", ticks: weeks },
  y: { label: "回" },
  series: [
    { name: "使い方", points: [320, 410, 380, 460, 520] },
    { name: "リファレンス", points: [180, 210, 260, 240, 300] },
    { name: "はじめに", points: [90, 70, 110, 80, 100] },
  ],
};

// 積み上げの棒: 系列 3 つ。棒の上に合計を出す
window.mdmarkMockDiagrams["inquiry-stacked"] = {
  kind: "chart",
  type: "stacked-bar",
  title: "窓口ごとの問い合わせの件数（返信の種類の積み上げ）",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "窓口", ticks: ["メール", "フォーム", "チャット", "電話"] },
  y: { label: "件" },
  series: [
    { name: "よくある質問で回答", points: [86, 60, 41, 5] },
    { name: "担当者へ回送", points: [38, 41, 63, 95] },
    { name: "返信なし", points: [12, 6, 4, 0] },
  ],
};

// 横棒: 系列 2 つ。項目の名前が長いときに使う
window.mdmarkMockDiagrams["inquiry-horizontal"] = {
  kind: "chart",
  type: "horizontal-bar",
  title: "質問の分類ごとの件数",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "分類", ticks: ["料金", "設定", "障害", "解約", "その他"] },
  y: { label: "件" },
  series: [
    { name: "今週", points: [64, 51, 23, 12, 30] },
    { name: "先週", points: [58, 44, 31, 15, 26] },
  ],
};

// ドーナツ: 項目 4 つ。中央に合計を出す
window.mdmarkMockDiagrams["reply-kind-donut"] = {
  kind: "chart",
  type: "donut",
  title: "返信の種類の割合",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  unit: " 件",
  items: [
    { name: "よくある質問で回答", value: 186 },
    { name: "担当者へ回送", value: 92 },
    { name: "テンプレートで回答", value: 41 },
    { name: "返信なし", value: 22 },
  ],
};

// レーダー: 系列 2 つ・軸 5 つ
window.mdmarkMockDiagrams["review-radar"] = {
  kind: "chart",
  type: "radar",
  title: "窓口の評価",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "観点", ticks: ["速さ", "正確さ", "丁寧さ", "解決率", "満足度"] },
  y: { label: "点", min: 0, max: 5, step: 1 },
  series: [
    { name: "自動返信", points: [5, 3, 3, 3, 3] },
    { name: "担当者", points: [2, 5, 4, 4, 4] },
  ],
};

// バブル: 系列 2 つ。3 つ目の値を円の面積で出す
window.mdmarkMockDiagrams["inquiry-bubble"] = {
  kind: "chart",
  type: "bubble",
  title: "本文の長さと返信までの時間と件数",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "本文の長さ（字）" },
  y: { label: "分" },
  size: { label: "件数" },
  series: [
    { name: "自動返信", points: [[150, 8, 40], [400, 12, 90], [750, 15, 20]] },
    { name: "担当者", points: [[250, 30, 15], [550, 42, 60], [900, 55, 35]] },
  ],
};

// 折れ線と棒の組み合わせ: 棒の件数（左の軸）と、折れ線の解決率（右の軸）
window.mdmarkMockDiagrams["inquiry-combo"] = {
  kind: "chart",
  type: "combo",
  title: "問い合わせの件数と解決率",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "週", ticks: weeks },
  y: { label: "件" },
  y2: { label: "%", min: 0, max: 100, step: 20 },
  series: [
    { name: "件数", as: "bar", points: [210, 245, 230, 270, 260] },
    { name: "解決率", as: "line", axis: "y2", points: [72, 75, 80, 78, 84] },
  ],
};

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
