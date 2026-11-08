import { expect, test } from "vitest";

/** mermaid のソースの読み取りを読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadSource = (): Promise<
  typeof import("../../../src/mermaid-source.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../src/mermaid-source.ts",
      import.meta.url,
    ).href
  );

// front matter の title を取り出し、ほかの行が無ければ front matter ごと除く（正常系）
test("test_split_mermaid_title", async () => {
  // 準備
  const { splitMermaidTitle } = await loadSource();
  const source = "---\ntitle: 問い合わせの受付\n---\nflowchart LR\n  A --> B";
  // 実行
  const result = splitMermaidTitle(source);
  // 検証
  expect(result).toEqual({
    title: "問い合わせの受付",
    body: "flowchart LR\n  A --> B",
    kind: "flowchart",
  });
});

// title のほかの front matter の行は残す（正常系）
test("test_split_mermaid_title_when_other_keys", async () => {
  // 準備
  const { splitMermaidTitle } = await loadSource();
  const source =
    "---\ntitle: 受付\nconfig:\n  look: classic\n---\nflowchart LR";
  // 実行
  const result = splitMermaidTitle(source);
  // 検証
  expect(result.title).toBe("受付");
  expect(result.body).toBe("---\nconfig:\n  look: classic\n---\nflowchart LR");
  expect(result.kind).toBe("flowchart");
});

// front matter が無ければ accTitle の値を取り、行は残す（正常系）
test("test_split_mermaid_title_when_acc_title", async () => {
  // 準備
  const { splitMermaidTitle } = await loadSource();
  const source = "sequenceDiagram\n  accTitle: 文書を描く\n  A->>B: x";
  // 実行
  const result = splitMermaidTitle(source);
  // 検証
  expect(result).toEqual({
    title: "文書を描く",
    body: source,
    kind: "sequenceDiagram",
  });
});

// どちらも無ければ title を持たない（正常系）
test("test_split_mermaid_title_when_none", async () => {
  // 準備
  const { splitMermaidTitle } = await loadSource();
  // 実行
  const result = splitMermaidTitle("classDiagram\n  class A");
  // 検証
  expect(result.title).toBeUndefined();
  expect(result.kind).toBe("classDiagram");
});

// 表の単語は名前に、表に無い単語と継承した名前は 図 にする（正常系）
test("test_mermaid_kind_name", async () => {
  // 準備
  const { mermaidKindName } = await loadSource();
  // 実行
  const names = ["stateDiagram-v2", "journey", "constructor"].map(
    mermaidKindName,
  );
  // 検証
  expect(names).toEqual(["状態遷移図", "図", "図"]);
});
