import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import type {
  MdmarkIndex,
  MdmarkMatch,
  MdmarkMatches,
} from "../../../src/index.ts";

type Built = {
  collectMatches: (input: {
    index: MdmarkIndex;
    documents: Record<string, string>;
  }) => MdmarkMatches;
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** 用語 `ワークスペース`（別名 `WS`）と、別名 `公開関数` の文書 `api` を持つ索引 */
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    {
      id: "api",
      path: "api.md",
      title: "API",
      description: "公開関数の一覧",
      aliases: ["公開関数"],
    },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

/** `INDEX` の用語 `ワークスペース` に、やめた言い方 `作業場` を加えた索引 */
const AVOID_INDEX: MdmarkIndex = {
  ...INDEX,
  terms: (INDEX.terms ?? []).map((term) => ({ ...term, avoid: ["作業場"] })),
};

/** 用語 `ワークスペース` の参照先 */
const WS_TARGET = {
  kind: "term",
  id: "ws",
  title: "ワークスペース",
  description: "話し合いの記録を置くフォルダ",
};

/** 文書 `api` の参照先 */
const API_TARGET = {
  kind: "doc",
  id: "api",
  title: "API",
  description: "公開関数の一覧",
};

/** 箱の `name` に `{{語}}` を書いた、フロー図の定義の JSON */
function flowDefinition(name: string): string[] {
  return [
    "{",
    '  "title": "受け取り",',
    '  "scope": "範囲",',
    '  "updated": "2026-10-23",',
    '  "width": 520,',
    '  "height": 160,',
    '  "nodes": [',
    `    { "id": "recv", "kind": "script", "x": 20, "y": 48, "w": 140, "h": 64, "name": "${name}", "sub": "" }`,
    "  ],",
    '  "wires": []',
    "}",
  ];
}

/** 一致の行・始まり・終わりで本文を切り出した文字 */
function cut(
  body: string,
  match: Pick<MdmarkMatch, "line" | "start" | "end">,
): string {
  return (body.split("\n")[match.line - 1] ?? "").slice(match.start, match.end);
}

// 索引の用語・別名と文書の別名の一致を、参照先と本文の位置つきで返す（正常系）
test("test_normal", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const index = structuredClone(AVOID_INDEX);
  const guide = [
    "# ワークスペースの使い方",
    "",
    "ワークスペースを開き、WS を確かめ、公開関数を呼び、ワークスペースを閉じる。作業場は使わない。",
    "",
    "`ワークスペース` のコードと [ワークスペース](./ws.md) のリンク。",
    "",
  ].join("\n");
  const api = "# API\n\nワークスペースと公開関数を書く。\n";
  const documents = { "使い方/guide.md": guide, "api.md": api };
  const documentsBefore = structuredClone(documents);
  // 実行
  const matches = collectMatches({ index, documents });
  // 検証
  // 見出し・コード・リンクの文字は一致にならず、段落の 4 件が本文の頭からの順に並ぶ
  const inGuide = matches.byDocument.guide ?? [];
  expect(inGuide.map((match) => [match.kind, match.id, match.text])).toEqual([
    ["term", "ws", "ワークスペース"],
    ["term", "ws", "WS"],
    ["doc", "api", "公開関数"],
    ["term", "ws", "ワークスペース"],
  ]);
  expect(inGuide[0]).toEqual({
    ...WS_TARGET,
    text: "ワークスペース",
    line: 3,
    start: 0,
    end: 7,
  });
  expect(inGuide[2]).toEqual({
    ...API_TARGET,
    text: "公開関数",
    line: 3,
    start: 19,
    end: 23,
  });
  for (const match of inGuide) {
    expect(cut(guide, match)).toBe(match.text);
  }
  // 文書自身の別名 `公開関数` は一致にならない
  expect(matches.byDocument.api?.map((match) => match.id)).toEqual(["ws"]);
  // やめた言い方 `作業場` は byDocument に入らず、代わりの用語と位置つきで avoided に入る
  expect(matches.avoided.guide).toEqual([
    { ...WS_TARGET, text: "作業場", line: 3, start: 39, end: 42 },
  ]);
  expect(matches.avoided.api).toEqual([]);
  expect(matches.targets).toEqual([WS_TARGET, API_TARGET]);
  expect(index).toEqual(AVOID_INDEX);
  expect(documents).toEqual(documentsBefore);
});

