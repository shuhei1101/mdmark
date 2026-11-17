/** map の単体テストの見本（モック `docs/mock/refs/445/assets/samples.js` と同じ Mermaid。補足は ER 図『mapの補足』の構造の JSON） */

/** 構成図: 入れ子 2 レイヤーのグループ・グループをまたぐ線・種類のクラス（ノード 10・グループ 4・線 12） */
export const FLOW = `flowchart LR
  user(["利用側のページ"]):::outside
  subgraph lib [mdmark]
    direction LR
    mount["mount"]:::step
    subgraph read [記法の読み取り]
      direction TB
      marker["map のマーカーの読み取り"]:::step
      mermaid["Mermaid の記法の読み取り"]:::step
      data["補足の検査"]:::step
    end
    subgraph place [配置]
      direction TB
      layout["入れ子のグループの自動配置"]:::step
      route["線の経路"]:::step
    end
    frame["図の枠"]:::step
  end
  subgraph store [データ]
    direction TB
    index[("索引")]:::store
    doc[("文書の Markdown")]:::store
  end
  user -->|設定と Markdown| mount
  mount --> marker
  doc -.-> marker
  marker -->|mermaid のブロック| mermaid
  marker -->|補足| data
  index -.-> data
  mermaid -->|ノードと線| layout
  data -->|layout の上書き| layout
  layout --> route
  route <--> frame
  data --> frame
  frame -->|HTML| user
`;

/** シーケンス図（参加者 5・メッセージ 7・ブロック 3・注記 1・活性化 1） */
export const SEQUENCE = `sequenceDiagram
  autonumber
  participant user as 利用側のページ
  participant mount as mount
  participant marker as map のマーカーの読み取り
  participant mermaid as Mermaid の記法の読み取り
  participant layout as 自動配置
  %% block: 描く前の準備
  rect rgb(240, 244, 255)
    user->>+mount: 設定と Markdown
  end
  loop map の範囲ごと
    mount->>marker: map の範囲
    alt mermaid のブロックがある
      marker->>mermaid: mermaid のブロック
      mermaid->>layout: ノードと線
      layout-->>mount: 配置した図
    else ブロックが無い
      marker--xmount: 書き方の警告
    end
  end
  Note over user,mount: 全ての範囲を描き終えてから返す
  mount-->>-user: 描いた文書
`;

/** 構成図の補足（JSON のオブジェクト。複数の行にわたる） */
export const DATA = `{
  "version": 1,
  "notes": {
    "layout": {"text": "内側のグループから配置し、グループの大きさを決めてから外側を配置する"},
    "data": {"text": "version と機能ごとのキーをスキーマで検査する"}
  },
  "walkthroughs": [
    {"title": "mount に渡す", "text": "利用側のページが、設定と Markdown を mount に渡します。", "nodes": ["user", "mount"]},
    {
      "title": "文書と索引を読む",
      "text": "文書と索引は、補足の検査と map のマーカーの読み取りに読まれます。\\n索引の用語と別名は、補足の検査でラベルと notes の文の照合に使います。\\n文書の Markdown は、map の範囲ごとに 1 つの図の定義に分けます。",
      "nodes": ["doc", "index", "data"]
    },
    {"title": "線の経路を決める", "text": "配置のグループの中で、自動配置の後に線の経路を決めます。", "enter": "place", "nodes": ["layout", "route"]},
    {"title": "大きさを伝え合う", "text": "線の経路と図の枠は、描き直すたびに互いに大きさを伝え合います。", "nodes": ["route", "frame"]}
  ],
  "layout": {
    "read": {"color": "blue"},
    "place": {"color": "green"},
    "store": {"color": "orange"}
  }
}
`;

/** 使う側の設定の map（既定を当てた後の形） */
export const CONFIG = {
  node_fit: "height" as const,
  url_state: true,
  kinds: {
    step: { label: "処理", icon: "cog", shape: "rounded" as const },
    store: {
      label: "保存先",
      icon: "database",
      shape: "rect" as const,
      color: "purple",
    },
    outside: {
      label: "外部",
      icon: "globe",
      shape: "pill" as const,
      color: "green",
    },
  },
  lines: {
    "-.->": { dash: "dashed" as const, head: "open" as const },
    "==>": { width: "thick" as const, color: "orange" },
    back: { dash: "dotted" as const, head: "open" as const },
  },
};

