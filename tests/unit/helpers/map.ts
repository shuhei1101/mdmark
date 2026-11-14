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
