// mermaid のライブラリへ戻している mermaid のコードブロック（設定の行・外観を指定する行を持つ）を、今の描き方（mermaid の図）と、
// map の図で描く案 A（指定を適用しない）・案 B（style・classDef の塗りと線の色をノードに適用する）で並べる。
// 案の図は、設定の行と外観を指定する行を除いた同じ Mermaid を補足の無い map の範囲で囲み、配布物の mount で描く。案 B は描いた後にノードへ色を適用する（モックだけの再現）

import { mount } from "../../../../../dist/index.js";

const STYLED = `flowchart LR
  A[要望を受ける] --> B{対応するか}
  B -->|する| C[計画へ記載する]
  B -->|しない| D[理由を返却する]
  style A fill:#f9f,stroke:#c3c
  classDef warn fill:#ffe08a,stroke:#b8860b
  class D warn`;

const INIT = `%%{init: {"theme": "forest"}}%%
flowchart LR
  A[文書を開く] --> B[図を描く]
  B --> C[読者が読む]`;

const CIRCLE = `flowchart LR
  A[作成者] --o B[文書]
  B --> C[読者]`;

const MINDMAP = `mindmap
  root((mdmark))
    記法
      ::icon(fa fa-book)
      表
      注意書き
    図:::urgent
      map
      mermaid`;

/** map で描く案の Mermaid: 設定の行と外観を指定する行を除く（モックだけの読み替え。案では map がこれらの行を読み取る） */
const stripForMap = (source) =>
  source
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(%%\{|style |classDef |class |linkStyle |::icon\()/.test(line),
    )
    .map((line) => line.replace(/:::\w+/g, "").replace(" --o ", " --> "))
    .join("\n");

const fence = (source) => ["```mermaid", source, "```"].join("\n");
const mapRange = (source, title) =>
  [`<!-- map: ${JSON.stringify({ title })} -->`, "", fence(stripForMap(source)), "", "<!-- /map -->"].join("\n");

const trio = (heading, lead, source, withB) =>
  [
    `## ${heading}`,
    "",
    lead,
    "",
    "### 今（mermaid の図）",
    "",
    fence(source),
    "",
    "### 案 A（map の図。指定を適用しない）",
    "",
    mapRange(source, "案 A"),
    ...(withB
      ? ["", "### 案 B（map の図。style・classDef の塗りと線の色を適用する）", "", mapRange(source, "案 B")]
      : []),
  ].join("\n");

const markdown = [
  "# mermaid のライブラリへ戻している mermaid のコードブロック",
  "",
  "設定の行（`%%{init}`）・外観を指定する行（`style`・`classDef`・`class`・`::icon`・`:::`）・端に丸を付ける線（`--o`）を持つ mermaid のコードブロックを、今の描き方（mermaid の図）と map の図で並べた。",
  "",
  trio(
    "style と classDef を持つ flowchart",
    "案 A はノードを map の配色で描く。案 B は `style A` の塗りと線の色をノード A に、`classDef warn` の色をノード D に適用する。",
    STYLED,
    true,
  ),
  "",
  trio(
    "%%{init} の設定の行を持つ flowchart",
    "テーマの指定（`forest`）は、案 A・案 B のどちらでも map の図に適用しない。",
    INIT,
    false,
  ),
  "",
  trio("端に丸を付ける線を持つ flowchart", "案では、作成者から文書への線の文書の側の端を丸で描く（このモックの map の図は今の配布物で描いたため、端を矢印のまま描いている）。", CIRCLE, false),
  "",
  trio("::icon と ::: を持つ mindmap", "`::icon(fa fa-book)` と `:::urgent` は、案 A・案 B のどちらでも map の図に適用しない。", MINDMAP, false),
].join("\n");

/** 案 B: style・classDef で指定した塗りと線の色を、map のノードへ適用する（モックだけの再現） */
const PLAN_B_COLORS = { A: ["#f9f", "#c3c"], D: ["#ffe08a", "#b8860b"] };
const applyPlanB = (root) => {
  // 範囲の引数のタイトルが「案 B」の map の図
  const range = [...root.querySelectorAll(".mdmark-map")].find((el) =>
    (el.getAttribute("data-map-args") ?? "").includes("案 B"),
  );
  if (range) {
    range.dataset.mockPlan = "b";
    for (const [id, [fill, stroke]] of Object.entries(PLAN_B_COLORS)) {
      for (const node of range.querySelectorAll(`[data-node="${id}"]`)) {
        node.style.setProperty("--mock-node-fill", fill);
        node.style.setProperty("--mock-node-stroke", stroke);
        node.classList.add("mock-styled-node");
      }
    }
  }
};

const root = document.getElementById("doc");
mount(root, { markdown });
const observer = new MutationObserver(() => {
  applyPlanB(root);
});
observer.observe(root, { childList: true, subtree: true });
