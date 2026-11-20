// mermaid のライブラリへ戻している mermaid のコードブロック（設定の行・外観を指定する行を持つ）を、今の描き方（mermaid の図）と、
// map の図で描く案 A（指定を適用しない）・案 B（style・classDef・::: の塗りと線の色をノードに、linkStyle の色を線に適用し、文字の色を color: か塗りとのコントラストで決める）で並べる。
// 案の図は、設定の行と外観を指定する行を除いた同じ Mermaid を補足の無い map の範囲で囲み、配布物の mount で描く。案 B は描いた後にノードへ色を適用する（モックだけの再現）

import { mount } from "../../../../../dist/index.js";

const STYLED = `flowchart LR
  A[要望を受ける] --> B{対応するか}
  B -->|する| C[計画へ記載する]
  B -->|しない| D[理由を返却する]
  B -->|保留| E[後で決める]
  style A fill:#f9f,stroke:#c3c
  classDef warn fill:#ffe08a,stroke:#b8860b
  class D warn
  E:::warn
  linkStyle 1 stroke:#d33`;

const INIT = `%%{init: {"theme": "forest"}}%%
flowchart LR
  A[文書を開く] --> B[図を描く]
  B --> C[読者が読む]`;

const CONFIG = `---
title: 文書を読む流れ
config:
  theme: forest
---
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
    .filter((line) => line.trim() !== "")
    .join("\n");

/** front matter の config を除く（title は残す） */
const stripConfig = (source) => source.replace(/\nconfig:\n(?:  .*\n)+/, "\n");

const fence = (source) => ["```mermaid", source, "```"].join("\n");
const mapRange = (source, title) =>
  [`<!-- map: ${JSON.stringify({ title })} -->`, "", fence(stripForMap(stripConfig(source))), "", "<!-- /map -->"].join("\n");

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
      ? ["", "### 案 B（map の図。style・classDef・::: の色をノードに、linkStyle の色を線に適用する）", "", mapRange(source, "案 B")]
      : []),
  ].join("\n");

const markdown = [
  "# mermaid のライブラリへ戻している mermaid のコードブロック",
  "",
  "設定の行（`%%{init}`）・外観を指定する行（`style`・`classDef`・`class`・`::icon`・`:::`）・端に丸を付ける線（`--o`）を持つ mermaid のコードブロックを、今の描き方（mermaid の図）と map の図で並べた。",
  "",
  trio(
    "style と classDef を持つ flowchart",
    "案 A はノードと線を map の配色で描く。案 B は `style A` の塗りと線の色をノード A に、`classDef warn` の色を `class D warn` のノード D と `E:::warn` のノード E に、`linkStyle 1` の色を 2 本目の線（する）に適用する。文字の色は、`color:` の指定があればその色、無ければ塗りに対してコントラスト比 4.5:1 以上になる黒か白にする。上の操作列で暗い配色に切り替えて確認できる。",
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
  trio(
    "front matter の config を持つ flowchart",
    "front matter の `config` は、案 A・案 B のどちらでも map の図に適用しない。front matter の `title` は図の枠のタイトルにする（このモックの map の図は範囲の引数のタイトルで描いている）。",
    CONFIG,
    false,
  ),
  "",
  trio("端に丸を付ける線を持つ flowchart", "案では、作成者から文書への線の文書の側の端を丸で描く（このモックの map の図は今の配布物で描いたため、端を矢印のまま描いている）。", CIRCLE, false),
  "",
  trio("::icon と ::: を持つ mindmap", "`::icon(fa fa-book)` と `:::urgent` は、案 A・案 B のどちらでも map の図に適用しない。", MINDMAP, false),
].join("\n");

/** 案 B: style・classDef・::: で指定した塗りと線の色を map のノードへ、linkStyle の色を線へ適用する（モックだけの再現） */
const PLAN_B_NODES = { A: ["#f9f", "#c3c"], D: ["#ffe08a", "#b8860b"], E: ["#ffe08a", "#b8860b"] };
const PLAN_B_WIRE_INDEX = 1;
const PLAN_B_WIRE_COLOR = "#d33";

/** 塗りの色の相対輝度（WCAG 2） */
const luminance = (hex) => {
  const full = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** 塗りに対してコントラスト比の高い方の文字の色（黒か白） */
const textOn = (fill) => {
  const l = luminance(fill);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? "#111111" : "#ffffff";
};

const applyPlanB = (root) => {
  // 範囲の引数のタイトルが「案 B」の map の図
  const range = [...root.querySelectorAll(".mdmark-map")].find((el) =>
    (el.getAttribute("data-map-args") ?? "").includes("案 B"),
  );
  if (!range) return;
  range.dataset.mockPlan = "b";
  for (const [id, [fill, stroke]] of Object.entries(PLAN_B_NODES)) {
    for (const node of range.querySelectorAll(`[data-node="${id}"]`)) {
      node.style.setProperty("--mock-node-fill", fill);
      node.style.setProperty("--mock-node-stroke", stroke);
      node.style.setProperty("--mock-node-text", textOn(fill));
      node.classList.add("mock-styled-node");
    }
  }
  const wires = [...new Set([...range.querySelectorAll("path.mdmark-diagram-wire[data-wire]")].map((el) => el.dataset.wire))];
  const target = wires[PLAN_B_WIRE_INDEX];
  for (const wire of range.querySelectorAll(`path.mdmark-diagram-wire[data-wire="${target}"]`)) {
    if (wire.style.stroke !== PLAN_B_WIRE_COLOR) wire.style.stroke = PLAN_B_WIRE_COLOR;
  }
};

/** モックの操作列: 明るい配色と暗い配色を切り替える */
for (const button of document.querySelectorAll("[data-mock-scheme]")) {
  button.addEventListener("click", () => {
    const dark = button.dataset.mockScheme === "dark";
    document.body.classList.toggle("mdmark-theme-dark", dark);
    document.body.classList.toggle("mdmark-theme-light", !dark);
    for (const other of document.querySelectorAll("[data-mock-scheme]")) {
      other.setAttribute("aria-pressed", String(other === button));
    }
  });
}

const root = document.getElementById("doc");
mount(root, { markdown });
const observer = new MutationObserver(() => {
  applyPlanB(root);
});
observer.observe(root, { childList: true, subtree: true });