// ほかの文書の用語集の表の用語を glossary の参照先として返す（正常系）
test("test_normal_when_glossary_table", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "glossary", path: "用語集.md", title: "用語集" },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
  };
  const documents = {
    "用語集.md": [
      "<!-- glossary: term=用語 aliases=別名 meaning=意味 -->",
      "",
      "| 用語 | 別名 | 意味 |",
      "| --- | --- | --- |",
      "| 印 | マーク | HTML コメントで書く指定 |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
    "使い方/guide.md": "# 使い方\n\n印を付け、印刷する。\n",
  };
  // 実行
  const matches = collectMatches({ index, documents });
  // 検証
  // `印刷` は語の区切りが 1 語なので、その中の `印` は一致にならない
  expect(matches.byDocument.guide).toEqual([
    {
      kind: "glossary",
      id: "glossary:glossary:印",
      title: "印",
      description: "HTML コメントで書く指定",
      text: "印",
      line: 3,
      start: 0,
      end: 1,
    },
  ]);
  // 表の中の `印` は、表を持つ文書の一致にならない
  expect(matches.byDocument.glossary).toEqual([]);
});

// 埋め込んだ HTML の文字と、図の部品の定義の {{語}} も照合し、本文の位置へ戻す（正常系）
test("test_normal_when_embedded_html_and_diagram", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const guide = [
    "# 使い方",
    "",
    "<!-- html -->",
    "",
    "```html",
    "<p>ワークスペースを開く。</p>",
    '<a href="#">ワークスペース</a>',
    "<mdmark-flow>",
    ...flowDefinition("{{ワークスペース}}"),
    "</mdmark-flow>",
    "```",
    "",
    "<!-- /html -->",
    "",
    "<!-- flow -->",
    "",
    "```json",
    ...flowDefinition("{{ワークスペース}} と {{公開関数}}"),
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
  // 実行
  const matches = collectMatches({
    index: INDEX,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  // HTML の段落・`<mdmark-flow>` の箱・`<!-- flow -->` の箱の 3 件で、リンクの文字と文書の別名の `{{公開関数}}` は無い
  const inGuide = matches.byDocument.guide ?? [];
  expect(inGuide.map((match) => [match.id, match.text])).toEqual([
    ["ws", "ワークスペース"],
    ["ws", "ワークスペース"],
    ["ws", "ワークスペース"],
  ]);
  expect(inGuide.map((match) => match.line)).toEqual([6, 16, 35]);
  for (const match of inGuide) {
    expect(cut(guide, match)).toBe(match.text);
  }
  expect(matches.targets).toEqual([WS_TARGET]);
});

// 実体参照・エスケープ・強調の後ろの一致も、本文に書いたままの範囲を返す（正常系）
test("test_normal_when_escaped_text", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const index: MdmarkIndex = {
    ...INDEX,
    terms: [
      ...(INDEX.terms ?? []),
      { id: "ab", term: "A&B", meaning: "A と B の組" },
    ],
  };
  const guide = [
    "# 使い方",
    "",
    "\\*記号\\* の後ろのワークスペース",
    "",
    "&amp; の後ろの WS と A&amp;B",
    "",
    "**ワークスペース** と *WS*",
    "",
    "> 引用の中の WS",
    "",
    "| 項目 | 内容 |",
    "| --- | --- |",
    "| WS | ワークスペース |",
    "",
  ].join("\n");
  // 実行
  const matches = collectMatches({
    index,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  const inGuide = matches.byDocument.guide ?? [];
  expect(inGuide.map((match) => match.text)).toEqual([
    "ワークスペース",
    "WS",
    "A&B",
    "ワークスペース",
    "WS",
    "WS",
    "WS",
    "ワークスペース",
  ]);
  // 本文に書いたままの範囲を切り出すと、実体参照を戻したときに `text` と同じになる
  for (const match of inGuide) {
    expect(cut(guide, match).replaceAll("&amp;", "&")).toBe(match.text);
  }
  const ab = inGuide.find((match) => match.id === "ab");
  expect(ab && cut(guide, ab)).toBe("A&amp;B");
  // 表の 2 つのセルの一致は、同じ行のそれぞれのセルの位置を指す
  const cells = inGuide.filter((match) => match.line === 13);
  expect(cells.map((match) => [match.text, match.start, match.end])).toEqual([
    ["WS", 2, 4],
    ["ワークスペース", 7, 14],
  ]);
});

// 文書の印でオフにした機能の種類の一致を返さない（正常系）
test("test_normal_when_feature_off", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const index: MdmarkIndex = {
    ...AVOID_INDEX,
    docs: [...INDEX.docs, { id: "memo", path: "memo.md", title: "メモ" }],
  };
  const paragraph = "ワークスペースと公開関数と作業場を使う。";
  const guide = `<!-- features: -glossary -->\n\n${paragraph}\n`;
  const memo = `<!-- features: -glossary -backlinks -->\n\n${paragraph}\n`;
  // 実行
  const matches = collectMatches({
    index,
    documents: { "使い方/guide.md": guide, "memo.md": memo },
  });
  // 検証
  // glossary がオフの guide は、用語を返さず文書の別名だけを返す
  expect(matches.byDocument.guide).toEqual([
    { ...API_TARGET, text: "公開関数", line: 3, start: 8, end: 12 },
  ]);
  // 両方がオフの memo は何も返さない
  expect(matches.byDocument.memo).toEqual([]);
  expect(matches.targets).toEqual([API_TARGET]);
  // glossary がオフの文書は、やめた言い方も返さない
  expect(matches.avoided.guide).toEqual([]);
  expect(matches.avoided.memo).toEqual([]);
});

// 本文に出たやめた言い方を、代わりの用語と本文の位置つきで avoided に返す（正常系）
test("test_normal_when_avoided_term", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const guide = [
    "# 作業場の使い方",
    "",
    "作業場を開き、作業場を閉じ、ワークスペースを確かめる。",
    "",
    "`作業場` のコードは対象外。",
    "",
    "## 後片付け",
    "",
    "作業場を片付ける。",
    "",
    "<!-- html -->",
    "",
    "```html",
    "<p>作業場を開く。</p>",
    "```",
    "",
    "<!-- /html -->",
    "",
    "<!-- flow -->",
    "",
    "```json",
    ...flowDefinition("{{作業場}}"),
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
  const documents = {
    "使い方/guide.md": guide,
    "api.md": "# API\n\nワークスペースを使う。\n",
  };
  // 実行
  const matches = collectMatches({ index: AVOID_INDEX, documents });
  // 検証
  // 1 つ目のセクションの 2 件・2 つ目のセクションの 1 件・埋め込んだ HTML の段落の 1 件が本文の頭からの順に並ぶ
  const avoided = matches.avoided.guide ?? [];
  expect(avoided.map((match) => [match.line, match.start, match.end])).toEqual([
    [3, 0, 3],
    [3, 7, 10],
    [9, 0, 3],
    [14, 3, 6],
  ]);
  for (const match of avoided) {
    expect(match).toMatchObject({ ...WS_TARGET, text: "作業場" });
    expect(cut(guide, match)).toBe("作業場");
  }
  // byDocument はやめた言い方を一致にしない
  expect(matches.byDocument.guide?.map((match) => match.text)).toEqual([
    "ワークスペース",
  ]);
  expect(matches.avoided.api).toEqual([]);
  expect(matches.targets).toEqual([WS_TARGET]);
});

// 全角と半角・大文字と小文字だけが違う本文の語も一致にし、位置は正規化する前の本文を指す（正常系）
test("test_normal_when_notation_differs", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  const index: MdmarkIndex = {
    ...INDEX,
    terms: (INDEX.terms ?? []).map((term) => ({
      ...term,
      avoid: ["workplace"],
    })),
  };
  // 1 行目の半角カナ `ﾜｰｸｽﾍﾟｰｽ`（8 文字）は正規化すると 7 文字になり、正規化した位置と本文の位置がずれる
  const guide = "ﾜｰｸｽﾍﾟｰｽとＷＳ\n\nws と WorkPlace\n";
  // 実行
  const matches = collectMatches({
    index,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  const found = matches.byDocument.guide ?? [];
  expect(found.map((match) => cut(guide, match))).toEqual([
    "ﾜｰｸｽﾍﾟｰｽ",
    "ＷＳ",
    "ws",
  ]);
  expect(found.map((match) => [match.line, match.start, match.end])).toEqual([
    [1, 0, 8],
    [1, 9, 11],
    [3, 0, 2],
  ]);
  for (const match of found) {
    expect(match).toMatchObject({ ...WS_TARGET });
  }
  // `text` は索引に記載した表記
  expect(found.map((match) => match.text)).toEqual([
    "ワークスペース",
    "WS",
    "WS",
  ]);
  const avoided = matches.avoided.guide ?? [];
  expect(avoided).toHaveLength(1);
  expect(avoided[0]).toMatchObject({
    ...WS_TARGET,
    text: "workplace",
    line: 3,
  });
  expect(cut(guide, avoided[0] as MdmarkMatch)).toBe("WorkPlace");
  expect(matches.targets).toEqual([WS_TARGET]);
});

// Schema に合わない用語・文書を除いて照合し、例外を投げない（正常系）
test("test_normal_when_invalid_index", async () => {
  // 準備
  const { collectMatches } = await loadBuilt();
  // `meaning` を持たない用語 `印` と、`path` を持たない文書 `broken` を足した索引
  const index = {
    schema: 1,
    docs: [
      ...INDEX.docs,
      { id: "broken", title: "壊れた", aliases: ["壊れた文書"] },
    ],
    terms: [...(INDEX.terms ?? []), { id: "mark", term: "印" }],
  } as unknown as MdmarkIndex;
  const documents = {
    "使い方/guide.md": "# 使い方\n\nWS・印・壊れた文書を並べる。\n",
  };
  // 実行
  let matches: MdmarkMatches | undefined;
  expect(() => {
    matches = collectMatches({ index, documents });
  }).not.toThrow();
  // 検証
  expect(matches?.byDocument.guide?.map((match) => match.text)).toEqual(["WS"]);
  expect(matches?.targets.map((target) => target.id)).toEqual(["ws"]);
});
