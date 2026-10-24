import { expect, test } from "@playwright/test";
import type { MdmarkIndex, MdmarkMatch } from "../../../src/index.ts";
import {
  buildDistRoot,
  collectMatchesInNode,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 用語 `ワークスペース`（別名 `WS`）と、別名 `公開関数` の文書 `api`、文書 `guide` を持つ索引
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

// `INDEX` の用語 `ワークスペース` に、やめた言い方 `作業場` を加えた索引
const AVOID_INDEX: MdmarkIndex = {
  ...INDEX,
  terms: (INDEX.terms ?? []).map((term) => ({ ...term, avoid: ["作業場"] })),
};

// 用語 `ワークスペース` の参照先
const WS_TARGET = {
  kind: "term",
  id: "ws",
  title: "ワークスペース",
  description: "話し合いの記録を置くフォルダ",
};

// 文書 `api` の参照先
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
function cut(body: string, match: MdmarkMatch): string {
  return (body.split("\n")[match.line - 1] ?? "").slice(match.start, match.end);
}

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 本文の用語・文書の別名の一致を、参照先と位置つきで返し、見出し・コード・リンクの文字は一致にしない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const index = structuredClone(INDEX);
  const guide = [
    "# ワークスペース",
    "",
    "ワークスペースを開き、WS を確かめ、ワークスペースを閉じる。",
    "",
    "`ワークスペース` のコードと [ワークスペース](./ws.md) のリンク。",
    "",
    "## 呼び出し",
    "",
    "公開関数を呼ぶ。",
    "",
  ].join("\n");
  const documents = { "使い方/guide.md": guide };
  // 実行
  const matches = await collectMatchesInNode(builtRoot, { index, documents });
  // 検証
  // 見出し・コード・リンクの文字は一覧に無く、2 つの節の段落の 4 件が本文の頭からの順に並ぶ
  const inGuide = matches.byDocument.guide ?? [];
  expect(inGuide.map((match) => [match.kind, match.id, match.text])).toEqual([
    ["term", "ws", "ワークスペース"],
    ["term", "ws", "WS"],
    ["term", "ws", "ワークスペース"],
    ["doc", "api", "公開関数"],
  ]);
  expect(inGuide[0]).toEqual({
    ...WS_TARGET,
    text: "ワークスペース",
    line: 3,
    start: 0,
    end: 7,
  });
  expect(inGuide[3]).toEqual({
    ...API_TARGET,
    text: "公開関数",
    line: 9,
    start: 0,
    end: 4,
  });
  // 各要素の位置で本文を切り出した文字が、一致した文字と同じ
  for (const match of inGuide) {
    expect(cut(guide, match)).toBe(match.text);
  }
  expect(matches.targets).toEqual([WS_TARGET, API_TARGET]);
  // 渡した索引と本文は書き換わらない
  expect(index).toEqual(INDEX);
  expect(documents).toEqual({ "使い方/guide.md": guide });
});

// 複数の文書に同じ用語が出ても、文書ごとに並べ、まとめた一覧には 1 回だけ入れる（正常シナリオ（複数の文書に同じ参照先））
test("test_normal_when_same_target_in_documents", async () => {
  // 準備
  const documents = {
    "使い方/guide.md": "# 使い方\n\nワークスペースを開く。\n",
    "api.md": "# API\n\nワークスペースと自身の別名 公開関数 を書く。\n",
  };
  // 実行
  const matches = await collectMatchesInNode(builtRoot, {
    index: INDEX,
    documents,
  });
  // 検証
  expect(matches.byDocument.guide?.map((match) => match.id)).toEqual(["ws"]);
  // `api` は自身の別名 `公開関数` を一致にしない
  expect(matches.byDocument.api?.map((match) => match.id)).toEqual(["ws"]);
  expect(matches.targets).toEqual([WS_TARGET]);
});

