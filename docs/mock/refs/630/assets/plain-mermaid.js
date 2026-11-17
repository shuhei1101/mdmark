// map の範囲の外の mermaid のコードブロック（純粋な Mermaid）を、今の描き方（mermaid の図）と案 A（補足の無い map の図）で並べる。
// 案 A の図は、同じ Mermaid を引数だけを持つ map の範囲で囲み、配布物の mount で描く（front matter の title は範囲の引数の title に読み替える）

import { mount } from "../../../../../dist/index.js";

const FLOW_TITLE = "問い合わせの受付";
const FLOW = `flowchart LR
  A[問い合わせを受ける] --> B{担当がいるか}
  B -->|いる| C[担当へ回す]
  B -->|いない| D[一次回答を返却する]
  C --> E[(記録)]
  D --> E`;

const SEQUENCE = `sequenceDiagram
  actor U as 読者
  participant P as 利用側のページ
  participant M as mdmark
  participant X as mermaid
  P->>M: 設定と Markdown を指定して描かせる
  M->>M: コードブロックを集める
  M->>X: 本体を要求
  X-->>M: 本体
  M->>M: テーマを作る
  M-->>P: 図を描く
  P-->>U: 文書を表示
  U->>P: 図を拡大する
  P->>M: 倍率の変更
  M-->>P: 拡大した図
  U->>P: 図の余白を上へドラッグする
  P->>M: 位置の変更
  M-->>P: 参加者の行を上端に留めた図
  U->>P: 配色を切り替える
  P->>M: 配色の変化
  M-->>P: 再描画した図
  P-->>U: 文書を表示`;

const CLASS = `classDiagram
  class 文書 {
    +タイトル
    +本文
  }
  class 図 {
    +種類
    +ソース
  }
  文書 "1" --> "*" 図
  click 文書 href "./文書.md"`;

const GANTT = `gantt
  title 作業 PR の工程
  dateFormat YYYY-MM-DD
  section 設計
  単一ユースケース設計 :a1, 2026-11-16, 2d
  インターフェース定義設計 :a2, after a1, 2d
  section 実装
  実装 :b1, after a2, 3d
  結合テスト :b2, after b1, 2d`;

const fence = (source) => ["```mermaid", source, "```"].join("\n");
const mapRange = (source, args) =>
  [args ? `<!-- map: ${JSON.stringify(args)} -->` : "<!-- map -->", "", fence(source), "", "<!-- /map -->"].join("\n");

/** 1 つの見本: 今の描き方と案 A を見出しで分けて並べる */
const pair = (heading, lead, source, args) =>
  [
    `## ${heading}`,
    "",
    lead,
    "",
    "### 今（mermaid の図）",
    "",
    fence(source),
    "",
    "### 案 A（補足の無い map の図）",
    "",
    mapRange(source, args),
  ].join("\n");

const markdown = [
  "# map の範囲の外の mermaid のコードブロック",
  "",
  "同じ Mermaid を、今の描き方（mermaid の図）と案 A（補足の無い map の図）で並べた。記載するのは、どちらも言語 `mermaid` のコードブロックだけ。",
  "",
  pair(
    "flowchart",
    "front matter の `title` を図の枠のタイトルにする。ノードの文字・線のラベルは、押したまま動かすと選んでコピーできる。",
    FLOW,
    { title: FLOW_TITLE },
  ),
  "",
  pair(
    "sequenceDiagram",
    "拡大して図の余白を上へドラッグすると、案 A では参加者の行が表示する枠の上端に留まる。参加者のノードを押すと、その参加者のメッセージを強調する。",
    SEQUENCE,
  ),
  "",
  pair("classDiagram", "`click` の行の URL のクラスをリンクにする。", CLASS),
  "",
  "## gantt（map が描けない種類）",
  "",
  "今のまま mermaid の図で描く。案 A では、タスク名を押したまま動かすと選んでコピーできる。",
  "",
  fence(GANTT),
].join("\n");

mount(document.getElementById("doc"), { markdown });
