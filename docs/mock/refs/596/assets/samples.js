// map のクラス図・アーキテクチャ図・C4 図のモックの見本（文書の map の範囲に記載する Mermaid と補足に該当する）

export const CLASS = `classDiagram
  namespace 形状 {
    class 図形 {
      <<interface>>
      +面積() float
    }
    class 基本図形 {
      #色 string
      +描く()*
      +数$ int
    }
    class 円 {
      -半径 float
      +面積() float
    }
  }
  class 図面 {
    +名前 string
    +追加(図形 g) void
  }
  class 一覧~T~ {
    -要素 T[]
    +先頭() T
  }
  class 描画器 {
    ~拡大率 float
    +描画(図面 d) void
  }
  基本図形 ..|> 図形
  基本図形 <|-- 円
  図面 *-- 基本図形
  図面 o-- 一覧
  描画器 --> 図面 : 描く
  描画器 ..> 図形
  一覧 "1" -- "*" 円
  note for 描画器 "画面ごとに 1 つ作る"
`;

export const CLASS_DATA = {
  version: 1,
  notes: {
    基本図形: { text: "色を持つ図形の共通の親" },
    "基本図形.描く": { text: "子のクラスで描き方を決める" },
    r5: { text: "描画器は図面を 1 つずつ描く" },
  },
  layout: { 一覧: { color: "green" } },
};

export const ARCH = `architecture-beta
  group cloud(cloud)[クラウド]
  group app(server)[アプリ] in cloud
  service web(internet)[利用者のブラウザ]
  service api(server)[API サーバー] in app
  service worker(server)[ジョブ] in app
  service db(database)[データベース] in cloud
  service files(disk)[ファイル置き場] in cloud
  service cdn(cloud)[配信網]
  junction hub in cloud
  web:R --> L:cdn
  cdn:R --> L:api
  api:B -- T:worker
  api:R -- L:hub
  hub:R -- L:db
  hub:B -- T:files
`;

export const ARCH_DATA = {
  version: 1,
  notes: {
    api: { text: "利用者の要求を受ける" },
    r3: { text: "時間の掛かる処理をジョブへ渡す" },
  },
};

export const C4 = `C4Context
  title 注文のシステムの全体
  Person(customer, "顧客", "商品を注文する人")
  Person_Ext(support, "サポートの担当", "問い合わせに答える")
  Enterprise_Boundary(company, "自社") {
    System_Boundary(shop, "通販") {
      System(store, "注文のシステム", "注文と支払いを受け付ける")
      SystemDb(orders, "注文のデータベース", "注文と明細を保存する")
      SystemQueue(events, "通知の待ち行列", "発送の通知を順に送る")
    }
    System(stock, "在庫のシステム", "在庫の数を持つ")
  }
  System_Ext(pay, "決済代行", "カードの決済")
  Rel(customer, store, "注文する", "HTTPS")
  Rel_D(store, orders, "保存する")
  Rel_R(store, stock, "在庫を引き当てる")
  BiRel(store, pay, "決済する")
  Rel(store, events, "通知を積む")
  Rel(support, store, "注文を調べる")
`;

export const C4_DATA = {
  version: 1,
  notes: {
    store: { text: "注文の受付から通知までを持つ" },
  },
};
