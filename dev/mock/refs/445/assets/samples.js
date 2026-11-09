// map の図のモックの見本: 構成図の Mermaid・補足・シーケンス図（文書の map の範囲に記載する内容に該当する）

/** 構成図: 入れ子 2 レイヤーのグループ・グループをまたぐ線・種類のクラス */
export const FLOW = `flowchart LR
  user(["利用側のページ"]):::external
  subgraph lib [mdmark]
    direction LR
    mount["mount"]:::script
    subgraph read [記法の読み取り]
      direction TB
      marker["map のマーカーの読み取り"]:::script
      mermaid["Mermaid の記法の読み取り"]:::script
      data["補足の検査"]:::script
    end
    subgraph place [配置]
      direction TB
      layout["入れ子のグループの自動配置"]:::script
      route["線の経路"]:::script
    end
    frame["図の枠"]:::script
  end
  subgraph store [データ]
    direction TB
    index[("索引")]:::data
    doc[("文書の Markdown")]:::data
  end
  user -->|設定と Markdown| mount
  mount --> marker
  doc -.-> marker
  marker --> mermaid
  marker --> data
  index -.-> data
  mermaid --> layout
  data --> layout
  layout --> route
  route --> frame
  data --> frame
  frame -->|描いた図| user
`;

export const DATA = {
  notes: {
    layout: "内側のグループから配置し、グループの大きさを決めてから外側を配置する",
    data: "version と機能ごとのキーをスキーマで検査する",
  },
  relations: {
    呼び出し: [
      { from: "user", to: "mount" },
      { from: "mount", to: "marker" },
      { from: "marker", to: "mermaid" },
      { from: "mermaid", to: "layout" },
      { from: "layout", to: "route" },
      { from: "route", to: "frame" },
      { from: "frame", to: "user" },
    ],
    データの流れ: [
      { from: "doc", to: "marker" },
      { from: "index", to: "data" },
      { from: "data", to: "layout" },
      { from: "data", to: "frame" },
    ],
  },
  walkthroughs: [
    { text: "利用側のページが、設定と Markdown を mount に渡します。", highlight: ["user", "mount"] },
    { text: "文書と索引は、補足の検査と map のマーカーの読み取りに読まれます。", view: "データの流れ", highlight: ["doc", "index", "data"] },
    { text: "配置のグループの中で、自動配置の後に線の経路を決めます。", enter: "place", highlight: ["layout", "route"] },
  ],
  links: { frame: ["図の枠の部品"] },
};

export const SEQUENCE = {
  title: "文書を描くまで",
  source: `sequenceDiagram
  participant user as 利用側のページ
  participant mount as mount
  participant marker as map のマーカーの読み取り
  participant mermaid as Mermaid の記法の読み取り
  participant layout as 自動配置
  user->>mount: 設定と Markdown
  mount->>marker: map の範囲
  marker->>mermaid: mermaid のブロック
  mermaid->>layout: ノードと線
`,
};
