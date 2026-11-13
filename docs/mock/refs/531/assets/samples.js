// map の ER 図・状態遷移図のモックの見本（文書の map の範囲に記載する Mermaid と補足に該当する）

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

export const ER_DATA = {
  version: 1,
  notes: {
    注文: { text: "1 回の注文。明細と支払いを持つ" },
    "注文.状態": { text: "下書き・確定・発送済み・取り消し" },
    r2: { text: "注文 1 件に明細が 1 件以上つながる" },
  },
  groups: { 記録: { title: "記録", tables: ["注文", "明細", "支払い"] } },
};

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

export const STATE_DATA = {
  version: 1,
  notes: {
    確認待ち: { text: "担当者の確認を待つ状態" },
    t6: { text: "差し戻しの理由はコメントに残る" },
  },
};
