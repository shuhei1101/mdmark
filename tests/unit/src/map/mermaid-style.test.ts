import { expect, test } from "vitest";

/** Mermaid の色の指定の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMermaidStyle = () => import("../../../../src/map/mermaid-style.ts");

/** モック plain-mermaid-style の「style と classDef を持つ flowchart」の 2 行目からの行 */
const STYLED_LINES = [
  "A[要望を受ける] --> B{対応するか}",
  "B -->|する| C[計画へ記載する]",
  "B -->|しない| D[理由を返却する]",
  "B -->|保留| E[後で決める]",
  "style A fill:#f9f,stroke:#c3c",
  "classDef warn fill:#ffe08a,stroke:#b8860b",
  "class D warn",
  "E:::warn",
  "linkStyle 1 stroke:#d33",
];

// style・classDef・class・:::・linkStyle を読み取り、style を優先する（正常系）
test("test_read_mermaid_styles", async () => {
  // 準備
  const { readMermaidStyles } = await loadMermaidStyle();
  // 実行
  const styles = readMermaidStyles({
    lines: [...STYLED_LINES, "class A warn"],
    classTarget: "class",
  });
  // 検証
  expect(styles.nodes.A).toEqual({ fill: "#f9f", stroke: "#c3c" });
  expect(styles.nodes.D).toEqual({ fill: "#ffe08a", stroke: "#b8860b" });
  expect(styles.nodes.E).toEqual({ fill: "#ffe08a", stroke: "#b8860b" });
  expect(styles.wires[1]).toEqual({ stroke: "#d33" });
});

// 色でない属性と classDef を持たないクラスを当てず、default を既定にする（正常系）
test("test_read_mermaid_styles_when_ignored", async () => {
  // 準備
  const { readMermaidStyles } = await loadMermaidStyle();
  // 実行
  const styles = readMermaidStyles({
    lines: [
      "A --> B",
      "style A stroke-width:4px,stroke-dasharray: 5 5",
      "B:::unknown",
      "classDef default fill:#eee;",
      "linkStyle default stroke:#999",
    ],
    classTarget: "class",
  });
  // 検証
  expect(styles.nodes.A).toEqual({ fill: "#eee" });
  expect(styles.nodes.B).toEqual({ fill: "#eee" });
  expect(styles.defaultWire).toEqual({ stroke: "#999" });
});

// 明るい面は黒、暗い面は白、読み取れない色は undefined（正常系）
test("test_text_color_on", async () => {
  // 準備
  const { textColorOn } = await loadMermaidStyle();
  // 実行
  const colors = [
    "#f9f",
    "#ffe08a",
    "#333",
    "navy",
    "rgb(255, 255, 255)",
    "var(--x)",
  ].map((fill) => textColorOn(fill));
  // 検証
  expect(colors).toEqual([
    "#000000",
    "#000000",
    "#ffffff",
    "#ffffff",
    "#000000",
    undefined,
  ]);
});
