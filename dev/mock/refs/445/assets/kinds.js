// map の図で使えるノードの種類・線の種類・グループ・データの点の一覧: 本文は配布物の mount で描き、目印の段落の場所に map の図を置く

import { mount } from "../../../../../dist/index.js";
import { createMap } from "./map-mock.js";

/** ノードの種類: Mermaid のクラスと、使う場面の例 */
const NODES = `flowchart LR
  llm["要約する"]:::llm
  dm["振り分けを選ぶ"]:::dm
  script["形式を検査する"]:::script
  mcp["Issue を取得する"]:::mcp
  data[("索引")]:::data
  external(["利用側のページ"]):::external
`;

/** 線の種類: Mermaid の矢印と、使う場面の例 */
const LINES = `flowchart LR
  caller["呼び出し元"]:::script
  worker["処理"]:::script
  store[("保存先")]:::data
  source[("読み込み元")]:::data
  peer["相手"]:::script
  caller -->|処理の流れ| worker
  source -.->|読み込む| worker
  worker ==>|書き込む| store
  worker <-->|やり取り| peer
`;

/** グループ: subgraph の入れ子・色・最初に閉じる */
const GROUPS = `flowchart LR
  user(["利用者"]):::external
  subgraph app [アプリ]
    direction LR
    subgraph front [画面]
      page["一覧の画面"]:::script
    end
    subgraph back [サーバー]
      direction TB
      api["API"]:::script
      job["集計の処理"]:::script
    end
  end
  subgraph store [データ]
    db[("DB")]:::data
  end
  user --> page
  page --> api
  api ==> db
  job -.-> db
`;

/** データの点: 線ごとに色と形を変える */
const PACKETS = `flowchart LR
  a["送り手"]:::script
  b["受け手 1"]:::script
  c["受け手 2"]:::llm
  d[("受け手 3")]:::data
  a -->|丸| b
  a -->|四角| c
  a ==>|ひし形| d
`;