/** map の範囲の Markdown を組み立てる */
export function mapRange(options: {
  args?: string;
  mermaid?: string;
  data?: string;
}): string {
  const open =
    options.args === undefined
      ? "<!-- map -->"
      : `<!-- map: ${options.args} -->`;
  const block =
    options.mermaid === undefined
      ? ""
      : `\n\n\`\`\`mermaid\n${options.mermaid}\`\`\`\n`;
  const data =
    options.data === undefined ? "" : `\n<!-- map-data: ${options.data} -->\n`;
  return `${open}${block}${data}\n<!-- /map -->\n`;
}

/** ER 図（テーブル 5・関連 5。モック `docs/mock/refs/531/assets/samples.js` の `ER` と同じ） */
export const ER = `erDiagram
  顧客 {
    int id PK
    string 名前
    string メール UK "ログインに使う"
  }
  注文 {
    int id PK
    int 顧客ID FK
    date 注文日
    string 状態
    int 合計
    string 配送先
    string 備考 "利用者が入力した自由な文"
    datetime 更新日時
  }
  明細 {
    int id PK
    int 注文ID FK
    int 商品ID FK
    int 数量
  }
  商品 {
    int id PK
    string 名前
    int 価格
  }
  支払い {
    int id PK
    int 注文ID FK
    int 金額
  }
  顧客 ||--o{ 注文 : "注文する"
  注文 ||--|{ 明細 : "含む"
  明細 }o--|| 商品 : "指す"
  注文 ||..o{ 支払い : "支払う"
  商品 |o--|| 顧客 : "最後に見た"
`;

/** ER 図の補足（説明・分類） */
export const ER_DATA = `{
  "version": 1,
  "notes": {
    "注文": {"text": "1 回の注文。明細と支払いを持つ"},
    "注文.状態": {"text": "下書き・確定・発送済み・取り消し"},
    "r2": {"text": "注文 1 件に明細が 1 件以上つながる"}
  },
  "groups": {"記録": {"title": "記録", "tables": ["注文", "明細", "支払い"]}}
}
`;

/** 状態遷移図（遷移 13・入れ子の状態 2・注記 1・分岐 1。モックの `STATE` と同じ） */
export const STATE = `stateDiagram-v2
  direction LR
  state "差し戻しの理由を確認する" as s1
  state 判定 <<choice>>
  [*] --> 下書き
  下書き --> 下書き : 保存する
  下書き --> 確認待ち : 提出する
  確認待ち --> 判定 : 確認する
  判定 --> 実行中 : 承認
  判定 --> s1 : 差し戻し
  s1 --> 処理 : 再開する
  実行中 --> 完了 : 終える
  state 実行中 {
    direction LR
    準備
    処理
    [*] --> 準備
    処理 --> [*]
  }
  完了 --> [*]
  state 保留 {
    待機
  }
  確認待ち --> 保留 : 保留する
  保留 --> 確認待ち : 戻す
  note right of 確認待ち : 担当者が内容を確認する
`;

/** 状態遷移図の補足（説明） */
export const STATE_DATA = `{
  "version": 1,
  "notes": {
    "確認待ち": {"text": "担当者の確認を待つ状態"},
    "t6": {"text": "差し戻しの理由はコメントに残る"}
  }
}
`;

/** クラス図（クラス 6・関係 7・namespace 1・ノート 1。モック `docs/mock/refs/596/assets/samples.js` の `CLASS` と同じ） */
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

/** クラス図の補足（説明・色・座標） */
export const CLASS_DATA = `{
  "version": 1,
  "notes": {
    "基本図形": {"text": "色を持つ図形の共通の親"},
    "基本図形.描く": {"text": "子のクラスで描き方を決める"},
    "r5": {"text": "描画器は図面を 1 つずつ描く"}
  },
  "layout": {"一覧": {"color": "green"}, "描画器": {"pos": {"x": 0, "y": 0}}}
}
`;

/** アーキテクチャ図（group 2・service 6・junction 1・線 6。モックの `ARCH` と同じ） */
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
  api{group}:R -- L:hub
  hub:R -- L:db
  hub:B -- T:files
