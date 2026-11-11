// map の図のモックの見本: 構成図の Mermaid・補足・シーケンス図（文書の map の範囲に記載する内容に該当する）

/** 構成図: 入れ子 2 レイヤーのグループ・グループをまたぐ線・種類のクラス */
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
  marker -->|補足の YAML| data
  index -.-> data
  mermaid -->|ノードと線| layout
  data -->|layout の上書き| layout
  layout --> route
  route <--> frame
  data --> frame
  frame -->|HTML| user
`;

export const DATA = {
  notes: {
    layout: "内側のグループから配置し、グループの大きさを決めてから外側を配置する",
    data: "version と機能ごとのキーをスキーマで検査する",
    L2: "文書の map の範囲の Markdown",
    L5: "用語集の用語と別名",
  },
  /** 色の名前（グループ・ノード・線の id ごと） */
  colors: {
    read: "blue",
    place: "green",
    store: "orange",
    L2: "orange",
    L5: "orange",
  },
  walkthroughs: [
    { title: "mount に渡す", text: "利用側のページが、設定と Markdown を mount に渡します。", highlight: ["user", "mount"] },
    { title: "文書と索引を読む", text: "文書と索引は、補足の検査と map のマーカーの読み取りに読まれます。\n索引の用語と別名は、補足の検査でラベルと notes の文の照合に使います。\n文書の Markdown は、map の範囲ごとに 1 つの図の定義に分けます。", highlight: ["doc", "index", "data"] },
    { title: "線の経路を決める", text: "配置のグループの中で、自動配置の後に線の経路を決めます。", enter: "place", highlight: ["layout", "route"] },
    { title: "大きさを伝え合う", text: "線の経路と図の枠は、描き直すたびに互いに大きさを伝え合います。", highlight: ["route", "frame"] },
  ],
  /** 配置と見た目の上書き。packet はデータの印（図全体の既定と、線の ID ごと） */
  layout: {
    L5: { packet: { color: "source", shape: "diamond" } },
    L11: { line: "back" },
  },
};

export const SEQUENCE = {
  title: "文書を描くまで",
  /** メッセージの番号（1 から）ごとの説明。ポインターを当てたときのツールチップに出す */
  notes: {
    2: "map の範囲の Markdown と印の引数",
    3: "範囲の中の mermaid のコードブロックの本文。\nmap の範囲の中のブロックは、mermaid のライブラリでは描かない",
  },
  source: `sequenceDiagram
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
`,
};

/**
 * 使う側の設定（mdmark.config.yaml の map に該当する）: ノードの種類と線の種類は mdmark では決めず、ここで作る。
 * この見本は 3 種類のノードと、矢印ごとの線と名前の線（back）を作った例
 */
export const CONFIG = {
  kinds: {
    step: { label: "処理", icon: "cog", shape: "rounded" },
    store: { label: "保存先", icon: "database", shape: "rect", color: "purple" },
    outside: { label: "外部", icon: "globe", shape: "pill", color: "green" },
  },
  lines: {
    "-.->": { dash: "dashed", head: "open" },
    "==>": { width: "thick", color: "orange" },
    back: { dash: "dotted", head: "open" },
  },
};