const markdown = `# map の図で使えるノード・線・グループ・データの点

map の図は、Mermaid の \`flowchart\` に書いたクラス・矢印・\`subgraph\` から、今のフロー図と同じ見た目で描く。色と形の上書きは補足の \`layout\` に書く。

## ノードの種類

MAP-SLOT-NODES

| 種類 | Mermaid の書き方 | 形とアイコン | 使う場面の例 |
| --- | --- | --- | --- |
| LLM | \`llm["要約する"]:::llm\` | 角の丸い四角・ロボット | LLM に要約・分類・文章の生成をさせる処理 |
| 意思決定モデル | \`dm["振り分けを選ぶ"]:::dm\` | 角の丸い四角・分かれ道 | 選択肢から 1 つを選ぶだけの速い判断のモデル |
| スクリプト | \`script["形式を検査する"]:::script\` | 角の丸い四角・コード | 決まった手順で動くプログラム（変換・検査・集計）。クラスを書かないノードもスクリプト |
| MCP | \`mcp["Issue を取得する"]:::mcp\` | 角の丸い四角・プラグ | MCP のサーバーやツールの呼び出し |
| データ | \`data[("索引")]:::data\` | 下の角が丸い四角・データベース | 保存しているデータ（DB・ファイル・索引・キャッシュ） |
| 外部のシステム | \`external(["利用側のページ"]):::external\` | 角の丸い四角・地球 | 図の範囲の外のシステム・利用者・外部の API |

判定フローチャートの開始・質問・アクション・結果の種類（\`:::start\`・\`:::question\`・\`:::action\`・\`:::result\`）は、処理の順番を描く図で使う。

## 線の種類

MAP-SLOT-LINES

| 種類 | Mermaid の書き方 | 線の見た目 | 使う場面の例 |
| --- | --- | --- | --- |
| 処理の流れ | \`a --> b\` | 実線・塗りの矢じり | 呼び出す・渡す・次の処理へ進む |
| 読み込む | \`a -.-> b\` | 破線・線の矢じり | データを参照する（元はデータ、先は処理） |
| 書き込む | \`a ==> b\` | 太い実線・塗りの矢じり | データを保存・更新する（元は処理、先はデータ） |
| 両向き | \`a <--> b\` | 両端に矢じり | 互いにやり取りする（データの点は両方へ流れる） |
| 返却する・戻る（ループ） | 補足の \`layout\` で線の ID に \`line: reply\`・\`line: loop\` | 破線・線の矢じり | 呼び出し元へ結果を返す・前の処理へ戻って繰り返す（Mermaid の矢印に無いため補足で指定する） |

線のラベルは \`a -->|ラベル| b\`、線の説明は補足の \`notes\` に線の ID（\`L0\` など）で書く。説明を持つ線にポインターを当てるとツールチップに出る。

## グループ

MAP-SLOT-GROUPS

| 項目 | 書き方 | 見え方 |
| --- | --- | --- |
| グループ | \`subgraph app [アプリ]\` 〜 \`end\` | 枠と左上のタイトル。タイトルを押すと中へ入り、山形で開閉する。入れ子は 2 段まで推奨 |
| 並べる向き | グループの中の \`direction LR\`・\`direction TB\` | 中のノードを左から右・上から下に並べる |
| 色 | 補足の \`layout\` で \`{グループの ID}: { color: blue }\` | 枠と面とタイトルの文字がその色の名前の配色になる |
| 最初に閉じる | 補足の \`layout\` で \`{グループの ID}: { collapsed: true }\` | 開いたときから閉じたグループのノードで描く（既定は開く） |

## データの点

MAP-SLOT-PACKETS

| 項目 | 書き方 | 既定 | 選べる値 |
| --- | --- | --- | --- |
| 形 | 補足の \`layout\` で \`packet: { shape: … }\`（図全体）か \`{線の ID}: { packet: { shape: … } }\` | 丸（\`dot\`） | 丸（\`dot\`）・四角（\`square\`）・ひし形（\`diamond\`） |
| 色 | 同じく \`packet: { color: … }\` | 線の色（\`line\`） | 線の色（\`line\`）・元のノードの色（\`source\`）・先のノードの色（\`target\`）・色の名前（\`blue\` など） |
`;

const doc = document.getElementById("doc");
mount(doc, { markdown });
const slot = (text) => [...doc.querySelectorAll("p")].find((p) => p.textContent.trim() === text);
const place = (text, spec, initial = {}) => {
  const host = document.createElement("div");
  host.className = "map-host";
  slot(text).replaceWith(host);
  createMap(host, spec, initial);
};

// 線を持たないノードは自動配置で 1 列に並ぶため、一覧では座標の固定（補足の layout の pos）で 3 列に並べる
const grid = Object.fromEntries(["llm", "dm", "script", "mcp", "data", "external"].map((id, index) => [id, { pos: { x: (index % 3) * 200, y: Math.floor(index / 3) * 100 } }]));
place("MAP-SLOT-NODES", { id: "kinds-nodes", title: "ノードの種類", flow: NODES, data: { layout: grid } });
place("MAP-SLOT-LINES", { id: "kinds-lines", title: "線の種類", flow: LINES, data: {} });
place("MAP-SLOT-GROUPS", {
  id: "kinds-groups",
  title: "グループ",
  flow: GROUPS,
  data: { colors: { front: "blue", back: "green", store: "orange" }, layout: {} },
});
place(
  "MAP-SLOT-PACKETS",
  {
    id: "kinds-packets",
    title: "データの点",
    flow: PACKETS,
    data: {
      walkthroughs: [{ text: "上から、丸・線の色（既定）、四角・先のノードの色、ひし形・色の名前（purple）のデータの点が流れます。", highlight: ["a", "b", "c", "d"] }],
      layout: {
        L1: { packet: { shape: "square", color: "target" } },
        L2: { packet: { shape: "diamond", color: "purple" } },
      },
    },
  },
  { step: 0 },
);