`;

/** アーキテクチャ図の補足（説明・座標・入る辺） */
export const ARCH_DATA = `{
  "version": 1,
  "notes": {
    "api": {"text": "利用者の要求を受ける"},
    "r3": {"text": "時間の掛かる処理をジョブへ渡す"}
  },
  "layout": {"web": {"pos": {"x": 0, "y": 120}}, "r2": {"ends": {"to": {"side": "top"}}}}
}
`;

/** C4 図（要素 7・境界 2・関係 6。モックの `C4` と同じ） */
export const C4 = `C4Context
  title 注文のシステムの全体
  Person(customer, "顧客", "商品を注文する人")
  Person_Ext(support, "サポートの担当", "問い合わせに答える")
  Enterprise_Boundary(company, "自社") {
    System_Boundary(shop, "通販") {
      System(store, "注文のシステム", "注文と支払いを受け付ける")
      System(stock, "在庫のシステム", "在庫の数を持つ")
      SystemDb(orders, "注文のデータベース", "注文と明細を保存する")
    }
    SystemQueue(events, "通知の待ち行列", "発送の通知を順に送る")
  }
  System_Ext(pay, "決済代行", "カードの決済")
  Rel(customer, store, "注文する", "HTTPS")
  Rel_D(store, orders, "保存する")
  Rel_R(store, stock, "在庫を引き当てる")
  BiRel(store, pay, "決済する")
  Rel(store, events, "通知を積む")
  Rel(support, store, "注文を調べる")
`;

/** C4 図の補足（説明・座標） */
export const C4_DATA = `{
  "version": 1,
  "notes": {"store": {"text": "注文の受付から通知までを持つ"}},
  "layout": {"orders": {"pos": {"x": 0, "y": 200}}}
}
`;

/** マインドマップ（根 1・1 レイヤー目の枝 4・項目 14。モック `docs/mock/refs/649/assets/samples.js` の `MINDMAP` と同じ） */
export const MINDMAP = `mindmap
  root((企画の論点))
    a1[目的]
      利用者を増やす
      継続して使ってもらう
    (体制)
      課題
        人手が足りない
      ))担当の割り当て((
    )予算(
      課題
        見積もりが粗い
    {{スケジュール}}
      リリースの時期を四半期の終わりまでに決めて関係者へ共有する
        ::icon(fa fa-book)
      マイルストーン
      :::urgent
`;

/** 見た目を指定する行（`::icon()` と `:::`）を持たないマインドマップ（モックの `MINDMAP_PLAIN` と同じ） */
export const MINDMAP_PLAIN = MINDMAP.split("\n")
  .filter(
    (line) =>
      !line.trim().startsWith("::icon(") && !line.trim().startsWith(":::"),
  )
  .join("\n");

/** マインドマップの補足（説明。モックの `MINDMAP_DATA` と同じ） */
export const MINDMAP_DATA = `{
  "version": 1,
  "notes": {
    "a1": {"text": "利用者の数と、続けて使う割合の 2 つで測る"},
    "人手が足りない": {"text": "開発 2 名・デザイン 0 名"}
  }
}
`;

/** マインドマップの補足の layout（色と閉じた状態、適用しない座標と並び順。モックの `MINDMAP_LAYOUT_DATA` と同じ） */
export const MINDMAP_LAYOUT_DATA = `{
  "version": 1,
  "notes": {
    "a1": {"text": "利用者の数と、続けて使う割合の 2 つで測る"},
    "人手が足りない": {"text": "開発 2 名・デザイン 0 名"}
  },
  "layout": {
    "a1": {"color": "purple"},
    "予算": {"collapsed": true},
    "マイルストーン": {"pos": {"x": 40, "y": 40}},
    "継続して使ってもらう": {"order": 0}
  }
}
`;

/** マインドマップの補足の案内（手順 2 は体制の中へ入る。モックの `MINDMAP_WALK_DATA` と同じ） */
export const MINDMAP_WALK_DATA = `{
  "version": 1,
  "notes": {
    "a1": {"text": "利用者の数と、続けて使う割合の 2 つで測る"},
    "人手が足りない": {"text": "開発 2 名・デザイン 0 名"}
  },
  "walkthroughs": [
    {"title": "目的と体制", "text": "まず、何のためにやるかと、誰がやるかを決める", "nodes": ["a1", "体制"]},
    {"title": "体制の課題", "text": "体制の中では、人手の不足がいちばん大きい課題", "enter": "体制", "nodes": ["人手が足りない"]}
  ]
}
`;

/** 2 つ目の根を持つマインドマップ（モックの `MINDMAP_UNREADABLE` と同じ） */
export const MINDMAP_UNREADABLE = `mindmap
  root((企画の論点))
    a1[目的]
      利用者を増やす
    (体制)
 二つ目の根
`;
