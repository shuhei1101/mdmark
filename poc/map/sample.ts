import type { LayoutOverride } from "./layout.ts";

/** 日本語 30 文字のラベル */
export const LONG_LABELS = [
  "利用者の申し込みを受け付けて内容を検証し記録する窓口のサーバ",
  "選んだ一件の注文の詳しい内容と配送の状況を並べて見せる画面部",
  "毎晩の決まった時刻に全ての表の写しを取って別の場所へ保存する",
];

/** 入れ子 2 レイヤー・ノード 30・線 40。階層をまたぐ線と、向きの違う箱を持つ */
export const SAMPLE_FLOW = `flowchart LR
  %% 利用者と外の仕組み
  user(["利用者"]):::external
  admin(["管理者"]):::external
  cron{{"定期実行"}}
  mail["メールの送信"]
  log[("ログ")]:::data
  monitor{"監視"}
  docsite>"文書のサイト"]
  subgraph app [アプリ]
    direction LR
    gw["入口"]
    cache[("キャッシュ")]:::data
    subgraph fe [画面]
      direction TB
      page["ページ"]
      form["入力の欄"]
      list["一覧"]
      detail["${LONG_LABELS[1]}"]
      toast("通知")
    end
    subgraph be [サーバー]
      api["${LONG_LABELS[0]}"]:::script
      auth["認証"]
      job["処理の実行"]
      queue[("待ち行列")]:::data
      render["描画"]
    end
  end
  subgraph data [データ]
    direction TB
    files[("ファイル")]:::data
    backup["${LONG_LABELS[2]}"]
    index[("索引")]:::data
    subgraph db [DB]
      direction LR
      users[("利用者の表")]:::data
      orders[("注文の表")]:::data
      items[("商品の表")]:::data
      audit[("監査の表")]:::data
    end
  end
  subgraph ext [外部]
    direction TB
    pay["決済"]:::external
    smtp["メールの配送"]:::external
    cdn["配信網"]:::external
    idp["認証の提供元"]:::external
  end
  user --> page
  admin --> page
  page --> form --> list
  list --> detail
  detail -.-> toast
  form e1@--> gw
  gw -->|振り分け| api
  gw -- 認証の確認 --> auth
  api --> job
  job --> queue
  queue -.-> render
  api ==> cache
  auth --> idp
  api --> pay
  job --> smtp
  smtp --> mail
  api --> users
  api --> orders
  job --> items
  auth --> audit
  users & orders --> backup
  items --> index
  backup --> files
  index -.-> files
  cron --> job
  job --> log
  api --> log
  log --> monitor
  monitor -.-> admin
  render --> cdn
  cdn --> page
  render --> docsite
  cache -.-> render
  list --> api
  detail --> render
  toast -.-> user
  users --> orders --> items
`;

/** GitHub の Mermaid でも読めない行 */
export const UNREADABLE_LINE = "  gw -> api";

export const SAMPLE_SEQUENCE = `sequenceDiagram
  actor U as 利用者
  participant P as ページ
  participant A as API
  participant D as DB
  U->>P: 申し込む
  P->>A: 送る
  loop 3 回まで
    A->>D: 書く
    D-->>A: 結果
  end
  A-->>P: 応答
  P-->>U: 表示
`;

/** 補足の layout の上書き */
export const SAMPLE_OVERRIDES: Record<string, LayoutOverride> = {
  cache: { align: "gw" },
  audit: { order: 0 },
  monitor: { pos: { x: 0, y: 0 } },
};