// ほかの文書の用語集の表の用語を一致にし、別の語の一部と表の中は一致にしない（正常シナリオ（用語集の表の用語））
test("test_normal_when_glossary_table", async () => {
  // 準備
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "glossary", path: "用語集.md", title: "用語集" },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
  };
  const documents = {
    "用語集.md": [
      "<!-- glossary: term=用語 meaning=意味 -->",
      "",
      "| 用語 | 意味 |",
      "| --- | --- |",
      "| 印 | HTML コメントで書く指定 |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
    "使い方/guide.md": "# 使い方\n\n印を付け、印刷する。\n",
  };
  // 実行
  const matches = await collectMatchesInNode(builtRoot, { index, documents });
  // 検証
  // `印刷` の `印` は一致にならず、`印` の 1 件だけが用語集の表の用語として返る
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

// 文書の印でオフにした機能の種類の一致を返さない（正常シナリオ（文書の印で機能がオフ））
test("test_normal_when_feature_off", async () => {
  // 準備
  const index: MdmarkIndex = {
    ...AVOID_INDEX,
    docs: [...INDEX.docs, { id: "memo", path: "memo.md", title: "メモ" }],
  };
  const paragraph = "ワークスペースと公開関数と作業場を使う。";
  const documents = {
    "使い方/guide.md": `<!-- features: -glossary -->\n\n${paragraph}\n`,
    "memo.md": `<!-- features: -glossary -backlinks -->\n\n${paragraph}\n`,
  };
  // 実行
  const matches = await collectMatchesInNode(builtRoot, { index, documents });
  // 検証
  // glossary がオフの guide は、用語を返さず文書の別名だけを返す
  expect(matches.byDocument.guide).toEqual([
    { ...API_TARGET, text: "公開関数", line: 3, start: 8, end: 12 },
  ]);
  // 両方がオフの memo は空の一覧
  expect(matches.byDocument.memo).toEqual([]);
  expect(matches.targets).toEqual([API_TARGET]);
  // glossary がオフの文書は、やめた言い方の一覧も空
  expect(matches.avoided.guide).toEqual([]);
  expect(matches.avoided.memo).toEqual([]);
});

// 本文に出たやめた言い方を、代わりの用語と本文の位置つきで返す（正常シナリオ（やめた言い方が本文に出る））
test("test_normal_when_avoided_term", async () => {
  // 準備
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
  ].join("\n");
  // 実行
  const matches = await collectMatchesInNode(builtRoot, {
    index: AVOID_INDEX,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  // 1 つ目の節の 2 件と 2 つ目の節の 1 件が出現の全てとして本文の頭からの順に並び、見出し・行内のコードの分は無い
  const avoided = matches.avoided.guide ?? [];
  expect(avoided.map((match) => [match.line, match.start, match.end])).toEqual([
    [3, 0, 3],
    [3, 7, 10],
    [9, 0, 3],
  ]);
  // 代わりの用語は索引の用語 `ws`
  for (const match of avoided) {
    expect(match).toMatchObject({ ...WS_TARGET, text: "作業場" });
    expect(cut(guide, match)).toBe("作業場");
  }
  // 参照の一覧は `ワークスペース` だけで、`作業場` を持たない
  expect(matches.byDocument.guide?.map((match) => match.text)).toEqual([
    "ワークスペース",
  ]);
  expect(matches.targets).toEqual([WS_TARGET]);
});

// 埋め込んだ HTML の文字と図の部品の {{語}} も照合し、図の部品では用語だけを一致にする（正常シナリオ（埋め込んだ HTML と図の部品の用語））
test("test_normal_when_embedded_html_and_diagram", async () => {
  // 準備
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
  const matches = await collectMatchesInNode(builtRoot, {
    index: INDEX,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  // HTML の段落・`<mdmark-flow>` の箱・`<!-- flow -->` の箱の 3 件が `ws` で、リンクの文字と図の箱の `{{公開関数}}` は無い
  const inGuide = matches.byDocument.guide ?? [];
  expect(inGuide.map((match) => [match.id, match.text, match.line])).toEqual([
    ["ws", "ワークスペース", 6],
    ["ws", "ワークスペース", 16],
    ["ws", "ワークスペース", 35],
  ]);
  for (const match of inGuide) {
    expect(cut(guide, match)).toBe(match.text);
  }
});

// 全角と半角・大文字と小文字だけが違う語も一致にし、位置は正規化する前の本文を指す（正常シナリオ（全角と半角・大文字と小文字だけが違う語））
test("test_normal_when_width_and_case_differ", async () => {
  // 準備
  const index: MdmarkIndex = {
    ...INDEX,
    terms: (INDEX.terms ?? []).map((term) => ({
      ...term,
      avoid: ["workplace"],
    })),
  };
  // 1 行目の半角カナ `ﾜｰｸｽﾍﾟｰｽ`（8 文字）は正規化すると 7 文字になる
  const guide = "ﾜｰｸｽﾍﾟｰｽとＷＳ\nws と WorkPlace\n";
  // 実行
  const matches = await collectMatchesInNode(builtRoot, {
    index,
    documents: { "使い方/guide.md": guide },
  });
  // 検証
  const inGuide = matches.byDocument.guide ?? [];
  expect(
    inGuide.map((match) => [match.kind, match.id, cut(guide, match)]),
  ).toEqual([
    ["term", "ws", "ﾜｰｸｽﾍﾟｰｽ"],
    ["term", "ws", "ＷＳ"],
    ["term", "ws", "ws"],
  ]);
  expect(inGuide.map((match) => [match.line, match.start, match.end])).toEqual([
    [1, 0, 8],
    [1, 9, 11],
    [2, 0, 2],
  ]);
  const avoided = matches.avoided.guide ?? [];
  expect(avoided).toHaveLength(1);
  expect(avoided[0]).toMatchObject({
    kind: "term",
    id: "ws",
    title: "ワークスペース",
    text: "workplace",
  });
  expect(cut(guide, avoided[0] as MdmarkMatch)).toBe("WorkPlace");
  expect(matches.targets).toEqual([WS_TARGET]);
});
